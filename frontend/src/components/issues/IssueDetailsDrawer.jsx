import { Button } from "@/components/ui/button";
import { useState } from "react";
import ResolveIssueModal from "./ResolveIssueModal";
import IssueAssignmentPanel from "@/pages/admin/components/IssueAssignmentPanel";
import API from "@/services/api";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

function normalizeScore(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.max(0, Math.min(number, 1));
}

function formatPercent(value) {
  const normalized = normalizeScore(value);

  if (normalized === null) {
    return "--";
  }

  return `${Math.round(normalized * 100)}%`;
}

function formatDate(value) {
  if (!value) return "Not available";

  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}


function safeExportFilePart(value) {
  return String(value || "issue")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "issue";
}

function todayExportDate() {
  return new Date().toISOString().slice(0, 10);
}

async function downloadTimelineExport(url, filename, contentType) {
  const response = await API.get(url, {
    responseType: "blob",
  });

  const blob = new Blob([response.data], {
    type: contentType,
  });

  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(downloadUrl);
}

async function readExportBlobError(error) {
  const data = error?.response?.data;

  if (data instanceof Blob) {
    try {
      const text = await data.text();
      return text || "Request failed.";
    } catch {
      return "Request failed.";
    }
  }

  if (typeof data === "string") {
    return data;
  }

  if (data?.message) {
    return data.message;
  }

  return null;
}


function getSlaState(issue) {
  const closedStatuses = ["RESOLVED", "REJECTED"];

  if (!issue) {
    return {
      key: "UNKNOWN",
      label: "SLA unavailable",
      helper: "No issue selected",
      className: "border-slate-200 bg-slate-50 text-slate-600 dark:border-[#333333] dark:bg-[#151515] dark:text-slate-300",
    };
  }

  if (closedStatuses.includes(issue.status)) {
    return {
      key: "CLOSED",
      label: "SLA closed",
      helper: issue.status === "RESOLVED" ? "Issue officially closed" : "Issue rejected",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    };
  }

  if (!issue.slaDeadline) {
    return {
      key: "NOT_STARTED",
      label: "SLA not started",
      helper: "Assign issue to start SLA tracking",
      className: "border-slate-200 bg-slate-50 text-slate-600 dark:border-[#333333] dark:bg-[#151515] dark:text-slate-300",
    };
  }

  const deadline = new Date(issue.slaDeadline).getTime();
  const now = Date.now();

  if (!Number.isFinite(deadline)) {
    return {
      key: "UNKNOWN",
      label: "SLA unavailable",
      helper: "Invalid deadline",
      className: "border-slate-200 bg-slate-50 text-slate-600 dark:border-[#333333] dark:bg-[#151515] dark:text-slate-300",
    };
  }

  const diffMs = deadline - now;
  const absHours = Math.max(1, Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60)));

  if (issue.slaBreached || diffMs < 0) {
    return {
      key: "BREACHED",
      label: "SLA breached",
      helper: `${absHours}h overdue`,
      className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    };
  }

  if (diffMs <= 24 * 60 * 60 * 1000) {
    return {
      key: "DUE_SOON",
      label: "Due soon",
      helper: `${absHours}h remaining`,
      className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    };
  }

  const daysLeft = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  return {
    key: "ON_TRACK",
    label: "On track",
    helper: `${daysLeft}d remaining`,
    className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  };
}

function canEscalateIssue(issue) {
  return (
    issue &&
    ["ASSIGNED", "IN_PROGRESS", "PENDING_CLOSURE"].includes(issue.status)
  );
}

function getPositiveScoreBarColor(value) {
  const normalized = normalizeScore(value) || 0;

  if (normalized >= 0.85) {
    return "bg-emerald-500";
  }

  if (normalized >= 0.6) {
    return "bg-amber-500";
  }

  return "bg-red-500";
}

function getRiskScoreBarColor(value) {
  const normalized = normalizeScore(value) || 0;

  if (normalized >= 0.65) {
    return "bg-red-500";
  }

  if (normalized >= 0.35) {
    return "bg-amber-500";
  }

  return "bg-emerald-500";
}

function getAiVerificationBadge(issue) {
  const confidence = normalizeScore(issue?.aiConfidenceScore);
  const fakeRisk = normalizeScore(issue?.fakeReportLikelihood);
  const duplicateRisk = normalizeScore(issue?.duplicateLikelihood);

  if (issue?.status === "REJECTED" || (fakeRisk !== null && fakeRisk >= 0.65)) {
    return {
      label: "High Risk",
      className:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    };
  }

  if (duplicateRisk !== null && duplicateRisk >= 0.55) {
    return {
      label: "Possible Duplicate",
      className:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    };
  }

  if (confidence !== null && confidence >= 0.75) {
    return {
      label: "AI Verified",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    };
  }

  return {
    label: "AI Pending",
    className:
      "border-slate-200 bg-slate-50 text-slate-600 dark:border-[#333333] dark:bg-[#151515] dark:text-slate-300",
  };
}

function parseAiReasoning(reasoning) {
  if (!reasoning) {
    return [];
  }

  if (Array.isArray(reasoning)) {
    return reasoning.map(String).map((item) => item.trim()).filter(Boolean);
  }

  const text = String(reasoning).trim();

  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed)) {
      return parsed.map(String).map((item) => item.trim()).filter(Boolean);
    }
  } catch {
    // Backend can return Java List.toString(): [a, b, c]
  }

  return text
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(/,(?=\s*[A-Z])/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function AiMetricBar({ label, value, colorClass, helper }) {
  const normalized = normalizeScore(value);
  const width = normalized === null ? 0 : normalized * 100;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <div>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {label}
          </span>

          {helper && (
            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              {helper}
            </p>
          )}
        </div>

        <span className="shrink-0 text-xs font-semibold text-slate-800 dark:text-slate-100">
          {formatPercent(value)}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-[#1f1f1f]">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colorClass}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

const categoryLabels = {
  POTHOLE: "Pothole",
  GARBAGE: "Garbage Overflow",
  STREETLIGHT: "Streetlight Failure",
  WATER_LEAK: "Water Leak",
};

const severityLabels = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

const severityStyles = {
  LOW: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  MEDIUM:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  HIGH: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
};


const escalationReasonLabels = {
  SLA_BREACHED: "SLA breached",
  WORKER_UNAVAILABLE: "Worker unavailable",
  PUBLIC_SAFETY_RISK: "Public safety risk",
  REPEATED_COMPLAINTS: "Repeated citizen complaints",
  EVIDENCE_DELAY: "Resolution evidence delay",
  OTHER: "Other operational risk",
};

const escalationLevelLabels = {
  LEVEL_1: "Level 1",
  LEVEL_2: "Level 2",
  LEVEL_3: "Level 3",
};

function formatLabel(value) {
  if (!value) {
    return "Not available";
  }

  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function IssueStatusPill({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-300 ${
        status === "VERIFIED"
          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
          : status === "REJECTED"
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          : status === "PENDING_CLOSURE"
          ? "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300"
          : status === "RESOLVED"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          : status === "ASSIGNED"
          ? "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-300"
          : status === "IN_PROGRESS"
          ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
          : "border-slate-200 bg-slate-50 text-slate-700 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-300"
      }`}
    >
      <span
        className={`h-2 w-2 animate-pulse rounded-full ${
          status === "VERIFIED"
            ? "bg-blue-500"
            : status === "REJECTED"
            ? "bg-red-500"
            : status === "PENDING_CLOSURE"
            ? "bg-purple-500"
            : status === "RESOLVED"
            ? "bg-emerald-500"
            : status === "ASSIGNED"
            ? "bg-cyan-500"
            : status === "IN_PROGRESS"
            ? "bg-amber-500"
            : "bg-slate-400"
        }`}
      />

      {status === "REPORTED"
        ? "AI Processing"
        : status
        ? status.replace("_", " ")
        : "AI Processing"}
    </span>
  );
}


function formatActivityType(type) {
  if (!type) {
    return "Timeline event";
  }

  return type
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getActivityStyle(type) {
  switch (type) {
    case "ISSUE_CREATED":
      return {
        dot: "bg-blue-500",
        border: "border-blue-200 dark:border-blue-900/60",
        badge: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
      };

    case "AI_ANALYSIS_COMPLETED":
      return {
        dot: "bg-violet-500",
        border: "border-violet-200 dark:border-violet-900/60",
        badge: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
      };

    case "ISSUE_VERIFIED":
    case "CLOSURE_APPROVED":
      return {
        dot: "bg-emerald-500",
        border: "border-emerald-200 dark:border-emerald-900/60",
        badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
      };

    case "ISSUE_ASSIGNED":
    case "WORK_STARTED":
      return {
        dot: "bg-cyan-500",
        border: "border-cyan-200 dark:border-cyan-900/60",
        badge: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-300",
      };

    case "CLOSURE_SUBMITTED":
      return {
        dot: "bg-purple-500",
        border: "border-purple-200 dark:border-purple-900/60",
        badge: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300",
      };

    case "ISSUE_REJECTED":
    case "ISSUE_DELETED":
      return {
        dot: "bg-red-500",
        border: "border-red-200 dark:border-red-900/60",
        badge: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
      };

    case "SUPERVISOR_NOTE":
      return {
        dot: "bg-orange-500",
        border: "border-orange-200 dark:border-orange-900/60",
        badge: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
      };

    case "ISSUE_ESCALATED":
      return {
        dot: "bg-orange-500",
        border: "border-orange-200 dark:border-orange-900/60",
        badge: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
      };

    case "ISSUE_SENT_BACK":
      return {
        dot: "bg-amber-500",
        border: "border-amber-200 dark:border-amber-900/60",
        badge: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
      };

    default:
      return {
        dot: "bg-slate-400",
        border: "border-slate-200 dark:border-[#333333]",
        badge: "border-slate-200 bg-slate-50 text-slate-700 dark:border-[#333333] dark:bg-[#151515] dark:text-slate-300",
      };
  }
}

function IssueTimelineSection({ issue, canExportTimeline = false }) {
  const issueId = issue?.id;

  const {
    data: timeline = [],
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: ["issue-timeline", issueId, issue?.updatedAt],
    queryFn: async () => {
      const response = await API.get(`/api/issues/${issueId}/timeline`);
      return response.data || [];
    },
    enabled: Boolean(issueId),
    retry: 1,
    staleTime: 1000 * 15,
    refetchOnWindowFocus: false,
  });


  const [timelineExporting, setTimelineExporting] = useState(null);

  const handleExportTimeline = async (format) => {
    if (!issueId || timelineExporting) {
      return;
    }

    const issuePart = safeExportFilePart(issue?.title || issueId);
    const extension = format === "xlsx" ? "xlsx" : "csv";
    const contentType =
      format === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv;charset=utf-8;";

    setTimelineExporting(format);

    try {
      await downloadTimelineExport(
        `/api/issues/${issueId}/timeline/export.${extension}`,
        `${issuePart}-Timeline-${todayExportDate()}.${extension}`,
        contentType
      );

      toast.success("Timeline exported", {
        description: `${format.toUpperCase()} audit timeline downloaded.`,
      });
    } catch (error) {
      console.error("Timeline export failed", error);

      toast.error("Failed to export timeline", {
        description:
          (await readExportBlobError(error)) ||
          "Check permissions and try again.",
      });
    } finally {
      setTimelineExporting(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-[#262626] dark:bg-[#111111]/80">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Issue Timeline
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Audit trail of key civic workflow events
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {canExportTimeline && issueId && (
            <>
              <button
                type="button"
                disabled={Boolean(timelineExporting)}
                onClick={() => handleExportTimeline("csv")}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#333333] dark:bg-[#151515] dark:text-slate-300 dark:hover:bg-[#1f1f1f]"
              >
                {timelineExporting === "csv" ? "Exporting..." : "Export CSV"}
              </button>

              <button
                type="button"
                disabled={Boolean(timelineExporting)}
                onClick={() => handleExportTimeline("xlsx")}
                className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60"
              >
                {timelineExporting === "xlsx" ? "Exporting..." : "Export XLSX"}
              </button>
            </>
          )}

          {isFetching && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:border-[#333333] dark:bg-[#151515] dark:text-slate-400">
              Syncing
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-16 animate-pulse rounded-xl border border-slate-100 bg-slate-50 dark:border-[#242424] dark:bg-[#151515]"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-300">
          <p className="font-medium">Timeline unavailable</p>
          <p className="mt-1 text-xs opacity-90">
            {error?.response?.data?.message ||
              error?.response?.data ||
              "Could not load timeline events."}
          </p>
        </div>
      ) : timeline.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500 dark:border-[#333333] dark:bg-[#151515] dark:text-slate-400">
          No timeline events recorded yet. New actions will appear here.
        </div>
      ) : (
        <div className="relative space-y-3">
          <div className="absolute bottom-3 left-[9px] top-3 w-px bg-slate-200 dark:bg-[#333333]" />

          {timeline.map((activity) => {
            const style = getActivityStyle(activity.type);

            return (
              <div
                key={activity.id || `${activity.type}-${activity.createdAt}`}
                className="relative flex gap-3"
              >
                <div className="relative z-10 mt-4 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white dark:bg-[#111111]">
                  <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                </div>

                <div
                  className={`flex-1 rounded-xl border bg-slate-50/70 p-3 dark:bg-[#151515] ${style.border}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {activity.message || formatActivityType(activity.type)}
                      </p>

                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {activity.actorName || "System"}
                        {activity.actorRole ? ` · ${activity.actorRole}` : ""}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}
                    >
                      {formatActivityType(activity.type)}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(activity.createdAt)}
                  </p>

                  {activity.metadata && (
                    <p className="mt-2 line-clamp-2 rounded-lg border border-slate-100 bg-white px-2 py-1 text-[11px] text-slate-500 dark:border-[#242424] dark:bg-[#101010] dark:text-slate-400">
                      {activity.metadata}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}


function IssueFeedbackReadOnlySection({ issue, canViewFeedback }) {
  const issueId = issue?.id;

  const {
    data: feedback,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["issue-feedback", issueId],
    queryFn: async () => {
      const response = await API.get(`/api/issues/${issueId}/feedback`);
      return response.data || null;
    },
    enabled: Boolean(issueId) && Boolean(canViewFeedback),
    retry: 1,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });

  if (!canViewFeedback || !issueId) {
    return null;
  }

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-[#262626] dark:bg-[#111111]/80">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          Citizen Feedback
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Loading feedback...
        </p>
      </section>
    );
  }

  if (!feedback) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-[#262626] dark:bg-[#111111]/80">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Citizen Feedback
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              No citizen feedback has been submitted for this issue yet.
            </p>
          </div>

          {isFetching && (
            <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-500 dark:border-[#333333] dark:text-slate-400">
              Syncing
            </span>
          )}
        </div>
      </section>
    );
  }

  const isSatisfied = feedback.rating === "SATISFIED";

  return (
    <section
      className={`rounded-2xl border p-4 shadow-sm ${
        isSatisfied
          ? "border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-200"
          : "border-red-200 bg-red-50/80 text-red-900 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Citizen Feedback</p>
          <p className="mt-1 text-xs opacity-80">
            Submitted by {feedback.citizenName || "Citizen"} · {formatDate(feedback.createdAt)}
          </p>
        </div>

        <span className="rounded-full border border-current/20 bg-white/60 px-2.5 py-1 text-[11px] font-semibold dark:bg-black/20">
          {feedback.ratingLabel || feedback.rating}
        </span>
      </div>

      {feedback.comment && (
        <p className="mt-3 text-sm leading-6">{feedback.comment}</p>
      )}
    </section>
  );
}


export default function IssueDetailsDrawer({
  issue,
  isLoading = false,
  isFetching = false,
  onClose,
  onDeleteIssue,
  possibleDuplicateIssue,
  isPossibleDuplicateFetching = false,
  onOpenMatchedIssue,
  getDisplayArea = () => "Pune area",
  isAdmin = false,
  isWorker = false,
  isSupervisor = false,
  canAddSupervisorNote = false,
  actions = null,
}) {
  const reasoningItems = parseAiReasoning(issue?.aiReasoning);
  const badge = getAiVerificationBadge(issue);
  const queryClient = useQueryClient();
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("FAKE_REPORT");
  const [customRejectionReason, setCustomRejectionReason] = useState("");
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const [escalationReason, setEscalationReason] = useState("SLA_BREACHED");
  const [escalationLevel, setEscalationLevel] = useState("LEVEL_1");
  const [escalationNotes, setEscalationNotes] = useState("");
  const [supervisorNote, setSupervisorNote] = useState("");


  const addSupervisorNoteMutation = useMutation({
    mutationFn: async () => {
      if (!issue?.id) {
        throw new Error("Issue ID is missing");
      }

      const note = supervisorNote.trim();

      if (!note) {
        throw new Error("Supervisor note is required");
      }

      const response = await API.post(
        `/api/supervisor/issues/${issue.id}/note`,
        { note }
      );

      return response.data;
    },

    onSuccess: () => {
      toast.success("Supervisor note added", {
        description: "The note was recorded in the issue timeline.",
      });

      setSupervisorNote("");

      queryClient.invalidateQueries({ queryKey: ["issue-timeline", issue?.id] });
      queryClient.invalidateQueries({ queryKey: ["supervisor-overview"] });
      queryClient.invalidateQueries({ queryKey: ["supervisor-issue-detail", issue?.id] });
    },

    onError: (error) => {
      console.error("Failed to add supervisor note", error);
      toast.error("Failed to add supervisor note", {
        description:
          error?.response?.data?.message ||
          error?.response?.data ||
          error?.message ||
          "Check supervisor department access and try again.",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (payload) => {
      if (!issue?.id) {
        throw new Error("Issue ID is missing");
      }

      const requestBody =
        typeof payload === "string"
          ? { status: payload }
          : payload;

      const response = await API.patch(
        `/api/issues/${issue.id}/status`,
        requestBody
      );

      return response.data;
    },

    onSuccess: (_, payload) => {
      const status =
        typeof payload === "string"
          ? payload
          : payload?.status;

      toast.success(`Issue marked as ${status}`);

      if (status === "REJECTED") {
        setShowRejectModal(false);
        setCustomRejectionReason("");
      }

      queryClient.invalidateQueries({
        queryKey: ["issues"],
      });

      queryClient.invalidateQueries({
        queryKey: ["nearby-issues"],
      });

      queryClient.invalidateQueries({
        queryKey: ["worker-issues"],
        exact: false,
      });

      if (issue?.id) {
        queryClient.invalidateQueries({
          queryKey: ["issue-detail"],
          exact: false,
        });

        queryClient.invalidateQueries({
          queryKey: ["admin-issue-detail", issue.id],
        });

        queryClient.invalidateQueries({
          queryKey: ["issue-timeline", issue.id],
        });
      }
    },

    onError: (error) => {
      console.error("Failed to update issue status", error);

      toast.error(
        error?.response?.data?.message ||
          error?.response?.data ||
          "Failed to update issue status"
      );
    },
  });


  const escalateIssueMutation = useMutation({
    mutationFn: async () => {
      if (!issue?.id) {
        throw new Error("Issue ID is missing");
      }

      const requestBody = {
        reason: escalationReason,
        escalationLevel,
        notes: escalationNotes.trim() || null,
      };

      const response = await API.patch(
        `/api/issues/${issue.id}/escalate`,
        requestBody
      );

      return response.data;
    },

    onSuccess: (updatedIssue) => {
      const reasonLabel =
        escalationReasonLabels[updatedIssue?.escalationReason] ||
        escalationReasonLabels[escalationReason] ||
        "Operational escalation";

      toast.warning("Issue escalated", {
        description: `${reasonLabel} has been recorded for this issue.`,
      });

      setShowEscalationModal(false);
      setEscalationReason("SLA_BREACHED");
      setEscalationLevel("LEVEL_1");
      setEscalationNotes("");

      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["nearby-issues"] });
      queryClient.invalidateQueries({ queryKey: ["worker-issues"], exact: false });

      if (issue?.id) {
        queryClient.invalidateQueries({ queryKey: ["issue-detail"], exact: false });
        queryClient.invalidateQueries({ queryKey: ["admin-issue-detail", issue.id] });
        queryClient.invalidateQueries({ queryKey: ["issue-timeline", issue.id] });
      }
    },

    onError: (error) => {
      console.error("Failed to escalate issue", error);
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data ||
          "Failed to escalate issue"
      );
    },
  });

  const slaState = getSlaState(issue);
  const isEscalatable = isAdmin && canEscalateIssue(issue);

  const hasAiSignals =
    issue?.aiConfidenceScore !== null ||
    issue?.fakeReportLikelihood !== null ||
    issue?.severityConfidence !== null ||
    issue?.duplicateLikelihood !== null ||
    reasoningItems.length > 0;

  const hasDuplicateSignal =
    Boolean(issue?.possibleDuplicateIssueId) ||
    (normalizeScore(issue?.duplicateLikelihood) !== null &&
      normalizeScore(issue?.duplicateLikelihood) >= 0.55);

  const isPendingClosureIssue = issue?.status === "PENDING_CLOSURE";
  const isRejectedIssue = issue?.status === "REJECTED";
  const isResolvedIssue = issue?.status === "RESOLVED";

  const hasReportEvidence =
    !isResolvedIssue &&
    !isPendingClosureIssue &&
    Boolean(issue?.imageUrl);

  const hasResolutionEvidence =
    isResolvedIssue ||
    isPendingClosureIssue ||
    Boolean(issue?.resolutionNotes) ||
    Boolean(issue?.resolutionImageUrl) ||
    Boolean(issue?.resolvedAt);

  const shouldShowAssignmentPanel =
    isAdmin && issue && !isRejectedIssue && !isResolvedIssue && !isPendingClosureIssue;

  const hasRejectionDetails =
    isRejectedIssue ||
    Boolean(issue?.rejectionReason) ||
    Boolean(issue?.rejectionNotes) ||
    Boolean(issue?.rejectedAt);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-[#2a2a2a]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">
              {isAdmin
                ? "Admin issue review"
                : isWorker
                ? "Worker task details"
                : "Issue details"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {isAdmin
                ? "AI-assisted moderation and operations context"
                : isWorker
                ? "Assigned work order and SLA context"
                : "Full civic report inspection"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#222222] dark:hover:text-slate-100"
          >
            Close
          </button>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto p-4">
        {isLoading ? (
          <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-[#333333] dark:text-slate-400">
            Loading issue details...
          </div>
        ) : !issue ? (
          <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-[#333333] dark:text-slate-400">
            Issue details could not be loaded. Try opening it again from the dashboard.
          </div>
        ) : (
          <div className="space-y-4">
            {issue.imageUrl ? (
              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-[#2a2a2a]">
                <img
                  src={issue.imageUrl}
                  alt={issue.title}
                  className="max-h-[320px] w-full bg-black object-contain"
                />
              </div>
            ) : (
              <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-500">
                No image available
              </div>
            )}

            <div>
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-lg font-semibold leading-6 text-slate-950 dark:text-white">
                  {issue.title}
                </h1>

                {isFetching && (
                  <span className="shrink-0 text-xs text-slate-400">
                    Syncing
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 dark:border-[#2a2a2a] dark:bg-[#101010] dark:text-slate-300">
                  {categoryLabels[issue.category] || issue.category}
                </span>

                <span
                  className={`rounded-md border px-2 py-1 text-xs font-medium ${
                    severityStyles[issue.severity] ||
                    "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {severityLabels[issue.severity] || issue.severity}
                </span>

                <IssueStatusPill status={issue.status} />
              </div>
            </div>

            <section className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-[#2a2a2a] dark:bg-[#101010]">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Description
              </h3>

              <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 dark:border-[#333333] dark:bg-[#151515]">
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
                  {issue.description || "No description provided."}
                </p>
              </div>
            </section>

            {issue && (
              <section className={`rounded-2xl border p-4 shadow-sm ${slaState.className}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">SLA & Escalation</h3>
                    <p className="mt-1 text-xs leading-5 opacity-80">
                      {slaState.helper}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full border border-current/30 bg-white/70 px-2.5 py-1 text-[11px] font-semibold dark:bg-black/20">
                    {slaState.label}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-current/15 bg-white/70 p-3 dark:bg-black/20">
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                      SLA Deadline
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      {formatDate(issue.slaDeadline)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-current/15 bg-white/70 p-3 dark:bg-black/20">
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                      Escalation Flag
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      {issue.slaBreached ? "Escalated / breached" : "Not escalated"}
                    </p>
                  </div>
                </div>

                {(issue.slaBreached ||
                  issue.escalationReason ||
                  issue.escalatedAt) && (
                  <div className="mt-4 rounded-xl border border-current/15 bg-white/70 p-3 dark:bg-black/20">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                          Escalation Details
                        </p>
                        <p className="mt-1 text-xs opacity-80">
                          Recorded operational risk context for supervisor/admin review.
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full border border-current/30 bg-white/70 px-2.5 py-1 text-[11px] font-semibold dark:bg-black/20">
                        {issue.escalationLevel || "LEVEL_1"}
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                          Reason
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {escalationReasonLabels[issue.escalationReason] ||
                            formatLabel(issue.escalationReason)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                          Escalated at
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {formatDate(issue.escalatedAt)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                          Escalated by
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {issue.escalatedBy?.name || "Operations team"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                          Level
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {escalationLevelLabels[issue.escalationLevel] ||
                            issue.escalationLevel ||
                            "Level 1"}
                        </p>
                      </div>
                    </div>

                    {issue.escalationNotes && (
                      <div className="mt-3 rounded-lg border border-current/15 bg-white/70 p-3 dark:bg-black/20">
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                          Escalation notes
                        </p>
                        <p className="mt-2 text-sm leading-6">
                          {issue.escalationNotes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {hasRejectionDetails && (
              <section className="rounded-2xl border border-red-200 bg-red-50/80 p-4 shadow-sm dark:border-red-900/70 dark:bg-red-950/20">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">
                      Rejection Details
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-red-700 dark:text-red-300">
                      This report was rejected during moderation and is not eligible for worker assignment.
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full border border-red-300 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
                    Rejected
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-red-100 bg-white/85 p-3 dark:border-red-900/60 dark:bg-[#111111]/70">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Reason
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                      {issue.rejectionReason
                        ? issue.rejectionReason.replaceAll("_", " ")
                        : "Not specified"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-red-100 bg-white/85 p-3 dark:border-red-900/60 dark:bg-[#111111]/70">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Rejected at
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                      {formatDate(issue.rejectedAt)}
                    </p>
                  </div>
                </div>

                {issue.rejectionNotes && (
                  <div className="mt-3 rounded-xl border border-red-100 bg-white/85 p-3 dark:border-red-900/60 dark:bg-[#111111]/70">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Moderator notes
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                      {issue.rejectionNotes}
                    </p>
                  </div>
                )}
              </section>
            )}

            {shouldShowAssignmentPanel && (
              <IssueAssignmentPanel
                issue={issue}
                isAdmin={isAdmin}
              />
            )}

            {hasReportEvidence && (
              <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-[#262626] dark:bg-[#111111]/80">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Report Evidence
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Original image attached when this issue was reported.
                  </p>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-[#333333] dark:bg-[#101010]">
                  <img
                    src={issue.imageUrl}
                    alt={`${issue.title} report evidence`}
                    className="h-48 w-full bg-black object-contain"
                  />
                </div>
              </section>
            )}

            {hasResolutionEvidence && (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm dark:border-emerald-900/70 dark:bg-emerald-950/20">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                      {isPendingClosureIssue ? "Closure Review Evidence" : "Before & After Evidence"}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-emerald-700 dark:text-emerald-300">
                      {isPendingClosureIssue
                        ? "Worker-submitted closure evidence is awaiting admin verification."
                        : "Original report image and worker resolution proof for before/after verification."}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full border border-emerald-300 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                    {isPendingClosureIssue ? "Pending Review" : "Resolved"}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-emerald-100 bg-white/85 p-3 dark:border-emerald-900/60 dark:bg-[#111111]/70">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Original Report Image
                    </p>

                    {issue.imageUrl ? (
                      <img
                        src={issue.imageUrl}
                        alt={`${issue.title} before resolution`}
                        className="h-44 w-full rounded-lg bg-black object-contain"
                      />
                    ) : (
                      <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-500">
                        No original report image
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-white/85 p-3 dark:border-emerald-900/60 dark:bg-[#111111]/70">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Resolution Proof Image
                    </p>

                    {issue.resolutionImageUrl ? (
                      <img
                        src={issue.resolutionImageUrl}
                        alt={`${issue.title} after resolution`}
                        className="h-44 w-full rounded-lg bg-black object-contain"
                      />
                    ) : (
                      <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-500">
                        No resolution proof image uploaded
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-emerald-100 bg-white/85 p-3 dark:border-emerald-900/60 dark:bg-[#111111]/70">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Resolution notes
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                      {issue.resolutionNotes || "No resolution notes provided."}
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-white/85 p-3 dark:border-emerald-900/60 dark:bg-[#111111]/70">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {isPendingClosureIssue ? "Submitted at" : "Resolved at"}
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                      {formatDate(issue.resolvedAt)}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {hasDuplicateSignal && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm dark:border-amber-900/70 dark:bg-amber-950/20">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      Possible duplicate detected
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-amber-700 dark:text-amber-300">
                      CivicSense rechecks this report after image AI processing using the AI description, raw caption, CLIP label, semantic similarity, distance, and time proximity.
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full border border-amber-300 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                    {formatPercent(issue.duplicateLikelihood)} match
                  </span>
                </div>

                {issue.possibleDuplicateIssueId && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-white/85 p-3 dark:border-amber-900/60 dark:bg-[#111111]/70">
                    {isPossibleDuplicateFetching ? (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Loading matched issue preview...
                      </p>
                    ) : possibleDuplicateIssue ? (
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                              {possibleDuplicateIssue.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {getDisplayArea(possibleDuplicateIssue)} ·{" "}
                              {formatDate(possibleDuplicateIssue.createdAt)}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                              severityStyles[possibleDuplicateIssue.severity] ||
                              "border-slate-200 bg-slate-50 text-slate-700 dark:border-[#333333] dark:bg-[#151515] dark:text-slate-200"
                            }`}
                          >
                            {severityLabels[possibleDuplicateIssue.severity] ||
                              possibleDuplicateIssue.severity}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            onOpenMatchedIssue?.(possibleDuplicateIssue)
                          }
                          className="rounded-md border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-200 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/70"
                        >
                          Open matched issue
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Matched issue ID:
                        </p>
                        <p className="break-all rounded-md bg-amber-100 px-2 py-1 text-[11px] font-mono text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                          {issue.possibleDuplicateIssueId}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            <section className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[#2a2a2a] dark:bg-[#101010]">
                <p className="text-xs text-slate-400">Reporter</p>
                <p className="mt-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                  {issue.reportedBy?.name || "Unknown"}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[#2a2a2a] dark:bg-[#101010]">
                <p className="text-xs text-slate-400">Assigned</p>
                <p className="mt-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                  {issue.assignedTo?.name || "Unassigned"}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[#2a2a2a] dark:bg-[#101010]">
                <p className="text-xs text-slate-400">Department</p>
                <p className="mt-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                  {issue.assignedDepartment
                    ? issue.assignedDepartment.replaceAll("_", " ")
                    : "Not assigned"}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[#2a2a2a] dark:bg-[#101010]">
                <p className="text-xs text-slate-400">SLA Deadline</p>
                <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                  {formatDate(issue.slaDeadline)}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[#2a2a2a] dark:bg-[#101010]">
                <p className="text-xs text-slate-400">Created</p>
                <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                  {formatDate(issue.createdAt)}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[#2a2a2a] dark:bg-[#101010]">
                <p className="text-xs text-slate-400">Updated</p>
                <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                  {formatDate(issue.updatedAt)}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-[#262626] dark:bg-[#111111]/80">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    AI Intelligence
                  </h3>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Automated civic verification insights
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>

              {hasAiSignals ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-[#242424] dark:bg-[#151515]">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Confidence
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                        {formatPercent(issue.aiConfidenceScore)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-[#242424] dark:bg-[#151515]">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Fake Risk
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                        {formatPercent(issue.fakeReportLikelihood)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    <AiMetricBar
                      label="Confidence Score"
                      helper="How strongly the AI believes this is a civic issue"
                      value={issue.aiConfidenceScore}
                      colorClass={getPositiveScoreBarColor(
                        issue.aiConfidenceScore
                      )}
                    />

                    <AiMetricBar
                      label="Fake Report Risk"
                      helper="Likelihood that the image does not match a valid civic report"
                      value={issue.fakeReportLikelihood}
                      colorClass={getRiskScoreBarColor(
                        issue.fakeReportLikelihood
                      )}
                    />

                    <AiMetricBar
                      label="Severity Certainty"
                      helper="Confidence behind the suggested severity level"
                      value={issue.severityConfidence}
                      colorClass={getPositiveScoreBarColor(
                        issue.severityConfidence
                      )}
                    />

                    <AiMetricBar
                      label="Duplicate Likelihood"
                      helper="Semantic duplicate score refined after image AI processing using AI description, raw caption, CLIP label, geo distance, and time proximity"
                      value={issue.duplicateLikelihood}
                      colorClass={getRiskScoreBarColor(
                        issue.duplicateLikelihood
                      )}
                    />
                  </div>

                  {reasoningItems.length > 0 && (
                    <div className="mt-5 border-t border-slate-100 pt-4 dark:border-[#1f1f1f]">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        AI Reasoning
                      </div>

                      <div className="space-y-2">
                        {reasoningItems.map((reason, index) => (
                          <div
                            key={`${reason}-${index}`}
                            className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-700 dark:border-[#1f1f1f] dark:bg-[#151515] dark:text-slate-300"
                          >
                            <span className="mt-0.5 text-emerald-500">✓</span>
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500 dark:border-[#333333] dark:bg-[#151515] dark:text-slate-400">
                  AI intelligence signals are not available yet. They will appear once image analysis completes.
                </div>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-[#2a2a2a] dark:bg-[#101010]">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Metadata
              </h3>

              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">
                    Area
                  </span>
                  <span className="text-right text-slate-800 dark:text-slate-200">
                    {getDisplayArea(issue)}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">
                    Latitude
                  </span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {issue.latitude}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">
                    Longitude
                  </span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {issue.longitude}
                  </span>
                </div>

                {issue.possibleDuplicateIssueId && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500 dark:text-slate-400">
                      Possible duplicate ID
                    </span>
                    <span className="max-w-[180px] truncate text-right font-mono text-xs text-slate-800 dark:text-slate-200">
                      {issue.possibleDuplicateIssueId}
                    </span>
                  </div>
                )}
              </div>
            </section>


            {canAddSupervisorNote && issue && (
              <section className="rounded-2xl border border-orange-200 bg-orange-50/80 p-4 shadow-sm dark:border-orange-900/70 dark:bg-orange-950/20">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-200">
                    Supervisor Note
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-orange-700 dark:text-orange-300">
                    Add operational context for this issue. Notes are saved in the issue timeline audit trail.
                  </p>
                </div>

                <textarea
                  value={supervisorNote}
                  onChange={(event) => setSupervisorNote(event.target.value)}
                  rows={4}
                  placeholder="Example: Please prioritize this because repeated complaints were received near a school route."
                  className="w-full resize-none rounded-xl border border-orange-200 bg-white/90 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 dark:border-orange-900/60 dark:bg-[#111111] dark:text-slate-100 dark:placeholder:text-slate-600"
                />

                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-orange-700/80 dark:text-orange-300/80">
                    Timeline event type: SUPERVISOR_NOTE
                  </p>

                  <button
                    type="button"
                    onClick={() => addSupervisorNoteMutation.mutate()}
                    disabled={addSupervisorNoteMutation.isPending || !supervisorNote.trim()}
                    className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {addSupervisorNoteMutation.isPending ? "Adding..." : "Add Note"}
                  </button>
                </div>
              </section>
            )}

            <IssueFeedbackReadOnlySection
              issue={issue}
              canViewFeedback={isAdmin || isSupervisor}
            />

            <IssueTimelineSection issue={issue} canExportTimeline={isAdmin || isSupervisor} />

            {isWorker && issue && (
              <section className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 shadow-sm backdrop-blur-sm dark:border-cyan-900/70 dark:bg-cyan-950/20">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-cyan-950 dark:text-cyan-100">
                    Worker Actions
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-cyan-800 dark:text-cyan-300">
                    Update the operational state of this assigned task.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={
                      updateStatusMutation.isPending ||
                      issue.status !== "ASSIGNED"
                    }
                    onClick={() => updateStatusMutation.mutate("IN_PROGRESS")}
                    className="rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    START WORK
                  </button>

                  <button
                    type="button"
                    disabled={
                      updateStatusMutation.isPending ||
                      issue.status === "RESOLVED" ||
                      issue.status === "REJECTED" ||
                      issue.status === "PENDING_CLOSURE"
                    }
                    onClick={() => setShowResolveModal(true)}
                    className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    SUBMIT REVIEW
                  </button>
                </div>

                {issue.status === "ASSIGNED" && (
                  <p className="mt-3 text-xs text-cyan-800 dark:text-cyan-300">
                    Start work when the crew begins field execution.
                  </p>
                )}

                {issue.status === "IN_PROGRESS" && (
                  <p className="mt-3 text-xs text-cyan-800 dark:text-cyan-300">
                    This task is active. Submit resolution evidence once completed.
                  </p>
                )}

                {issue.status === "PENDING_CLOSURE" && (
                  <p className="mt-3 text-xs text-purple-800 dark:text-purple-300">
                    Evidence submitted. Waiting for admin closure approval.
                  </p>
                )}
              </section>
            )}

            {isAdmin && isPendingClosureIssue && (
              <section className="rounded-2xl border border-purple-200 bg-purple-50/80 p-4 shadow-sm backdrop-blur-sm dark:border-purple-900/70 dark:bg-purple-950/20">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-purple-950 dark:text-purple-100">
                    Closure Review Required
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-purple-800 dark:text-purple-300">
                    Worker submitted resolution evidence. Approve final closure only if the before/after proof looks valid.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={updateStatusMutation.isPending}
                    onClick={() => updateStatusMutation.mutate("RESOLVED")}
                    className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    APPROVE CLOSURE
                  </button>

                  <button
                    type="button"
                    disabled={updateStatusMutation.isPending}
                    onClick={() => updateStatusMutation.mutate("IN_PROGRESS")}
                    className="rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    SEND BACK
                  </button>
                </div>

                <p className="mt-3 text-xs text-purple-800 dark:text-purple-300">
                  Send back moves the issue to IN PROGRESS so the assigned worker can resubmit better evidence.
                </p>
              </section>
            )}

            {isAdmin && issue && (
              <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-[#262626] dark:bg-[#111111]/80">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Moderation Actions
                  </h3>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Administrative moderation and operational controls
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={
                      updateStatusMutation.isPending ||
                      issue.status === "VERIFIED"
                    }
                    onClick={() => updateStatusMutation.mutate("VERIFIED")}
                    className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    VERIFY
                  </button>

                  <button
                    type="button"
                    disabled={
                      updateStatusMutation.isPending ||
                      issue.status === "REJECTED"
                    }
                    onClick={() => setShowRejectModal(true)}
                    className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    REJECT
                  </button>

                  <button
                    type="button"
                    disabled={
                      updateStatusMutation.isPending ||
                      issue.status === "RESOLVED" ||
                      issue.status === "PENDING_CLOSURE"
                    }
                    onClick={() => setShowResolveModal(true)}
                    className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    ADMIN RESOLVE
                  </button>

                  <button
                    type="button"
                    disabled={
                      updateStatusMutation.isPending ||
                      escalateIssueMutation.isPending ||
                      !isEscalatable
                    }
                    onClick={() => setShowEscalationModal(true)}
                    className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/50"
                  >
                    {issue.slaBreached ? "ESCALATED" : "ESCALATE"}
                  </button>
                </div>

                {updateStatusMutation.isPending && (
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    Updating issue...
                  </p>
                )}
              </section>
            )}

            {actions}
          </div>
        )}
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-white">
                Reject issue
              </h3>

              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Select a valid rejection reason before marking this civic report as rejected.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Rejection reason
                </label>

                <select
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-red-500"
                >
                  <option value="FAKE_REPORT">Fake issue / unrelated image</option>
                  <option value="DUPLICATE_ISSUE">Duplicate issue</option>
                  <option value="UNCLEAR_IMAGE">Unclear or low-quality image</option>
                  <option value="INVALID_CATEGORY">Invalid category</option>
                  <option value="OUTSIDE_SERVICE_AREA">Outside service area</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {rejectionReason === "OTHER" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">
                    Custom reason
                  </label>

                  <textarea
                    value={customRejectionReason}
                    onChange={(event) => setCustomRejectionReason(event.target.value)}
                    rows={3}
                    placeholder="Explain why this issue is being rejected..."
                    className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-red-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  disabled={updateStatusMutation.isPending}
                  className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={
                    updateStatusMutation.isPending ||
                    (rejectionReason === "OTHER" &&
                      customRejectionReason.trim().length < 5)
                  }
                  onClick={() =>
                    updateStatusMutation.mutate({
                      status: "REJECTED",
                      rejectionReason,
                      rejectionNotes:
                        rejectionReason === "OTHER"
                          ? customRejectionReason.trim()
                          : rejectionReason,
                    })
                  }
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updateStatusMutation.isPending ? "Rejecting..." : "Reject Issue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {showEscalationModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-white">
                Escalate issue
              </h3>

              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Record why this issue needs operational escalation. This marks the issue as escalated and adds a timeline audit entry.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Escalation reason
                </label>

                <select
                  value={escalationReason}
                  onChange={(event) => setEscalationReason(event.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-orange-500"
                >
                  <option value="SLA_BREACHED">SLA breached</option>
                  <option value="WORKER_UNAVAILABLE">Worker unavailable</option>
                  <option value="PUBLIC_SAFETY_RISK">Public safety risk</option>
                  <option value="REPEATED_COMPLAINTS">Repeated citizen complaints</option>
                  <option value="EVIDENCE_DELAY">Resolution evidence delay</option>
                  <option value="OTHER">Other operational risk</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Escalation level
                </label>

                <select
                  value={escalationLevel}
                  onChange={(event) => setEscalationLevel(event.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-orange-500"
                >
                  <option value="LEVEL_1">Level 1 - Department attention</option>
                  <option value="LEVEL_2">Level 2 - Supervisor attention</option>
                  <option value="LEVEL_3">Level 3 - Critical civic risk</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Notes
                </label>

                <textarea
                  value={escalationNotes}
                  onChange={(event) => setEscalationNotes(event.target.value)}
                  rows={4}
                  placeholder="Example: SLA deadline crossed and repeated citizen complaints received."
                  className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-orange-500"
                />
              </div>

              <div className="rounded-xl border border-orange-900/60 bg-orange-950/20 p-3 text-xs leading-5 text-orange-200">
                Escalation does not change the issue status. It keeps the issue in its current operational state while flagging it for higher attention.
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEscalationModal(false)}
                  disabled={escalateIssueMutation.isPending}
                  className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={escalateIssueMutation.isPending}
                  onClick={() => escalateIssueMutation.mutate()}
                  className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {escalateIssueMutation.isPending
                    ? "Escalating..."
                    : "Confirm Escalation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ResolveIssueModal
        issue={issue}
        open={showResolveModal}
        onClose={() => setShowResolveModal(false)}
      />

      {issue && onDeleteIssue && !isAdmin && (
        <div className="border-t border-slate-200 p-4 dark:border-[#2a2a2a]">
          <Button
            type="button"
            variant="destructive"
            className="w-full border-0 bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
            onClick={() => onDeleteIssue(issue.id)}
          >
            Delete issue
          </Button>
        </div>
      )}
    </div>
  );
}
