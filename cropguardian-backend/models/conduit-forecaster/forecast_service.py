"""
forecast_service.py
====================
Loads the Adaption forecasting model configured in the backend environment,
predicts next-hour telemetry from the last 3 hours of Conduit readings, and
runs that prediction through your existing deterministic rule engine
(rules.py) to produce a *predictive* agronomic assessment -- e.g. "fungal
risk conditions likely in the next hour" instead of only "right now".

Adaption exports model weights for local deployment. So this module:

  1. Downloads the trained weights once (cached locally).
  2. Loads them with transformers for local inference.
  3. Parses the model's forecast text back into a RawConduitStream.
  4. Reuses evaluate_agronomic_rules() unchanged on the predicted reading.

Install:
    pip install adaption transformers torch accelerate

Env vars:
    ADAPTION_API_KEY -- required to download the trained model
    ADAPTION_MODEL   -- trained Adaption model/run id
"""

import os
import re
import functools
import json
import tarfile
from datetime import datetime, timedelta
from typing import List, Optional

from schemas import RawConduitStream, AgronomicAssessment
from rules import evaluate_agronomic_rules

SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.getenv("FORECAST_MODEL_DIR", os.path.join(SERVICE_DIR, "adaption-model"))
MODEL_ID = os.getenv("ADAPTION_MODEL") or os.getenv("AUTOSCIENTIST_RUN_ID", "")
ADAPTIVE_DATASET_FILE = os.getenv(
    "ADAPTIVE_DATASET_FILE",
    os.path.join(SERVICE_DIR, "adaptive-dataset.jsonl"),
)


# ---------------------------------------------------------------------
# Model loading (cached -- only downloads / loads into memory once)
# ---------------------------------------------------------------------
@functools.lru_cache(maxsize=1)
def _load_model():
    """Downloads (if needed) and loads the trained forecaster. Cached so
    this only happens once per process, not once per request."""
    from adaption import Adaption

    if not _model_files_exist(MODEL_DIR):
        if not MODEL_ID:
            raise RuntimeError(
                "No local model found at FORECAST_MODEL_DIR and no ADAPTION_MODEL "
                "set to download one."
            )
        if not os.getenv("ADAPTION_API_KEY"):
            raise RuntimeError("ADAPTION_API_KEY is required to download the Adaption model.")

        os.makedirs(MODEL_DIR, exist_ok=True)
        _download_model_archive(Adaption(api_key=os.environ["ADAPTION_API_KEY"]))

    # Imported lazily so the rest of the app works even if torch/transformers
    # aren't installed yet -- only this function needs them.
    from transformers import AutoModelForCausalLM, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
    model = AutoModelForCausalLM.from_pretrained(MODEL_DIR)
    model.eval()
    return tokenizer, model


def _model_files_exist(model_dir: str) -> bool:
    """Check for files Transformers needs, not just any file in the folder."""
    if not os.path.isdir(model_dir):
        return False

    required_any = ("config.json", "adapter_config.json")
    tokenizer_any = ("tokenizer.json", "tokenizer_config.json")
    files = set(os.listdir(model_dir))
    return any(name in files for name in required_any) and any(
        name in files for name in tokenizer_any
    )


def _download_model_archive(client) -> None:
    archive_path = os.path.join(MODEL_DIR, "best-checkpoint.tgz")

    with client.autoscientist.with_streaming_response.download(MODEL_ID) as response:
        response.stream_to_file(archive_path)

    with tarfile.open(archive_path) as archive:
        for member in archive.getmembers():
            destination = os.path.abspath(os.path.join(MODEL_DIR, member.name))
            if not destination.startswith(os.path.abspath(MODEL_DIR) + os.sep):
                raise RuntimeError(f"Unsafe path in Adaption model archive: {member.name}")
        archive.extractall(MODEL_DIR)


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

_READING_PATTERN = re.compile(
    r"temp=([\d.\-]+)C\s+hum=([\d.\-]+)%\s+press=([\d.\-]+)hPa\s+"
    r"wind=([\d.\-]+)m/s\s+wbgt=([\d.\-]+)C\s+rain=([\d.\-]+)mm",
    re.DOTALL,
)

_ENHANCED_FIELD_PATTERNS = {
    "temp": re.compile(r"Temperature:\*\*\s*([\d.\-]+)"),
    "humidity": re.compile(r"Humidity:\*\*\s*([\d.\-]+)"),
    "pressure": re.compile(r"Pressure:\*\*\s*([\d.\-]+)"),
    "wind": re.compile(r"Wind Speed:\*\*\s*([\d.\-]+)"),
    "wbgt": re.compile(r"WBGT:\*\*\s*([\d.\-]+)"),
    "rain": re.compile(r"Rainfall:\*\*\s*([\d.\-]+)"),
}


def _parse_forecast(text: str, station_id: str, base_time: datetime) -> Optional[RawConduitStream]:
    match = _FIELD_PATTERN.search(text)
    if match:
        temp, humidity, pressure, wind, wbgt, rain = (float(g) for g in match.groups())
    else:
        values = {}
        for field, pattern in _ENHANCED_FIELD_PATTERNS.items():
            field_match = pattern.search(text)
            if field_match:
                values[field] = float(field_match.group(1))
        if len(values) != len(_ENHANCED_FIELD_PATTERNS):
            return None
        temp = values["temp"]
        humidity = values["humidity"]
        pressure = values["pressure"]
        wind = values["wind"]
        wbgt = values["wbgt"]
        rain = values["rain"]

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

    if MODEL_ID:
        adaptive_result = _generate_adaptive_dataset_assessment(history)
        if adaptive_result is not None:
            return adaptive_result

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


def _generate_adaptive_dataset_assessment(
    history: List[RawConduitStream],
) -> Optional["PredictiveAssessment"]:
    """Use the Adaptive Data output as a local forecast library.

    Adaptive Data returns an improved dataset, not a hosted inference model. For
    this app, we cache that dataset and choose the closest historical 3-hour
    pattern, then score its Adaptive forecast completion with the rule engine.
    """
    dataset_path = _ensure_adaptive_dataset()
    if dataset_path is None:
        return None

    target_vector = _history_vector(history[-3:])
    best_record = None
    best_score = float("inf")

    with open(dataset_path) as dataset_file:
        for line in dataset_file:
            if not line.strip():
                continue
            record = json.loads(line)
            prompt = record.get("prompt") or record.get("enhanced_prompt") or ""
            readings = _READING_PATTERN.findall(prompt)
            if len(readings) < 3:
                continue

            candidate_vector = [float(value) for reading in readings[-3:] for value in reading]
            score = _vector_distance(target_vector, candidate_vector)
            if score < best_score:
                best_score = score
                best_record = record

    if best_record is None:
        return None

    output = best_record.get("enhanced_completion") or best_record.get("completion") or ""
    predicted = _parse_forecast(output, history[-1].station_id, history[-1].timestamp)
    if predicted is None and best_record.get("completion"):
        output = best_record["completion"]
        predicted = _parse_forecast(output, history[-1].station_id, history[-1].timestamp)
    if predicted is None:
        return None

    return PredictiveAssessment(
        forecast_for=predicted.timestamp,
        predicted_telemetry=predicted,
        predicted_assessment=evaluate_agronomic_rules(predicted),
        raw_model_output=(
            "Adaption Adaptive Data forecast from cached dataset "
            f"{MODEL_ID}; nearest-pattern distance={round(best_score, 4)}. "
            f"Output: {output}"
        ),
    )


def _ensure_adaptive_dataset() -> Optional[str]:
    if os.path.exists(ADAPTIVE_DATASET_FILE) and os.path.getsize(ADAPTIVE_DATASET_FILE) > 0:
        return ADAPTIVE_DATASET_FILE

    if not MODEL_ID or not os.getenv("ADAPTION_API_KEY"):
        return None

    from adaption import Adaption

    client = Adaption(api_key=os.environ["ADAPTION_API_KEY"])
    os.makedirs(os.path.dirname(ADAPTIVE_DATASET_FILE), exist_ok=True)
    with client.datasets.with_streaming_response.download(MODEL_ID, file_format="jsonl") as response:
        response.stream_to_file(ADAPTIVE_DATASET_FILE)
    return ADAPTIVE_DATASET_FILE


def _history_vector(history: List[RawConduitStream]) -> List[float]:
    vector = []
    for reading in history:
        vector.extend([
            reading.sht_temperature,
            reading.sht_humidity,
            reading.barometric_pressure,
            reading.wind_speed,
            reading.wbgt_temperature,
            reading.daily_rain_total_mm,
        ])
    return vector


def _vector_distance(left: List[float], right: List[float]) -> float:
    scales = [10.0, 30.0, 10.0, 3.0, 10.0, 10.0] * 3
    return sum(((a - b) / scale) ** 2 for a, b, scale in zip(left, right, scales)) / len(scales)


# ---------------------------------------------------------------------
# Response schema -- add this to schemas.py alongside your existing models
# ---------------------------------------------------------------------
from pydantic import BaseModel


class PredictiveAssessment(BaseModel):
    forecast_for: datetime
    predicted_telemetry: RawConduitStream
    predicted_assessment: AgronomicAssessment
    raw_model_output: str
    
