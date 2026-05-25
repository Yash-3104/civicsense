import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  LogOut,
  RefreshCw,
  Shield,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import API from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";
import IssueDetailsDrawer from "@/components/issues/IssueDetailsDrawer";
import NotificationBell from "@/components/notifications/NotificationBell";
import { toast } from "sonner";

function formatLabel(value) {
  if (!value) return "Not available";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

function getStatusStyle(status) {
  if (status === "PENDING_CLOSURE") return "border-purple-900/70 bg-purple-950/40 text-purple-200";
  if (status === "IN_PROGRESS") return "border-amber-900/70 bg-amber-950/40 text-amber-200";
  if (status === "ASSIGNED") return "border-cyan-900/70 bg-cyan-950/40 text-cyan-200";
  if (status === "RESOLVED") return "border-emerald-900/70 bg-emerald-950/40 text-emerald-200";
  return "border-zinc-700 bg-zinc-950 text-zinc-300";
}

function getRiskLabel(issue) {
  if (issue?.slaBreached) return "SLA Breached";
  if (issue?.escalationReason) return formatLabel(issue.escalationReason);
  return "Operational Risk";
}

function isDueSoon(issue) {
  if (!issue?.slaDeadline || issue?.slaBreached) return false;
  const deadline = new Date(issue.slaDeadline).getTime();
  if (!Number.isFinite(deadline)) return false;
  const diffMs = deadline - Date.now();
  return diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000;
}


async function downloadExportFile(url, filename, contentType = "application/octet-stream") {
  const response = await API.get(url, {
    responseType: "blob",
  });

  // Prefix BOM so Excel detects UTF-8 correctly.
  // XLSX cannot store column widths/styles; for true formatted columns we need XLSX export.
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




function formatExportedAt(value) {
  if (!value) return null;

  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(value);
  } catch {
    return String(value);
  }
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


export default function SupervisorDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  const supervisorFilePrefix = safeCsvFilePart(user?.name || "Supervisor");

  const [taskFilter, setTaskFilter] = useState("ALL");
  const [workerFilter, setWorkerFilter] = useState("ALL");
  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [exportingCsv, setExportingCsv] = useState(null);
  const [lastExportedAt, setLastExportedAt] = useState(null);


  useEffect(() => {
    const notificationIssueId = searchParams.get("issueId");

    if (notificationIssueId) {
      setSelectedIssueId(notificationIssueId);
    }
  }, [searchParams]);

  const {
    data: overview,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["supervisor-overview"],
    queryFn: async () => {
      const response = await API.get("/api/supervisor/overview");
      return response.data;
    },
    retry: 1,
    staleTime: 1000 * 20,
    refetchOnWindowFocus: true,
  });

  const {
    data: selectedIssue,
    isLoading: isIssueLoading,
    isFetching: isIssueFetching,
  } = useQuery({
    queryKey: ["supervisor-issue-detail", selectedIssueId],
    queryFn: async () => {
      const response = await API.get(`/api/issues/${selectedIssueId}`);
      return response.data;
    },
    enabled: Boolean(selectedIssueId),
    retry: 1,
    staleTime: 1000 * 10,
  });

  const mappedDepartments = useMemo(() => overview?.supervisorDepartments || [], [overview?.supervisorDepartments]);

  const workerOptions = useMemo(() => {
    return [...(overview?.workerWorkloads || [])]
      .filter((worker) => (worker.totalActiveCount || 0) > 0)
      .sort((a, b) => String(a.workerName || "").localeCompare(String(b.workerName || "")));
  }, [overview?.workerWorkloads]);

  const taskQueue = useMemo(() => {
    let tasks = overview?.taskQueue || [];

    if (workerFilter !== "ALL") {
      tasks = tasks.filter((issue) => issue.assignedTo?.id === workerFilter);
    }

    switch (taskFilter) {
      case "ASSIGNED":
        return tasks.filter((issue) => issue.status === "ASSIGNED");
      case "IN_PROGRESS":
        return tasks.filter((issue) => issue.status === "IN_PROGRESS");
      case "PENDING_CLOSURE":
        return tasks.filter((issue) => issue.status === "PENDING_CLOSURE");
      case "RESOLVED":
        return tasks.filter((issue) => issue.status === "RESOLVED");
      case "DUE_SOON":
        return tasks.filter(isDueSoon);
      default:
        return tasks;
    }
  }, [overview?.taskQueue, taskFilter, workerFilter]);

  const topWorkers = useMemo(() => {
    return [...(overview?.workerWorkloads || [])]
      .sort((a, b) => (b.totalActiveCount || 0) - (a.totalActiveCount || 0))
      .slice(0, 8);
  }, [overview?.workerWorkloads]);

  const topDepartments = useMemo(() => {
    return [...(overview?.departmentWorkloads || [])]
      .sort((a, b) => (b.totalActiveCount || 0) - (a.totalActiveCount || 0))
      .slice(0, 8);
  }, [overview?.departmentWorkloads]);

  const dueSoonCount = useMemo(() => {
    return (overview?.taskQueue || []).filter(isDueSoon).length;
  }, [overview?.taskQueue]);


  const handleSupervisorExport = async (type, url, filename) => {
    if (exportingCsv) return;

    setExportingCsv(type);

    try {
      await downloadExportFile(url, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

      const exportedAt = new Date();
      setLastExportedAt(exportedAt);

      toast.success("XLSX exported", {
        description: `${filename} downloaded successfully.`,
      });
    } catch (error) {
      console.error("Supervisor XLSX export failed", error);
      const errorMessage =
        (await readBlobError(error)) ||
        "Failed to export XLSX. Check supervisor permissions and try again.";

      toast.error("Failed to export XLSX", {
        description: errorMessage,
      });
    } finally {
      setExportingCsv(null);
    }
  };

  const handleLogout = () => {
    queryClient.clear();
    logout();
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-orange-500/20 p-2">
              <Shield className="h-6 w-6 text-orange-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Supervisor Dashboard</h1>
              <p className="text-sm text-zinc-400">Department-scoped tasks, SLA oversight, escalations, and worker workload</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />

            <div className="hidden rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-400 md:block">
              {user?.name || "Supervisor"} · {user?.email || "supervisor"}
            </div>
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={() =>
                  handleSupervisorExport(
                    "tasks",
                    "/api/export/supervisor/tasks.xlsx",
                    `${supervisorFilePrefix}-Tasks-${todayCsvDate()}.xlsx`
                  )
                }
                disabled={Boolean(exportingCsv)}
                className="inline-flex items-center gap-2 rounded-lg border border-orange-900/70 bg-orange-950/30 px-4 py-2 text-sm font-medium text-orange-200 transition hover:border-orange-700 hover:bg-orange-950/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {exportingCsv === "tasks" ? "Exporting..." : "Export Tasks"}
              </button>

              {lastExportedAt && (
                <span className="text-[11px] text-zinc-500">
                  Last exported at {formatExportedAt(lastExportedAt)}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                handleSupervisorExport(
                  "timelines",
                  "/api/export/supervisor/issue-timelines.xlsx",
                  `${supervisorFilePrefix}-Department-Issue-Timelines-${todayCsvDate()}.xlsx`
                )
              }
              disabled={Boolean(exportingCsv)}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-900/70 bg-emerald-950/30 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:border-emerald-700 hover:bg-emerald-950/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {exportingCsv === "timelines" ? "Exporting..." : "Audit Timelines"}
            </button>

            <button type="button" onClick={() => refetch()} className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm transition hover:border-zinc-500 hover:bg-zinc-800">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
            {user?.role === "ADMIN" && (
              <Link to="/admin" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm transition hover:border-zinc-500 hover:bg-zinc-800">
                Admin Dashboard
              </Link>
            )}
            <button type="button" onClick={handleLogout} className="inline-flex items-center gap-2 rounded-lg border border-red-900/70 bg-red-950/30 px-4 py-2 text-sm font-medium text-red-300 transition hover:border-red-700 hover:bg-red-950/60 hover:text-red-200">
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {isLoading ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">Loading supervisor overview...</div>
        ) : isError ? (
          <div className="rounded-2xl border border-red-900/70 bg-red-950/30 p-5 text-red-300">
            <p className="font-semibold">Failed to load supervisor dashboard</p>
            <p className="mt-2 text-sm">{error?.response?.data?.message || error?.response?.data || "Check supervisor permissions and SecurityConfig."}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-orange-900/40 bg-orange-950/10 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-orange-200">Supervisor Scope</h2>
                  <p className="mt-1 text-sm text-zinc-400">This dashboard is filtered to your mapped departments.</p>
                  {lastExportedAt && (
                    <p className="mt-2 text-xs text-zinc-500">
                      Export activity: Last exported at {formatExportedAt(lastExportedAt)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {mappedDepartments.length === 0 ? (
                    <span className="rounded-full border border-amber-900/70 bg-amber-950/30 px-3 py-1 text-xs text-amber-200">No departments mapped — ask an admin to map you to a department.</span>
                  ) : (
                    mappedDepartments.map((department) => (
                      <span key={department} className="rounded-full border border-orange-900/70 bg-orange-950/30 px-3 py-1 text-xs font-medium text-orange-100">{formatLabel(department)}</span>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-4 xl:grid-cols-9">
              <StatCard label="Active" value={overview?.activeIssues} icon={<BarChart3 />} tone="blue" />
              <StatCard label="Assigned" value={overview?.assignedIssues} icon={<Users />} tone="cyan" />
              <StatCard label="In Progress" value={overview?.inProgressIssues} icon={<Clock />} tone="amber" />
              <StatCard label="Pending Closure" value={overview?.pendingClosureIssues} icon={<CheckCircle2 />} tone="purple" />
              <StatCard label="Resolved" value={overview?.resolvedIssues} icon={<CheckCircle2 />} tone="emerald" />
              <StatCard label="Due Soon" value={dueSoonCount} icon={<Clock />} tone="orange" />
              <StatCard label="SLA Breached" value={overview?.slaBreachedIssues} icon={<AlertTriangle />} tone="red" />
              <StatCard label="Escalated" value={overview?.escalatedIssues} icon={<AlertTriangle />} tone="orange" />
              <StatCard label="Active Workers" value={overview?.activeWorkers} icon={<Users />} tone="emerald" />
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-white">My Department Tasks</h2>
                    <p className="mt-1 text-sm text-zinc-400">Active and resolved tasks from your mapped departments.</p>

                    <button
                      type="button"
                      disabled={Boolean(exportingCsv)}
                      onClick={() =>
                        handleSupervisorExport(
                          "tasks",
                          "/api/export/supervisor/tasks.xlsx",
                          `${supervisorFilePrefix}-Tasks-${todayCsvDate()}.xlsx`
                        )
                      }
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-orange-900/70 bg-orange-950/30 px-3 py-2 text-xs font-medium text-orange-200 transition hover:border-orange-700 hover:bg-orange-950/60 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download className="h-4 w-4" />
                      {exportingCsv === "tasks" ? "Exporting..." : "Export Tasks XLSX"}
                    </button>
                  </div>
                  <div className="flex flex-col gap-3 lg:items-end">
                    <select value={workerFilter} onChange={(event) => setWorkerFilter(event.target.value)} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white outline-none transition focus:border-orange-500">
                      <option value="ALL">All mapped workers</option>
                      {workerOptions.map((worker) => (
                        <option key={worker.workerId} value={worker.workerId}>{worker.workerName}</option>
                      ))}
                    </select>
                    <div className="flex flex-wrap justify-end gap-2">
                      {["ALL", "ASSIGNED", "IN_PROGRESS", "PENDING_CLOSURE", "RESOLVED", "DUE_SOON"].map((filter) => (
                        <button key={filter} type="button" onClick={() => setTaskFilter(filter)} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${taskFilter === filter ? "border-orange-700 bg-orange-950/60 text-orange-100" : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"}`}>
                          {filter === "ALL" ? "All" : formatLabel(filter)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {taskQueue.length === 0 ? (
                    <EmptyState message="No department tasks match this filter. Try All or check mapped departments." />
                  ) : (
                    taskQueue.map((issue) => <TaskQueueCard key={issue.id} issue={issue} onClick={() => setSelectedIssueId(issue.id)} />)
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white">SLA & Escalation Queue</h2>
                    <p className="mt-1 text-sm text-zinc-400">Breached or escalated tasks from your mapped departments.</p>

                    <button
                      type="button"
                      disabled={Boolean(exportingCsv)}
                      onClick={() =>
                        handleSupervisorExport(
                          "sla",
                          "/api/export/supervisor/sla-queue.xlsx",
                          `${supervisorFilePrefix}-SLA-Escalation-Queue-${todayCsvDate()}.xlsx`
                        )
                      }
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-900/70 bg-red-950/30 px-3 py-2 text-xs font-medium text-red-200 transition hover:border-red-700 hover:bg-red-950/60 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download className="h-4 w-4" />
                      {exportingCsv === "sla" ? "Exporting..." : "Export SLA XLSX"}
                    </button>
                  </div>
                  <span className="rounded-full border border-orange-900/70 bg-orange-950/30 px-3 py-1 text-xs font-medium text-orange-200">{overview?.slaQueue?.length || 0} risks</span>
                </div>
                <div className="space-y-3">
                  {(overview?.slaQueue || []).length === 0 ? (
                    <EmptyState message="No escalated or SLA-breached issues right now." />
                  ) : (
                    overview.slaQueue.map((issue) => <RiskQueueCard key={issue.id} issue={issue} onClick={() => setSelectedIssueId(issue.id)} />)
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Department Workload</h2>
                    <p className="mt-1 text-sm text-zinc-400">Active operational load for your mapped departments.</p>
                  </div>

                  <button
                    type="button"
                    disabled={Boolean(exportingCsv)}
                    onClick={() =>
                      handleSupervisorExport(
                        "departments",
                        "/api/export/supervisor/department-workload.xlsx",
                        `${supervisorFilePrefix}-Department-Workload-${todayCsvDate()}.xlsx`
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" />
                    {exportingCsv === "departments" ? "Exporting..." : "Export XLSX"}
                  </button>
                </div>
                <div className="space-y-3">
                  {topDepartments.length === 0 ? <EmptyState message="No department workload yet. Assigned and resolved work will appear here." /> : topDepartments.map((department) => <DepartmentRow key={department.department} department={department} />)}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Worker Workload</h2>
                    <p className="mt-1 text-sm text-zinc-400">Workers mapped to your departments and their active work.</p>
                  </div>

                  <button
                    type="button"
                    disabled={Boolean(exportingCsv)}
                    onClick={() =>
                      handleSupervisorExport(
                        "workers",
                        "/api/export/supervisor/worker-workload.xlsx",
                        `${supervisorFilePrefix}-Worker-Workload-${todayCsvDate()}.xlsx`
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" />
                    {exportingCsv === "workers" ? "Exporting..." : "Export XLSX"}
                  </button>
                </div>
                <div className="overflow-hidden rounded-2xl border border-zinc-800">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-800 bg-zinc-950 text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Worker</th>
                        <th className="px-4 py-3">Departments</th>
                        <th className="px-4 py-3">Assigned</th>
                        <th className="px-4 py-3">In Progress</th>
                        <th className="px-4 py-3">Pending Closure</th>
                        <th className="px-4 py-3">Resolved</th>
                        <th className="px-4 py-3">SLA Breached</th>
                        <th className="px-4 py-3">Escalated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {topWorkers.length === 0 ? (
                        <tr><td colSpan={8} className="px-4 py-10 text-center text-zinc-500">No worker workload yet. Assign department tasks to workers to populate this table.</td></tr>
                      ) : (
                        topWorkers.map((worker) => <WorkerRow key={worker.workerId} worker={worker} />)
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {selectedIssueId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="dark h-full w-full max-w-2xl border-l border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
            <div className="h-full bg-zinc-950 text-zinc-100">
            <IssueDetailsDrawer
              issue={selectedIssue}
              isLoading={isIssueLoading}
              isFetching={isIssueFetching}
              onClose={() => {
                setSelectedIssueId(null);
                setSearchParams({});
              }}
              isSupervisor
              canAddSupervisorNote
            />
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value = 0, icon, tone }) {
  const toneClass = {
    blue: "text-blue-300 bg-blue-500/15",
    cyan: "text-cyan-300 bg-cyan-500/15",
    amber: "text-amber-300 bg-amber-500/15",
    purple: "text-purple-300 bg-purple-500/15",
    red: "text-red-300 bg-red-500/15",
    orange: "text-orange-300 bg-orange-500/15",
    emerald: "text-emerald-300 bg-emerald-500/15",
    green: "text-green-300 bg-green-500/15",
  }[tone];
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-zinc-400">{label}</p>
        <div className={`rounded-lg p-1.5 ${toneClass}`}><div className="h-4 w-4">{icon}</div></div>
      </div>
      <h3 className="text-2xl font-bold text-white">{value ?? 0}</h3>
    </div>
  );
}

function TaskQueueCard({ issue, onClick }) {
  return (
    <button type="button" onClick={onClick} className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-left transition hover:border-orange-800/70 hover:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusStyle(issue.status)}`}>{formatLabel(issue.status)}</span>
            {isDueSoon(issue) && <span className="rounded-full border border-orange-900/70 bg-orange-950/30 px-2.5 py-1 text-[11px] font-semibold text-orange-200">Due Soon</span>}
            {(issue.slaBreached || issue.escalationReason) && <span className="rounded-full border border-red-900/70 bg-red-950/30 px-2.5 py-1 text-[11px] font-semibold text-red-200">{getRiskLabel(issue)}</span>}
          </div>
          <h3 className="truncate text-base font-semibold text-white">{issue.title}</h3>
          <p className="mt-1 text-sm text-zinc-400">{formatLabel(issue.assignedDepartment)} · {issue.assignedTo?.name || "Unassigned"}</p>
          <p className="mt-1 text-xs text-zinc-500">{issue.address || "No address"} · SLA: {formatDate(issue.slaDeadline)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-zinc-500">{issue.status === "RESOLVED" ? "Resolved" : "Updated"}</p>
          <p className="mt-1 text-xs font-medium text-zinc-300">{formatDate(issue.status === "RESOLVED" ? issue.resolvedAt || issue.updatedAt : issue.updatedAt)}</p>
          <p className="mt-2 text-[11px] font-semibold text-orange-300">Open</p>
        </div>
      </div>
    </button>
  );
}

function RiskQueueCard({ issue, onClick }) {
  return (
    <button type="button" onClick={onClick} className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-left transition hover:border-orange-800/70 hover:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            <span className="rounded-full border border-red-900/70 bg-red-950/30 px-2.5 py-1 text-[11px] font-semibold text-red-200">{getRiskLabel(issue)}</span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusStyle(issue.status)}`}>{formatLabel(issue.status)}</span>
          </div>
          <h3 className="truncate text-base font-semibold text-white">{issue.title}</h3>
          <p className="mt-1 text-sm text-zinc-400">{formatLabel(issue.assignedDepartment)} · {issue.assignedTo?.name || "Unassigned"}</p>
          <p className="mt-1 text-xs text-zinc-500">{issue.address || "No address"} · SLA: {formatDate(issue.slaDeadline)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-zinc-500">Level</p>
          <p className="mt-1 text-sm font-semibold text-orange-200">{issue.escalationLevel || "LEVEL_1"}</p>
          <p className="mt-2 text-[11px] font-semibold text-orange-300">Open</p>
        </div>
      </div>
    </button>
  );
}

function DepartmentRow({ department }) {
  const total = Math.max(Number(department.totalActiveCount || 0), 1);
  const breachedPercent = Math.min(100, Math.round(((department.slaBreachedCount || 0) / total) * 100));
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{formatLabel(department.department)}</p>
          <p className="mt-1 text-xs text-zinc-500">{department.totalActiveCount || 0} active · {department.pendingClosureCount || 0} pending closure</p>
        </div>
        <span className="rounded-full border border-red-900/70 bg-red-950/30 px-2.5 py-1 text-xs font-semibold text-red-200">{department.slaBreachedCount || 0} breached</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-red-500" style={{ width: `${breachedPercent}%` }} /></div>
    </div>
  );
}

function WorkerRow({ worker }) {
  return (
    <tr className="bg-zinc-900/60 align-top transition hover:bg-zinc-900">
      <td className="px-4 py-4">
        <p className="font-semibold text-zinc-100">{worker.workerName}</p>
        <p className="mt-1 text-xs text-zinc-500">{worker.workerEmail}</p>
        <p className="mt-1 text-xs text-zinc-600">{formatLabel(worker.role)}</p>
      </td>
      <td className="px-4 py-4">
        {Array.isArray(worker.departments) && worker.departments.length > 0 ? (
          <div className="flex max-w-md flex-wrap gap-2">
            {worker.departments.map((department) => <span key={department} className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300">{formatLabel(department)}</span>)}
          </div>
        ) : <span className="text-xs text-amber-300">No departments mapped — ask an admin to map you to a department.</span>}
      </td>
      <td className="px-4 py-4 text-zinc-300">{worker.assignedCount || 0}</td>
      <td className="px-4 py-4 text-zinc-300">{worker.inProgressCount || 0}</td>
      <td className="px-4 py-4 text-zinc-300">{worker.pendingClosureCount || 0}</td>
      <td className="px-4 py-4 text-emerald-300">{worker.resolvedCount || 0}</td>
      <td className="px-4 py-4 text-red-300">{worker.slaBreachedCount || 0}</td>
      <td className="px-4 py-4 text-orange-300">{worker.escalatedCount || 0}</td>
    </tr>
  );
}

function EmptyState({ message }) {
  return <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-8 text-center text-sm text-zinc-500">{message}</div>;
}
