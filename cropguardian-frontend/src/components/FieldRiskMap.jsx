import { useEffect, useMemo, useState } from "react";
import { fetchAssessment } from "../api";

const LEVEL_COLORS = {
  LOW: "bg-emerald-500 border-emerald-700",
  MODERATE: "bg-yellow-300 border-yellow-600",
  HIGH: "bg-orange-400 border-orange-700",
  CRITICAL: "bg-red-500 border-red-800",
};

const LEVEL_TEXT = {
  LOW: "text-[#245c37]",
  MODERATE: "text-[#8a6a10]",
  HIGH: "text-[#8a3b11]",
  CRITICAL: "text-[#8c2f24]",
};

const BASE_PLOTS = [
  { id: "A1", label: "A1", crop: "Maize", x: "8%", y: "12%", w: "18%", h: "26%", rotate: "3deg", factor: "fungal_risk" },
  { id: "A2", label: "A2", crop: "Tomato", x: "31%", y: "9%", w: "17%", h: "28%", rotate: "5deg", factor: "heat_stress" },
  { id: "A3", label: "A3", crop: "Beans", x: "52%", y: "13%", w: "18%", h: "25%", rotate: "-6deg", factor: "soil_washout" },
  { id: "B1", label: "B1", crop: "Coffee", x: "12%", y: "47%", w: "20%", h: "31%", rotate: "-4deg", factor: "soil_washout" },
  { id: "B2", label: "B2", crop: "Potato", x: "38%", y: "45%", w: "18%", h: "34%", rotate: "4deg", factor: "fungal_risk" },
  { id: "B3", label: "B3", crop: "Kale", x: "62%", y: "45%", w: "20%", h: "34%", rotate: "-2deg", factor: "heat_stress" },
];

function getOverallLevel(score) {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 35) return "MODERATE";
  return "LOW";
}

function buildPlots(assessment) {
  if (!assessment) {
    return BASE_PLOTS.map((plot) => ({ ...plot, level: "LOW", score: 0 }));
  }

  return BASE_PLOTS.map((plot, index) => {
    const factor = assessment[plot.factor];
    const level = factor?.level || getOverallLevel(assessment.risk_score);
    const score = Math.min(100, Math.max(0, (factor?.score || assessment.risk_score) + index * 2 - 5));

    return { ...plot, level, score };
  });
}

export default function FieldRiskMap() {
  const [assessment, setAssessment] = useState(null);
  const [error, setError] = useState(null);
  const [selectedPlotId, setSelectedPlotId] = useState("A1");

  useEffect(() => {
    let cancelled = false;

    fetchAssessment()
      .then((result) => {
        if (!cancelled) setAssessment(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const plots = useMemo(() => buildPlots(assessment), [assessment]);
  const selectedPlot = plots.find((plot) => plot.id === selectedPlotId) || plots[0];
  const overallLevel = assessment ? getOverallLevel(assessment.risk_score) : "LOW";

  return (
    <section className="rounded-xl border border-[#e2e0d8] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1b3a2b]">Field Risk Map</h2>
          <p className="mt-1 text-sm text-[#5c6b60]">
            JKUAT demo plots colored by current rule-engine risk.
          </p>
        </div>
        <span className={`rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs font-bold ${LEVEL_TEXT[overallLevel]}`}>
          {assessment ? `${assessment.risk_score}/100` : "Loading"}
        </span>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-[#8a6a10]">
          Map is showing demo risk colors while assessment is unavailable: {error}
        </div>
      )}

      <div className="relative h-72 overflow-hidden rounded-lg border border-[#cfd8c8] bg-[#edf2e8]">
        <div className="absolute left-0 top-0 z-10 flex flex-col border border-stone-300 bg-white shadow-sm">
          <button className="h-8 w-8 border-b border-stone-300 text-lg font-semibold text-[#1b3a2b]" type="button">+</button>
          <button className="h-8 w-8 text-lg font-semibold text-[#1b3a2b]" type="button">-</button>
        </div>

        <div className="absolute inset-0 opacity-70">
          <div className="absolute left-[-10%] top-[25%] h-2 w-[125%] rotate-[-18deg] bg-white" />
          <div className="absolute left-[-8%] top-[62%] h-2 w-[120%] rotate-[12deg] bg-white" />
          <div className="absolute left-[28%] top-[-8%] h-[120%] w-2 rotate-[10deg] bg-white" />
          <div className="absolute left-[76%] top-[-8%] h-[120%] w-2 rotate-[-8deg] bg-white" />
        </div>

        {plots.map((plot) => (
          <button
            key={plot.id}
            type="button"
            onClick={() => setSelectedPlotId(plot.id)}
            className={`absolute border-2 p-2 text-left shadow-sm transition hover:brightness-105 ${
              LEVEL_COLORS[plot.level] || LEVEL_COLORS.LOW
            } ${selectedPlot.id === plot.id ? "ring-2 ring-[#1b3a2b] ring-offset-2" : ""}`}
            style={{
              left: plot.x,
              top: plot.y,
              width: plot.w,
              height: plot.h,
              transform: `rotate(${plot.rotate})`,
            }}
          >
            <span className="block text-xs font-bold text-white drop-shadow">
              {plot.label}
            </span>
            <span className="block text-[11px] font-semibold text-white drop-shadow">
              {plot.crop}
            </span>
          </button>
        ))}

        <div className="absolute bottom-3 right-3 rounded-md border border-stone-200 bg-white/95 p-3 text-xs shadow-sm">
          <p className="mb-2 font-bold text-[#1b3a2b]">Risk Level</p>
          {["CRITICAL", "HIGH", "MODERATE", "LOW"].map((level) => (
            <div key={level} className="mt-1 flex items-center gap-2">
              <span className={`h-3 w-3 border ${LEVEL_COLORS[level]}`} />
              <span className="text-[#4a4a44]">{level}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-[#e8e5dc] bg-[#f7f5f0] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-[#1b3a2b]">
            Plot {selectedPlot.label} · {selectedPlot.crop}
          </p>
          <span className={`rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-bold ${LEVEL_TEXT[selectedPlot.level]}`}>
            {selectedPlot.level} · {selectedPlot.score.toFixed(0)}/100
          </span>
        </div>

        <p className="mt-1 text-sm text-[#5c6b60]">
          Use this as a simple visual layer for showing which field blocks need
          scouting or farmer alerts first.
        </p>
      </div>
    </section>
  );
}
