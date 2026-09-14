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
import LandingHero from "./components/LandingHero";
import ImpactStrip from "./components/ImpactStrip";

function AppFooter() {
  return (
    <footer className="mx-auto w-full max-w-7xl px-4 pb-6 md:px-8">
      <div className="flex flex-col gap-2 border-t border-stone-200 pt-4 text-xs text-[#5c6b60] sm:flex-row sm:items-center sm:justify-between">
        <span className="font-bold text-[#1b3a2b]">CropGuardian</span>
        <span>JKUAT Conduit climate intelligence for timely crop decisions.</span>
      </div>
    </footer>
  );
}

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
        <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
          <LandingHero cropType={cropType} growthStage={growthStage} />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="space-y-6 xl:col-span-4">
              <CurrentConditions />
              <CropSelector
                cropType={cropType}
                growthStage={growthStage}
                onCropChange={setCropType}
                onStageChange={setGrowthStage}
              />
              <ForecastPanel />
            </div>

            <div className="space-y-6 xl:col-span-4">
              <AlertsPanel cropType={cropType} growthStage={growthStage} />
              <Simulation />
            </div>

            <div className="space-y-6 xl:col-span-4">
              <AdvisorPanel cropType={cropType} growthStage={growthStage} />
              <FieldRiskMap />
            </div>
          </div>

          <ImpactStrip />
        </main>
      )}

      <AppFooter />
    </div>
  );
}
