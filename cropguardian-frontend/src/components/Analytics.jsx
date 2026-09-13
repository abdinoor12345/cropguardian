import { useEffect, useMemo, useState } from "react";
import {
  fetchHistoricalTelemetry,
  historicalTelemetryExportUrl,
} from "../api";

const RANGE_OPTIONS = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

const SERIES = [
  {
    key: "sht_temperature",
    label: "Air Temperature",
    unit: "C",
    color: "#b45309",
  },
  {
    key: "sht_humidity",
    label: "Relative Humidity",
    unit: "%",
    color: "#0f766e",
  },
  {
    key: "wbgt_temperature",
    label: "WBGT",
    unit: "C",
    color: "#b91c1c",
  },
  {
    key: "barometric_pressure",
    label: "Atmospheric Pressure",
    unit: "hPa",
    color: "#1d4ed8",
  },
];

function formatDate(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function valueStats(data, key) {
  if (!data.length) return { min: 0, max: 0, avg: 0, latest: 0 };
  const values = data.map((item) => item[key]);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: total / values.length,
    latest: values[values.length - 1],
  };
}

function LineChart({ data, metric }) {
  const width = 760;
  const height = 210;
  const padding = 28;
  const stats = valueStats(data, metric.key);
  const range = stats.max - stats.min || 1;

  const points = data.map((item, index) => {
    const x =
      padding + (index / Math.max(data.length - 1, 1)) * (width - padding * 2);
    const y =
      height -
      padding -
      ((item[metric.key] - stats.min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#1b3a2b]">{metric.label}</h3>
          <p className="mt-1 text-xs text-[#5c6b60]">
            Avg {stats.avg.toFixed(1)} {metric.unit} · Min{" "}
            {stats.min.toFixed(1)} · Max {stats.max.toFixed(1)}
          </p>
        </div>
        <span className="rounded-md bg-stone-100 px-2.5 py-1 text-xs font-bold text-[#1b3a2b]">
          {stats.latest.toFixed(1)} {metric.unit}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-56 w-full"
        role="img"
        aria-label={`${metric.label} time-series chart`}
      >
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#d6d3c8"
          strokeWidth="1"
        />
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="#d6d3c8"
          strokeWidth="1"
        />
        <polyline
          fill="none"
          points={points.join(" ")}
          stroke={metric.color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        <text x={padding} y={20} fill="#78716c" fontSize="11">
          {stats.max.toFixed(1)}
        </text>
        <text x={padding} y={height - 8} fill="#78716c" fontSize="11">
          {stats.min.toFixed(1)}
        </text>
      </svg>
    </div>
  );
}

function buildWindBins(data) {
  const bins = [
    { label: "0-1", min: 0, max: 1, count: 0 },
    { label: "1-3", min: 1, max: 3, count: 0 },
    { label: "3-5", min: 3, max: 5, count: 0 },
    { label: "5+", min: 5, max: Infinity, count: 0 },
  ];

  data.forEach((item) => {
    const bin = bins.find(
      (candidate) =>
        item.wind_speed >= candidate.min && item.wind_speed < candidate.max,
    );
    if (bin) bin.count += 1;
  });

  const maxCount = Math.max(...bins.map((bin) => bin.count), 1);
  return bins.map((bin) => ({ ...bin, intensity: bin.count / maxCount }));
}

function buildRainfallBlocks(data) {
  const blockCount = 12;
  const chunkSize = Math.max(Math.ceil(data.length / blockCount), 1);
  const blocks = [];

  for (let index = 0; index < data.length; index += chunkSize) {
    const chunk = data.slice(index, index + chunkSize);
    const totals = chunk.map((item) => item.daily_rain_total_mm);
    const rainfall = Math.max(...totals) - Math.min(...totals);
    blocks.push({
      label: formatDate(chunk[0].timestamp),
      rainfall: Math.max(rainfall, 0),
    });
  }

  const maxRain = Math.max(...blocks.map((block) => block.rainfall), 1);
  return blocks.map((block) => ({
    ...block,
    intensity: block.rainfall / maxRain,
  }));
}

export default function Analytics() {
  const [range, setRange] = useState("24h");
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchHistoricalTelemetry(range)
      .then((result) => {
        if (!cancelled) setHistory(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range]);

  const records = history?.data || [];
  const rainfallBlocks = useMemo(() => buildRainfallBlocks(records), [records]);
  const windBins = useMemo(() => buildWindBins(records), [records]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-[#5c6b60]">
              JKUAT Conduit Station
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[#1b3a2b]">
              Historical Telemetry & Analytics
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#4a4a44]">
              Review weather trends, sensor diagnostics, rainfall accumulation,
              and wind speed distribution across selectable historical windows.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option.value)}
                className={`rounded-lg border px-4 py-2 text-sm font-bold ${
                  range === option.value
                    ? "border-[#1b3a2b] bg-[#1b3a2b] text-white"
                    : "border-stone-200 bg-white text-[#1b3a2b] hover:bg-stone-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading && (
        <section className="rounded-lg border border-stone-200 bg-white p-6 text-sm text-[#5c6b60]">
          Loading historical telemetry...
        </section>
      )}

      {error && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-[#b3261e]">
          Could not load historical telemetry: {error}
        </section>
      )}

      {history && !loading && !error && (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-[#5c6b60]">
                Records
              </p>
              <p className="mt-2 text-2xl font-bold text-[#1b3a2b]">
                {history.summary.record_count}
              </p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-[#5c6b60]">
                Rainfall
              </p>
              <p className="mt-2 text-2xl font-bold text-[#1b3a2b]">
                {history.summary.total_rainfall_mm.toFixed(1)} mm
              </p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-[#5c6b60]">
                Avg Wind
              </p>
              <p className="mt-2 text-2xl font-bold text-[#1b3a2b]">
                {history.summary.average_wind_speed.toFixed(1)} m/s
              </p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-[#5c6b60]">
                Window
              </p>
              <p className="mt-2 text-sm font-bold text-[#1b3a2b]">
                {formatDate(history.summary.from_timestamp)} to{" "}
                {formatDate(history.summary.to_timestamp)}
              </p>
            </div>
          </section>

          {history.is_mock && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-[#8a6a10]">
              Showing bundled station history because Conduit API credentials
              are not configured.
            </p>
          )}

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {SERIES.map((metric) => (
              <LineChart key={metric.key} data={records} metric={metric} />
            ))}
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-[#1b3a2b]">
                Precipitation Heatmap
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {rainfallBlocks.map((block) => (
                  <div
                    key={block.label}
                    className="rounded-md border border-stone-200 p-3"
                    style={{
                      backgroundColor: `rgba(15, 118, 110, ${
                        0.08 + block.intensity * 0.45
                      })`,
                    }}
                  >
                    <p className="text-xs font-semibold text-[#1b3a2b]">
                      {block.label}
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#0f4d47]">
                      {block.rainfall.toFixed(1)} mm
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-[#1b3a2b]">
                Wind Speed Distribution
              </h2>
              <div className="mt-4 space-y-3">
                {windBins.map((bin) => (
                  <div key={bin.label}>
                    <div className="mb-1 flex justify-between text-xs font-semibold text-[#5c6b60]">
                      <span>{bin.label} m/s</span>
                      <span>{bin.count} readings</span>
                    </div>
                    <div className="h-7 overflow-hidden rounded-md bg-stone-100">
                      <div
                        className="h-full bg-[#6f8f5f]"
                        style={{ width: `${Math.max(bin.intensity * 100, 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-[#1b3a2b]">
                Export Dataset
              </h2>
              <p className="mt-1 text-sm text-[#5c6b60]">
                Download the currently selected telemetry window for offline
                study.
              </p>
            </div>
            <div className="flex gap-2">
              <a
                className="rounded-lg bg-[#1b3a2b] px-4 py-2 text-sm font-bold text-white"
                href={historicalTelemetryExportUrl(range, "csv")}
              >
                CSV
              </a>
              <a
                className="rounded-lg border border-[#1b3a2b] px-4 py-2 text-sm font-bold text-[#1b3a2b]"
                href={historicalTelemetryExportUrl(range, "json")}
              >
                JSON
              </a>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
