"""
Hack The Weather — Conduit data -> Adaption training pipeline
================================================================

What this does:
1. Loads the raw Conduit CSV export (15-min interval sensor readings).
2. Resamples to hourly and builds a short rolling-window context per timestep.
3. Frames the task as short-term forecasting: given the last 3 hours of
   conditions, predict next-hour temperature, humidity, and pressure —
   plus a short natural-language summary (useful for an advisory app).
4. Writes the result as prompt/completion pairs (what Adaption's Adaptive
   Data step expects).
5. Uploads to Adaption, runs Adaptive Data, then kicks off AutoScientist.

Why forecasting instead of a fixed risk classifier:
Rain, extreme heat, or frost may or may not appear in whatever date range
you pull from the Conduit platform (this particular export had zero rain
and only a handful of near-frost readings). A forecasting task uses every
row as a training signal regardless of season, and lets your app apply its
own configurable risk thresholds (frost, heat stress, heavy rain) on top of
the model's predicted values — instead of baking a data-hungry classifier
that only handled one climate condition.

Before running:
    pip install adaption pandas
    export ADAPTION_API_KEY="pt_live_..."
"""

import os
import pandas as pd

RAW_CSV = "weatherdata.csv"          # path to your Conduit export
OUTPUT_PARQUET = "conduit_prompts.parquet"

# -----------------------------------------------------------------------
# 1. Load and clean
# -----------------------------------------------------------------------
df = pd.read_csv(RAW_CSV)
df["ts"] = pd.to_datetime(df["ts"])
df = df.sort_values("ts").set_index("ts")

# Drop the UV column if it's dead (constant zero) in your export — check first.
if df["si1145_uv"].nunique() <= 1:
    df = df.drop(columns=["si1145_uv"])

# -----------------------------------------------------------------------
# 2. Resample to hourly means (smooths 15-min sensor noise)
# -----------------------------------------------------------------------
hourly = df.resample("1h").mean(numeric_only=True).dropna()

# Include every field CropGuardian's rules.py needs to score risk on a
# *forecasted* reading, not just the fields that were easy to plot.
FEATURES = [
    "temp_sht", "humidity_sht", "press_bmx", "wind_spd", "si1145_vis",
    "wet_bulb_globe_temp",  # heat_stress rule
    "rg2tt",                # closest available proxy for cumulative rain (mm) -- soil_washout rule
]
hourly = hourly[[c for c in FEATURES if c in hourly.columns]].round(2)

# -----------------------------------------------------------------------
# 3. Build rolling 3-hour context -> next-hour target
# -----------------------------------------------------------------------
records = []
WINDOW = 3

for i in range(WINDOW, len(hourly) - 1):
    ctx = hourly.iloc[i - WINDOW:i]
    nxt = hourly.iloc[i + 1]
    ts_now = hourly.index[i]

    context_lines = "; ".join(
        f"{t.strftime('%H:%M')} temp={row.temp_sht}C hum={row.humidity_sht}% "
        f"press={row.press_bmx}hPa wind={row.wind_spd}m/s wbgt={row.wet_bulb_globe_temp}C "
        f"rain={row.rg2tt}mm"
        for t, row in ctx.iterrows()
    )

    prompt = (
        f"Location: JKUAT Conduit station. Current time: {ts_now.strftime('%Y-%m-%d %H:%M')}.\n"
        f"Readings for the past {WINDOW} hours: {context_lines}.\n"
        f"Forecast the conditions for the next hour."
    )

    # This is the exact field set forecast_service.py parses back out and
    # feeds into rules.py's evaluate_agronomic_rules() -- keep names/order
    # in sync with the regex there if you change this line.
    completion = (
        f"Next hour forecast: temp={nxt.temp_sht}C, humidity={nxt.humidity_sht}%, "
        f"pressure={nxt.press_bmx}hPa, wind={nxt.wind_spd}m/s, wbgt={nxt.wet_bulb_globe_temp}C, "
        f"rain={nxt.rg2tt}mm."
    )

    records.append({"prompt": prompt, "completion": completion})

out_df = pd.DataFrame(records)
out_df.to_parquet(OUTPUT_PARQUET, index=False)
print(f"Wrote {len(out_df)} prompt/completion pairs to {OUTPUT_PARQUET}")
print(out_df.iloc[0].prompt)
print("---")
print(out_df.iloc[0].completion)

# -----------------------------------------------------------------------
# 4. Upload to Adaption and train
# -----------------------------------------------------------------------
def run_adaption_pipeline():
    from adaption import Adaption

    client = Adaption(api_key=os.environ["ADAPTION_API_KEY"])

    dataset = client.datasets.upload_file(OUTPUT_PARQUET)

    client.datasets.run(
        dataset.dataset_id,
        column_mapping={
            "prompt": "prompt",
            "completion": "completion",
        },
    )
    client.datasets.wait_for_completion(dataset.dataset_id)

    run = client.autoscientist.create(
        dataset_id=dataset.dataset_id,
    )
    print("AutoScientist run started:", run)
    return run


if __name__ == "__main__":
    if os.environ.get("ADAPTION_API_KEY"):
        run_adaption_pipeline()
    else:
        print(
            "\nSet ADAPTION_API_KEY to also launch the Adaption training run.\n"
            "For now, the local prompt/completion file above is ready to inspect."
        )