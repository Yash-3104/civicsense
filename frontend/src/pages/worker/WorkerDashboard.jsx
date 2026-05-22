import IssueDetailsDrawer from "@/components/issues/IssueDetailsDrawer";
import NotificationBell from "@/components/notifications/NotificationBell";
import { Button } from "@/components/ui/button";
import API from "@/services/api";
import {
  connectIssueSocket,
  disconnectIssueSocket,
} from "@/services/realtime";
import { useAuthStore } from "@/store/useAuthStore";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import WorkerOperationsFeed from "./components/WorkerOperationsFeed";
import WorkerQueue from "./components/WorkerQueue";
import WorkerStatsCards from "./components/WorkerStatsCards";

function getStoredToken() {
  return sessionStorage.getItem("token") || localStorage.getItem("token");
}

function decodeJwtPayload(token) {
  if (!token) {
    return null;
  }

  try {
    const base64Url = token.split(".")[1];

    if (!base64Url) {
      return null;
    }

    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

    return JSON.parse(window.atob(base64));
  } catch {
    return null;
  }
}

async function fetchWorkerIssues() {
  const response = await API.get("/api/issues/worker/me");
  return response.data || [];
}

async function fetchIssueDetail({ queryKey }) {
  const [_key, _workerEmail, issueId] = queryKey;

  const response = await API.get(`/api/issues/${issueId}`);

  return response.data;
}

function getDisplayArea(issue) {
  if (!issue?.address || issue.address === "Selected from map") {
    return "Assigned civic area";
  }

  return issue.address;
}

export default function WorkerDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  const queryClient = useQueryClient();
  const selectedIssueIdRef = useRef(null);

  const token = getStoredToken();
  const jwtPayload = decodeJwtPayload(token);

  const currentWorkerEmail =
    jwtPayload?.email ||
    jwtPayload?.sub ||
    user?.email ||
    "unknown-worker";

  const currentWorkerName =
    jwtPayload?.name ||
    user?.name ||
    "Worker";

  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [events, setEvents] = useState([]);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const {
    data: workerIssues = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["worker-issues", currentWorkerEmail],
    queryFn: fetchWorkerIssues,
    enabled: Boolean(token) && currentWorkerEmail !== "unknown-worker",
    staleTime: 0,
    gcTime: 0,
    retry: 1,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const {
    data: selectedIssue,
    isLoading: isIssueLoading,
    isFetching: isIssueFetching,
  } = useQuery({
    queryKey: ["issue-detail", currentWorkerEmail, selectedIssueId],
    queryFn: fetchIssueDetail,
    enabled:
      Boolean(token) &&
      Boolean(selectedIssueId) &&
      currentWorkerEmail !== "unknown-worker",
    staleTime: 0,
    gcTime: 0,
    retry: 1,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });


  useEffect(() => {
    const notificationIssueId = searchParams.get("issueId");

    if (notificationIssueId) {
      setSelectedIssueId(notificationIssueId);
    }
  }, [searchParams]);

  useEffect(() => {
    selectedIssueIdRef.current = selectedIssueId;
  }, [selectedIssueId]);

  useEffect(() => {
    setSelectedIssueId(null);
    setEvents([]);

    queryClient.removeQueries({
      queryKey: ["worker-issues"],
      exact: false,
    });

    queryClient.removeQueries({
      queryKey: ["issue-detail"],
      exact: false,
    });
  }, [currentWorkerEmail, queryClient]);

  useEffect(() => {
    connectIssueSocket({
      onConnect: () => setIsRealtimeConnected(true),

      onDisconnect: () => setIsRealtimeConnected(false),

      onIssueEvent: (event) => {
        const eventIssueId =
          event?.issueId || event?.id || event?.issue?.id || event?.data?.id;

        setEvents((previous) => [event, ...previous].slice(0, 20));

        queryClient.invalidateQueries({
          queryKey: ["worker-issues", currentWorkerEmail],
        });

        if (eventIssueId) {
          queryClient.invalidateQueries({
            queryKey: ["issue-detail", currentWorkerEmail, eventIssueId],
          });
        }

        const activeIssueId = selectedIssueIdRef.current;

        if (activeIssueId) {
          queryClient.invalidateQueries({
            queryKey: ["issue-detail", currentWorkerEmail, activeIssueId],
          });
        }

        if (event?.type === "ISSUE_ASSIGNED") {
          toast.info("Worker queue updated", {
            description: event?.title || "A new task may be assigned.",
          });
        }

        if (event?.type === "ISSUE_UPDATED" && event?.status === "IN_PROGRESS") {
          toast.message("Task moved to in progress", {
            description: event?.title || "Operational work started.",
          });
        }

        if (event?.type === "ISSUE_PENDING_CLOSURE") {
          toast.info("Closure review requested", {
            description: event?.title || "Resolution evidence submitted for admin review.",
          });
        }

        if (event?.type === "ISSUE_ESCALATED") {
          toast.warning("SLA escalation recorded", {
            description: event?.title || "A task in your queue may need urgent attention.",
          });
        }

        if (event?.type === "ISSUE_RESOLVED") {
          toast.success("Task resolved", {
            description: event?.title || "Resolution approved by admin.",
          });
        }
      },
    });

    return () => {
      setIsRealtimeConnected(false);
      disconnectIssueSocket();
    };
  }, [queryClient, currentWorkerEmail]);

  const selectedIssueFromList = useMemo(() => {
    return workerIssues.find((issue) => issue.id === selectedIssueId);
  }, [workerIssues, selectedIssueId]);

  const handleLogout = () => {
    setSelectedIssueId(null);
    setEvents([]);

    queryClient.clear();

    logout();

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/login", {
      replace: true,
    });
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="grid h-full grid-rows-[64px_minmax(0,1fr)]">
        <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6">
          <div>
            <h1 className="text-lg font-bold text-white">Worker Dashboard</h1>
            <p className="text-xs text-zinc-500">
              Assigned civic work orders, SLA deadlines, and resolution workflow
            </p>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />

            <div className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
              {currentWorkerName} · {currentWorkerEmail}
            </div>

            <div className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
              <span
                className={`mr-2 inline-block h-2 w-2 rounded-full ${
                  isRealtimeConnected ? "bg-emerald-500" : "bg-zinc-500"
                }`}
              />
              {isRealtimeConnected ? "Live" : "Offline"}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/")}
              className="h-8 border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            >
              Citizen Map
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleLogout}
              className="h-8 border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            >
              Logout
            </Button>
          </div>
        </header>

        <main className="grid min-h-0 grid-cols-[360px_minmax(0,1fr)_420px] gap-4 p-4">
          <aside className="min-h-0 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/60">
            <div className="border-b border-zinc-800 p-5">
              <h2 className="font-semibold text-white">My Work Queue</h2>
              <p className="mt-1 text-xs text-zinc-500">
                {isLoading
                  ? "Loading assigned issues..."
                  : `${workerIssues.length} assigned tasks`}
              </p>
            </div>

            <div className="h-[calc(100%-82px)] min-h-0 overflow-y-auto p-4">
              <WorkerQueue
                issues={workerIssues}
                selectedIssueId={selectedIssueId}
                onSelectIssue={(issue) => setSelectedIssueId(issue.id)}
              />
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Operations Overview
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Start tasks, update progress, and submit closure evidence for admin review.
                </p>
              </div>

              {isFetching && (
                <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-400">
                  Syncing
                </span>
              )}
            </div>

            <WorkerStatsCards issues={workerIssues} />

            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
                <h3 className="font-semibold text-white">Current Task</h3>

                <p className="mt-1 text-sm text-zinc-500">
                  Select a work order from the queue to inspect and update it.
                </p>

                {selectedIssueFromList ? (
                  <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      Selected
                    </p>

                    <h4 className="mt-2 text-lg font-semibold text-white">
                      {selectedIssueFromList.title}
                    </h4>

                    <p className="mt-2 text-sm text-zinc-400">
                      {selectedIssueFromList.assignedDepartment?.replaceAll(
                        "_",
                        " "
                      ) || "Assigned department"}
                    </p>

                    <p className="mt-3 text-xs text-zinc-500">
                      Use the drawer on the right to start work or submit closure proof.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
                    No active task selected. Choose an assigned issue from the worker queue, or open one from a notification.
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
                <h3 className="font-semibold text-white">Realtime Feed</h3>

                <p className="mt-1 text-sm text-zinc-500">
                  Assignment, progress, and closure review events.
                </p>

                <div className="mt-5">
                  <WorkerOperationsFeed events={events} />
                </div>
              </div>
            </div>
          </section>

          <aside className="min-h-0 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/60">
            {selectedIssueId ? (
              <div className="dark h-full bg-zinc-950 text-zinc-100">
                <IssueDetailsDrawer
                  issue={selectedIssue}
                  isLoading={isIssueLoading}
                  isFetching={isIssueFetching}
                  onClose={() => {
                    setSelectedIssueId(null);
                    setSearchParams({});
                  }}
                  getDisplayArea={getDisplayArea}
                  isWorker
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div>
                  <p className="font-semibold text-white">No task selected</p>

                  <p className="mt-2 text-sm text-zinc-500">
                    Choose an assigned issue from the worker queue, or open one from a notification.
                  </p>
                </div>
              </div>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}
