const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";

async function handleResponse(response) {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Request failed (${response.status}): ${detail}`);
  }
  return response.json();
}

export async function fetchCurrentTelemetry() {
  const response = await fetch(`${BASE_URL}/api/v1/telemetry/current`);
  return handleResponse(response);
}

export async function fetchHistoricalTelemetry(range = "24h") {
  const params = new URLSearchParams({ range });
  const response = await fetch(`${BASE_URL}/api/v1/telemetry/history?${params}`);
  return handleResponse(response);
}

export function historicalTelemetryExportUrl(range = "24h", format = "csv") {
  const params = new URLSearchParams({ range, format });
  return `${BASE_URL}/api/v1/telemetry/history/export?${params}`;
}

export async function fetchAssessment() {
  const response = await fetch(`${BASE_URL}/api/v1/agronomy/assess`);
  return handleResponse(response);
}

export async function fetchForecast() {
  const response = await fetch(`${BASE_URL}/api/v1/agronomy/forecast`);
  return handleResponse(response);
}

export async function fetchCropCatalog() {
  const response = await fetch(`${BASE_URL}/api/v1/crops`);
  return handleResponse(response);
}

export async function fetchAdvisory(cropType, growthStage) {
  const response = await fetch(`${BASE_URL}/api/v1/agronomy/advisory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ crop_type: cropType, growth_stage: growthStage }),
  });
  return handleResponse(response);
}

export async function fetchAdvisoryHistory(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const query = params.toString();
  const response = await fetch(
    `${BASE_URL}/api/v1/advisories${query ? `?${query}` : ""}`,
  );
  return handleResponse(response);
}

export async function updateAdvisoryOutcome(advisoryId, outcomeId, completed) {
  const response = await fetch(
    `${BASE_URL}/api/v1/advisories/${advisoryId}/outcomes/${outcomeId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    },
  );
  return handleResponse(response);
}

export async function sendAssistantMessage(payload) {
  const response = await fetch(`${BASE_URL}/api/v1/ai-assistant/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

export async function runScenarioSimulation(payload) {
  const response = await fetch(`${BASE_URL}/api/v1/ai-assistant/scenario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}
