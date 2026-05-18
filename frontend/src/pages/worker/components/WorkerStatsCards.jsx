function isOverdue(issue) {
  if (!issue?.slaDeadline || issue?.status === "RESOLVED" || issue?.status === "REJECTED") {
    return false;
  }

  return Boolean(issue.slaBreached) || new Date(issue.slaDeadline).getTime() < Date.now();
}

function isDueSoon(issue) {
  if (!issue?.slaDeadline || issue?.status === "RESOLVED" || issue?.status === "REJECTED") {
    return false;
  }

  const deadline = new Date(issue.slaDeadline).getTime();
  const now = Date.now();
  const hoursLeft = (deadline - now) / (1000 * 60 * 60);

  return hoursLeft >= 0 && hoursLeft <= 24;
}

export default function WorkerStatsCards({ issues = [] }) {
  const assigned = issues.filter((issue) => issue.status === "ASSIGNED").length;
  const inProgress = issues.filter((issue) => issue.status === "IN_PROGRESS").length;
  const pendingClosure = issues.filter((issue) => issue.status === "PENDING_CLOSURE").length;
  const resolved = issues.filter((issue) => issue.status === "RESOLVED").length;
  const overdue = issues.filter(isOverdue).length;
  const dueSoon = issues.filter(isDueSoon).length;

  const cards = [
    {
      label: "Assigned",
      value: assigned,
      helper: "Waiting to start",
      className: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    },
    {
      label: "In Progress",
      value: inProgress,
      helper: "Active field work",
      className: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    },
    {
      label: "Pending Review",
      value: pendingClosure,
      helper: "Awaiting admin closure",
      className: "border-purple-500/20 bg-purple-500/10 text-purple-300",
    },
    {
      label: "Due Soon",
      value: dueSoon,
      helper: "Within 24 hours",
      className: "border-orange-500/20 bg-orange-500/10 text-orange-300",
    },
    {
      label: "Overdue",
      value: overdue,
      helper: "SLA breached",
      className: "border-red-500/20 bg-red-500/10 text-red-300",
    },
    {
      label: "Resolved",
      value: resolved,
      helper: "Completed work",
      className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-2xl border p-4 ${card.className}`}
        >
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">
            {card.label}
          </p>
          <p className="mt-2 text-3xl font-bold text-white">{card.value}</p>
          <p className="mt-1 text-xs opacity-80">{card.helper}</p>
        </div>
      ))}
    </div>
  );
}
