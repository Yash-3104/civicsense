import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Download,
  LogOut,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import API from "@/services/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  connectIssueSocket,
  disconnectIssueSocket,
} from "@/services/realtime";

import IssueDetailsDrawer from "@/components/issues/IssueDetailsDrawer";
import NotificationBell from "@/components/notifications/NotificationBell";
import AdminIssueTable from "./components/AdminIssueTable";
import ModerationFilters from "./components/ModerationFilters";
import LiveOperationsFeed from "./components/LiveOperationsFeed";
import { useAuthStore } from "@/store/useAuthStore";

function getSlaState(issue) {
  if (!issue || issue.status === "RESOLVED" || issue.status === "REJECTED") {
    return "CLOSED";
  }

  if (!issue.slaDeadline) {
    return "NOT_STARTED";
  }

  const deadline = new Date(issue.slaDeadline).getTime();

  if (!Number.isFinite(deadline)) {
    return "UNKNOWN";
  }

  const diffMs = deadline - Date.now();

  if (issue.slaBreached || diffMs < 0) {
    return "BREACHED";
  }

  if (diffMs <= 24 * 60 * 60 * 1000) {
    return "DUE_SOON";
  }

  return "ON_TRACK";
}


function csvEscape(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized = String(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const escaped = normalized.replace(/"/g, '""');

  if (escaped.includes(",") || escaped.includes("\n") || escaped.includes('"')) {
    return `"${escaped}"`;
  }

  return escaped;
}

function downloadTextCsv(csv, filename) {
  // Prefix BOM so Excel detects UTF-8 correctly.
  const blob = new Blob(["\ufeff", csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
}

function buildAdminVisibleIssuesCsv(issues) {
  const headers = [
    "Issue ID",
    "Title",
    "Category",
    "Status",
    "Severity",
    "Address",
    "Department",
    "Assigned Worker",
    "Created At",
    "Updated At",
    "SLA Deadline",
    "SLA Breached",
    "Escalated",
    "Escalation Level",
    "Escalation Reason",
    "Rejection Reason",
    "Resolved At",
  ];

  const rows = issues.map((issue) => [
    issue.id,
    issue.title,
    issue.category,
    issue.status,
    issue.severity,
    issue.address,
    issue.assignedDepartment,
    issue.assignedTo?.name,
    issue.createdAt,
    issue.updatedAt,
    issue.slaDeadline,
    issue.slaBreached ? "true" : "false",
    issue.escalationReason || issue.escalatedAt ? "true" : "false",
    issue.escalationLevel,
    issue.escalationReason,
    issue.rejectionReason,
    issue.resolvedAt,
  ]);

  return [headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
}

async function downloadBackendFile(url, filename, contentType = "application/octet-stream") {
  const response = await API.get(url, {
    responseType: "blob",
  });

  // Prefix BOM so Excel detects UTF-8 correctly.
  // CSV cannot store column widths/styles; for true formatted columns we need XLSX export.
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



async function readBlobError(error) {
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



function safeCsvFilePart(value) {
  return String(value || "CivicSense")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "CivicSense";
}

function todayCsvDate() {
  return new Date().toISOString().slice(0, 10);
}


export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const logout = useAuthStore((state) => state.logout);

  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [selectedIssueSummary, setSelectedIssueSummary] = useState(null);
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [liveEvents, setLiveEvents] = useState([]);
  const [isDeletingIssue, setIsDeletingIssue] = useState(false);
  const [deleteCandidateIssue, setDeleteCandidateIssue] = useState(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const handleCloseDrawer = () => {
    setSelectedIssueId(null);
    setSelectedIssueSummary(null);
    setSearchParams({});
  };

  const handleLogout = () => {
    handleCloseDrawer();
    setLiveEvents([]);
    queryClient.clear();

    logout();

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/login", { replace: true });
  };


  useEffect(() => {
    const notificationIssueId = searchParams.get("issueId");

    if (notificationIssueId) {
      setSelectedIssueId(notificationIssueId);
      setSelectedIssueSummary({ id: notificationIssueId });
    }
  }, [searchParams]);

  const fetchIssues = async () => {
    const response = await API.get("/api/issues?page=0&size=100");
    return response.data.data || response.data.content || [];
  };

  const fetchIssueDetail = async ({ queryKey }) => {
    const [, issueId] = queryKey;
    const response = await API.get(`/api/issues/${issueId}`);
    return response.data;
  };

  const { data: issues = [], isLoading } = useQuery({
    queryKey: ["issues"],
    queryFn: fetchIssues,
  });

  const {
    data: selectedIssue,
    isLoading: isSelectedIssueLoading,
    isFetching: isSelectedIssueFetching,
  } = useQuery({
    queryKey: ["admin-issue-detail", selectedIssueId],
    queryFn: fetchIssueDetail,
    enabled: Boolean(selectedIssueId),
    staleTime: 1000 * 30,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const possibleDuplicateIssueId = selectedIssue?.possibleDuplicateIssueId;

  const {
    data: possibleDuplicateIssue,
    isFetching: isPossibleDuplicateFetching,
  } = useQuery({
    queryKey: ["admin-issue-detail", possibleDuplicateIssueId],
    queryFn: fetchIssueDetail,
    enabled:
      Boolean(selectedIssueId) &&
      Boolean(possibleDuplicateIssueId) &&
      possibleDuplicateIssueId !== selectedIssueId,
    staleTime: 1000 * 30,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const filteredIssues = useMemo(() => {
    switch (activeFilter) {
      case "AI_FLAGGED":
        return issues.filter((issue) => {
          return (
            (issue.fakeReportLikelihood || 0) >= 0.6 ||
            (issue.duplicateLikelihood || 0) >= 0.55 ||
            (issue.aiConfidenceScore || 1) <= 0.4
          );
        });

      case "DUPLICATES":
        return issues.filter(
          (issue) => (issue.duplicateLikelihood || 0) >= 0.55
        );

      case "LOW_CONFIDENCE":
        return issues.filter(
          (issue) => (issue.aiConfidenceScore || 1) <= 0.4
        );

      case "HIGH_SEVERITY":
        return issues.filter((issue) => issue.severity === "HIGH");

      case "UNRESOLVED":
        return issues.filter((issue) => issue.status !== "RESOLVED");

      case "PENDING_CLOSURE":
        return issues.filter((issue) => issue.status === "PENDING_CLOSURE");

      case "DUE_SOON":
        return issues.filter((issue) => getSlaState(issue) === "DUE_SOON");

      case "SLA_BREACHED":
        return issues.filter((issue) => getSlaState(issue) === "BREACHED");

      default:
        return issues;
    }
  }, [issues, activeFilter]);

  const aiFlaggedCount = issues.filter((issue) => {
    return (
      (issue.fakeReportLikelihood || 0) >= 0.6 ||
      (issue.duplicateLikelihood || 0) >= 0.55 ||
      (issue.aiConfidenceScore || 1) <= 0.4
    );
  }).length;

  const duplicateCount = issues.filter(
    (issue) => (issue.duplicateLikelihood || 0) >= 0.55
  ).length;

  const resolvedTodayCount = issues.filter(
    (issue) => issue.status === "RESOLVED"
  ).length;

  const slaBreachedCount = issues.filter(
    (issue) => getSlaState(issue) === "BREACHED"
  ).length;


  const handleExportVisibleIssues = () => {
    const csv = buildAdminVisibleIssuesCsv(filteredIssues);
    const suffix = activeFilter === "ALL" ? "all" : activeFilter.toLowerCase();

    downloadTextCsv(csv, `Admin-${safeCsvFilePart(suffix)}-Current-View-${todayCsvDate()}.csv`);

    toast.success("CSV exported", {
      description: "The current admin table view was exported as CSV.",
    });
  };

  const handleExportBackendCsv = async (url, filename, successDescription) => {
    if (isExportingCsv) return;

    setIsExportingCsv(true);

    try {
      await downloadBackendFile(url, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

      toast.success("XLSX export started", {
        description: successDescription || "The XLSX file is downloading.",
      });
    } catch (error) {
      console.error("Admin CSV export failed", error);

      const errorMessage =
        (await readBlobError(error)) ||
        "Check that you are logged in as ADMIN and try again.";

      toast.error("Failed to export XLSX", {
        description: errorMessage,
      });
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleSelectIssue = (issue) => {
    setSelectedIssueId(issue.id);
    setSelectedIssueSummary(issue);
  };

  const handleOpenMatchedIssue = (matchedIssue) => {
    if (!matchedIssue?.id) return;

    setSelectedIssueId(matchedIssue.id);
    setSelectedIssueSummary(matchedIssue);
  };

  const handleRequestDeleteIssue = (issue) => {
    if (!issue || isDeletingIssue) return;
    setDeleteConfirmationText("");
    setDeleteCandidateIssue(issue);
  };

  const handleCancelDeleteIssue = () => {
    if (isDeletingIssue) return;
    setDeleteConfirmationText("");
    setDeleteCandidateIssue(null);
  };

  const handleConfirmDeleteIssue = async () => {
    const issueId = deleteCandidateIssue?.id;

    if (!issueId || isDeletingIssue || deleteConfirmationText !== "DELETE") return;

    setIsDeletingIssue(true);

    try {
      await API.delete(`/api/issues/${issueId}`);

      toast.success("Issue deleted", {
        description: "The issue was removed from dashboards, exports, public registry, and workflow views.",
      });

      queryClient.setQueryData(["issues"], (oldIssues) => {
        if (!Array.isArray(oldIssues)) return oldIssues;
        return oldIssues.filter((issue) => issue.id !== issueId);
      });

      queryClient.setQueriesData(
        {
          queryKey: ["nearby-issues"],
          exact: false,
        },
        (oldIssues) => {
          if (!Array.isArray(oldIssues)) return oldIssues;
          return oldIssues.filter((issue) => issue.id !== issueId);
        }
      );

      queryClient.removeQueries({
        queryKey: ["admin-issue-detail", issueId],
        exact: true,
      });

      queryClient.removeQueries({
        queryKey: ["issue-detail", issueId],
        exact: true,
      });

      if (selectedIssueId === issueId) {
        handleCloseDrawer();
      }

      setDeleteConfirmationText("");
      setDeleteCandidateIssue(null);

      await queryClient.invalidateQueries({ queryKey: ["issues"] });
      await queryClient.invalidateQueries({
        queryKey: ["nearby-issues"],
        exact: false,
      });
    } catch (error) {
      console.error("Admin delete issue failed", error);

      toast.error("Failed to delete issue", {
        description:
          error?.response?.data?.message ||
          error?.response?.data ||
          "Check that you are logged in as ADMIN/OFFICER/SUPERVISOR.",
      });
    } finally {
      setIsDeletingIssue(false);
    }
  };

  useEffect(() => {
    connectIssueSocket({
      onIssueEvent: (payload) => {
        const isResolvedEvent =
          payload.type === "ISSUE_RESOLVED" ||
          (payload.type === "ISSUE_UPDATED" &&
            payload.status === "RESOLVED");

        const isPendingClosureEvent =
          payload.type === "ISSUE_PENDING_CLOSURE" ||
          (payload.type === "ISSUE_UPDATED" &&
            payload.status === "PENDING_CLOSURE");

        const isEscalatedEvent = payload.type === "ISSUE_ESCALATED";

        const eventType = isResolvedEvent
          ? "ISSUE_RESOLVED"
          : isPendingClosureEvent
          ? "ISSUE_PENDING_CLOSURE"
          : isEscalatedEvent
          ? "ISSUE_ESCALATED"
          : payload.type || "SYSTEM_EVENT";

        const event = {
          type: eventType,
          timestamp: payload.timestamp || new Date().toISOString(),
          message:
            eventType === "NEW_ISSUE"
              ? `New issue reported: ${payload.title || "Untitled issue"}`
              : eventType === "AI_ANALYSIS_COMPLETED"
              ? `AI analysis completed for ${
                  payload.title || "the selected issue"
                }`
              : eventType === "ISSUE_PENDING_CLOSURE"
              ? `Closure review requested: ${
                  payload.title || "the selected issue"
                }`
              : eventType === "ISSUE_RESOLVED"
              ? `Issue closure approved: ${
                  payload.title || "the selected issue"
                }`
              : eventType === "ISSUE_ASSIGNED"
              ? `Issue assigned to operations: ${
                  payload.title || "the selected issue"
                }`
              : eventType === "ISSUE_ESCALATED"
              ? `SLA escalated: ${payload.title || "the selected issue"}`
              : eventType === "ISSUE_UPDATED"
              ? `Issue updated${payload.status ? ` to ${payload.status}` : ""}`
              : eventType === "ISSUE_DELETED"
              ? "Issue removed from the system"
              : "Realtime civic event received.",
          issueTitle: payload.title,
        };

        setLiveEvents((prev) => [event, ...prev].slice(0, 20));

        queryClient.invalidateQueries({ queryKey: ["issues"] });

        if (payload.issueId) {
          queryClient.invalidateQueries({
            queryKey: ["admin-issue-detail", payload.issueId],
          });

          queryClient.invalidateQueries({
            queryKey: ["issue-detail", payload.issueId],
          });

          if (selectedIssueId === payload.issueId) {
            queryClient.invalidateQueries({
              queryKey: ["admin-issue-detail", payload.issueId],
            });
          }

          if (
            payload.type === "ISSUE_DELETED" &&
            selectedIssueId === payload.issueId
          ) {
            handleCloseDrawer();
          }
        }
      },
    });

    return () => {
      disconnectIssueSocket();
    };
  }, [queryClient, selectedIssueId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 p-10 text-white">
        Loading moderation dashboard...
      </div>
    );
  }

  const drawerIssue = selectedIssue || selectedIssueSummary;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-500/20 p-2">
              <Shield className="h-6 w-6 text-blue-400" />
            </div>

            <div>
              <h1 className="text-2xl font-bold">CivicSense Admin</h1>
              <p className="text-sm text-zinc-400">
                AI-assisted civic operations dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />

            <Link
              to="/admin/staff"
              className="
                inline-flex
                items-center
                gap-2
                rounded-lg
                border
                border-purple-900/70
                bg-purple-950/30
                px-4
                py-2
                text-sm
                font-medium
                text-purple-200
                transition
                hover:border-purple-700
                hover:bg-purple-950/60
              "
            >
              <Users className="h-4 w-4" />
              Staff Management
            </Link>

            <Link
              to="/"
              className="
                rounded-lg
                border
                border-zinc-700
                px-4
                py-2
                text-sm
                transition
                hover:border-zinc-500
                hover:bg-zinc-800
              "
            >
              Citizen Dashboard
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="
                inline-flex
                items-center
                gap-2
                rounded-lg
                border
                border-red-900/70
                bg-red-950/30
                px-4
                py-2
                text-sm
                font-medium
                text-red-300
                transition
                hover:border-red-700
                hover:bg-red-950/60
                hover:text-red-200
              "
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-zinc-400">Open Issues</p>
              <Activity className="h-5 w-5 text-blue-400" />
            </div>
            <h2 className="text-3xl font-bold">{issues.length}</h2>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-zinc-400">AI Flagged</p>
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
            </div>
            <h2 className="text-3xl font-bold">{aiFlaggedCount}</h2>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-zinc-400">Possible Duplicates</p>
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <h2 className="text-3xl font-bold">{duplicateCount}</h2>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-zinc-400">SLA Breached</p>
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <h2 className="text-3xl font-bold">{slaBreachedCount}</h2>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-zinc-400">Resolved</p>
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            </div>
            <h2 className="text-3xl font-bold">{resolvedTodayCount}</h2>
          </div>
        </div>

        <div className="mt-6">
          <ModerationFilters
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
          />
        </div>

        <div className="grid grid-cols-12 gap-6">
          <section className="col-span-12 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 lg:col-span-8">
            <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Moderation Queue</h2>
                <p className="text-sm text-zinc-400">
                  AI-flagged and operationally relevant civic reports
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExportVisibleIssues}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
                >
                  <Download className="h-4 w-4" />
                  Export Current View
                </button>

                <button
                  type="button"
                  disabled={isExportingCsv}
                  onClick={() =>
                    handleExportBackendCsv(
                      "/api/admin/export/issues.xlsx",
                      `Admin-All-Issues-${todayCsvDate()}.xlsx`,
                      "All issues CSV is downloading."
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-900/70 bg-blue-950/30 px-3 py-2 text-xs font-medium text-blue-200 transition hover:border-blue-700 hover:bg-blue-950/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  {isExportingCsv ? "Exporting..." : "Export All XLSX"}
                </button>

                <button
                  type="button"
                  disabled={isExportingCsv}
                  onClick={() =>
                    handleExportBackendCsv(
                      "/api/admin/export/issues.xlsx?slaBreached=true",
                      `Admin-SLA-Breached-Issues-${todayCsvDate()}.xlsx`,
                      "SLA breached issues CSV is downloading."
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-red-900/70 bg-red-950/30 px-3 py-2 text-xs font-medium text-red-200 transition hover:border-red-700 hover:bg-red-950/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  SLA Breached
                </button>

                <button
                  type="button"
                  disabled={isExportingCsv}
                  onClick={() =>
                    handleExportBackendCsv(
                      "/api/admin/export/issues.xlsx?escalated=true",
                      `Admin-Escalated-Issues-${todayCsvDate()}.xlsx`,
                      "Escalated issues CSV is downloading."
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-orange-900/70 bg-orange-950/30 px-3 py-2 text-xs font-medium text-orange-200 transition hover:border-orange-700 hover:bg-orange-950/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  Escalated
                </button>

                <button
                  type="button"
                  disabled={isExportingCsv}
                  onClick={() =>
                    handleExportBackendCsv(
                      "/api/admin/export/issue-timelines.xlsx",
                      `Admin-All-Issue-Timelines-${todayCsvDate()}.xlsx`,
                      "All issue timelines XLSX is downloading."
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-900/70 bg-emerald-950/30 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:border-emerald-700 hover:bg-emerald-950/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  Audit Timelines
                </button>

              </div>
            </div>

            {filteredIssues.length === 0 && (
              <div className="mb-4 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/40 p-5 text-sm text-zinc-400">
                No admin issues match the current filters. Clear filters or create a demo report to populate this table.
              </div>
            )}

            <AdminIssueTable
              issues={filteredIssues}
              onSelectIssue={handleSelectIssue}
            />
          </section>

          <section className="col-span-12 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 lg:col-span-4">
            <h2 className="mb-4 text-xl font-semibold">Live Operations Feed</h2>
            <LiveOperationsFeed events={liveEvents} />
          </section>
        </div>
      </main>

      {(selectedIssueId || selectedIssueSummary) && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
          <div className="dark fixed right-0 top-0 h-full w-full max-w-[460px] border-l border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
            <IssueDetailsDrawer
              issue={drawerIssue}
              isLoading={isSelectedIssueLoading}
              isFetching={isSelectedIssueFetching}
              onClose={handleCloseDrawer}
              possibleDuplicateIssue={possibleDuplicateIssue}
              isPossibleDuplicateFetching={isPossibleDuplicateFetching}
              onOpenMatchedIssue={handleOpenMatchedIssue}
              isAdmin
              actions={
                drawerIssue ? (
                  <section className="rounded-2xl border border-red-900/70 bg-red-950/20 p-4 shadow-sm">
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-red-200">
                        Delete Verification
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-red-300/80">
                        Delete requires typed confirmation before the issue is removed from CivicSense records.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isDeletingIssue}
                      onClick={() => handleRequestDeleteIssue(drawerIssue)}
                      className="
                        inline-flex
                        w-full
                        items-center
                        justify-center
                        gap-2
                        rounded-xl
                        bg-red-600
                        px-4
                        py-3
                        text-sm
                        font-semibold
                        text-white
                        transition
                        hover:bg-red-500
                        disabled:cursor-not-allowed
                        disabled:opacity-60
                      "
                    >
                      <Trash2 className="h-4 w-4" />
                      {isDeletingIssue ? "Deleting..." : "Delete Issue"}
                    </button>
                  </section>
                ) : null
              }
            />
          </div>
        </div>
      )}

      {deleteCandidateIssue && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-red-900/60 bg-zinc-950 p-5 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-lg bg-red-500/15 p-2 text-red-300">
                <Trash2 className="h-5 w-5" />
              </div>

              <div>
                <h3 className="text-base font-semibold text-white">
                  Delete issue from CivicSense?
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Deleting this issue removes it from dashboards, exports, public registry, and workflow views. Use this only for demo cleanup or invalid test data.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-xs font-medium text-zinc-500">Issue title</p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">
                {deleteCandidateIssue.title || "Untitled issue"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {deleteCandidateIssue.category || "Unknown category"} · {deleteCandidateIssue.status || "Unknown status"}
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <label htmlFor="delete-confirmation" className="text-sm font-medium text-zinc-200">
                Type DELETE to confirm
              </label>
              <input
                id="delete-confirmation"
                value={deleteConfirmationText}
                disabled={isDeletingIssue}
                onChange={(event) => setDeleteConfirmationText(event.target.value)}
                autoComplete="off"
                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-red-400 focus:ring-2 focus:ring-red-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="DELETE"
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                disabled={isDeletingIssue}
                onClick={handleCancelDeleteIssue}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeletingIssue || deleteConfirmationText !== "DELETE"}
                onClick={handleConfirmDeleteIssue}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                <Trash2 className="h-4 w-4" />
                {isDeletingIssue ? "Deleting..." : "Delete issue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
