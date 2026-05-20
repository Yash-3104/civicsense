
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import API from "@/services/api";

function formatDepartmentLabel(value) {
  if (!value) {
    return "Not assigned";
  }

  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatWorkerDepartments(worker) {
  const departments = Array.isArray(worker?.departments)
    ? worker.departments
    : [];

  if (departments.length === 0) {
    return "No mapped departments";
  }

  return departments.map(formatDepartmentLabel).join(", ");
}

export default function IssueAssignmentPanel({ issue, isAdmin = false }) {
  const queryClient = useQueryClient();

  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState("");

  const category = issue?.category;

  const isAssigned =
    Boolean(issue?.assignedTo?.id) ||
    issue?.status === "ASSIGNED" ||
    issue?.status === "IN_PROGRESS" ||
    issue?.status === "PENDING_CLOSURE" ||
    issue?.status === "RESOLVED";

  const {
    data: departments = [],
    isLoading: departmentsLoading,
    isError: departmentsError,
    error: departmentsErrorObject,
  } = useQuery({
    queryKey: ["departments", category],
    queryFn: async () => {
      if (!category) {
        return [];
      }

      const response = await API.get(`/api/departments/${category}`);
      return response.data || [];
    },
    enabled: Boolean(category) && isAdmin && !isAssigned,
    retry: 1,
    staleTime: 1000 * 60,
  });

  const {
    data: workers = [],
    isLoading: workersLoading,
    isFetching: workersFetching,
    isError: workersError,
    error: workersErrorObject,
  } = useQuery({
    queryKey: ["workers", "by-department", selectedDepartment],
    queryFn: async () => {
      if (!selectedDepartment) {
        return [];
      }

      const response = await API.get(
        `/api/workers/by-department/${selectedDepartment}`
      );

      return response.data || [];
    },
    enabled: isAdmin && !isAssigned && Boolean(selectedDepartment),
    retry: 1,
    staleTime: 1000 * 30,
  });

  useEffect(() => {
    if (issue?.assignedDepartment) {
      setSelectedDepartment(issue.assignedDepartment);
    } else {
      setSelectedDepartment("");
    }

    if (issue?.assignedTo?.id) {
      setSelectedWorkerId(issue.assignedTo.id);
    } else {
      setSelectedWorkerId("");
    }
  }, [issue?.id, issue?.assignedDepartment, issue?.assignedTo?.id]);

  useEffect(() => {
    setSelectedWorkerId("");
  }, [selectedDepartment]);

  const selectedWorker = useMemo(() => {
    return workers.find((worker) => worker.id === selectedWorkerId);
  }, [workers, selectedWorkerId]);

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!issue?.id) {
        throw new Error("Issue ID is missing");
      }

      if (!selectedDepartment) {
        throw new Error("Please select a department");
      }

      if (!selectedWorkerId) {
        throw new Error("Please select a worker");
      }

      const response = await API.patch(`/api/issues/${issue.id}/assign`, {
        workerId: selectedWorkerId,
        department: selectedDepartment,
      });

      return response.data;
    },

    onSuccess: (assignedIssue) => {
      const workerName =
        assignedIssue?.assignedTo?.name || selectedWorker?.name || "worker";

      toast.success(`Issue assigned to ${workerName}`, {
        description: `${formatDepartmentLabel(
          assignedIssue?.assignedDepartment || selectedDepartment
        )} mapping verified.`,
      });

      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["nearby-issues"] });
      queryClient.invalidateQueries({ queryKey: ["workers"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["worker-issues"], exact: false });

      if (issue?.id) {
        queryClient.invalidateQueries({ queryKey: ["issue-detail"], exact: false });
        queryClient.invalidateQueries({ queryKey: ["admin-issue-detail", issue.id] });
        queryClient.invalidateQueries({ queryKey: ["issue-timeline", issue.id] });
      }
    },

    onError: (error) => {
      console.error("Assignment failed", error);

      toast.error("Failed to assign issue", {
        description:
          error?.response?.data?.message ||
          error?.response?.data ||
          "Check worker-department mapping and try again.",
      });
    },
  });

  const canAssign =
    Boolean(selectedDepartment) &&
    Boolean(selectedWorkerId) &&
    isAdmin &&
    !isAssigned;

  const assignmentDataError = departmentsError || workersError;

  return (
    <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Operational Assignment
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Workers are filtered using Worker Department Mapping V2.
          </p>
        </div>

        {isAssigned ? (
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300">
            Assigned
          </span>
        ) : (
          <span className="rounded-full bg-slate-700/60 px-3 py-1 text-xs font-medium text-slate-300">
            Unassigned
          </span>
        )}
      </div>

      {isAssigned ? (
        <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Current Assignment
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">Worker</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {issue?.assignedTo?.name || "Assigned worker"}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Department</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {formatDepartmentLabel(issue?.assignedDepartment)}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/80 p-3">
            <p className="text-xs text-slate-500">SLA Deadline</p>
            <p className="mt-1 text-sm font-medium text-amber-300">
              {formatDate(issue?.slaDeadline)}
            </p>
          </div>

          {issue?.assignedAt && (
            <p className="mt-3 text-xs text-slate-500">
              Assigned at: {formatDate(issue.assignedAt)}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {assignmentDataError && (
            <div className="rounded-xl border border-red-900/70 bg-red-950/30 px-3 py-2 text-xs text-red-300">
              <p className="font-semibold">Failed to load assignment data.</p>
              <p className="mt-1">
                Department error:{" "}
                {departmentsErrorObject?.response?.status || "none"} · Worker
                error: {workersErrorObject?.response?.status || "none"}
              </p>
              <p className="mt-1">
                Check that Worker Department Mapping V2 SQL has been run and
                that `/api/workers/by-department/{department}` returns mapped workers.
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Department
            </label>

            <select
              value={selectedDepartment}
              onChange={(event) => setSelectedDepartment(event.target.value)}
              disabled={departmentsLoading || !isAdmin}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500"
            >
              <option value="">
                {departmentsLoading
                  ? "Loading departments..."
                  : "Select department"}
              </option>

              {departments.map((department) => (
                <option key={department} value={department}>
                  {formatDepartmentLabel(department)}
                </option>
              ))}
            </select>

            {!departmentsLoading &&
              departments.length === 0 &&
              !departmentsError && (
                <p className="mt-1 text-xs text-amber-300">
                  No departments available for this issue category.
                </p>
              )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <label className="block text-xs font-medium text-slate-400">
                Worker
              </label>

              {workersFetching && (
                <span className="text-[11px] text-slate-500">Syncing</span>
              )}
            </div>

            <select
              value={selectedWorkerId}
              onChange={(event) => setSelectedWorkerId(event.target.value)}
              disabled={workersLoading || !isAdmin || !selectedDepartment}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500"
            >
              <option value="">
                {workersLoading ? "Loading mapped workers..." : "Select mapped worker"}
              </option>

              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name} ({worker.role})
                </option>
              ))}
            </select>

            {!workersLoading &&
              selectedDepartment &&
              workers.length === 0 &&
              !workersError && (
                <div className="mt-2 rounded-lg border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
                  No workers are mapped to{" "}
                  <span className="font-semibold">
                    {formatDepartmentLabel(selectedDepartment)}
                  </span>
                  . Add a mapping in the database or Staff Management later.
                </div>
              )}

            {selectedWorker && (
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {selectedWorker.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedWorker.email || "No email returned"} ·{" "}
                      {selectedWorker.role}
                    </p>
                  </div>

                  <span className="rounded-full border border-cyan-900/70 bg-cyan-950/30 px-2.5 py-1 text-[11px] font-medium text-cyan-300">
                    Mapped
                  </span>
                </div>

                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/70 p-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Department mappings
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">
                    {formatWorkerDepartments(selectedWorker)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => assignMutation.mutate()}
              disabled={!canAssign || assignMutation.isPending}
              className="w-full rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {assignMutation.isPending ? "Assigning..." : "Assign Issue"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
