import { useEffect, useState } from "react";
import { fetchForecast } from "../api";

const READINGS = [
  {
    key: "sht_temperature",
    label: "Air Temp",
    unit: "C",
    decimals: 1,
    accent: "bg-amber-100 text-amber-800",
  },
  {
    key: "sht_humidity",
    label: "Humidity",
    unit: "%",
    decimals: 1,
    accent: "bg-teal-100 text-teal-800",
  },
  {
    key: "wbgt_temperature",
    label: "WBGT",
    unit: "C",
    decimals: 1,
    accent: "bg-red-100 text-red-800",
  },
  {
    key: "wind_speed",
    label: "Wind",
    unit: "m/s",
    decimals: 1,
    accent: "bg-sky-100 text-sky-800",
  },
  {
    key: "daily_rain_total_mm",
    label: "Rain Total",
    unit: "mm",
    decimals: 1,
    accent: "bg-blue-100 text-blue-800",
  },
  {
    key: "barometric_pressure",
    label: "Pressure",
    unit: "hPa",
    decimals: 1,
    accent: "bg-lime-100 text-lime-800",
  },
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

function formatSourceTime(value) {
  if (!value) return null;

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
    <div className={`min-w-0 rounded-lg border px-3 py-2 ${chipClass}`}>
      <p className="m-0 text-[11px] font-bold uppercase">{label}</p>
      <p className="m-0 mt-1 text-sm font-bold leading-snug">
        {factor.level} · {factor.score.toFixed(0)}
      </p>
    </div>
  );
}

function strongestForecastDriver(assessment) {
  const drivers = [
    ["Fungal pressure", assessment.fungal_risk],
    ["Heat stress", assessment.heat_stress],
    ["Soil washout", assessment.soil_washout],
  ];
  return drivers.sort((left, right) => right[1].score - left[1].score)[0];
}

function FieldRows() {
  return (
    <div className="grid grid-cols-6 gap-1.5" aria-hidden="true">
      {[70, 48, 82, 58, 76, 52].map((height, index) => (
        <span
          key={index}
          className="block rounded-t-full bg-[#b8d27a]"
          style={{ height }}
        />
      ))}
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
  const sourceTime = formatSourceTime(telemetry.timestamp);
  const [driverLabel, driver] = strongestForecastDriver(assessment);

  return (
    <section className="overflow-hidden rounded-xl border border-[#d6dfc6] bg-white shadow-sm">
      <div className="relative bg-[#183d2c] p-5 text-white sm:p-6">
        <div className="absolute bottom-0 right-5 w-24 opacity-25">
          <FieldRows />
        </div>

        <div className="relative grid gap-4">
          <div>
            <p className="m-0 text-xs font-bold uppercase text-[#cfe7c0]">
              Adaption model forecast
            </p>
            <h2 className="mt-1 text-xl font-bold leading-tight">
              Next-hour microclimate outlook
            </h2>
            <p className="mt-2 text-sm leading-snug text-[#edf7e8]">
              Forecast for {formatForecastTime(forecast.forecast_for)}
            </p>
            {sourceTime && (
              <p className="mt-1 text-xs leading-snug text-[#cfe7c0]">
                Based on latest station reading from {sourceTime}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-white/20 bg-white px-3 py-2 text-xs font-bold uppercase text-[#1b3a2b]">
            Risk score: {assessment.risk_score}/100
            </span>
            {forecast.status === "fallback" && (
              <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold uppercase text-[#8a6a10]">
                Trend fallback
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-3">
          {READINGS.map(({ key, label, unit, decimals, accent }) => (
            <div
              key={key}
              className="min-w-0 rounded-lg border border-[#e6eadf] bg-[#fbfdf8] p-3.5"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="m-0 text-xs font-bold text-[#5c6b60]">{label}</p>
                <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
              </div>
              <p className="m-0 text-2xl font-bold leading-none text-[#1b3a2b]">
                {telemetry[key].toFixed(decimals)}
              </p>
              <p className="m-0 mt-1 text-xs font-semibold text-[#5c6b60]">
                {unit}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-[#e7dcc3] bg-[#fffaf0] p-3.5">
          <p className="m-0 text-xs font-bold uppercase text-[#7b5b16]">
            Field operation signal
          </p>
          <p className="m-0 mt-1 text-sm font-semibold leading-snug text-[#1b3a2b]">
            {assessment.spraying_suitability.status}
            <span className="font-normal text-[#5c6b60]">
              {" "}
              - {assessment.spraying_suitability.reason}
            </span>
          </p>
          <div className="mt-3 border-t border-[#eadfca] pt-3">
            <p className="m-0 text-xs font-bold uppercase text-[#7b5b16]">
              Why this forecast matters
            </p>
            <p className="m-0 mt-1 text-sm leading-snug text-[#4a4a44]">
              {driverLabel} is the strongest projected driver at {driver.score.toFixed(0)}/100. {assessment.alerts[0] || driver.description}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <RiskChip label="Fungal" factor={assessment.fungal_risk} />
          <RiskChip label="Heat" factor={assessment.heat_stress} />
          <RiskChip label="Washout" factor={assessment.soil_washout} />
          <div className="min-w-0 rounded-lg border border-[#e6eadf] bg-[#f7f5f0] px-3 py-2">
            <p className="m-0 text-[11px] font-bold uppercase text-[#5c6b60]">
              Model status
            </p>
            <p className="m-0 mt-1 text-sm font-bold leading-snug text-[#1b3a2b]">
              {forecast.status === "fallback" ? "Fallback" : "Active"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
