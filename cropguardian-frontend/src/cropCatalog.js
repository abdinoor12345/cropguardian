import { useEffect, useMemo, useState } from "react";
import { fetchCropCatalog } from "./api";

export const FALLBACK_CROP_CATALOG = [
  {
    name: "Maize",
    growth_stages: ["Germination", "Vegetative", "Flowering", "Grain filling", "Harvest"],
  },
  {
    name: "Tomato",
    growth_stages: ["Seedling", "Vegetative", "Flowering", "Fruiting", "Harvest"],
  },
  {
    name: "Beans",
    growth_stages: ["Germination", "Vegetative", "Flowering", "Pod filling", "Harvest"],
  },
  {
    name: "Coffee",
    growth_stages: ["Seedling", "Vegetative", "Flowering", "Berry development", "Harvest"],
  },
  {
    name: "Potato",
    growth_stages: ["Sprouting", "Vegetative", "Tuber initiation", "Tuber bulking", "Maturity"],
  },
];

export const FALLBACK_GROWTH_STAGES = ["Vegetative", "Flowering", "Fruiting", "Harvest"];

export function getCropNames(catalog) {
  return catalog.map((crop) => crop.name);
}

export function getGrowthStagesForCrop(catalog, cropName) {
  return (
    catalog.find((crop) => crop.name === cropName)?.growth_stages ||
    FALLBACK_GROWTH_STAGES
  );
}

export function useCropCatalog() {
  const [catalog, setCatalog] = useState(FALLBACK_CROP_CATALOG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchCropCatalog()
      .then((result) => {
        if (!cancelled && result.data?.length) {
          setCatalog(result.data);
        }
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
  }, []);

  const crops = useMemo(() => getCropNames(catalog), [catalog]);

  return { catalog, crops, loading, error };
}
