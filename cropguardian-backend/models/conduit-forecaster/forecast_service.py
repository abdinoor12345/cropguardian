"""
forecast_service.py
====================
Loads the model trained by prepare_and_train.py (via Adaption AutoScientist),
predicts next-hour telemetry from the last 3 hours of Conduit readings, and
runs that prediction through your existing deterministic rule engine
(rules.py) to produce a *predictive* agronomic assessment -- e.g. "fungal
risk conditions likely in the next hour" instead of only "right now".

This does NOT call a hosted Adaption inference endpoint -- AutoScientist
exports weights for you to deploy yourself (see their docs: "the weights
are yours to download and deploy anywhere"). So this module:

  1. Downloads the trained weights once (cached locally).
  2. Loads them with transformers for local inference.
  3. Parses the model's forecast text back into a RawConduitStream.
  4. Reuses evaluate_agronomic_rules() unchanged on the predicted reading.

Install:
    pip install adaption transformers torch accelerate

Env vars:
    ADAPTION_API_KEY   -- required to download the trained model
    AUTOSCIENTIST_RUN_ID -- the run id returned when you launched training
"""

import os
import re
import functools
from datetime import datetime, timedelta
from typing import List, Optional

from schemas import RawConduitStream, AgronomicAssessment
from rules import evaluate_agronomic_rules

MODEL_DIR = os.getenv("FORECAST_MODEL_DIR", "./models/conduit-forecaster")
RUN_ID = os.getenv("AUTOSCIENTIST_RUN_ID", "")


# ---------------------------------------------------------------------
# Model loading (cached -- only downloads / loads into memory once)
# ---------------------------------------------------------------------
@functools.lru_cache(maxsize=1)
def _load_model():
    """Downloads (if needed) and loads the trained forecaster. Cached so
    this only happens once per process, not once per request."""
    from adaption import Adaption

    if not os.path.isdir(MODEL_DIR) or not os.listdir(MODEL_DIR):
        if not RUN_ID:
            raise RuntimeError(
                "No local model found at FORECAST_MODEL_DIR and no "
                "AUTOSCIENTIST_RUN_ID set to download one."
            )
        client = Adaption(api_key=os.environ["ADAPTION_API_KEY"])
        os.makedirs(MODEL_DIR, exist_ok=True)
        client.autoscientist.download(RUN_ID, path=MODEL_DIR)

    # Imported lazily so the rest of the app works even if torch/transformers
    # aren't installed yet -- only this function needs them.
    from transformers import AutoModelForCausalLM, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
    model = AutoModelForCausalLM.from_pretrained(MODEL_DIR)
    model.eval()
    return tokenizer, model


# ---------------------------------------------------------------------
# Prompt construction -- must match prepare_and_train.py's format exactly
# ---------------------------------------------------------------------
def _build_forecast_prompt(history: List[RawConduitStream]) -> str:
    """history: last 3 hourly RawConduitStream readings, oldest first."""
    ts_now = history[-1].timestamp
    context_lines = "; ".join(
        f"{r.timestamp.strftime('%H:%M')} temp={r.sht_temperature}C "
        f"hum={r.sht_humidity}% press={r.barometric_pressure}hPa "
        f"wind={r.wind_speed}m/s wbgt={r.wbgt_temperature}C "
        f"rain={r.daily_rain_total_mm}mm"
        for r in history
    )
    return (
        f"Location: JKUAT Conduit station. Current time: {ts_now.strftime('%Y-%m-%d %H:%M')}.\n"
        f"Readings for the past 3 hours: {context_lines}.\n"
        f"Forecast the conditions for the next hour."
    )


# ---------------------------------------------------------------------
# Output parsing -- pulls numbers back out of the model's generated text.
# Keep this regex in sync with the completion format in prepare_and_train.py.
# ---------------------------------------------------------------------
_FIELD_PATTERN = re.compile(
    r"temp=([\d.\-]+)C.*?humidity=([\d.\-]+)%.*?pressure=([\d.\-]+)hPa.*?"
    r"wind=([\d.\-]+)m/s.*?wbgt=([\d.\-]+)C.*?rain=([\d.\-]+)mm",
    re.DOTALL,
)


def _parse_forecast(text: str, station_id: str, base_time: datetime) -> Optional[RawConduitStream]:
    match = _FIELD_PATTERN.search(text)
    if not match:
        return None
    temp, humidity, pressure, wind, wbgt, rain = (float(g) for g in match.groups())
    return RawConduitStream(
        station_id=station_id,
        timestamp=base_time + timedelta(hours=1),
        sht_temperature=temp,
        wbgt_temperature=wbgt,
        sht_humidity=humidity,
        instant_rain_mm=0.0,       # not modeled -- treat forecast as a running total delta instead
        daily_rain_total_mm=rain,
        solar_irradiance=0.0,      # not part of the forecast target; omitted from rule scoring
        barometric_pressure=pressure,
        wind_speed=wind,
    )


# ---------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------
def generate_predictive_assessment(
    history: List[RawConduitStream],
) -> "PredictiveAssessment":
    """
    history: the last 3 hourly RawConduitStream readings for one station,
    oldest first (fetch these from your existing /telemetry/current-style
    Conduit call, resampled to hourly -- see NOTE below).

    Returns both the raw forecasted reading and the agronomic assessment
    computed on it, so the caller can show "predicted for 14:00: ..." and
    "predicted risk: ..." side by side with the current-conditions version.
    """
    if len(history) < 3:
        raise ValueError("Need at least 3 hourly readings to forecast from.")

    tokenizer, model = _load_model()
    prompt = _build_forecast_prompt(history[-3:])

    inputs = tokenizer(prompt, return_tensors="pt")
    output_ids = model.generate(
        **inputs,
        max_new_tokens=80,
        do_sample=False,  # deterministic output -- you want the same forecast twice, not a sampled one
    )
    generated_text = tokenizer.decode(
        output_ids[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True
    )

    predicted = _parse_forecast(generated_text, history[-1].station_id, history[-1].timestamp)
    if predicted is None:
        raise RuntimeError(f"Could not parse model output: {generated_text!r}")

    predicted_assessment = evaluate_agronomic_rules(predicted)

    return PredictiveAssessment(
        forecast_for=predicted.timestamp,
        predicted_telemetry=predicted,
        predicted_assessment=predicted_assessment,
        raw_model_output=generated_text,
    )


# ---------------------------------------------------------------------
# Response schema -- add this to schemas.py alongside your existing models
# ---------------------------------------------------------------------
from pydantic import BaseModel


class PredictiveAssessment(BaseModel):
    forecast_for: datetime
    predicted_telemetry: RawConduitStream
    predicted_assessment: AgronomicAssessment
    raw_model_output: str
    