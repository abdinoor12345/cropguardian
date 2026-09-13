"""
rules.py - Deterministic Agronomic Rule Engine for CropGuardian
Evaluates live normalized weather telemetry against agronomic thresholds.
"""

from schemas import (
    RawConduitStream,
    RiskFactor,
    SprayingSuitability,
    AgronomicAssessment
)


def evaluate_agronomic_rules(telemetry: RawConduitStream) -> AgronomicAssessment:
    """
    Evaluates microclimate telemetry against deterministic risk thresholds.
    Returns an AgronomicAssessment containing detailed risk factors and alerts.
    """
    alerts = []

    # -------------------------------------------------------------------------
    # 1. Fungal Disease Risk Rule
    # High relative humidity combined with favorable temperatures triggers fungal pressure.
    # -------------------------------------------------------------------------
    fungal_score = 0.0
    
    if telemetry.sht_humidity >= 85.0 and 14.0 <= telemetry.sht_temperature <= 28.0:
        if telemetry.sht_humidity >= 90.0:
            fungal_level = "CRITICAL"
            fungal_score = 90.0
        else:
            fungal_level = "HIGH"
            fungal_score = 75.0
        alerts.append(
            f"Fungal disease outbreak condition detected (RH: {telemetry.sht_humidity}%, "
            f"Temp: {telemetry.sht_temperature}°C)"
        )
    elif telemetry.sht_humidity >= 70.0 and 12.0 <= telemetry.sht_temperature <= 30.0:
        fungal_level = "MODERATE"
        fungal_score = 45.0
        alerts.append(
            f"Moderate fungal pressure watch (RH: {telemetry.sht_humidity}%, "
            f"Temp: {telemetry.sht_temperature}°C). Scout susceptible leaves."
        )
    elif telemetry.sht_humidity >= 80.0 and telemetry.solar_irradiance < 250.0:
        fungal_level = "MODERATE"
        fungal_score = 40.0
        alerts.append(
            f"Canopy drying may be slow due to high humidity ({telemetry.sht_humidity}%) "
            f"and low light ({telemetry.solar_irradiance})."
        )
    else:
        fungal_level = "LOW"
        fungal_score = 10.0

    fungal_risk = RiskFactor(
        level=fungal_level,
        score=fungal_score,
        description=f"Relative humidity at {telemetry.sht_humidity}% with air temperature at {telemetry.sht_temperature}°C."
    )

    # -------------------------------------------------------------------------
    # 2. Heat Stress Risk Rule
    # Evaluates Wet-Bulb Globe Temperature (WBGT) and ambient temperature.
    # -------------------------------------------------------------------------
    if telemetry.wbgt_temperature >= 33.0 or telemetry.sht_temperature >= 38.0:
        heat_level = "CRITICAL"
        heat_score = 95.0
        alerts.append(
            f"Critical crop heat stress warning (WBGT: {telemetry.wbgt_temperature}°C, "
            f"Air Temp: {telemetry.sht_temperature}°C). Avoid additional crop stress."
        )
    elif telemetry.wbgt_temperature >= 30.0 or telemetry.sht_temperature >= 35.0:
        heat_level = "HIGH"
        heat_score = 85.0
        alerts.append(
            f"Severe crop heat stress warning (WBGT: {telemetry.wbgt_temperature}°C, "
            f"Air Temp: {telemetry.sht_temperature}°C)"
        )
    elif telemetry.wbgt_temperature >= 25.0 or telemetry.sht_temperature >= 30.0:
        heat_level = "MODERATE"
        heat_score = 50.0
        alerts.append(
            f"Moderate heat stress watch (WBGT: {telemetry.wbgt_temperature}°C). "
            "Prioritize irrigation checks during the cooler part of the day."
        )
    else:
        heat_level = "LOW"
        heat_score = 15.0

    heat_stress = RiskFactor(
        level=heat_level,
        score=heat_score,
        description=f"WBGT heat index observed at {telemetry.wbgt_temperature}°C."
    )

    # -------------------------------------------------------------------------
    # 3. Soil Washout / Heavy Rainfall Risk Rule
    # Evaluates daily cumulative rainfall and instant rain rates.
    # -------------------------------------------------------------------------
    if telemetry.daily_rain_total_mm >= 60.0 or telemetry.instant_rain_mm >= 20.0:
        washout_level = "CRITICAL"
        washout_score = 95.0
        alerts.append(
            f"Critical rainfall washout warning ({telemetry.daily_rain_total_mm}mm daily total). "
            "Inspect drainage, erosion channels, and nutrient loss risk."
        )
    elif telemetry.daily_rain_total_mm >= 35.0 or telemetry.instant_rain_mm >= 10.0:
        washout_level = "HIGH"
        washout_score = 80.0
        alerts.append(
            f"Heavy rainfall detected ({telemetry.daily_rain_total_mm}mm daily total). "
            f"High risk of soil erosion and nutrient leaching."
        )
    elif telemetry.daily_rain_total_mm >= 15.0 or telemetry.instant_rain_mm >= 2.0:
        washout_level = "MODERATE"
        washout_score = 45.0
        alerts.append(
            f"Moderate rainfall washout watch ({telemetry.daily_rain_total_mm}mm daily total). "
            "Delay fertilizer applications until runoff risk drops."
        )
    else:
        washout_level = "LOW"
        washout_score = 5.0

    soil_washout = RiskFactor(
        level=washout_level,
        score=washout_score,
        description=f"Cumulative daily rainfall at {telemetry.daily_rain_total_mm}mm."
    )

    # -------------------------------------------------------------------------
    # 4. Chemical Spraying Window Suitability
    # Spraying is unsuitable during active rain, high wind, high heat, or very dry air.
    # -------------------------------------------------------------------------
    if telemetry.instant_rain_mm > 0.0:
        spray_obj = SprayingSuitability(
            suitable=False,
            status="UNSUITABLE",
            reason="Active precipitation will wash off applied chemicals."
        )
    elif telemetry.wind_speed > 5.0:
        spray_obj = SprayingSuitability(
            suitable=False,
            status="UNSUITABLE",
            reason=f"Excessive wind speed ({telemetry.wind_speed} m/s) causes severe spray drift."
        )
    elif telemetry.sht_temperature >= 32.0:
        spray_obj = SprayingSuitability(
            suitable=False,
            status="UNSUITABLE",
            reason=f"High air temperature ({telemetry.sht_temperature}°C) increases evaporation and crop burn risk."
        )
    elif telemetry.sht_humidity < 40.0:
        spray_obj = SprayingSuitability(
            suitable=True,
            status="SUB-OPTIMAL",
            reason=f"Low relative humidity ({telemetry.sht_humidity}%) may increase droplet evaporation."
        )
    elif telemetry.wind_speed > 3.0:
        spray_obj = SprayingSuitability(
            suitable=True,
            status="SUB-OPTIMAL",
            reason=f"Moderate wind speed ({telemetry.wind_speed} m/s). Use low-drift nozzles and exercise caution."
        )
    else:
        spray_obj = SprayingSuitability(
            suitable=True,
            status="OPTIMAL",
            reason=f"Wind speed is low ({telemetry.wind_speed} m/s) and weather is clear. Ideal spraying window."
        )

    if (
        telemetry.daily_rain_total_mm <= 1.0
        and telemetry.sht_temperature >= 32.0
        and telemetry.sht_humidity <= 45.0
    ):
        alerts.append(
            f"Moisture stress watch: low rainfall ({telemetry.daily_rain_total_mm}mm), "
            f"high temperature ({telemetry.sht_temperature}°C), and dry air ({telemetry.sht_humidity}% RH)."
        )

    if telemetry.wind_speed >= 8.0:
        alerts.append(
            f"Wind damage watch: wind speed is {telemetry.wind_speed} m/s. "
            "Check staking, lodging-prone crops, and exposed seedlings."
        )

    # -------------------------------------------------------------------------
    # 5. Aggregate Risk Index Calculation (0.0 - 100.0)
    # Weighted calculation across all risk dimensions.
    # -------------------------------------------------------------------------
    aggregate_score = round(
        (fungal_risk.score * 0.40) + 
        (heat_stress.score * 0.30) + 
        (soil_washout.score * 0.30), 
        1
    )

    return AgronomicAssessment(
        station_id=telemetry.station_id,
        risk_score=aggregate_score,
        alerts=alerts,
        fungal_risk=fungal_risk,
        heat_stress=heat_stress,
        soil_washout=soil_washout,
        spraying_suitability=spray_obj
    )
