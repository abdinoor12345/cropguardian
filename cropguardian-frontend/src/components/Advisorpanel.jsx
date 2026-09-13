import { useState } from "react";
import { fetchAdvisory } from "../api";

const URGENCY_BADGES = {
  Immediate: "bg-red-100 text-[#8c2f24] border-red-200",
  "24-48 Hours": "bg-amber-100 text-[#8a6a10] border-amber-200",
  Routine: "bg-emerald-100 text-[#245c37] border-emerald-200",
};

export default function AdvisorPanel({ cropType, growthStage }) {
  const [advisory, setAdvisory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdvisory(cropType, growthStage);
      setAdvisory(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#e2e0d8] bg-white p-5 shadow-sm sm:p-6">
      {/* Header Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#1b3a2b]">
          AI Agronomy Advisor
        </h2>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg bg-[#1b3a2b] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#12281d] focus:outline-none focus:ring-2 focus:ring-[#1b3a2b] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Generating…
            </span>
          ) : (
            `Generate for ${cropType}`
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3.5 text-sm text-[#b3261e] border border-red-200">
          Couldn't generate advisory: {error}
        </div>
      )}

      {/* Empty State */}
      {!advisory && !loading && !error && (
        <p className="text-sm text-[#5c6b60]">
          Select a crop and growth stage, then generate an advisory for current conditions.
        </p>
      )}

      {/* Advisory Content */}
      {advisory && (
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-[#1b3a2b]">
            {advisory.summary}
          </p>

          {/* Risk Overview */}
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#5c6b60]">
              Risk overview
            </h3>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-[#4a4a44]">
              {advisory.risk_overview.map((item, i) => (
                <li key={i} className="leading-snug">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Recommendations */}
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#5c6b60]">
              Recommendations
            </h3>
            <div className="flex flex-col gap-2.5">
              {advisory.recommendations.map((rec, i) => {
                const badgeClass =
                  URGENCY_BADGES[rec.urgency] ||
                  "bg-stone-100 text-[#5c6b60] border-stone-200";

                return (
                  <div
                    key={i}
                    className="rounded-lg bg-[#f7f5f0] p-3.5 border border-[#e8e5dc] transition-all"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#1b3a2b]">
                        {rec.category}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${badgeClass}`}
                      >
                        {rec.urgency}
                      </span>
                    </div>
                    <p className="m-0 text-sm leading-snug text-[#4a4a44]">
                      {rec.action}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fallback Warning */}
          {advisory.status === "fallback" && (
            <p className="mt-4 rounded-md bg-[#fff6e0] p-2.5 text-xs text-[#8a6a10] border border-[#e6c67a]">
              Rule-based fallback used (AI advisory unavailable this time).
            </p>
          )}
        </div>
      )}
    </section>
  );
}