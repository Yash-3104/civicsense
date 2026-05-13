import {
    AlertTriangle,
    ShieldAlert,
    Sparkles,
  } from "lucide-react";
  
  import {
    useMemo,
  } from "react";
  
  const getSeverityStyles = (severity) => {
  
    switch (severity) {
  
      case "HIGH":
        return `
          bg-red-500/20
          text-red-300
          border-red-500/30
        `;
  
      case "MEDIUM":
        return `
          bg-yellow-500/20
          text-yellow-300
          border-yellow-500/30
        `;
  
      default:
        return `
          bg-blue-500/20
          text-blue-300
          border-blue-500/30
        `;
    }
  };
  
  const getStatusStyles = (status) => {
  
    switch (status) {
  
      case "VERIFIED":
        return `
          bg-green-500/20
          text-green-300
          border-green-500/30
        `;
  
      case "REJECTED":
        return `
          bg-red-500/20
          text-red-300
          border-red-500/30
        `;
  
      case "RESOLVED":
        return `
          bg-emerald-500/20
          text-emerald-300
          border-emerald-500/30
        `;
  
      default:
        return `
          bg-yellow-500/20
          text-yellow-300
          border-yellow-500/30
        `;
    }
  };
  
  export default function AdminIssueTable({
    issues,
    onSelectIssue,
  }) {
  
    const sortedIssues = useMemo(() => {
  
      return [...issues].sort((a, b) => {
  
        const aRisk =
          (a.fakeReportLikelihood || 0) +
          (a.duplicateLikelihood || 0);
  
        const bRisk =
          (b.fakeReportLikelihood || 0) +
          (b.duplicateLikelihood || 0);
  
        return bRisk - aRisk;
      });
  
    }, [issues]);
  
    return (
  
      <div
        className="
          overflow-hidden
          rounded-2xl
          border
          border-zinc-800
        "
      >
  
        {/* HEADER */}
        <div
          className="
            grid
            grid-cols-12
            gap-4
            border-b
            border-zinc-800
            bg-zinc-900
            px-4
            py-3
            text-xs
            font-semibold
            uppercase
            tracking-wide
            text-zinc-500
          "
        >
  
          <div className="col-span-4">
            Issue
          </div>
  
          <div className="col-span-2">
            Severity
          </div>
  
          <div className="col-span-2">
            Status
          </div>
  
          <div className="col-span-2">
            AI Risk
          </div>
  
          <div className="col-span-2">
            Duplicate
          </div>
  
        </div>
  
        {/* ROWS */}
        <div className="divide-y divide-zinc-800">
  
          {sortedIssues.map((issue) => {
  
            const fakeRisk =
              Math.round(
                (issue.fakeReportLikelihood || 0) * 100
              );
  
            const duplicateRisk =
              Math.round(
                (issue.duplicateLikelihood || 0) * 100
              );
  
            const isAiFlagged =
              fakeRisk >= 60 ||
              duplicateRisk >= 55 ||
              (issue.aiConfidenceScore || 1) <= 0.4;
  
            return (
  
              <button
                key={issue.id}
                type="button"
                onClick={() =>
                  onSelectIssue(issue)
                }
                className="
                  grid
                  w-full
                  grid-cols-12
                  gap-4
                  bg-zinc-950
                  px-4
                  py-4
                  text-left
                  transition
                  hover:bg-zinc-900
                "
              >
  
                {/* ISSUE */}
                <div className="col-span-4">
  
                  <div className="mb-1 flex items-center gap-2">
  
                    <p className="font-medium text-white">
                      {issue.title}
                    </p>
  
                    {isAiFlagged && (
  
                      <ShieldAlert
                        className="
                          h-4
                          w-4
                          text-yellow-400
                        "
                      />
  
                    )}
  
                  </div>
  
                  <p className="text-sm text-zinc-400">
                    {issue.category}
                  </p>
  
                </div>
  
                {/* SEVERITY */}
                <div className="col-span-2">
  
                  <span
                    className={`
                      rounded-full
                      border
                      px-3
                      py-1
                      text-xs
                      font-medium
                      ${getSeverityStyles(
                        issue.severity
                      )}
                    `}
                  >
                    {issue.severity}
                  </span>
  
                </div>
  
                {/* STATUS */}
                <div className="col-span-2">
  
                  <span
                    className={`
                      rounded-full
                      border
                      px-3
                      py-1
                      text-xs
                      font-medium
                      ${getStatusStyles(
                        issue.status
                      )}
                    `}
                  >
                    {issue.status}
                  </span>
  
                </div>
  
                {/* AI RISK */}
                <div className="col-span-2">
  
                  <div className="flex items-center gap-2">
  
                    <Sparkles
                      className="
                        h-4
                        w-4
                        text-blue-400
                      "
                    />
  
                    <span className="font-medium">
                      {fakeRisk}%
                    </span>
  
                  </div>
  
                </div>
  
                {/* DUPLICATE */}
                <div className="col-span-2">
  
                  <div className="flex items-center gap-2">
  
                    <AlertTriangle
                      className="
                        h-4
                        w-4
                        text-yellow-400
                      "
                    />
  
                    <span className="font-medium">
                      {duplicateRisk}%
                    </span>
  
                  </div>
  
                </div>
  
              </button>
  
            );
          })}
  
        </div>
  
      </div>
    );
  }