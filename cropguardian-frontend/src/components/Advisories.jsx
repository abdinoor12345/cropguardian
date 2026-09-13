import { useEffect, useMemo, useState } from "react";
import {
  fetchAdvisory,
  fetchAdvisoryHistory,
  updateAdvisoryOutcome,
} from "../api";
import { useCropCatalog } from "../cropCatalog";

const RISK_LEVELS = ["LOW", "MODERATE", "HIGH", "CRITICAL"];

const RISK_STYLES = {
  LOW: "border-emerald-200 bg-emerald-50 text-[#245c37]",
  MODERATE: "border-amber-200 bg-amber-50 text-[#8a6a10]",
  HIGH: "border-red-200 bg-red-50 text-[#8c2f24]",
  CRITICAL: "border-red-300 bg-red-100 text-[#7f1d1d]",
};

function formatDateTime(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function SensorSnapshot({ telemetry }) {
  const readings = [
    ["Air temp", `${telemetry.sht_temperature.toFixed(1)} C`],
    ["Humidity", `${telemetry.sht_humidity.toFixed(1)}%`],
    ["WBGT", `${telemetry.wbgt_temperature.toFixed(1)} C`],
    ["Pressure", `${telemetry.barometric_pressure.toFixed(1)} hPa`],
    ["Rain", `${telemetry.daily_rain_total_mm.toFixed(1)} mm`],
    ["Wind", `${telemetry.wind_speed.toFixed(1)} m/s`],
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {readings.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-[#f7f5f0] p-3">
          <p className="text-xs font-bold uppercase text-[#5c6b60]">{label}</p>
          <p className="mt-1 text-lg font-bold text-[#1b3a2b]">{value}</p>
        </div>
      ))}
    </div>
  );
}

function RuleFlags({ assessment }) {
  const flags = [
    ["Fungal disease", assessment.fungal_risk],
    ["Heat stress", assessment.heat_stress],
    ["Soil washout", assessment.soil_washout],
  ];

  return (
    <div className="space-y-2">
      {flags.map(([label, risk]) => (
        <div
          key={label}
          className="rounded-lg border border-stone-200 bg-white p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-[#1b3a2b]">{label}</p>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                RISK_STYLES[risk.level] || RISK_STYLES.LOW
              }`}
            >
              {risk.level}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#5c6b60]">{risk.description}</p>
        </div>
      ))}
      <div className="rounded-lg border border-stone-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-[#1b3a2b]">Spraying window</p>
          <span className="rounded-full border border-stone-200 bg-stone-100 px-2.5 py-1 text-xs font-bold text-[#1b3a2b]">
            {assessment.spraying_suitability.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-[#5c6b60]">
          {assessment.spraying_suitability.reason}
        </p>
      </div>
    </div>
  );
}

export default function Advisories() {
  const { crops } = useCropCatalog();
  const [entries, setEntries] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    crop_type: "",
    risk_level: "",
    date: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingOutcome, setSavingOutcome] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAdvisoryHistory(filters)
      .then((result) => {
        if (cancelled) return;
        setEntries(result.data);
        setSelectedId((current) => current || result.data[0]?.id || null);
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
  }, [filters, refreshKey]);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedId) || entries[0],
    [entries, selectedId],
  );

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setSelectedId(null);
  }

  async function handleOutcomeToggle(outcome, completed) {
    if (!selectedEntry) return;
    const savingKey = `${selectedEntry.id}-${outcome.id}`;
    setSavingOutcome(savingKey);

    try {
      const updated = await updateAdvisoryOutcome(
        selectedEntry.id,
        outcome.id,
        completed,
      );
      setEntries((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setSelectedId(updated.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingOutcome(null);
    }
  }

  async function handleGenerateCurrentAdvisory() {
    setGenerating(true);
    setError(null);

    try {
      await fetchAdvisory("Maize", "Vegetative");
      setFilters({
        search: "",
        crop_type: "",
        risk_level: "",
        date: "",
      });
      setSelectedId(null);
      setRefreshKey((current) => current + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm md:p-6">
        <p className="text-xs font-bold uppercase text-[#5c6b60]">
          Advisory History
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[#1b3a2b]">
          Advisory History & Action Log
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#4a4a44]">
          Search generated recommendations, inspect the sensor and rule context
          behind them, and track which interventions have been completed.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm lg:grid-cols-4">
        <input
          type="search"
          value={filters.search}
          onChange={(event) => updateFilter("search", event.target.value)}
          placeholder="Search recommendations"
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[#1b3a2b] focus:ring-2 focus:ring-[#d6e8c8]"
        />
        <select
          value={filters.crop_type}
          onChange={(event) => updateFilter("crop_type", event.target.value)}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[#1b3a2b] focus:ring-2 focus:ring-[#d6e8c8]"
        >
          <option value="">All crops</option>
          {crops.map((crop) => (
            <option key={crop} value={crop}>
              {crop}
            </option>
          ))}
        </select>
        <select
          value={filters.risk_level}
          onChange={(event) => updateFilter("risk_level", event.target.value)}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[#1b3a2b] focus:ring-2 focus:ring-[#d6e8c8]"
        >
          <option value="">All risk levels</option>
          {RISK_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filters.date}
          onChange={(event) => updateFilter("date", event.target.value)}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[#1b3a2b] focus:ring-2 focus:ring-[#d6e8c8]"
        />
      </section>

      {loading && (
        <section className="rounded-lg border border-stone-200 bg-white p-6 text-sm text-[#5c6b60]">
          Loading advisory history...
        </section>
      )}

      {error && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-[#b3261e]">
          {error}
        </section>
      )}

      {!loading && !error && entries.length === 0 && (
        <section className="rounded-lg border border-stone-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#1b3a2b]">
                No advisory records yet
              </h2>
              <p className="mt-1 text-sm text-[#5c6b60]">
                Generate the first Maize advisory from current station
                conditions, then use the feed and outcome tracker here.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateCurrentAdvisory}
              disabled={generating}
              className="rounded-lg bg-[#1b3a2b] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generating ? "Generating..." : "Generate Current Advisory"}
            </button>
          </div>
        </section>
      )}

      {selectedEntry && !loading && (
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
          <div className="space-y-3">
            {entries.map((entry) => {
              const completedCount = entry.outcomes.filter(
                (outcome) => outcome.completed,
              ).length;
              const isSelected = selectedEntry.id === entry.id;

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  className={`w-full rounded-lg border p-4 text-left shadow-sm transition ${
                    isSelected
                      ? "border-[#1b3a2b] bg-[#eef5e9]"
                      : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-[#1b3a2b]">
                        {entry.crop_type} · {entry.growth_stage}
                      </p>
                      <p className="mt-1 text-xs text-[#5c6b60]">
                        {formatDateTime(entry.created_at)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                        RISK_STYLES[entry.risk_level] || RISK_STYLES.LOW
                      }`}
                    >
                      {entry.risk_level}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-5 text-[#4a4a44]">
                    {entry.advisory.summary}
                  </p>
                  <p className="mt-3 text-xs font-semibold text-[#5c6b60]">
                    {completedCount}/{entry.outcomes.length} interventions done
                  </p>
                </button>
              );
            })}
          </div>

          <article className="space-y-5 rounded-lg border border-stone-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-[#5c6b60]">
                  {selectedEntry.crop_type} · {selectedEntry.growth_stage}
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#1b3a2b]">
                  {formatDateTime(selectedEntry.created_at)}
                </h2>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-bold ${
                  RISK_STYLES[selectedEntry.risk_level] || RISK_STYLES.LOW
                }`}
              >
                {selectedEntry.risk_score}/100 · {selectedEntry.risk_level}
              </span>
            </div>

            <section>
              <h3 className="mb-3 text-sm font-bold uppercase text-[#5c6b60]">
                Sensor Snapshot
              </h3>
              <SensorSnapshot telemetry={selectedEntry.telemetry} />
            </section>

            <section>
              <h3 className="mb-3 text-sm font-bold uppercase text-[#5c6b60]">
                Adaption AI Forecast
              </h3>
              <p className="rounded-lg bg-[#f7f5f0] p-4 text-sm leading-6 text-[#1b3a2b]">
                {selectedEntry.advisory.summary}
              </p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[#4a4a44]">
                {selectedEntry.advisory.risk_overview.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-bold uppercase text-[#5c6b60]">
                Rule Flags
              </h3>
              <RuleFlags assessment={selectedEntry.assessment} />
            </section>

            <section>
              <h3 className="mb-3 text-sm font-bold uppercase text-[#5c6b60]">
                Outcome Tracking
              </h3>
              <div className="space-y-3">
                {selectedEntry.outcomes.map((outcome) => {
                  const savingKey = `${selectedEntry.id}-${outcome.id}`;

                  return (
                    <label
                      key={outcome.id}
                      className="flex gap-3 rounded-lg border border-stone-200 bg-white p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={outcome.completed}
                        disabled={savingOutcome === savingKey}
                        onChange={(event) =>
                          handleOutcomeToggle(outcome, event.target.checked)
                        }
                        className="mt-1 h-4 w-4 rounded border-stone-300 text-[#1b3a2b]"
                      />
                      <span>
                        <span className="block font-bold text-[#1b3a2b]">
                          {outcome.category}
                        </span>
                        <span className="block leading-5 text-[#4a4a44]">
                          {outcome.label}
                        </span>
                        {outcome.completed_at && (
                          <span className="mt-1 block text-xs text-[#5c6b60]">
                            Completed {formatDateTime(outcome.completed_at)}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          </article>
        </section>
      )}
    </main>
  );
}
