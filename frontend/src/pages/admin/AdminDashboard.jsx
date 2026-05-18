import { Link, useNavigate } from "react-router-dom";
import {
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle2,
  LogOut,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import API from "@/services/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { toast } from "sonner";

import IssueDetailsDrawer from "@/components/issues/IssueDetailsDrawer";
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

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [selectedIssueSummary, setSelectedIssueSummary] = useState(null);
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [liveEvents, setLiveEvents] = useState([]);
  const [isDeletingIssue, setIsDeletingIssue] = useState(false);
  const [deleteCandidateIssue, setDeleteCandidateIssue] = useState(null);

  const handleCloseDrawer = () => {
    setSelectedIssueId(null);
    setSelectedIssueSummary(null);
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
    setDeleteCandidateIssue(issue);
  };

  const handleCancelDeleteIssue = () => {
    if (isDeletingIssue) return;
    setDeleteCandidateIssue(null);
  };

  const handleConfirmDeleteIssue = async () => {
    const issueId = deleteCandidateIssue?.id;

    if (!issueId || isDeletingIssue) return;

    setIsDeletingIssue(true);

    try {
      await API.delete(`/api/issues/${issueId}`);

      toast.success("Issue deleted", {
        description: "The issue was removed from admin and citizen map views.",
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
    const socket = new SockJS("http://localhost:8031/ws");

    const stompClient = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        stompClient.subscribe("/topic/issues", (message) => {
          try {
            const payload = JSON.parse(message.body);

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
          } catch (error) {
            console.error("Live feed parse failed", error);
          }
        });
      },
    });

    stompClient.activate();

    return () => {
      stompClient.deactivate();
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
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Moderation Queue</h2>
              <p className="text-sm text-zinc-400">
                AI-flagged and operationally relevant civic reports
              </p>
            </div>

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
                        Development Cleanup
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-red-300/80">
                        Admin-only delete is enabled temporarily for cleaning test
                        reports. Later, replace this with delete verification.
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
          <div className="w-full max-w-md rounded-2xl border border-red-900/60 bg-zinc-950 p-5 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-xl bg-red-500/15 p-2 text-red-300">
                <Trash2 className="h-5 w-5" />
              </div>

              <div>
                <h3 className="text-base font-semibold text-white">
                  Delete issue from CivicSense?
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  This action removes the report from the admin queue and the citizen map.
                </p>
                <p className="mt-2 text-sm leading-6 text-red-300/90">
                  This is enabled only for development cleanup. Later, replace it with a verified deletion workflow.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Issue
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-100">
                {deleteCandidateIssue.title || "Untitled issue"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {deleteCandidateIssue.category || "Unknown category"} · {deleteCandidateIssue.status || "Unknown status"}
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                disabled={isDeletingIssue}
                onClick={handleCancelDeleteIssue}
                className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeletingIssue}
                onClick={handleConfirmDeleteIssue}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
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