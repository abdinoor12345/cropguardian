import { useEffect, useState } from "react";
import { fetchForecast } from "../api";

const READINGS = [
  { key: "sht_temperature", label: "Air Temp", unit: "C", decimals: 1 },
  { key: "sht_humidity", label: "Humidity", unit: "%", decimals: 1 },
  { key: "wbgt_temperature", label: "WBGT", unit: "C", decimals: 1 },
  { key: "wind_speed", label: "Wind", unit: "m/s", decimals: 1 },
  { key: "daily_rain_total_mm", label: "Rain Total", unit: "mm", decimals: 1 },
  { key: "barometric_pressure", label: "Pressure", unit: "hPa", decimals: 1 },
];

const LEVEL_CLASSES = {
  LOW: "border-emerald-200 bg-emerald-50 text-[#245c37]",
  MODERATE: "border-amber-200 bg-amber-50 text-[#8a6a10]",
  HIGH: "border-red-200 bg-red-50 text-[#8c2f24]",
  CRITICAL: "border-red-200 bg-red-50 text-[#8c2f24]",
};

function formatForecastTime(value) {
  if (!value) return "Next hour";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function RiskChip({ label, factor }) {
  const chipClass = LEVEL_CLASSES[factor.level] || LEVEL_CLASSES.LOW;

  return (
    <div className={`rounded-lg border px-3 py-2 ${chipClass}`}>
      <p className="m-0 text-[11px] font-bold uppercase">{label}</p>
      <p className="m-0 mt-1 text-sm font-bold">
        {factor.level} · {factor.score.toFixed(0)}
      </p>
    </div>
  );
}

export default function ForecastPanel() {
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchForecast()
      .then((result) => {
        if (!cancelled) setForecast(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-[#b3261e] shadow-sm">
        Could not load Adaption forecast: {error}
      </section>
    );
  }

  if (!forecast) {
    return (
      <section className="rounded-xl border border-[#e2e0d8] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="h-4 w-32 animate-pulse rounded bg-stone-200" />
            <div className="mt-3 h-6 w-56 animate-pulse rounded bg-stone-100" />
          </div>
          <div className="h-8 w-24 animate-pulse rounded bg-stone-100" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {READINGS.map((reading) => (
            <div key={reading.key} className="h-20 animate-pulse rounded-lg bg-stone-100" />
          ))}
        </div>
      </section>
    );
  }

  const telemetry = forecast.predicted_telemetry;
  const assessment = forecast.predicted_assessment;

  return (
    <section className="rounded-xl border border-[#dce8d2] bg-[#fbfdf8] p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="m-0 text-xs font-bold uppercase text-[#5c6b60]">
            Adaption model forecast
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#1b3a2b]">
            Next-hour microclimate outlook
          </h2>
          <p className="mt-1 text-sm text-[#5c6b60]">
            Forecast for {formatForecastTime(forecast.forecast_for)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-[#d8d5cb] bg-white px-3 py-2 text-xs font-bold uppercase text-[#1b3a2b]">
            Risk score: {assessment.risk_score}/100
          </span>
          {forecast.status === "fallback" && (
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold uppercase text-[#8a6a10]">
              Trend fallback
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {READINGS.map(({ key, label, unit, decimals }) => (
          <div key={key} className="rounded-lg border border-[#e6eadf] bg-white p-3">
            <p className="m-0 text-xs font-bold text-[#5c6b60]">{label}</p>
            <p className="m-0 mt-1 text-xl font-semibold text-[#1b3a2b]">
              {telemetry[key].toFixed(decimals)}
              <span className="text-sm font-normal text-[#5c6b60]"> {unit}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <RiskChip label="Fungal" factor={assessment.fungal_risk} />
        <RiskChip label="Heat" factor={assessment.heat_stress} />
        <RiskChip label="Washout" factor={assessment.soil_washout} />
        <div className="rounded-lg border border-[#e6eadf] bg-white px-3 py-2">
          <p className="m-0 text-[11px] font-bold uppercase text-[#5c6b60]">
            Spray window
          </p>
          <p className="m-0 mt-1 text-sm font-bold text-[#1b3a2b]">
            {assessment.spraying_suitability.status}
          </p>
        </div>
      </div>
    </section>
  );
}
