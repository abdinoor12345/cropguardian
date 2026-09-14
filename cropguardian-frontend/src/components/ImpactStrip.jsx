const IMPACT_ITEMS = [
  ["Detect disease early", "Catch fungal pressure before damage spreads."],
  ["Avoid wasted spraying", "Check rain, wind, heat, and humidity first."],
  ["Protect yield", "Prioritize urgent risks and interventions."],
  ["Adapt to climate variability", "Pair live telemetry with forecasts and AI guidance."],
];

export default function ImpactStrip() {
  return (
    <section className="rounded-xl border border-[#dce8d2] bg-[#fbfdf8] p-5 shadow-sm md:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-[#5c6b60]">
            Why it matters
          </p>
          <h2 className="mt-1 text-xl font-bold text-[#1b3a2b]">
            From weather readings to field action
          </h2>
        </div>
        <span className="rounded-full border border-[#d6e8c8] bg-white px-3 py-1 text-xs font-bold text-[#1b3a2b]">
          Climate-smart agriculture
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {IMPACT_ITEMS.map(([title, body]) => (
          <div key={title} className="rounded-lg border border-[#e6eadf] bg-white p-4">
            <p className="font-semibold text-[#1b3a2b]">{title}</p>
            <p className="mt-1 text-sm leading-snug text-[#5c6b60]">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
