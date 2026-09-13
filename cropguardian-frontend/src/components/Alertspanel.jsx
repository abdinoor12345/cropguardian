import { useEffect, useState } from "react";
import { fetchAdvisory, fetchAssessment } from "../api";

const LEVEL_STYLES = {
  CRITICAL: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-[#8c2f24]",
    label: "CRITICAL",
  },
  HIGH: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-[#8c2f24]",
    label: "HIGH RISK",
  },
  MODERATE: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-[#8a6a10]",
    label: "MODERATE RISK",
  },
  LOW: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-[#245c37]",
    label: "LOW RISK",
  },
};

function RiskCard({ title, level, description }) {
  const style = LEVEL_STYLES[level] || LEVEL_STYLES.LOW;
  return (
    <div
      className={`rounded-lg border p-3.5 transition-all ${style.bg} ${style.border}`}
    >
      <p className={`m-0 text-xs font-bold tracking-wide ${style.text}`}>
        {style.label}
      </p>
      <p className="my-1 text-base font-semibold text-[#1b3a2b]">
        {title}
      </p>
      <p className="m-0 text-sm leading-snug text-[#4a4a44]">
        {description}
      </p>
    </div>
  );
}

const ALERT_ACTIONS = {
  "Fungal Disease Pressure":
    "Scout lower leaves, improve canopy airflow, and prepare a protective spray only when the spray window is suitable.",
  "Heat Stress":
    "Irrigate early where available, reduce additional crop stress, and avoid foliar applications during peak heat.",
  "Soil Washout":
    "Check drainage paths, delay fertilizer applications, and inspect exposed roots or washed ridges after rain.",
};

function getRiskPriority(level) {
  return { CRITICAL: 4, HIGH: 3, MODERATE: 2, LOW: 1 }[level] || 0;
}

function AlertFeed({ alerts }) {
  if (!alerts.length) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5">
        <p className="m-0 text-sm font-semibold text-[#245c37]">
          No active severe warnings
        </p>
        <p className="m-0 mt-1 text-sm leading-snug text-[#4a4a44]">
          Current rules show routine monitoring conditions. Keep checking humidity,
          WBGT, rainfall, and wind before field operations.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {alerts.map((alert) => (
        <div
          key={alert}
          className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm leading-snug text-[#4a4a44]"
        >
          {alert}
        </div>
      ))}
    </div>
  );
}

function RecommendationList({ advisory, loading, error }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="h-16 w-full animate-pulse rounded-lg bg-stone-100" />
        <div className="h-16 w-full animate-pulse rounded-lg bg-stone-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-[#8a6a10]">
        AI recommendations are unavailable right now: {error}
      </div>
    );
  }

  if (!advisory?.recommendations?.length) {
    return (
      <div className="rounded-lg border border-stone-200 bg-[#f7f5f0] p-3.5 text-sm text-[#5c6b60]">
        AI recommendations will appear once the advisory service responds.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {advisory.recommendations.slice(0, 3).map((rec, index) => (
        <div
          key={`${rec.category}-${index}`}
          className="rounded-lg border border-[#e8e5dc] bg-[#f7f5f0] p-3.5"
        >
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[#1b3a2b]">
              {rec.category}
            </span>
            <span className="rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-xs font-bold text-[#5c6b60]">
              {rec.urgency}
            </span>
          </div>
          <p className="m-0 text-sm leading-snug text-[#4a4a44]">
            {rec.action}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function AlertsPanel({ cropType = "Maize", growthStage = "Vegetative" }) {
  const [assessment, setAssessment] = useState(null);
  const [advisory, setAdvisory] = useState(null);
  const [error, setError] = useState(null);
  const [advisoryError, setAdvisoryError] = useState(null);
  const [advisoryLoading, setAdvisoryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setError(null);
    setAdvisoryError(null);
    setAdvisoryLoading(true);
    setAdvisory(null);

    Promise.allSettled([
      fetchAssessment(),
      fetchAdvisory(cropType, growthStage),
    ]).then(([assessmentResult, advisoryResult]) => {
      if (cancelled) return;

      if (assessmentResult.status === "fulfilled") {
        setAssessment(assessmentResult.value);
      } else {
        setError(assessmentResult.reason.message);
      }

      if (advisoryResult.status === "fulfilled") {
        setAdvisory(advisoryResult.value);
      } else {
        setAdvisoryError(advisoryResult.reason.message);
      }

      setAdvisoryLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [cropType, growthStage]);

  if (error) {
    return (
      <section className="rounded-xl border border-[#e2e0d8] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-3 text-lg font-semibold text-[#1b3a2b]">
          Early Warning Alerts
        </h2>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-[#b3261e]">
          Couldn't load risk assessment: {error}
        </div>
      </section>
    );
  }

  if (!assessment) {
    return (
      <section className="rounded-xl border border-[#e2e0d8] bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#1b3a2b]">
            Early Warning Alerts
          </h2>
          <span className="h-4 w-24 animate-pulse rounded bg-stone-200" />
        </div>
        
        {/* Skeleton Loaders */}
        <div className="flex flex-col gap-2.5">
          <div className="h-20 w-full animate-pulse rounded-lg bg-stone-100" />
          <div className="h-20 w-full animate-pulse rounded-lg bg-stone-100" />
          <div className="h-20 w-full animate-pulse rounded-lg bg-stone-100" />
        </div>
      </section>
    );
  }

  const riskFactors = assessment
    ? [
        {
          title: "Fungal Disease Pressure",
          level: assessment.fungal_risk.level,
          score: assessment.fungal_risk.score,
          description: assessment.fungal_risk.description,
        },
        {
          title: "Heat Stress",
          level: assessment.heat_stress.level,
          score: assessment.heat_stress.score,
          description: assessment.heat_stress.description,
        },
        {
          title: "Soil Washout",
          level: assessment.soil_washout.level,
          score: assessment.soil_washout.score,
          description: assessment.soil_washout.description,
        },
      ].sort((a, b) => getRiskPriority(b.level) - getRiskPriority(a.level))
    : [];

  const highestRisk = riskFactors[0];
  const elevatedCount = riskFactors.filter((risk) =>
    ["CRITICAL", "HIGH", "MODERATE"].includes(risk.level),
  ).length;

  return (
    <section className="rounded-xl border border-[#e2e0d8] bg-white p-5 shadow-sm sm:p-6">
      {/* Header Row */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1b3a2b]">
          Early Warning Alerts
        </h2>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-[#5c6b60] border border-stone-200">
          Risk score: {assessment.risk_score}/100
        </span>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[#e8e5dc] bg-[#f7f5f0] p-3">
          <p className="m-0 text-xs font-bold uppercase text-[#5c6b60]">
            Top concern
          </p>
          <p className="m-0 mt-1 text-sm font-semibold text-[#1b3a2b]">
            {highestRisk.title}
          </p>
        </div>
        <div className="rounded-lg border border-[#e8e5dc] bg-[#f7f5f0] p-3">
          <p className="m-0 text-xs font-bold uppercase text-[#5c6b60]">
            Elevated alerts
          </p>
          <p className="m-0 mt-1 text-sm font-semibold text-[#1b3a2b]">
            {elevatedCount} active
          </p>
        </div>
        <div className="rounded-lg border border-[#e8e5dc] bg-[#f7f5f0] p-3">
          <p className="m-0 text-xs font-bold uppercase text-[#5c6b60]">
            Crop context
          </p>
          <p className="m-0 mt-1 text-sm font-semibold text-[#1b3a2b]">
            {cropType} / {growthStage}
          </p>
        </div>
      </div>

      {/* Risk Cards */}
      <div className="flex flex-col gap-2.5">
        {riskFactors.map((risk) => (
          <RiskCard
            key={risk.title}
            title={`${risk.title} (${risk.score.toFixed(0)}/100)`}
            level={risk.level}
            description={`${risk.description} ${ALERT_ACTIONS[risk.title]}`}
          />
        ))}
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5c6b60]">
          Active warning feed
        </h3>
        <AlertFeed alerts={assessment.alerts} />
      </div>

      <div className="mt-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[#5c6b60]">
            AI recommended actions
          </h3>
          {advisory?.status === "fallback" && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-[#8a6a10]">
              Rule fallback
            </span>
          )}
        </div>
        {advisory?.summary && (
          <p className="mb-3 rounded-lg border border-[#e8e5dc] bg-white p-3 text-sm leading-snug text-[#4a4a44]">
            {advisory.summary}
          </p>
        )}
        <RecommendationList
          advisory={advisory}
          loading={advisoryLoading}
          error={advisoryError}
        />
      </div>

      {/* Spray Window Status Footer */}
      <div className="mt-4 border-t border-[#e2e0d8] pt-3.5 text-sm text-[#4a4a44]">
        <span className="mr-1.5 font-medium text-[#5c6b60]">
          Spraying window:
        </span>
        <span className="mr-1.5 font-bold text-[#1b3a2b]">
          {assessment.spraying_suitability.status}
        </span>
        <span className="text-[#5c6b60]">
          — {assessment.spraying_suitability.reason}
        </span>
      </div>
    </section>
  );
}
