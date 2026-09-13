import os
import json
from anthropic import Anthropic
from schemas import (
    RawConduitStream, 
    AgronomicAssessment, 
    AIAdvisoryResponse, 
    ActionableRecommendation,
    AssistantChatMessage,
)

def build_prompt_harness(
    telemetry: RawConduitStream, 
    assessment: AgronomicAssessment, 
    crop_type: str, 
    growth_stage: str
) -> str:
    return f"""You are CropGuardian AI, an expert East African agronomic advisory system.
Analyze the following telemetry and rule engine flags for {crop_type} at the {growth_stage} stage.

=== LIVE METEOROLOGICAL TELEMETRY ===
- Station ID: {telemetry.station_id}
- Air Temperature: {telemetry.sht_temperature} °C
- WBGT Heat Stress Temp: {telemetry.wbgt_temperature} °C
- Relative Humidity: {telemetry.sht_humidity} %
- Solar Irradiance: {telemetry.solar_irradiance} W/m²
- Wind Speed: {telemetry.wind_speed} m/s
- Barometric Pressure: {telemetry.barometric_pressure} hPa
- Instant Rain Rate: {telemetry.instant_rain_mm} mm
- Daily Total Rain: {telemetry.daily_rain_total_mm} mm

=== DETERMINISTIC RULE ENGINE EVALUATIONS ===
- Overall Risk Score: {assessment.risk_score}
- Active Alerts: {", ".join(assessment.alerts) if assessment.alerts else "None"}
- Fungal Risk Level: {assessment.fungal_risk.level}
- Heat Stress Level: {assessment.heat_stress.level}
- Soil Washout Risk: {assessment.soil_washout.level}
- Spraying Window: {assessment.spraying_suitability.status} (Reason: {assessment.spraying_suitability.reason})

=== OUTPUT INSTRUCTIONS ===
Respond STRICTLY with valid JSON matching this schema:
{{
  "summary": "Concise 2-sentence summary of field conditions and crop impact.",
  "risk_overview": ["List of primary risk statements based on active flags"],
  "recommendations": [
    {{
      "category": "Category name",
      "urgency": "Immediate OR 24-48 Hours OR Routine",
      "action": "Detailed action step for the farmer"
    }}
  ]
}}
"""

def generate_ai_advisory(
    telemetry: RawConduitStream, 
    assessment: AgronomicAssessment, 
    crop_type: str, 
    growth_stage: str
) -> AIAdvisoryResponse:
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "").strip()

    if not anthropic_key:
        return build_fallback_advisory(telemetry, assessment, crop_type, growth_stage, "ANTHROPIC_API_KEY is missing from .env")

    try:
        # Direct Client Initialization (No default_headers, no workspace scope)
        client = Anthropic(api_key=anthropic_key)
        
        prompt = build_prompt_harness(telemetry, assessment, crop_type, growth_stage)
        
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",  # <--- Update to active model alias
            max_tokens=1000,
            system="You are a professional agronomist. Output pure JSON without markdown codeblock formatting.",
            messages=[{"role": "user", "content": prompt}]
        )
        
        raw_text = response.content[0].text.strip()
        
        # Clean formatting tags
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
            
        parsed_json = json.loads(raw_text.strip())
        
        recs = [
            ActionableRecommendation(
                category=r.get("category", "General Agronomy"),
                urgency=r.get("urgency", "Routine"),
                action=r.get("action", "")
            )
            for r in parsed_json.get("recommendations", [])
        ]
        
        return AIAdvisoryResponse(
            status="success",
            crop_type=crop_type,
            growth_stage=growth_stage,
            summary=parsed_json.get("summary", "Advisory successfully generated."),
            risk_overview=parsed_json.get("risk_overview", assessment.alerts),
            recommendations=recs
        )
        
    except Exception as e:
        return build_fallback_advisory(telemetry, assessment, crop_type, growth_stage, str(e))


def generate_assistant_reply(
    question: str,
    messages: list[AssistantChatMessage],
    telemetry: RawConduitStream,
    assessment: AgronomicAssessment,
    crop_type: str,
    growth_stage: str,
) -> tuple[str, str]:
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "").strip()

    if not anthropic_key:
        return (
            "fallback",
            build_fallback_assistant_reply(
                question,
                telemetry,
                assessment,
                crop_type,
                growth_stage,
                "ANTHROPIC_API_KEY is missing from .env",
            ),
        )

    try:
        client = Anthropic(api_key=anthropic_key)
        context = build_assistant_context(telemetry, assessment, crop_type, growth_stage)
        chat_messages = [
            {
                "role": item.role,
                "content": item.content,
            }
            for item in messages[-8:]
        ]
        chat_messages.append(
            {
                "role": "user",
                "content": f"{context}\n\nAgronomist question: {question}",
            }
        )

        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=900,
            system=(
                "You are Adaption AI inside CropGuardian. Answer as a concise, "
                "professional agronomy assistant for East African microclimate "
                "conditions. Use the supplied telemetry and deterministic rule "
                "engine output. Be practical, explain uncertainty, and avoid "
                "claiming field observations that are not in the data."
            ),
            messages=chat_messages,
        )

        return "success", response.content[0].text.strip()
    except Exception as e:
        return (
            "fallback",
            build_fallback_assistant_reply(
                question,
                telemetry,
                assessment,
                crop_type,
                growth_stage,
                str(e),
            ),
        )


def build_assistant_context(
    telemetry: RawConduitStream,
    assessment: AgronomicAssessment,
    crop_type: str,
    growth_stage: str,
) -> str:
    return f"""Current CropGuardian context:
- Crop: {crop_type}
- Growth stage: {growth_stage}
- Station: {telemetry.station_id}
- Temperature: {telemetry.sht_temperature} °C
- WBGT: {telemetry.wbgt_temperature} °C
- Relative humidity: {telemetry.sht_humidity} %
- Wind speed: {telemetry.wind_speed} m/s
- Instant rain: {telemetry.instant_rain_mm} mm
- Daily rain total: {telemetry.daily_rain_total_mm} mm
- Solar irradiance: {telemetry.solar_irradiance}
- Pressure: {telemetry.barometric_pressure} hPa
- Rule risk score: {assessment.risk_score}/100
- Rule alerts: {", ".join(assessment.alerts) if assessment.alerts else "None"}
- Fungal risk: {assessment.fungal_risk.level} ({assessment.fungal_risk.description})
- Heat stress: {assessment.heat_stress.level} ({assessment.heat_stress.description})
- Soil washout: {assessment.soil_washout.level} ({assessment.soil_washout.description})
- Spraying window: {assessment.spraying_suitability.status} ({assessment.spraying_suitability.reason})"""


def build_fallback_assistant_reply(
    question: str,
    telemetry: RawConduitStream,
    assessment: AgronomicAssessment,
    crop_type: str,
    growth_stage: str,
    error_reason: str,
) -> str:
    alerts = "; ".join(assessment.alerts) if assessment.alerts else "no active critical alerts"
    return (
        f"For {crop_type} at {growth_stage} stage, the rule engine currently scores "
        f"overall microclimate risk at {assessment.risk_score}/100 with {alerts}. "
        f"Fungal risk is {assessment.fungal_risk.level}, heat stress is "
        f"{assessment.heat_stress.level}, and soil washout risk is "
        f"{assessment.soil_washout.level}. For your question, '{question}', I would "
        f"prioritize the strongest flagged risk first and use the spraying status "
        f"as the operational constraint: {assessment.spraying_suitability.status} - "
        f"{assessment.spraying_suitability.reason} Note: live Adaption AI text was "
        f"unavailable, so this answer used the deterministic fallback ({error_reason})."
    )

def build_fallback_advisory(
    telemetry: RawConduitStream, 
    assessment: AgronomicAssessment, 
    crop_type: str, 
    growth_stage: str, 
    error_reason: str
) -> AIAdvisoryResponse:
    recs = []
    
    if assessment.fungal_risk.level in ["HIGH", "CRITICAL"]:
        recs.append(ActionableRecommendation(
            category="Disease Control",
            urgency="Immediate",
            action=f"High humidity ({telemetry.sht_humidity}%) combined with temperature ({telemetry.sht_temperature}°C) indicates fungal risk."
        ))

    recs.append(ActionableRecommendation(
        category="Chemical Application",
        urgency="Routine" if assessment.spraying_suitability.suitable else "24-48 Hours",
        action=f"Spraying status: {assessment.spraying_suitability.status}. {assessment.spraying_suitability.reason}"
    ))

    return AIAdvisoryResponse(
        status="fallback",
        crop_type=crop_type,
        growth_stage=growth_stage,
        summary=f"Automated advisory for {crop_type} ({growth_stage} stage). Risk Score: {assessment.risk_score}/100. (Note: {error_reason})",
        risk_overview=assessment.alerts if assessment.alerts else ["No critical risk flags detected."],
        recommendations=recs
    )
