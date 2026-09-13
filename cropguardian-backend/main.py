import os
import csv
import json
import importlib.util
from uuid import uuid4
from pathlib import Path
from datetime import datetime, timedelta
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import requests

from schemas import (
    RawConduitStream,
    SensorResponse,
    AgronomicAssessment,
    TelemetryHistoryResponse,
    TelemetryHistorySummary,
    AdvisoryLogEntry,
    AdvisoryHistoryResponse,
    InterventionOutcome,
    OutcomeUpdateRequest,
    AIAssistantChatRequest,
    AIAssistantChatResponse,
    ScenarioSimulationRequest,
    ScenarioSimulationResponse,
    PredictiveAssessment,
    CropCatalogResponse,
)
from crops import SUPPORTED_CROPS
from rules import evaluate_agronomic_rules

from schemas import AdvisoryRequest, AIAdvisoryResponse
from ai_service import generate_ai_advisory, generate_assistant_reply

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

JKUAT_CONDUIT_URL = os.getenv("JKUAT_CONDUIT_URL", "https://conduit.jhubafrica.com/data.php").strip()
CONDUIT_API_KEY = (os.getenv("CONDUIT_API_KEY") or "").strip()
CONDUIT_EMAIL = (os.getenv("CONDUIT_EMAIL") or "").strip()
LOCAL_WEATHER_DATA = Path(__file__).resolve().parent / "data" / "weatherdata.csv"
ADVISORY_LOG_FILE = Path(__file__).resolve().parent / "data" / "advisory_log.json"
FORECAST_SERVICE_FILE = Path(__file__).resolve().parent / "models" / "conduit-forecaster" / "forecast_service.py"
RANGE_TO_DELTA = {
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
}

app = FastAPI(title="CropGuardian Backend - Production Pipeline")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def safe_float(val, default: float = 0.0) -> float:
    """Safely converts string values to floats."""
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def default_date_range():
    """Computed fresh on every call -- never a fixed string that goes stale."""
    to_date = datetime.utcnow()
    from_date = to_date - timedelta(days=1)
    return from_date.strftime("%Y-%m-%d"), to_date.strftime("%Y-%m-%d")


def parse_conduit_timestamp(raw_ts):
    """Parses the station's real reading time. Falls back to now() only if
    the record has no usable timestamp -- so staleness is visible, not hidden."""
    if not raw_ts:
        return datetime.utcnow()
    try:
        parsed = datetime.fromisoformat(str(raw_ts).replace("Z", "+00:00"))
        if parsed.tzinfo is not None:
            return parsed.replace(tzinfo=None)
        return parsed
    except (TypeError, ValueError):
        return datetime.utcnow()


def normalize_conduit_record(record) -> RawConduitStream:
    temp_val = safe_float(record.get("temp_sht", record.get("temp_mcp", 0.0)))
    humidity_val = safe_float(record.get("humidity_sht", 0.0))
    wbgt_val = safe_float(record.get("wet_bulb_globe_temp", temp_val))
    pressure_val = safe_float(record.get("press_bmx", 1013.25))
    wind_val = safe_float(record.get("wind_spd", 0.0))
    rain_inst = safe_float(record.get("rg1", 0.0))
    rain_total = safe_float(record.get("rg1tt", 0.0))
    solar_val = safe_float(record.get("si1145_vis", 0.0))

    return RawConduitStream(
        station_id=str(record.get("station_id", "JKUAT_Main_Station")),
        timestamp=parse_conduit_timestamp(record.get("ts")),
        sht_temperature=temp_val,
        wbgt_temperature=wbgt_val,
        sht_humidity=humidity_val,
        instant_rain_mm=rain_inst,
        daily_rain_total_mm=rain_total,
        solar_irradiance=solar_val,
        barometric_pressure=pressure_val,
        wind_speed=wind_val,
    )


def fetch_conduit_records(from_date: str, to_date: str):
    if not CONDUIT_API_KEY or not CONDUIT_EMAIL:
        return None

    payload = {
        "apikey": CONDUIT_API_KEY,
        "email": CONDUIT_EMAIL,
        "fromdate": from_date,
        "todate": to_date,
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    response = requests.post(
        JKUAT_CONDUIT_URL,
        data=payload,
        headers=headers,
        timeout=10.0,
    )

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"JKUAT API HTTP {response.status_code}: {response.text}",
        )

    raw_json = response.json()
    data_list = raw_json.get("data", []) if isinstance(raw_json, dict) else raw_json
    return data_list if isinstance(data_list, list) else []


def read_local_weather_records():
    if not LOCAL_WEATHER_DATA.exists():
        return []

    with LOCAL_WEATHER_DATA.open(newline="") as csvfile:
        return list(csv.DictReader(csvfile))


def resolve_history_window(range_key: str, from_date: str = None, to_date: str = None):
    if from_date and to_date:
        return from_date, to_date

    delta = RANGE_TO_DELTA.get(range_key, RANGE_TO_DELTA["24h"])
    to_dt = datetime.utcnow()
    from_dt = to_dt - delta
    return from_dt.strftime("%Y-%m-%d"), to_dt.strftime("%Y-%m-%d")


def get_history_records(range_key: str, from_date: str = None, to_date: str = None):
    resolved_from, resolved_to = resolve_history_window(range_key, from_date, to_date)

    if CONDUIT_API_KEY and CONDUIT_EMAIL:
        try:
            records = fetch_conduit_records(resolved_from, resolved_to)
            return [normalize_conduit_record(record) for record in records], False
        except requests.RequestException:
            pass

    local_records = [normalize_conduit_record(record) for record in read_local_weather_records()]
    local_records.sort(key=lambda item: item.timestamp)

    if not local_records:
        return [], True

    if from_date and to_date:
        from_dt = parse_conduit_timestamp(from_date)
        to_dt = parse_conduit_timestamp(to_date)
    else:
        to_dt = local_records[-1].timestamp
        from_dt = to_dt - RANGE_TO_DELTA.get(range_key, RANGE_TO_DELTA["24h"])

    filtered = [
        record for record in local_records
        if from_dt <= record.timestamp <= to_dt
    ]
    return filtered, True


def build_hourly_forecast_history(records):
    if len(records) < 3:
        return records

    sampled = [records[-1]]
    cursor = records[-1].timestamp

    for record in reversed(records[:-1]):
        if cursor - record.timestamp >= timedelta(minutes=50):
            sampled.append(record)
            cursor = record.timestamp
        if len(sampled) == 3:
            break

    if len(sampled) < 3:
        sampled = records[-3:]
    else:
        sampled.reverse()

    return sampled


def load_forecast_service():
    spec = importlib.util.spec_from_file_location(
        "cropguardian_conduit_forecast_service",
        FORECAST_SERVICE_FILE,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load forecast service module.")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def build_trend_forecast(history):
    if len(history) < 2:
        raise ValueError("Need at least 2 readings for fallback trend forecast.")

    previous = history[-2]
    current = history[-1]
    forecast_for = current.timestamp + timedelta(hours=1)

    def project(field, minimum=None, maximum=None):
        value = getattr(current, field) + (getattr(current, field) - getattr(previous, field))
        if minimum is not None:
            value = max(minimum, value)
        if maximum is not None:
            value = min(maximum, value)
        return round(value, 2)

    predicted = RawConduitStream(
        station_id=current.station_id,
        timestamp=forecast_for,
        sht_temperature=project("sht_temperature", -10.0, 50.0),
        wbgt_temperature=project("wbgt_temperature", -10.0, 50.0),
        sht_humidity=project("sht_humidity", 0.0, 100.0),
        instant_rain_mm=max(0.0, round(current.instant_rain_mm, 2)),
        daily_rain_total_mm=project("daily_rain_total_mm", 0.0, None),
        solar_irradiance=project("solar_irradiance", 0.0, None),
        barometric_pressure=project("barometric_pressure", 700.0, 1100.0),
        wind_speed=project("wind_speed", 0.0, None),
    )

    return PredictiveAssessment(
        status="fallback",
        forecast_for=forecast_for,
        predicted_telemetry=predicted,
        predicted_assessment=evaluate_agronomic_rules(predicted),
        raw_model_output="Adaption forecast runtime unavailable; used short-term linear trend fallback.",
    )


def build_history_summary(records):
    if not records:
        return TelemetryHistorySummary(record_count=0)

    wind_values = [record.wind_speed for record in records]
    rainfall_values = [record.daily_rain_total_mm for record in records]
    total_rainfall = max(rainfall_values) - min(rainfall_values)

    return TelemetryHistorySummary(
        record_count=len(records),
        from_timestamp=records[0].timestamp,
        to_timestamp=records[-1].timestamp,
        total_rainfall_mm=round(max(total_rainfall, 0.0), 2),
        average_wind_speed=round(sum(wind_values) / len(wind_values), 2),
        max_wind_speed=round(max(wind_values), 2),
    )


def latest_local_telemetry():
    records = [normalize_conduit_record(record) for record in read_local_weather_records()]
    records.sort(key=lambda item: item.timestamp)
    return records[-1] if records else None


def risk_level_from_score(score: float) -> str:
    if score >= 80:
        return "CRITICAL"
    if score >= 60:
        return "HIGH"
    if score >= 35:
        return "MODERATE"
    return "LOW"


def read_advisory_log():
    if not ADVISORY_LOG_FILE.exists():
        return []

    with ADVISORY_LOG_FILE.open() as logfile:
        raw_entries = json.load(logfile)

    return [AdvisoryLogEntry.model_validate(entry) for entry in raw_entries]


def write_advisory_log(entries):
    ADVISORY_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    payload = [entry.model_dump(mode="json") for entry in entries]
    with ADVISORY_LOG_FILE.open("w") as logfile:
        json.dump(payload, logfile, indent=2)


def build_intervention_outcomes(advisory: AIAdvisoryResponse):
    outcomes = []
    for index, recommendation in enumerate(advisory.recommendations, start=1):
        outcomes.append(
            InterventionOutcome(
                id=f"rec-{index}",
                category=recommendation.category,
                label=recommendation.action,
            )
        )
    return outcomes


def save_advisory_log_entry(
    telemetry: RawConduitStream,
    assessment: AgronomicAssessment,
    advisory: AIAdvisoryResponse,
) -> AdvisoryLogEntry:
    entry = AdvisoryLogEntry(
        id=str(uuid4()),
        crop_type=advisory.crop_type,
        growth_stage=advisory.growth_stage,
        risk_level=risk_level_from_score(assessment.risk_score),
        risk_score=assessment.risk_score,
        telemetry=telemetry,
        assessment=assessment,
        advisory=advisory,
        outcomes=build_intervention_outcomes(advisory),
    )
    entries = read_advisory_log()
    entries.insert(0, entry)
    write_advisory_log(entries)
    return entry


@app.get("/")
def health_check():
    return {
        "status": "online",
        "telemetry_endpoint": "http://127.0.0.1:8001/api/v1/telemetry/current",
        "risk_assessment_endpoint": "http://127.0.0.1:8001/api/v1/agronomy/assess"
    }


@app.get("/api/v1/telemetry/history", response_model=TelemetryHistoryResponse)
def get_historical_telemetry(
    range: str = Query(default="24h", pattern="^(24h|7d|30d)$"),
    from_date: str = None,
    to_date: str = None,
):
    records, is_mock = get_history_records(range, from_date, to_date)

    if not records:
        raise HTTPException(
            status_code=404,
            detail=f"No historical telemetry found for range {range}.",
        )

    return TelemetryHistoryResponse(
        status="success",
        is_mock=is_mock,
        range=range,
        data=records,
        summary=build_history_summary(records),
    )


@app.get("/api/v1/telemetry/history/export")
def export_historical_telemetry(
    format: str = Query(default="csv", pattern="^(csv|json)$"),
    range: str = Query(default="24h", pattern="^(24h|7d|30d)$"),
    from_date: str = None,
    to_date: str = None,
):
    history = get_historical_telemetry(range=range, from_date=from_date, to_date=to_date)
    filename = f"cropguardian-telemetry-{range}.{format}"

    if format == "json":
        content = json.dumps(history.model_dump(mode="json"), indent=2)
        return Response(
            content=content,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    fieldnames = [
        "station_id",
        "timestamp",
        "sht_temperature",
        "sht_humidity",
        "wbgt_temperature",
        "barometric_pressure",
        "instant_rain_mm",
        "daily_rain_total_mm",
        "wind_speed",
        "solar_irradiance",
    ]
    rows = [record.model_dump(mode="json") for record in history.data]
    csv_lines = [",".join(fieldnames)]
    for row in rows:
        csv_lines.append(",".join(str(row.get(field, "")) for field in fieldnames))

    return Response(
        content="\n".join(csv_lines),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@app.get("/api/v1/telemetry/current", response_model=SensorResponse)
def get_current_telemetry(from_date: str = None, to_date: str = None):
    if from_date is None or to_date is None:
        default_from, default_to = default_date_range()
        from_date = from_date or default_from
        to_date = to_date or default_to

    if not CONDUIT_API_KEY or not CONDUIT_EMAIL:
        fallback = latest_local_telemetry()
        if fallback:
            return SensorResponse(status="success", is_mock=True, data=fallback)
        raise HTTPException(
            status_code=500,
            detail="CONDUIT_API_KEY or CONDUIT_EMAIL missing in .env configuration.",
        )

    try:
        data_list = fetch_conduit_records(from_date, to_date)

        if not data_list or not isinstance(data_list, list):
            raise HTTPException(
                status_code=404, 
                detail=f"No station records found between {from_date} and {to_date}."
            )

        # Get the latest observation from the array
        latest = data_list[-1]

        normalized = normalize_conduit_record(latest)

        return SensorResponse(status="success", is_mock=False, data=normalized)

    except requests.RequestException as e:
        fallback = latest_local_telemetry()
        if fallback:
            return SensorResponse(status="success", is_mock=True, data=fallback)
        raise HTTPException(status_code=502, detail=f"Conduit API network error: {str(e)}")

@app.get("/api/v1/crops", response_model=CropCatalogResponse)
def list_supported_crops():
    return CropCatalogResponse(data=SUPPORTED_CROPS)


@app.get("/api/v1/agronomy/assess", response_model=AgronomicAssessment)
def assess_agronomic_risk(from_date: str = None, to_date: str = None):
    """
    Module 2 Endpoint: Evaluates real-time risks against ingested Conduit telemetry.
    """
    telemetry_res = get_current_telemetry(from_date=from_date, to_date=to_date)
    assessment = evaluate_agronomic_rules(telemetry_res.data)
    return assessment


@app.get("/api/v1/agronomy/forecast", response_model=PredictiveAssessment)
def forecast_agronomic_risk():
    records, _is_mock = get_history_records("24h")
    history = build_hourly_forecast_history(records)

    if len(history) < 3:
        raise HTTPException(
            status_code=404,
            detail="Need at least 3 recent telemetry readings to produce a forecast.",
        )

    try:
        forecast_service = load_forecast_service()
        result = forecast_service.generate_predictive_assessment(history)
        return PredictiveAssessment(
            status="success",
            forecast_for=result.forecast_for,
            predicted_telemetry=result.predicted_telemetry,
            predicted_assessment=result.predicted_assessment,
            raw_model_output=result.raw_model_output,
        )
    except Exception as exc:
        forecast = build_trend_forecast(history)
        forecast.raw_model_output = f"{forecast.raw_model_output} Reason: {exc}"
        return forecast


@app.get("/api/v1/advisories", response_model=AdvisoryHistoryResponse)
def list_advisories(
    crop_type: str = None,
    risk_level: str = Query(default=None, pattern="^(LOW|MODERATE|HIGH|CRITICAL)$"),
    date: str = None,
    search: str = None,
):
    entries = read_advisory_log()

    if crop_type:
        entries = [
            entry for entry in entries
            if entry.crop_type.lower() == crop_type.lower()
        ]

    if risk_level:
        entries = [
            entry for entry in entries
            if entry.risk_level == risk_level
        ]

    if date:
        entries = [
            entry for entry in entries
            if entry.created_at.date().isoformat() == date
        ]

    if search:
        needle = search.lower()
        entries = [
            entry for entry in entries
            if needle in entry.advisory.summary.lower()
            or any(needle in item.lower() for item in entry.advisory.risk_overview)
            or any(needle in outcome.label.lower() for outcome in entry.outcomes)
        ]

    return AdvisoryHistoryResponse(data=entries)


@app.get("/api/v1/advisories/{advisory_id}", response_model=AdvisoryLogEntry)
def get_advisory_detail(advisory_id: str):
    for entry in read_advisory_log():
        if entry.id == advisory_id:
            return entry

    raise HTTPException(status_code=404, detail="Advisory not found.")


@app.patch("/api/v1/advisories/{advisory_id}/outcomes/{outcome_id}", response_model=AdvisoryLogEntry)
def update_advisory_outcome(
    advisory_id: str,
    outcome_id: str,
    req: OutcomeUpdateRequest,
):
    entries = read_advisory_log()

    for entry_index, entry in enumerate(entries):
        if entry.id != advisory_id:
            continue

        for outcome_index, outcome in enumerate(entry.outcomes):
            if outcome.id == outcome_id:
                entry.outcomes[outcome_index] = outcome.model_copy(
                    update={
                        "completed": req.completed,
                        "completed_at": datetime.utcnow() if req.completed else None,
                    }
                )
                entries[entry_index] = entry
                write_advisory_log(entries)
                return entry

        raise HTTPException(status_code=404, detail="Outcome not found.")

    raise HTTPException(status_code=404, detail="Advisory not found.")

@app.post("/api/v1/agronomy/advisory", response_model=AIAdvisoryResponse)
def get_ai_agronomic_advisory(req: AdvisoryRequest):
    """
    Module 3 Endpoint: Synthesizes live telemetry (Module 1) and rule engine risks (Module 2)
    into structured, crop-specific AI advisories.
    """
    # 1. Fetch normalized telemetry
    telemetry_res = get_current_telemetry(from_date=req.from_date, to_date=req.to_date)
    
    # 2. Evaluate rule engine risks
    assessment = evaluate_agronomic_rules(telemetry_res.data)
    
    # 3. Generate AI advisory using prompt harness
    advisory = generate_ai_advisory(
        telemetry=telemetry_res.data,
        assessment=assessment,
        crop_type=req.crop_type,
        growth_stage=req.growth_stage
    )

    save_advisory_log_entry(
        telemetry=telemetry_res.data,
        assessment=assessment,
        advisory=advisory,
    )
    
    return advisory


def build_scenario_telemetry(req: ScenarioSimulationRequest) -> RawConduitStream:
    telemetry_res = get_current_telemetry()
    override_fields = {
        "sht_temperature",
        "wbgt_temperature",
        "sht_humidity",
        "instant_rain_mm",
        "daily_rain_total_mm",
        "solar_irradiance",
        "barometric_pressure",
        "wind_speed",
    }
    updates = {
        field: getattr(req, field)
        for field in override_fields
        if getattr(req, field) is not None
    }

    if "sht_temperature" in updates and "wbgt_temperature" not in updates:
        updates["wbgt_temperature"] = updates["sht_temperature"]

    return telemetry_res.data.model_copy(update=updates)


@app.post("/api/v1/ai-assistant/chat", response_model=AIAssistantChatResponse)
def chat_with_ai_assistant(req: AIAssistantChatRequest):
    telemetry_res = get_current_telemetry()
    assessment = evaluate_agronomic_rules(telemetry_res.data)
    status, answer = generate_assistant_reply(
        question=req.question,
        messages=req.messages,
        telemetry=telemetry_res.data,
        assessment=assessment,
        crop_type=req.crop_type,
        growth_stage=req.growth_stage,
    )

    return AIAssistantChatResponse(
        status=status,
        answer=answer,
        assessment=assessment,
        telemetry=telemetry_res.data,
    )


@app.post("/api/v1/ai-assistant/scenario", response_model=ScenarioSimulationResponse)
def simulate_ai_scenario(req: ScenarioSimulationRequest):
    telemetry = build_scenario_telemetry(req)
    assessment = evaluate_agronomic_rules(telemetry)
    advisory = generate_ai_advisory(
        telemetry=telemetry,
        assessment=assessment,
        crop_type=req.crop_type,
        growth_stage=req.growth_stage,
    )

    return ScenarioSimulationResponse(
        telemetry=telemetry,
        assessment=assessment,
        advisory=advisory,
    )
