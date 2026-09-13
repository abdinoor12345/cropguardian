import { useEffect, useMemo, useState } from "react";
import { runScenarioSimulation, sendAssistantMessage } from "../api";
import { getGrowthStagesForCrop, useCropCatalog } from "../cropCatalog";

const SLIDERS = [
  {
    key: "sht_temperature",
    label: "Air temperature",
    unit: "C",
    min: 0,
    max: 45,
    step: 1,
  },
  {
    key: "sht_humidity",
    label: "Relative humidity",
    unit: "%",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: "wind_speed",
    label: "Wind speed",
    unit: "m/s",
    min: 0,
    max: 12,
    step: 0.5,
  },
  {
    key: "instant_rain_mm",
    label: "Instant rain",
    unit: "mm",
    min: 0,
    max: 20,
    step: 0.5,
  },
  {
    key: "daily_rain_total_mm",
    label: "Daily rain total",
    unit: "mm",
    min: 0,
    max: 80,
    step: 1,
  },
  {
    key: "solar_irradiance",
    label: "Solar irradiance",
    unit: "",
    min: 0,
    max: 1200,
    step: 25,
  },
];

const DEFAULT_SCENARIO = {
  sht_temperature: 30,
  wbgt_temperature: 30,
  sht_humidity: 95,
  wind_speed: 2,
  instant_rain_mm: 0,
  daily_rain_total_mm: 8,
  solar_irradiance: 600,
  barometric_pressure: 1013.25,
};

const LEVEL_STYLES = {
  LOW: { background: "#e7f4df", color: "#245c37", borderColor: "#b8d8aa" },
  MODERATE: { background: "#fff6d8", color: "#7c5f0d", borderColor: "#e6cf7a" },
  HIGH: { background: "#ffe7d0", color: "#8a3b11", borderColor: "#efb06d" },
  CRITICAL: { background: "#fde2df", color: "#8c2f24", borderColor: "#f0aaa3" },
};

function levelStyle(level) {
  return LEVEL_STYLES[level] || LEVEL_STYLES.LOW;
}

function RiskBadge({ label, factor }) {
  return (
    <div style={styles.riskItem}>
      <span style={styles.riskLabel}>{label}</span>
      <span style={{ ...styles.badge, ...levelStyle(factor.level) }}>
        {factor.level} · {factor.score.toFixed(0)}
      </span>
    </div>
  );
}

function ScenarioSlider({ config, value, onChange }) {
  return (
    <label style={styles.sliderGroup}>
      <div style={styles.sliderHeader}>
        <span>{config.label}</span>
        <strong>
          {value}
          {config.unit ? ` ${config.unit}` : ""}
        </strong>
      </div>
      <input
        type="range"
        min={config.min}
        max={config.max}
        step={config.step}
        value={value}
        onChange={(event) => onChange(config.key, Number(event.target.value))}
        style={styles.slider}
      />
    </label>
  );
}

function useIsNarrow() {
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 860);

  useEffect(() => {
    function handleResize() {
      setIsNarrow(window.innerWidth < 860);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isNarrow;
}

export default function AIAssistant() {
  const isNarrow = useIsNarrow();
  const { catalog, crops, loading: cropsLoading } = useCropCatalog();
  const [cropType, setCropType] = useState("Maize");
  const [growthStage, setGrowthStage] = useState("Vegetative");
  const [question, setQuestion] = useState(
    "If humidity rises to 95% while temperature stays near 30 C, what microclimate risks should I watch?",
  );
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Ask about microclimate risk, spraying windows, disease pressure, or compare a what-if scenario against the rule engine.",
    },
  ]);
  const [scenario, setScenario] = useState(DEFAULT_SCENARIO);
  const [chatLoading, setChatLoading] = useState(false);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [scenarioError, setScenarioError] = useState(null);
  const [scenarioResult, setScenarioResult] = useState(null);

  const chatHistory = useMemo(
    () => messages.filter((message) => message.role === "user" || message.role === "assistant"),
    [messages],
  );
  const growthStages = getGrowthStagesForCrop(catalog, cropType);

  useEffect(() => {
    if (crops.length && !crops.includes(cropType)) {
      setCropType(crops[0]);
    }
  }, [cropType, crops]);

  useEffect(() => {
    if (growthStages.length && !growthStages.includes(growthStage)) {
      setGrowthStage(growthStages[0]);
    }
  }, [growthStage, growthStages]);

  function updateScenario(key, value) {
    setScenario((current) => ({
      ...current,
      [key]: value,
      ...(key === "sht_temperature" ? { wbgt_temperature: value } : {}),
    }));
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || chatLoading) return;

    const nextMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setQuestion("");
    setChatLoading(true);
    setChatError(null);

    try {
      const result = await sendAssistantMessage({
        question: trimmed,
        crop_type: cropType,
        growth_stage: growthStage,
        messages: chatHistory.slice(-8),
      });

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result.answer,
          status: result.status,
        },
      ]);
    } catch (err) {
      setChatError(err.message);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleRunScenario() {
    setScenarioLoading(true);
    setScenarioError(null);

    try {
      const result = await runScenarioSimulation({
        crop_type: cropType,
        growth_stage: growthStage,
        ...scenario,
      });
      setScenarioResult(result);
    } catch (err) {
      setScenarioError(err.message);
    } finally {
      setScenarioLoading(false);
    }
  }

  const assessment = scenarioResult?.assessment;
  const advisory = scenarioResult?.advisory;

  return (
    <main style={styles.page}>
      <section style={{ ...styles.header, ...(isNarrow ? styles.headerNarrow : {}) }}>
        <div>
          <p style={styles.eyebrow}>Adaption AI workspace</p>
          <h1 style={styles.title}>AI Assistant & Scenario Tester</h1>
          <p style={styles.subtitle}>
            Ask open-ended agronomy questions and test how synthetic microclimate
            conditions change the Adaption AI advisory and deterministic rules.
          </p>
        </div>

        <div style={{ ...styles.selectGrid, ...(isNarrow ? styles.singleColumn : {}) }}>
          <label style={styles.selectLabel}>
            Crop
            <select
              value={cropType}
              onChange={(event) => setCropType(event.target.value)}
              disabled={cropsLoading}
              style={styles.select}
            >
              {crops.map((crop) => (
                <option key={crop} value={crop}>
                  {crop}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.selectLabel}>
            Stage
            <select
              value={growthStage}
              onChange={(event) => setGrowthStage(event.target.value)}
              disabled={cropsLoading}
              style={styles.select}
            >
              {growthStages.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section style={{ ...styles.workspace, ...(isNarrow ? styles.workspaceNarrow : {}) }}>
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>Chat Interface</h2>
            {chatLoading && <span style={styles.statusText}>Thinking...</span>}
          </div>

          <div style={styles.chatLog}>
            {messages.map((message, index) => (
              <article
                key={`${message.role}-${index}`}
                style={{
                  ...styles.message,
                  ...(message.role === "user" ? styles.userMessage : styles.assistantMessage),
                }}
              >
                <span style={styles.messageRole}>
                  {message.role === "user" ? "Agronomist" : "Adaption AI"}
                  {message.status === "fallback" ? " · rules fallback" : ""}
                </span>
                <p style={styles.messageText}>{message.content}</p>
              </article>
            ))}
          </div>

          {chatError && <p style={styles.error}>Could not send message: {chatError}</p>}

          <form onSubmit={handleSendMessage} style={styles.chatForm}>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={4}
              placeholder="Ask about fungal pressure, heat stress, spraying timing, or sensor-driven decisions..."
              style={styles.textarea}
            />
            <button type="submit" disabled={chatLoading} style={styles.primaryButton}>
              {chatLoading ? "Sending..." : "Send question"}
            </button>
          </form>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>What-If Scenario Simulator</h2>
            {scenarioLoading && <span style={styles.statusText}>Running...</span>}
          </div>

          <div style={{ ...styles.sliderGrid, ...(isNarrow ? styles.singleColumn : {}) }}>
            {SLIDERS.map((slider) => (
              <ScenarioSlider
                key={slider.key}
                config={slider}
                value={scenario[slider.key]}
                onChange={updateScenario}
              />
            ))}
          </div>

          <div style={styles.buttonRow}>
            <button type="button" onClick={handleRunScenario} disabled={scenarioLoading} style={styles.primaryButton}>
              {scenarioLoading ? "Testing..." : "Test scenario"}
            </button>
            <button
              type="button"
              onClick={() => {
                setScenario(DEFAULT_SCENARIO);
                setScenarioResult(null);
              }}
              style={styles.secondaryButton}
            >
              Reset
            </button>
          </div>

          {scenarioError && (
            <p style={styles.error}>Could not run scenario: {scenarioError}</p>
          )}

          {assessment && advisory && (
            <div style={styles.results}>
              <div style={styles.scoreBand}>
                <span style={styles.scoreLabel}>Rule engine risk score</span>
                <strong style={styles.scoreValue}>{assessment.risk_score}/100</strong>
              </div>

              <div style={{ ...styles.riskGrid, ...(isNarrow ? styles.singleColumn : {}) }}>
                <RiskBadge label="Fungal risk" factor={assessment.fungal_risk} />
                <RiskBadge label="Heat stress" factor={assessment.heat_stress} />
                <RiskBadge label="Soil washout" factor={assessment.soil_washout} />
                <div style={styles.riskItem}>
                  <span style={styles.riskLabel}>Spraying window</span>
                  <span style={styles.badge}>{assessment.spraying_suitability.status}</span>
                </div>
              </div>

              {assessment.alerts.length > 0 && (
                <div>
                  <h3 style={styles.sectionTitle}>Rule alerts</h3>
                  <ul style={styles.list}>
                    {assessment.alerts.map((alert) => (
                      <li key={alert}>{alert}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 style={styles.sectionTitle}>
                  Adaption AI reaction
                  {advisory.status === "fallback" ? " · fallback" : ""}
                </h3>
                <p style={styles.advisorySummary}>{advisory.summary}</p>
                <div style={styles.recommendations}>
                  {advisory.recommendations.map((recommendation, index) => (
                    <article key={`${recommendation.category}-${index}`} style={styles.recommendation}>
                      <div style={styles.recommendationHeader}>
                        <strong>{recommendation.category}</strong>
                        <span style={styles.smallBadge}>{recommendation.urgency}</span>
                      </div>
                      <p>{recommendation.action}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

const styles = {
  page: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: "24px clamp(18px, 4vw, 32px) 40px",
  },
  header: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(240px, 360px)",
    gap: 24,
    alignItems: "end",
    marginBottom: 24,
  },
  headerNarrow: {
    gridTemplateColumns: "1fr",
    alignItems: "start",
  },
  eyebrow: {
    margin: "0 0 6px",
    color: "#5c6b60",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    color: "#1b3a2b",
    fontSize: 30,
    lineHeight: 1.15,
  },
  subtitle: {
    maxWidth: 760,
    margin: "10px 0 0",
    color: "#4a4a44",
    fontSize: 15,
    lineHeight: 1.6,
  },
  selectGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  selectLabel: {
    display: "grid",
    gap: 6,
    color: "#5c6b60",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  select: {
    width: "100%",
    border: "1px solid #d8d5cb",
    borderRadius: 8,
    background: "#ffffff",
    color: "#1b3a2b",
    fontSize: 14,
    fontWeight: 700,
    padding: "10px 12px",
  },
  workspace: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.05fr)",
    gap: 20,
    alignItems: "start",
  },
  workspaceNarrow: {
    gridTemplateColumns: "1fr",
  },
  singleColumn: {
    gridTemplateColumns: "1fr",
  },
  panel: {
    background: "#ffffff",
    border: "1px solid #e2e0d8",
    borderRadius: 8,
    boxShadow: "0 6px 18px rgb(27 58 43 / 8%)",
    padding: 20,
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  panelTitle: {
    margin: 0,
    color: "#1b3a2b",
    fontSize: 18,
  },
  statusText: {
    color: "#5c6b60",
    fontSize: 12,
    fontWeight: 700,
  },
  chatLog: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minHeight: 360,
    maxHeight: 520,
    overflow: "auto",
    padding: 4,
  },
  message: {
    border: "1px solid #e8e5dc",
    borderRadius: 8,
    padding: "12px 14px",
  },
  userMessage: {
    alignSelf: "flex-end",
    maxWidth: "86%",
    background: "#eef6ea",
  },
  assistantMessage: {
    alignSelf: "flex-start",
    maxWidth: "92%",
    background: "#f7f5f0",
  },
  messageRole: {
    display: "block",
    marginBottom: 5,
    color: "#5c6b60",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  messageText: {
    margin: 0,
    color: "#2d352e",
    fontSize: 14,
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
  },
  chatForm: {
    display: "grid",
    gap: 10,
    marginTop: 16,
  },
  textarea: {
    width: "100%",
    minHeight: 104,
    resize: "vertical",
    border: "1px solid #d8d5cb",
    borderRadius: 8,
    color: "#1f2a22",
    font: "inherit",
    lineHeight: 1.45,
    padding: 12,
    boxSizing: "border-box",
  },
  primaryButton: {
    border: 0,
    borderRadius: 8,
    background: "#1b3a2b",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 800,
    minHeight: 42,
    padding: "0 16px",
  },
  secondaryButton: {
    border: "1px solid #d8d5cb",
    borderRadius: 8,
    background: "#ffffff",
    color: "#1b3a2b",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 800,
    minHeight: 42,
    padding: "0 16px",
  },
  sliderGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px 16px",
  },
  sliderGroup: {
    display: "grid",
    gap: 8,
  },
  sliderHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    color: "#4a4a44",
    fontSize: 13,
  },
  slider: {
    width: "100%",
    accentColor: "#1b3a2b",
  },
  buttonRow: {
    display: "flex",
    gap: 10,
    marginTop: 18,
  },
  error: {
    border: "1px solid #f0aaa3",
    borderRadius: 8,
    background: "#fdecea",
    color: "#8c2f24",
    fontSize: 13,
    lineHeight: 1.45,
    padding: "10px 12px",
  },
  results: {
    display: "grid",
    gap: 16,
    marginTop: 20,
  },
  scoreBand: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    background: "#f7f5f0",
    border: "1px solid #e8e5dc",
    padding: "14px 16px",
  },
  scoreLabel: {
    color: "#5c6b60",
    fontSize: 13,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  scoreValue: {
    color: "#1b3a2b",
    fontSize: 24,
  },
  riskGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  riskItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    border: "1px solid #e8e5dc",
    borderRadius: 8,
    padding: "10px 12px",
  },
  riskLabel: {
    color: "#4a4a44",
    fontSize: 13,
    fontWeight: 700,
  },
  badge: {
    border: "1px solid #d8d5cb",
    borderRadius: 8,
    background: "#f7f5f0",
    color: "#1b3a2b",
    fontSize: 12,
    fontWeight: 800,
    padding: "5px 8px",
    whiteSpace: "nowrap",
  },
  smallBadge: {
    borderRadius: 8,
    background: "#e7f4df",
    color: "#245c37",
    fontSize: 11,
    fontWeight: 800,
    padding: "5px 8px",
    whiteSpace: "nowrap",
  },
  sectionTitle: {
    margin: "0 0 8px",
    color: "#5c6b60",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  list: {
    margin: 0,
    paddingLeft: 18,
    color: "#4a4a44",
    fontSize: 14,
    lineHeight: 1.5,
  },
  advisorySummary: {
    margin: 0,
    color: "#1b3a2b",
    fontSize: 14,
    lineHeight: 1.55,
  },
  recommendations: {
    display: "grid",
    gap: 10,
    marginTop: 10,
  },
  recommendation: {
    border: "1px solid #e8e5dc",
    borderRadius: 8,
    background: "#fbfaf7",
    padding: "12px 14px",
  },
  recommendationHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    color: "#1b3a2b",
    fontSize: 13,
    marginBottom: 6,
  },
};
