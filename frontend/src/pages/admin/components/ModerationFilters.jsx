const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "AI_FLAGGED", label: "AI Flagged" },
  { key: "DUPLICATES", label: "Possible Duplicates" },
  { key: "LOW_CONFIDENCE", label: "Low Confidence" },
  { key: "HIGH_SEVERITY", label: "High Severity" },
  { key: "UNRESOLVED", label: "Unresolved" },
  { key: "PENDING_CLOSURE", label: "Pending Closure" },
  { key: "DUE_SOON", label: "Due Soon" },
  { key: "SLA_BREACHED", label: "SLA Breached" },
];

export default function ModerationFilters({
  activeFilter,
  setActiveFilter,
}) {
  return (
    <div className="mb-6 flex flex-wrap gap-3">
      {FILTERS.map((filter) => {
        const isActive = activeFilter === filter.key;

        return (
          <button
            key={filter.key}
            type="button"
            onClick={() => setActiveFilter(filter.key)}
            className={`
              rounded-full
              border
              px-4
              py-2
              text-sm
              font-medium
              transition

              ${
                isActive
                  ? `
                    border-blue-500/40
                    bg-blue-500/20
                    text-blue-300
                  `
                  : `
                    border-zinc-700
                    bg-zinc-900
                    text-zinc-400
                    hover:border-zinc-500
                    hover:bg-zinc-800
                  `
              }
            `}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
