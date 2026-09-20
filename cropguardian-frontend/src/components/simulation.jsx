import { useEffect, useState } from "react";
import { fetchAssessment, runScenarioSimulation } from "../api";

export default function Simulation({ cropType, growthStage }) {
  const [temperature, setTemperature] = useState(25);
  const [humidity, setHumidity] = useState(70);
  const [baseline, setBaseline] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchAssessment()
      .then((assessment) => {
        if (!cancelled) setBaseline(assessment);
      })
      .catch(() => {
        if (!cancelled) setBaseline(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSimulation() {
    setLoading(true);
    setError(null);

    try {
      const scenario = await runScenarioSimulation({
        crop_type: cropType,
        growth_stage: growthStage,
        sht_temperature: temperature,
        wbgt_temperature: temperature,
        sht_humidity: humidity,
      });
      setResult(scenario);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const riskChange = baseline && result
    ? Math.round(baseline.risk_score - result.assessment.risk_score)
    : null;

  return (
    <section style={styles.panel}>
      <div style={styles.headingRow}>
        <div>
          <h2 style={styles.heading}>Counterfactual field test</h2>
          <p style={styles.subheading}>What happens if conditions change?</p>
        </div>
        <span style={styles.liveBadge}>LIVE RULES</span>
      </div>
      <p style={styles.notice}>
        Test {cropType} at the {growthStage} stage against the current field
        assessment before making a decision.
      </p>

      <label style={styles.label}>
        <div style={styles.labelRow}>
          <span>Temperature</span>
          <span style={styles.value}>{temperature}°C</span>
        </div>
        <input
          type="range"
          min={0}
          max={45}
          value={temperature}
          onChange={(e) => setTemperature(Number(e.target.value))}
          style={styles.slider}
        />
      </label>

      <label style={styles.label}>
        <div style={styles.labelRow}>
          <span>Humidity</span>
          <span style={styles.value}>{humidity}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={humidity}
          onChange={(e) => setHumidity(Number(e.target.value))}
          style={styles.slider}
        />
      </label>

      <button type="button" onClick={handleSimulation} disabled={loading} style={styles.linkButton}>
        {loading ? "Testing conditions..." : "Test this scenario"}
      </button>

      {error && <p style={styles.error}>Scenario unavailable: {error}</p>}

      {result && (
        <div style={styles.result}>
          <div style={styles.resultHeader}>
            <div>
              <span style={styles.resultLabel}>Projected risk</span>
              <strong style={styles.resultScore}>{result.assessment.risk_score}/100</strong>
            </div>
            {riskChange !== null && (
              <span style={riskChange >= 0 ? styles.improvement : styles.decline}>
                {riskChange >= 0 ? `${riskChange} points avoided` : `${Math.abs(riskChange)} points higher`}
              </span>
            )}
          </div>
          <p style={styles.resultReason}>
            {result.assessment.alerts[0] || result.assessment.spraying_suitability.reason}
          </p>
          <p style={styles.action}>
            <strong>Best next action:</strong>{" "}
            {result.advisory.recommendations[0]?.action || "Inspect the field and reassess conditions."}
          </p>
        </div>
      )}
    </section>
  );
}

const styles = {
  panel: {
    background: "#ffffff",
    border: "1px solid #e2e0d8",
    borderRadius: 10,
    padding: "20px 24px",
  },
  heading: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: "#1b3a2b",
  },
  headingRow: {
    alignItems: "flex-start",
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
  },
  subheading: {
    color: "#5c6b60",
    fontSize: 12,
    margin: "4px 0 0",
  },
  liveBadge: {
    background: "#e7f4df",
    border: "1px solid #b8d8aa",
    borderRadius: 999,
    color: "#245c37",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.5,
    padding: "5px 8px",
  },
  notice: {
    fontSize: 12,
    color: "#8a6a10",
    background: "#fff6e0",
    border: "1px solid #e6c67a",
    borderRadius: 6,
    padding: "8px 10px",
    marginBottom: 16,
    lineHeight: 1.4,
  },
  label: {
    display: "block",
    marginBottom: 18,
  },
  labelRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    color: "#5c6b60",
    marginBottom: 6,
  },
  value: {
    fontWeight: 600,
    color: "#1b3a2b",
  },
  slider: {
    width: "100%",
  },
  linkButton: {
    alignItems: "center",
    background: "#1b3a2b",
    borderRadius: 8,
    color: "#ffffff",
    display: "inline-flex",
    fontSize: 14,
    fontWeight: 700,
    justifyContent: "center",
    minHeight: 40,
    padding: "0 14px",
    textDecoration: "none",
    border: 0,
    cursor: "pointer",
  },
  result: {
    background: "#f7f5f0",
    border: "1px solid #d6dfc6",
    borderRadius: 8,
    marginTop: 18,
    padding: 14,
  },
  resultHeader: {
    alignItems: "center",
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
  },
  resultLabel: {
    color: "#5c6b60",
    display: "block",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  resultScore: {
    color: "#1b3a2b",
    display: "block",
    fontSize: 24,
    marginTop: 3,
  },
  improvement: {
    background: "#e7f4df",
    borderRadius: 999,
    color: "#245c37",
    fontSize: 11,
    fontWeight: 800,
    padding: "6px 9px",
  },
  decline: {
    background: "#fde2df",
    borderRadius: 999,
    color: "#8c2f24",
    fontSize: 11,
    fontWeight: 800,
    padding: "6px 9px",
  },
  resultReason: {
    color: "#4a4a44",
    fontSize: 13,
    lineHeight: 1.45,
    margin: "12px 0 8px",
  },
  action: {
    borderTop: "1px solid #e2e0d8",
    color: "#1b3a2b",
    fontSize: 13,
    lineHeight: 1.45,
    margin: 0,
    paddingTop: 10,
  },
  error: {
    color: "#b3261e",
    fontSize: 12,
    margin: "10px 0 0",
  },
};
