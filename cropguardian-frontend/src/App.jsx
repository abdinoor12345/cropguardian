import { useState } from "react";
import CurrentConditions from "./components/CurrentConditions";
import AlertsPanel from "./components/AlertsPanel";
import CropSelector from "./components/CropSelector";
import AdvisorPanel from "./components/AdvisorPanel";
import Analytics from "./components/Analytics";
import Advisories from "./components/Advisories";
import Navbar from "./components/Navbar";
import Simulation from "./components/simulation";
import AIAssistant from "./components/AIAssistant";
import ForecastPanel from "./components/ForecastPanel";
import FieldRiskMap from "./components/FieldRiskMap";

export default function App() {
  const [cropType, setCropType] = useState("Maize");
  const [growthStage, setGrowthStage] = useState("Vegetative");
  const activePath = window.location.pathname;

  return (
    <div className="min-h-screen bg-[#f7f5f0] font-sans text-stone-800 antialiased">
      <Navbar />

      {activePath === "/analytics" ? (
        <Analytics />
      ) : activePath === "/advisories" ? (
        <Advisories />
      ) : activePath === "/ai-assistant" ? (
        <AIAssistant />
      ) : (
        <main className="mx-auto max-w-7xl p-6 md:p-8 space-y-6">
          {/* Prominent Top Banner: Current Environmental Conditions */}
          <section className="w-full rounded-xl bg-white p-6 shadow-sm border border-stone-200">
            <CurrentConditions />
          </section>

          <ForecastPanel />

          {/* Core Dashboard Grid System */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Crop Configuration & Active Alerts (5/12 width) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="rounded-xl bg-white p-6 shadow-sm border border-stone-200">
                <CropSelector
                  cropType={cropType}
                  growthStage={growthStage}
                  onCropChange={setCropType}
                  onStageChange={setGrowthStage}
                />
              </div>

              <div className="rounded-xl bg-white p-6 shadow-sm border border-stone-200">
                <AlertsPanel cropType={cropType} growthStage={growthStage} />
              </div>
            </div>

            {/* Right Column: AI Insights & Simulation Controls (7/12 width) */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="rounded-xl bg-white p-6 shadow-sm border border-stone-200">
                <AdvisorPanel cropType={cropType} growthStage={growthStage} />
              </div>

              <div className="rounded-xl bg-white p-6 shadow-sm border border-stone-200">
                <FieldRiskMap />
              </div>

              <div className="rounded-xl bg-white p-6 shadow-sm border border-stone-200">
                <Simulation />
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
