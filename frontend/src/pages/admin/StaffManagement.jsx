import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import API from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";

const STAFF_ROLES = ["WORKER", "OFFICER", "SUPERVISOR"];

const DEPARTMENTS = [
  "ROAD_MAINTENANCE",
  "PUBLIC_WORKS",
  "URBAN_INFRASTRUCTURE",
  "WATER_SUPPLY",
  "DRAINAGE_DEPARTMENT",
  "SEWAGE_DEPARTMENT",
  "WASTE_MANAGEMENT",
  "SANITATION_DEPARTMENT",
  "ELECTRICAL_DEPARTMENT",
  "STREETLIGHT_MAINTENANCE",
];

function formatLabel(value) {
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

function getRoleStyle(role) {
  if (role === "SUPERVISOR") {
    return "border-purple-900/70 bg-purple-950/40 text-purple-200";
  }

  if (role === "OFFICER") {
    return "border-blue-900/70 bg-blue-950/40 text-blue-200";
  }

  return "border-cyan-900/70 bg-cyan-950/40 text-cyan-200";
}

function emptyForm() {
  return {
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "WORKER",
    departments: [],
  };
}

export default function StaffManagement() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  const [roleFilter, setRoleFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const handleLogout = () => {
    queryClient.clear();
    logout();
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  const {
    data: staff = [],
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const response = await API.get("/api/staff");
      return response.data || [];
    },
    retry: 1,
    staleTime: 1000 * 20,
  });

  const createStaffMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        departments: form.departments,
      };

      const response = await API.post("/api/staff", payload);
      return response.data;
    },
    onSuccess: (createdStaff) => {
      toast.success("Staff member created", {
        description: `${createdStaff.name} can now log in and receive department-based assignments.`,
      });

      setShowCreateModal(false);
      setForm(emptyForm());

      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["workers"], exact: false });
    },
    onError: (error) => {
      console.error("Create staff failed", error);
      toast.error("Failed to create staff", {
        description:
          error?.response?.data?.message ||
          error?.response?.data ||
          "Check staff details and try again.",
      });
    },
  });

  const addDepartmentMutation = useMutation({
    mutationFn: async ({ staffId, department }) => {
      const response = await API.post(
        `/api/staff/${staffId}/departments/${department}`
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success("Department mapping added");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["workers"], exact: false });
    },
    onError: (error) => {
      console.error("Add department failed", error);
      toast.error("Failed to add department", {
        description:
          error?.response?.data?.message ||
          error?.response?.data ||
          "Check admin permissions and try again.",
      });
    },
  });

  const removeDepartmentMutation = useMutation({
    mutationFn: async ({ staffId, department }) => {
      const response = await API.delete(
        `/api/staff/${staffId}/departments/${department}`
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success("Department mapping removed");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["workers"], exact: false });
    },
    onError: (error) => {
      console.error("Remove department failed", error);
      toast.error("Failed to remove department", {
        description:
          error?.response?.data?.message ||
          error?.response?.data ||
          "Check admin permissions and try again.",
      });
    },
  });

  const filteredStaff = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return staff.filter((member) => {
      const matchesRole = roleFilter === "ALL" || member.role === roleFilter;

      const matchesSearch =
        !query ||
        member.name?.toLowerCase().includes(query) ||
        member.email?.toLowerCase().includes(query) ||
        member.phone?.toLowerCase().includes(query);

      return matchesRole && matchesSearch;
    });
  }, [staff, roleFilter, searchTerm]);

  const stats = useMemo(() => {
    return {
      total: staff.length,
      workers: staff.filter((member) => member.role === "WORKER").length,
      officers: staff.filter((member) => member.role === "OFFICER").length,
      supervisors: staff.filter((member) => member.role === "SUPERVISOR").length,
      unmapped: staff.filter(
        (member) =>
          !Array.isArray(member.departments) || member.departments.length === 0
      ).length,
    };
  }, [staff]);

  const toggleFormDepartment = (department) => {
    setForm((current) => {
      const exists = current.departments.includes(department);

      return {
        ...current,
        departments: exists
          ? current.departments.filter((item) => item !== department)
          : [...current.departments, department],
      };
    });
  };

  const canCreateStaff =
    form.name.trim().length >= 2 &&
    form.email.trim().length >= 5 &&
    form.password.trim().length >= 6 &&
    STAFF_ROLES.includes(form.role);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-500/20 p-2">
              <Users className="h-6 w-6 text-purple-300" />
            </div>

            <div>
              <h1 className="text-2xl font-bold">Staff Management</h1>
              <p className="text-sm text-zinc-400">
                Create staff and manage department mappings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm transition hover:border-zinc-500 hover:bg-zinc-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Admin Dashboard
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-red-900/70 bg-red-950/30 px-4 py-2 text-sm font-medium text-red-300 transition hover:border-red-700 hover:bg-red-950/60 hover:text-red-200"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <StatCard label="Total Staff" value={stats.total} icon={<Users />} />
          <StatCard label="Workers" value={stats.workers} icon={<UserCog />} />
          <StatCard label="Officers" value={stats.officers} icon={<Shield />} />
          <StatCard label="Supervisors" value={stats.supervisors} icon={<Shield />} />
          <StatCard label="Unmapped" value={stats.unmapped} icon={<RefreshCw />} />
        </div>

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Staff Directory</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Manage assignable workers, officers, supervisors, and their department coverage.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"
            >
              <Plus className="h-4 w-4" />
              Create Staff
            </button>
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-[1fr_220px]">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, email, or phone..."
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-purple-500"
            />

            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-white outline-none focus:border-purple-500"
            >
              <option value="ALL">All roles</option>
              {STAFF_ROLES.map((role) => (
                <option key={role} value={role}>
                  {formatLabel(role)}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-400">
              Loading staff...
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-300">
              <p className="font-semibold">Failed to load staff</p>
              <p className="mt-1">
                {error?.response?.data?.message ||
                  error?.response?.data ||
                  "Check that /api/staff is allowed for ADMIN."}
              </p>
            </div>
          ) : (
            <>
              {isFetching && (
                <p className="mb-3 text-xs text-zinc-500">Syncing staff data...</p>
              )}

              <div className="overflow-hidden rounded-2xl border border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-800 bg-zinc-950 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Staff</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Departments</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Add Mapping</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-800">
                    {filteredStaff.map((member) => (
                      <StaffRow
                        key={member.id}
                        member={member}
                        addDepartmentMutation={addDepartmentMutation}
                        removeDepartmentMutation={removeDepartmentMutation}
                      />
                    ))}

                    {filteredStaff.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-10 text-center text-zinc-500"
                        >
                          No staff found for the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-white">
                Create staff member
              </h3>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Create workers, officers, or supervisors and map them to operational departments.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Name"
                value={form.name}
                onChange={(value) => setForm((current) => ({ ...current, name: value }))}
                placeholder="Road Worker 2"
              />

              <Field
                label="Email"
                value={form.email}
                onChange={(value) => setForm((current) => ({ ...current, email: value }))}
                placeholder="road2@test.com"
              />

              <Field
                label="Phone"
                value={form.phone}
                onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
                placeholder="9876500004"
              />

              <Field
                label="Password"
                value={form.password}
                type="password"
                onChange={(value) => setForm((current) => ({ ...current, password: value }))}
                placeholder="worker@123"
              />

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, role: event.target.value }))
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                >
                  {STAFF_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {formatLabel(role)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-medium text-zinc-400">
                Department mappings
              </p>

              <div className="grid gap-2 md:grid-cols-2">
                {DEPARTMENTS.map((department) => {
                  const selected = form.departments.includes(department);

                  return (
                    <button
                      key={department}
                      type="button"
                      onClick={() => toggleFormDepartment(department)}
                      className={`rounded-xl border px-3 py-2 text-left text-xs font-medium transition ${
                        selected
                          ? "border-purple-700 bg-purple-950/50 text-purple-200"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      {formatLabel(department)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={createStaffMutation.isPending}
                onClick={() => {
                  setShowCreateModal(false);
                  setForm(emptyForm());
                }}
                className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!canCreateStaff || createStaffMutation.isPending}
                onClick={() => createStaffMutation.mutate()}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createStaffMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Create Staff
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-zinc-400">{label}</p>
        <div className="h-5 w-5 text-purple-300">{icon}</div>
      </div>
      <h2 className="text-3xl font-bold">{value}</h2>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-400">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-purple-500"
      />
    </div>
  );
}

function StaffRow({
  member,
  addDepartmentMutation,
  removeDepartmentMutation,
}) {
  const [selectedDepartment, setSelectedDepartment] = useState("");

  const departments = Array.isArray(member.departments)
    ? member.departments
    : [];

  const availableDepartments = DEPARTMENTS.filter(
    (department) => !departments.includes(department)
  );

  const isUpdating =
    addDepartmentMutation.isPending || removeDepartmentMutation.isPending;

  return (
    <tr className="bg-zinc-900/60 align-top transition hover:bg-zinc-900">
      <td className="px-4 py-4">
        <div>
          <p className="font-semibold text-zinc-100">{member.name}</p>
          <p className="mt-1 text-xs text-zinc-500">{member.email}</p>
          <p className="mt-1 text-xs text-zinc-600">{member.phone || "No phone"}</p>
        </div>
      </td>

      <td className="px-4 py-4">
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getRoleStyle(member.role)}`}
        >
          {formatLabel(member.role)}
        </span>
      </td>

      <td className="px-4 py-4">
        {departments.length === 0 ? (
          <span className="rounded-lg border border-amber-900/60 bg-amber-950/20 px-2 py-1 text-xs text-amber-300">
            No departments mapped
          </span>
        ) : (
          <div className="flex max-w-md flex-wrap gap-2">
            {departments.map((department) => (
              <span
                key={department}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300"
              >
                {formatLabel(department)}
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() =>
                    removeDepartmentMutation.mutate({
                      staffId: member.id,
                      department,
                    })
                  }
                  className="rounded-full p-0.5 text-zinc-500 transition hover:bg-red-950 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                  title={`Remove ${formatLabel(department)}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </td>

      <td className="px-4 py-4 text-xs text-zinc-500">
        {formatDate(member.createdAt)}
      </td>

      <td className="px-4 py-4">
        <div className="flex gap-2">
          <select
            value={selectedDepartment}
            onChange={(event) => setSelectedDepartment(event.target.value)}
            disabled={availableDepartments.length === 0 || isUpdating}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white outline-none focus:border-purple-500 disabled:opacity-50"
          >
            <option value="">
              {availableDepartments.length === 0
                ? "All departments mapped"
                : "Add department"}
            </option>
            {availableDepartments.map((department) => (
              <option key={department} value={department}>
                {formatLabel(department)}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={!selectedDepartment || isUpdating}
            onClick={() => {
              addDepartmentMutation.mutate({
                staffId: member.id,
                department: selectedDepartment,
              });
              setSelectedDepartment("");
            }}
            className="rounded-xl bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </td>
    </tr>
  );
}
