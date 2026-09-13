import { useEffect, useState } from "react";
import { fetchCurrentTelemetry } from "../api";

const READINGS = [
  { key: "sht_humidity", label: "Humidity", unit: "%", decimals: 1 },
  { key: "wbgt_temperature", label: "WBGT (heat stress)", unit: "°C", decimals: 1 },
  { key: "daily_rain_total_mm", label: "Rainfall (24h)", unit: "mm", decimals: 1 },
  { key: "solar_irradiance", label: "Solar Irradiance", unit: "W/m²", decimals: 0 },
  { key: "wind_speed", label: "Wind Speed", unit: "m/s", decimals: 1 },
  { key: "barometric_pressure", label: "Pressure", unit: "hPa", decimals: 1 },
];

export default function CurrentConditions() {
  const [telemetry, setTelemetry] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchCurrentTelemetry()
      .then((res) => {
        if (!cancelled) setTelemetry(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <section style={styles.panel}>
        <h2 style={styles.heading}>Current Conditions</h2>
        <p style={styles.errorText}>Couldn't reach the sensor feed: {error}</p>
      </section>
    );
  }

  if (!telemetry) {
    return (
      <section style={styles.panel}>
        <h2 style={styles.heading}>Current Conditions</h2>
        <p style={styles.loadingText}>Loading live readings…</p>
      </section>
    );
  }

  return (
    <section style={styles.panel}>
      <div style={styles.headerRow}>
        <h2 style={styles.heading}>Current Conditions</h2>
        <span style={styles.stationTag}>{telemetry.station_id}</span>
      </div>
      <div style={styles.grid}>
        {READINGS.map(({ key, label, unit, decimals }) => (
          <div key={key} style={styles.card}>
            <p style={styles.cardLabel}>{label}</p>
            <p style={styles.cardValue}>
              {telemetry[key].toFixed(decimals)}
              <span style={styles.cardUnit}> {unit}</span>
            </p>
          </div>
        ))}
      </div>
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
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  heading: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: "#1b3a2b",
  },
  stationTag: {
    fontSize: 13,
    color: "#5c6b60",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 14,
  },
  card: {
    background: "#f7f5f0",
    borderRadius: 8,
    padding: "14px 16px",
  },
  cardLabel: {
    margin: 0,
    fontSize: 13,
    color: "#5c6b60",
  },
  cardValue: {
    margin: "6px 0 0",
    fontSize: 22,
    fontWeight: 600,
    color: "#1b3a2b",
  },
  cardUnit: {
    fontSize: 14,
    fontWeight: 400,
    color: "#5c6b60",
  },
  loadingText: { color: "#5c6b60" },
  errorText: { color: "#b3261e" },
};