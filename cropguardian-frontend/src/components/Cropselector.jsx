import { useEffect } from "react";
import { getGrowthStagesForCrop, useCropCatalog } from "../cropCatalog";

export default function CropSelector({
  cropType,
  growthStage,
  onCropChange,
  onStageChange,
}) {
  const { catalog, crops, loading, error } = useCropCatalog();
  const growthStages = getGrowthStagesForCrop(catalog, cropType);

  useEffect(() => {
    if (crops.length && !crops.includes(cropType)) {
      onCropChange(crops[0]);
    }
  }, [cropType, crops, onCropChange]);

  useEffect(() => {
    if (growthStages.length && !growthStages.includes(growthStage)) {
      onStageChange(growthStages[0]);
    }
  }, [growthStage, growthStages, onStageChange]);

  return (
    <section className="rounded-xl border border-[#e2e0d8] bg-white p-5 shadow-sm sm:p-6">
      <h2 className="mb-4 text-lg font-semibold text-[#1b3a2b]">
        Crop Selector
      </h2>
      {error && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-[#8a6a10]">
          Using saved crop list while the crop catalog API is unavailable.
        </p>
      )}

      <div className="space-y-4">
        {/* Crop Type Select */}
        <div>
          <label
            htmlFor="crop-type-select"
            className="block text-xs font-semibold text-[#5c6b60]"
          >
            Crop type
          </label>
          <div className="relative mt-1.5">
            <select
              id="crop-type-select"
              value={cropType}
              onChange={(e) => onCropChange(e.target.value)}
              disabled={loading}
              className="w-full appearance-none rounded-lg border border-[#d6d3c8] bg-[#f7f5f0] px-3.5 py-2 pr-10 text-sm font-medium text-[#1b3a2b] transition-colors focus:border-[#1b3a2b] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1b3a2b]/20"
            >
              {crops.map((crop) => (
                <option key={crop} value={crop}>
                  {crop}
                </option>
              ))}
            </select>
            {/* Custom Dropdown Chevron */}
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#5c6b60]">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Growth Stage Select */}
        <div>
          <label
            htmlFor="growth-stage-select"
            className="block text-xs font-semibold text-[#5c6b60]"
          >
            Growth stage
          </label>
          <div className="relative mt-1.5">
            <select
              id="growth-stage-select"
              value={growthStage}
              onChange={(e) => onStageChange(e.target.value)}
              disabled={loading}
              className="w-full appearance-none rounded-lg border border-[#d6d3c8] bg-[#f7f5f0] px-3.5 py-2 pr-10 text-sm font-medium text-[#1b3a2b] transition-colors focus:border-[#1b3a2b] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1b3a2b]/20"
            >
              {growthStages.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
            {/* Custom Dropdown Chevron */}
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#5c6b60]">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
