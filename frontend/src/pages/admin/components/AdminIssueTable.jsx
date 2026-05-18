import {
  AlertTriangle,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { useMemo } from "react";

const getSeverityStyles = (severity) => {
  switch (severity) {
    case "HIGH":
      return "bg-red-500/20 text-red-300 border-red-500/30";
    case "MEDIUM":
      return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
    default:
      return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  }
};  

const getStatusStyles = (status) => {
  switch (status) {
    case "VERIFIED":
      return "bg-green-500/20 text-green-300 border-green-500/30";
    case "REJECTED":
      return "bg-red-500/20 text-red-300 border-red-500/30";
    case "RESOLVED":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    case "PENDING_CLOSURE":
      return "bg-purple-500/20 text-purple-300 border-purple-500/30";
    case "ASSIGNED":
      return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
    case "IN_PROGRESS":
      return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    default:
      return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
  }
};

function getSlaBadge(issue) {
  if (!issue?.slaDeadline || issue.status === "RESOLVED" || issue.status === "REJECTED") {
    return { label: "No active SLA", className: "border-zinc-700 bg-zinc-900 text-zinc-500" };
  }

  const diffMs = new Date(issue.slaDeadline).getTime() - Date.now();

  if (issue.slaBreached || diffMs < 0) {
    return { label: "SLA Breached", className: "border-red-500/30 bg-red-500/20 text-red-300" };
  }

  if (diffMs <= 24 * 60 * 60 * 1000) {
    return { label: "Due Soon", className: "border-orange-500/30 bg-orange-500/20 text-orange-300" };
  }

  return { label: "On Track", className: "border-blue-500/30 bg-blue-500/20 text-blue-300" };
}

export default function AdminIssueTable({ issues, onSelectIssue }) {
  const sortedIssues = useMemo(() => {
    return [...issues].sort((a, b) => {
      const aSlaPriority = getSlaBadge(a).label === "SLA Breached" ? 2 : getSlaBadge(a).label === "Due Soon" ? 1 : 0;
      const bSlaPriority = getSlaBadge(b).label === "SLA Breached" ? 2 : getSlaBadge(b).label === "Due Soon" ? 1 : 0;

      if (bSlaPriority !== aSlaPriority) {
        return bSlaPriority - aSlaPriority;
      }

      const aRisk = (a.fakeReportLikelihood || 0) + (a.duplicateLikelihood || 0);
      const bRisk = (b.fakeReportLikelihood || 0) + (b.duplicateLikelihood || 0);

      return bRisk - aRisk;
    });
  }, [issues]);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800">
      <div className="grid grid-cols-12 gap-4 border-b border-zinc-800 bg-zinc-900 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        <div className="col-span-3">Issue</div>
        <div className="col-span-2">Severity</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2">SLA</div>
        <div className="col-span-1">AI</div>
        <div className="col-span-2">Duplicate</div>
      </div>

      <div className="divide-y divide-zinc-800">
        {sortedIssues.map((issue) => {
          const fakeRisk = Math.round((issue.fakeReportLikelihood || 0) * 100);
          const duplicateRisk = Math.round((issue.duplicateLikelihood || 0) * 100);
          const sla = getSlaBadge(issue);

          const isAiFlagged =
            fakeRisk >= 60 ||
            duplicateRisk >= 55 ||
            (issue.aiConfidenceScore || 1) <= 0.4;

          return (
            <button
              key={issue.id}
              type="button"
              onClick={() => onSelectIssue(issue)}
              className="grid w-full grid-cols-12 gap-4 bg-zinc-950 px-4 py-4 text-left transition hover:bg-zinc-900"
            >
              <div className="col-span-3">
                <div className="mb-1 flex items-center gap-2">
                  <p className="truncate font-medium text-white">{issue.title}</p>
                  {isAiFlagged && <ShieldAlert className="h-4 w-4 shrink-0 text-yellow-400" />}
                </div>
                <p className="text-sm text-zinc-400">{issue.category}</p>
              </div>

              <div className="col-span-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getSeverityStyles(issue.severity)}`}>
                  {issue.severity}
                </span>
              </div>

              <div className="col-span-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusStyles(issue.status)}`}>
                  {issue.status?.replaceAll("_", " ")}
                </span>
              </div>

              <div className="col-span-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${sla.className}`}>
                  {sla.label}
                </span>
              </div>

              <div className="col-span-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-400" />
                  <span className="font-medium">{fakeRisk}%</span>
                </div>
              </div>

              <div className="col-span-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  <span className="font-medium">{duplicateRisk}%</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
