import { useState } from "react";

export default function Simulation() {
  const [temperature, setTemperature] = useState(25);
  const [humidity, setHumidity] = useState(70);

  return (
    <section style={styles.panel}>
      <h2 style={styles.heading}>Simulation Controls</h2>
      <p style={styles.notice}>
        Use the dedicated assistant workspace to test these conditions against
        the rule engine and Adaption AI model.
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

      <a href="/ai-assistant" style={styles.linkButton}>
        Open scenario tester
      </a>
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
    margin: "0 0 10px",
    fontSize: 18,
    fontWeight: 600,
    color: "#1b3a2b",
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
  },
};
