function formatLabel(value) {
  if (!value) return "Unassigned";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function DepartmentPerformanceCard({ departments }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">
            Department Performance
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Active workload from the currently loaded issue set.
          </p>
        </div>
      </div>

      {departments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-500">
          No active department workload in the loaded issues.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {departments.map((department) => (
            <div
              key={department.department}
              className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="min-w-0 truncate text-sm font-semibold text-zinc-100">
                  {formatLabel(department.department)}
                </h3>
                <span className="shrink-0 text-xs text-zinc-500">
                  {department.totalActiveWorkload} active
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <Metric label="Open" value={department.open} />
                <Metric label="In Progress" value={department.inProgress} />
                <Metric label="Escalated" value={department.escalated} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
