function formatDate(value) {
  if (!value) return "No SLA";

  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDepartment(value) {
  if (!value) return "No department";

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getSlaState(issue) {
  if (!issue?.slaDeadline || issue?.status === "RESOLVED" || issue?.status === "REJECTED") {
    return {
      label: "No active SLA",
      className: "text-zinc-500",
    };
  }

  const deadline = new Date(issue.slaDeadline).getTime();
  const diffMs = deadline - Date.now();
  const absHours = Math.abs(diffMs) / (1000 * 60 * 60);

  if (issue?.slaBreached || diffMs < 0) {
    return {
      label: `${Math.ceil(absHours)}h overdue`,
      className: "text-red-300",
    };
  }

  if (absHours <= 24) {
    return {
      label: `${Math.ceil(absHours)}h left`,
      className: "text-amber-300",
    };
  }

  return {
    label: `${Math.ceil(absHours / 24)}d left`,
    className: "text-emerald-300",
  };
}

const statusStyles = {
  ASSIGNED: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
  IN_PROGRESS: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  PENDING_CLOSURE: "border-purple-500/20 bg-purple-500/10 text-purple-300",
  RESOLVED: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
};

export default function WorkerQueue({
  issues = [],
  selectedIssueId,
  onSelectIssue,
}) {
  if (issues.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-500">
        No assigned work orders yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {issues.map((issue) => {
        const sla = getSlaState(issue);

        return (
          <button
            key={issue.id}
            type="button"
            onClick={() => onSelectIssue(issue)}
            className={`w-full rounded-2xl border p-4 text-left transition hover:border-cyan-500/50 hover:bg-zinc-900 ${
              selectedIssueId === issue.id
                ? "border-cyan-500/60 bg-cyan-500/10"
                : "border-zinc-800 bg-zinc-950"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-white">
                  {issue.title}
                </h3>
                <p className="mt-1 truncate text-xs text-zinc-400">
                  {formatDepartment(issue.assignedDepartment)}
                </p>
              </div>

              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  statusStyles[issue.status] ||
                  "border-zinc-700 bg-zinc-900 text-zinc-300"
                }`}
              >
                {issue.status?.replaceAll("_", " ") || "UNKNOWN"}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-zinc-500">SLA</p>
                <p className={`mt-1 font-semibold ${sla.className}`}>
                  {sla.label}
                </p>
              </div>

              <div>
                <p className="text-zinc-500">Deadline</p>
                <p className="mt-1 font-medium text-zinc-300">
                  {formatDate(issue.slaDeadline)}
                </p>
              </div>
            </div>

            {issue.slaBreached && (
              <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
                Escalated due to SLA breach
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
