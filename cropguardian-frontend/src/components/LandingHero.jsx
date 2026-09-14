import { useEffect, useMemo, useState } from "react";
import { fetchAssessment } from "../api";
import heroImage from "../assets/hero.png";

function riskLevelFromScore(score) {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 35) return "MODERATE";
  return "LOW";
}

function strongestRisk(assessment) {
  if (!assessment) return "Loading live risk";

  const risks = [
    ["Fungal pressure", assessment.fungal_risk],
    ["Heat stress", assessment.heat_stress],
    ["Soil washout", assessment.soil_washout],
  ];

  return risks.sort((a, b) => b[1].score - a[1].score)[0][0];
}

export default function LandingHero({ cropType, growthStage }) {
  const [assessment, setAssessment] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchAssessment()
      .then((result) => {
        if (!cancelled) setAssessment(result);
      })
      .catch(() => {
        if (!cancelled) setAssessment(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const riskLevel = assessment ? riskLevelFromScore(assessment.risk_score) : "SYNCING";
  const heroStats = useMemo(
    () => [
      ["Crop", cropType],
      ["Stage", growthStage],
      ["Top risk", strongestRisk(assessment)],
      ["Spray window", assessment?.spraying_suitability.status || "Checking"],
    ],
    [assessment, cropType, growthStage],
  );

  return (
    <section className="relative overflow-hidden rounded-xl border border-[#cfd8c8] bg-[#163b2b] text-white shadow-sm">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      <div className="absolute inset-0 bg-[#163b2b]/75" />

      <div className="relative grid gap-5 p-6 md:grid-cols-[1.35fr_1fr] md:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#cfe7c0]">
            JKUAT Conduit + Claude + Adaption
          </p>
          <h1 className="mt-2 max-w-3xl text-3xl font-bold leading-tight md:text-4xl">
            CropGuardian turns weather data into farmer-ready crop risk decisions.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#edf7e8] md:text-base">
            Monitor microclimate conditions, detect disease and weather stress,
            generate AI advisories, and preview short-term field risk from one
            operational dashboard.
          </p>
        </div>

        <div className="rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-[#cfe7c0]">
                Live risk status
              </p>
              <p className="mt-1 text-2xl font-bold">
                {assessment ? `${assessment.risk_score}/100` : "--/100"}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#163b2b]">
              {riskLevel}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {heroStats.map(([label, value]) => (
              <div key={label} className="rounded-lg bg-white/10 p-3">
                <p className="text-[11px] font-bold uppercase text-[#cfe7c0]">
                  {label}
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
