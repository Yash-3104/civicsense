import { Button } from "@/components/ui/button";
import { useState } from "react";
import ResolveIssueModal from "./ResolveIssueModal";
import axios from "axios";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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

function IssueStatusPill({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-300 ${
        status === "VERIFIED"
          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
          : status === "REJECTED"
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          : status === "RESOLVED"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
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
            : status === "RESOLVED"
            ? "bg-emerald-500"
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
  actions = null,
}) {
  const reasoningItems = parseAiReasoning(issue?.aiReasoning);
  const badge = getAiVerificationBadge(issue);
  const queryClient = useQueryClient();
  const [showResolveModal, setShowResolveModal] = useState(false);

  const updateStatusMutation = useMutation({
    mutationFn: async (status) => {
      if (!issue?.id) {
        throw new Error("Issue ID is missing");
      }

      const token = localStorage.getItem("token");

      await axios.patch(
        `http://localhost:8031/api/issues/${issue.id}/status`,
        { status },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    },

    onSuccess: (_, status) => {
      toast.success(`Issue marked as ${status}`);

      queryClient.invalidateQueries({
        queryKey: ["issues"],
      });

      queryClient.invalidateQueries({
        queryKey: ["nearby-issues"],
      });

      if (issue?.id) {
        queryClient.invalidateQueries({
          queryKey: ["issue-detail", issue.id],
        });
      }
    },

    onError: (error) => {
      console.error("Failed to update issue status", error);
      toast.error("Failed to update issue status");
    },
  });

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

  const hasResolutionEvidence =
    issue?.status === "RESOLVED" ||
    Boolean(issue?.resolutionNotes) ||
    Boolean(issue?.resolutionImageUrl) ||
    Boolean(issue?.resolvedAt);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-[#2a2a2a]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">
              {isAdmin ? "Admin issue review" : "Issue details"}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {isAdmin
                ? "AI-assisted moderation and operations context"
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
            Issue details unavailable.
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

            {hasResolutionEvidence && (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm dark:border-emerald-900/70 dark:bg-emerald-950/20">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                      Resolution Evidence
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-emerald-700 dark:text-emerald-300">
                      Closure proof submitted by the operations team for accountability and before/after verification.
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full border border-emerald-300 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                    Resolved
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-emerald-100 bg-white/85 p-3 dark:border-emerald-900/60 dark:bg-[#111111]/70">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Before image
                    </p>

                    {issue.imageUrl ? (
                      <img
                        src={issue.imageUrl}
                        alt={`${issue.title} before resolution`}
                        className="h-44 w-full rounded-lg bg-black object-contain"
                      />
                    ) : (
                      <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-500">
                        No before image
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-white/85 p-3 dark:border-emerald-900/60 dark:bg-[#111111]/70">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      After image
                    </p>

                    {issue.resolutionImageUrl ? (
                      <img
                        src={issue.resolutionImageUrl}
                        alt={`${issue.title} after resolution`}
                        className="h-44 w-full rounded-lg bg-black object-contain"
                      />
                    ) : (
                      <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-500">
                        No after image uploaded
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
                      Resolved at
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
                              {getDisplayArea(possibleDuplicateIssue)} · {formatDate(possibleDuplicateIssue.createdAt)}
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
                          onClick={() => onOpenMatchedIssue?.(possibleDuplicateIssue)}
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
                      colorClass={getPositiveScoreBarColor(issue.aiConfidenceScore)}
                    />

                    <AiMetricBar
                      label="Fake Report Risk"
                      helper="Likelihood that the image does not match a valid civic report"
                      value={issue.fakeReportLikelihood}
                      colorClass={getRiskScoreBarColor(issue.fakeReportLikelihood)}
                    />

                    <AiMetricBar
                      label="Severity Certainty"
                      helper="Confidence behind the suggested severity level"
                      value={issue.severityConfidence}
                      colorClass={getPositiveScoreBarColor(issue.severityConfidence)}
                    />

                    <AiMetricBar
                      label="Duplicate Likelihood"
                      helper="Semantic duplicate score refined after image AI processing using AI description, raw caption, CLIP label, geo distance, and time proximity"
                      value={issue.duplicateLikelihood}
                      colorClass={getRiskScoreBarColor(issue.duplicateLikelihood)}
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

            <section className="rounded-lg border border-dashed border-slate-300 bg-white p-3 dark:border-[#333333] dark:bg-[#101010]">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Timeline & comments
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Timeline, status history, comments, and admin notes will be added in the next backend/frontend upgrade.
              </p>
            </section>

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
                    onClick={() => updateStatusMutation.mutate("REJECTED")}
                    className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    REJECT
                  </button>

                  <button
                    type="button"
                    disabled={
                      updateStatusMutation.isPending ||
                      issue.status === "RESOLVED"
                    }
                    onClick={() => setShowResolveModal(true)}
                    className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    RESOLVE
                  </button>

                  <button
                    type="button"
                    disabled={updateStatusMutation.isPending}
                    onClick={() => toast("Escalation workflow coming next")}
                    className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#333333] dark:bg-[#1a1a1a] dark:text-slate-200 dark:hover:bg-[#222222]"
                  >
                    ESCALATE
                  </button>
                </div>

                {updateStatusMutation.isPending && (
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    Updating issue status...
                  </p>
                )}
              </section>
            )}

            {actions}
          </div>
        )}
      </div>

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