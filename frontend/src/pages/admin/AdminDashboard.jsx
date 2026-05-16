import { Link, useNavigate } from "react-router-dom";
import {
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle2,
  LogOut,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import API from "@/services/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

import IssueDetailsDrawer from "@/components/issues/IssueDetailsDrawer";
import AdminIssueTable from "./components/AdminIssueTable";
import ModerationFilters from "./components/ModerationFilters";
import LiveOperationsFeed from "./components/LiveOperationsFeed";
import { useAuthStore } from "@/store/useAuthStore";

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [selectedIssueSummary, setSelectedIssueSummary] = useState(null);
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [liveEvents, setLiveEvents] = useState([]);

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

  const handleSelectIssue = (issue) => {
    setSelectedIssueId(issue.id);
    setSelectedIssueSummary(issue);
  };

  const handleOpenMatchedIssue = (matchedIssue) => {
    if (!matchedIssue?.id) return;

    setSelectedIssueId(matchedIssue.id);
    setSelectedIssueSummary(matchedIssue);
  };

  const handleDeleteIssue = async (issueId) => {
    await API.delete(`/api/issues/${issueId}`);

    if (selectedIssueId === issueId) {
      handleCloseDrawer();
    }

    await queryClient.invalidateQueries({ queryKey: ["issues"] });
    await queryClient.invalidateQueries({
      queryKey: ["admin-issue-detail", issueId],
    });
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

            const eventType = isResolvedEvent
              ? "ISSUE_RESOLVED"
              : isPendingClosureEvent
              ? "ISSUE_PENDING_CLOSURE"
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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
              issue={selectedIssue || selectedIssueSummary}
              isLoading={isSelectedIssueLoading}
              isFetching={isSelectedIssueFetching}
              onClose={handleCloseDrawer}
              onDeleteIssue={handleDeleteIssue}
              possibleDuplicateIssue={possibleDuplicateIssue}
              isPossibleDuplicateFetching={isPossibleDuplicateFetching}
              onOpenMatchedIssue={handleOpenMatchedIssue}
              isAdmin
            />
          </div>
        </div>
      )}
    </div>
  );
}
