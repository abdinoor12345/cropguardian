from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

# --- Module 1: Ingestion Schemas ---

class RawConduitStream(BaseModel):
    station_id: str = Field(default="JKUAT_Main_Station", description="Unique weather station identifier")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Record timestamp")
    sht_temperature: float = Field(default=0.0, description="Air temperature (°C) from SHT sensor")
    wbgt_temperature: float = Field(default=0.0, description="Wet-Bulb Globe Temperature (°C)")
    sht_humidity: float = Field(default=0.0, description="Relative humidity (%)")
    instant_rain_mm: float = Field(default=0.0, description="Instantaneous rain rate (mm)")
    daily_rain_total_mm: float = Field(default=0.0, description="Cumulative daily rain total (mm)")
    solar_irradiance: float = Field(default=0.0, description="Solar irradiance (W/m² or lux)")
    barometric_pressure: float = Field(default=1013.25, description="Barometric pressure (hPa)")
    wind_speed: float = Field(default=0.0, description="Wind speed (m/s)")

class SensorResponse(BaseModel):
    status: str = "success"
    is_mock: bool = False
    data: RawConduitStream

class TelemetryHistorySummary(BaseModel):
    record_count: int
    from_timestamp: Optional[datetime] = None
    to_timestamp: Optional[datetime] = None
    total_rainfall_mm: float = 0.0
    average_wind_speed: float = 0.0
    max_wind_speed: float = 0.0

class TelemetryHistoryResponse(BaseModel):
    status: str = "success"
    is_mock: bool = False
    range: str
    data: List[RawConduitStream]
    summary: TelemetryHistorySummary


# --- Module 2: Rule Engine Schemas ---

class RiskFactor(BaseModel):
    level: str  # LOW, MODERATE, HIGH, CRITICAL
    score: float
    description: str

# Alias RiskAlert to RiskFactor so imports of either name work
RiskAlert = RiskFactor

class SprayingSuitability(BaseModel):
    suitable: bool
    status: str  # OPTIMAL, SUB-OPTIMAL, UNSUITABLE
    reason: str

class AgronomicAssessment(BaseModel):
    station_id: str
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)
    risk_score: float  # Aggregate 0.0 - 100.0
    alerts: List[str]
    fungal_risk: RiskFactor
    heat_stress: RiskFactor
    soil_washout: RiskFactor
    spraying_suitability: SprayingSuitability


# --- Crop Catalog Schemas ---

class CropOption(BaseModel):
    name: str
    growth_stages: List[str]

class CropCatalogResponse(BaseModel):
    status: str = "success"
    data: List[CropOption]


# --- Module 3: AI Advisory Schemas ---

class AdvisoryRequest(BaseModel):
    crop_type: str = Field(default="Maize", description="Target crop (e.g., Maize, Beans, Tomato)")
    growth_stage: str = Field(default="Vegetative", description="Growth stage (e.g., Flowering, Fruiting)")
    from_date: Optional[str] = None
    to_date: Optional[str] = None

class ActionableRecommendation(BaseModel):
    category: str
    urgency: str
    action: str

class AIAdvisoryResponse(BaseModel):
    status: str = "success"
    crop_type: str
    growth_stage: str
    summary: str
    risk_overview: List[str]
    recommendations: List[ActionableRecommendation]


# --- Module 4: Advisory History & Outcomes ---

class InterventionOutcome(BaseModel):
    id: str
    label: str
    category: str
    completed: bool = False
    completed_at: Optional[datetime] = None

class AdvisoryLogEntry(BaseModel):
    id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    crop_type: str
    growth_stage: str
    risk_level: str
    risk_score: float
    telemetry: RawConduitStream
    assessment: AgronomicAssessment
    advisory: AIAdvisoryResponse
    outcomes: List[InterventionOutcome]

class AdvisoryHistoryResponse(BaseModel):
    status: str = "success"
    data: List[AdvisoryLogEntry]

class OutcomeUpdateRequest(BaseModel):
    completed: bool


# --- Module 5: AI Assistant & Scenario Testing ---

class AssistantChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str

class AIAssistantChatRequest(BaseModel):
    question: str
    crop_type: str = Field(default="Maize")
    growth_stage: str = Field(default="Vegetative")
    messages: List[AssistantChatMessage] = Field(default_factory=list)

class AIAssistantChatResponse(BaseModel):
    status: str = "success"
    answer: str
    assessment: AgronomicAssessment
    telemetry: RawConduitStream

class ScenarioSimulationRequest(BaseModel):
    crop_type: str = Field(default="Maize")
    growth_stage: str = Field(default="Vegetative")
    sht_temperature: Optional[float] = None
    wbgt_temperature: Optional[float] = None
    sht_humidity: Optional[float] = None
    instant_rain_mm: Optional[float] = None
    daily_rain_total_mm: Optional[float] = None
    solar_irradiance: Optional[float] = None
    barometric_pressure: Optional[float] = None
    wind_speed: Optional[float] = None

class ScenarioSimulationResponse(BaseModel):
    status: str = "success"
    telemetry: RawConduitStream
    assessment: AgronomicAssessment
    advisory: AIAdvisoryResponse


# --- Module 6: Predictive Forecasting ---

class PredictiveAssessment(BaseModel):
    status: str = "success"
    forecast_for: datetime
    predicted_telemetry: RawConduitStream
    predicted_assessment: AgronomicAssessment
    raw_model_output: str
