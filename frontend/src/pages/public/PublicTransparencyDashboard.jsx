import {
    AlertTriangle,
    BarChart3,
    CheckCircle2,
    Clock,
    Image,
    MapPin,
    RefreshCw,
    Search,
    ShieldCheck,
    TrendingUp,
    X,
  } from "lucide-react";
  import { useMemo, useState } from "react";
  import { useQuery } from "@tanstack/react-query";
  
  import API from "@/services/api";
  
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
  
  function formatPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0%";
    return `${number.toFixed(1)}%`;
  }
  
  function getStatusStyle(status) {
    if (status === "RESOLVED") return "border-emerald-900/70 bg-emerald-950/40 text-emerald-200";
    if (status === "REJECTED") return "border-red-900/70 bg-red-950/40 text-red-200";
    if (status === "PENDING_CLOSURE") return "border-purple-900/70 bg-purple-950/40 text-purple-200";
    if (status === "IN_PROGRESS") return "border-amber-900/70 bg-amber-950/40 text-amber-200";
    if (status === "ASSIGNED") return "border-cyan-900/70 bg-cyan-950/40 text-cyan-200";
    if (status === "VERIFIED") return "border-blue-900/70 bg-blue-950/40 text-blue-200";
    return "border-zinc-700 bg-zinc-950 text-zinc-300";
  }
  
  function getSeverityStyle(severity) {
    if (severity === "CRITICAL" || severity === "HIGH") return "border-red-900/70 bg-red-950/40 text-red-200";
    if (severity === "MEDIUM") return "border-amber-900/70 bg-amber-950/40 text-amber-200";
    return "border-emerald-900/70 bg-emerald-950/40 text-emerald-200";
  }


  function hasBeforeImage(issue) {
    return Boolean(issue?.imageUrl);
  }

  function hasAfterImage(issue) {
    return Boolean(issue?.resolutionImageUrl);
  }

  function isResolvedIssue(issue) {
    return issue?.status === "RESOLVED" || Boolean(issue?.resolvedAt);
  }
  
  export default function PublicTransparencyDashboard() {
    const [selectedIssue, setSelectedIssue] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [departmentFilter, setDepartmentFilter] = useState("ALL");
    const [slaOnly, setSlaOnly] = useState(false);
  
    const {
      data,
      isLoading,
      isFetching,
      isError,
      error,
      refetch,
    } = useQuery({
      queryKey: ["public-transparency"],
      queryFn: async () => {
        const response = await API.get("/api/public/transparency");
        return response.data;
      },
      retry: 1,
      staleTime: 1000 * 30,
      refetchOnWindowFocus: true,
    });
  
    const publicIssues = data?.publicIssues || data?.recentIssues || [];
  
    const categoryOptions = useMemo(() => {
      return [...new Set(publicIssues.map((issue) => issue.category).filter(Boolean))].sort();
    }, [publicIssues]);
  
    const statusOptions = useMemo(() => {
      return [...new Set(publicIssues.map((issue) => issue.status).filter(Boolean))].sort();
    }, [publicIssues]);
  
    const departmentOptions = useMemo(() => {
      return [...new Set(publicIssues.map((issue) => issue.assignedDepartment).filter(Boolean))].sort();
    }, [publicIssues]);
  
    const filteredIssues = useMemo(() => {
      const query = searchTerm.trim().toLowerCase();
  
      return publicIssues.filter((issue) => {
        const matchesSearch =
          !query ||
          issue.title?.toLowerCase().includes(query) ||
          issue.description?.toLowerCase().includes(query) ||
          issue.address?.toLowerCase().includes(query) ||
          issue.category?.toLowerCase().includes(query) ||
          issue.assignedDepartment?.toLowerCase().includes(query);
  
        const matchesStatus = statusFilter === "ALL" || issue.status === statusFilter;
        const matchesCategory = categoryFilter === "ALL" || issue.category === categoryFilter;
        const matchesDepartment = departmentFilter === "ALL" || issue.assignedDepartment === departmentFilter;
        const matchesSla = !slaOnly || Boolean(issue.slaBreached);
  
        return matchesSearch && matchesStatus && matchesCategory && matchesDepartment && matchesSla;
      });
    }, [publicIssues, searchTerm, statusFilter, categoryFilter, departmentFilter, slaOnly]);
  
    const topCategories = useMemo(() => [...(data?.categoryBreakdown || [])].slice(0, 6), [data?.categoryBreakdown]);
    const topDepartments = useMemo(() => [...(data?.departmentBreakdown || [])].slice(0, 8), [data?.departmentBreakdown]);
    const statusBreakdown = useMemo(() => [...(data?.statusBreakdown || [])].slice(0, 8), [data?.statusBreakdown]);
  
    const resetFilters = () => {
      setSearchTerm("");
      setStatusFilter("ALL");
      setCategoryFilter("ALL");
      setDepartmentFilter("ALL");
      setSlaOnly(false);
    };
  
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <header className="border-b border-zinc-800 bg-zinc-900/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-emerald-900/60 bg-emerald-950/40 p-3">
                <ShieldCheck className="h-7 w-7 text-emerald-300" />
              </div>
  
              <div>
                <h1 className="text-2xl font-bold text-white">
                  CivicSense Public Transparency
                </h1>
                <p className="mt-1 text-sm text-zinc-400">
                  Public issue registry, resolution visibility, and accountability metrics.
                </p>
              </div>
            </div>
  
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </header>
  
        <main className="mx-auto max-w-7xl px-6 py-6">
          {isLoading ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-400">
              Loading public transparency data...
            </div>
          ) : isError ? (
            <div className="rounded-2xl border border-red-900/70 bg-red-950/30 p-5 text-red-300">
              <p className="font-semibold">Failed to load transparency dashboard</p>
              <p className="mt-2 text-sm">
                {error?.response?.data?.message ||
                  error?.response?.data ||
                  "Check that GET /api/public/transparency is public in SecurityConfig."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <section className="rounded-3xl border border-emerald-900/40 bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-zinc-950 p-6">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
                      Public Governance Snapshot
                    </p>
                    <h2 className="mt-3 max-w-3xl text-4xl font-bold leading-tight text-white">
                      Transparent civic issue tracking for reports, resolution, and operational progress.
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
                      This page exposes only public-safe operational information. Reporter identities,
                      worker emails, supervisor notes, and internal audit metadata are hidden.
                    </p>
                  </div>
  
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                    <p className="text-sm text-zinc-400">Resolution Rate</p>
                    <div className="mt-3 flex items-end gap-2">
                      <span className="text-5xl font-bold text-emerald-300">
                        {formatPercent(data?.resolutionRate)}
                      </span>
                      <span className="pb-2 text-sm text-zinc-500">
                        of total reports
                      </span>
                    </div>
  
                    <div className="mt-5 h-3 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, Number(data?.resolutionRate || 0)))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </section>
  
              <section className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-7">
                <StatCard label="Total Reports" value={data?.totalReports} icon={<BarChart3 />} tone="blue" />
                <StatCard label="Active" value={data?.activeIssues} icon={<Clock />} tone="amber" />
                <StatCard label="Resolved" value={data?.resolvedIssues} icon={<CheckCircle2 />} tone="emerald" />
                <StatCard label="Rejected" value={data?.rejectedIssues} icon={<AlertTriangle />} tone="red" />
                <StatCard label="Pending Closure" value={data?.pendingClosureIssues} icon={<CheckCircle2 />} tone="purple" />
                <StatCard label="SLA Breached" value={data?.slaBreachedIssues} icon={<AlertTriangle />} tone="red" />
                <StatCard label="Escalated" value={data?.escalatedIssues} icon={<TrendingUp />} tone="orange" />
              </section>
  
              <section className="grid gap-6 lg:grid-cols-3">
                <BreakdownPanel title="Category Breakdown" subtitle="Reports grouped by civic problem type." items={topCategories} />
                <BreakdownPanel title="Status Breakdown" subtitle="Current public workflow status distribution." items={statusBreakdown} />
                <BreakdownPanel title="Department Breakdown" subtitle="Operational load by assigned department." items={topDepartments} />
              </section>
  
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Public Issue Registry
                    </h2>
                    <p className="mt-1 text-sm text-zinc-400">
                      All public-safe issue summaries. Click any card to view public details.
                    </p>
                  </div>
  
                  <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs font-medium text-zinc-400">
                    {filteredIssues.length} of {publicIssues.length} issues
                  </span>
                </div>
  
                <div className="mb-5 grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_180px_180px_220px_150px_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search title, description, address, category..."
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-500"
                    />
                  </div>
  
                  <FilterSelect value={statusFilter} onChange={setStatusFilter} label="All statuses" options={statusOptions} />
                  <FilterSelect value={categoryFilter} onChange={setCategoryFilter} label="All categories" options={categoryOptions} />
                  <FilterSelect value={departmentFilter} onChange={setDepartmentFilter} label="All departments" options={departmentOptions} />
  
                  <label className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={slaOnly}
                      onChange={(event) => setSlaOnly(event.target.checked)}
                      className="h-4 w-4 accent-emerald-500"
                    />
                    SLA only
                  </label>
  
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800"
                  >
                    Reset
                  </button>
                </div>
  
                {filteredIssues.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-10 text-center text-sm text-zinc-500">
                    No public issues match the selected filters.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredIssues.map((issue) => (
                      <PublicIssueCard
                        key={issue.id}
                        issue={issue}
                        onClick={() => setSelectedIssue(issue)}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
  
        {selectedIssue && (
          <PublicIssueDrawer issue={selectedIssue} onClose={() => setSelectedIssue(null)} />
        )}
      </div>
    );
  }
  
  function FilterSelect({ value, onChange, label, options }) {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
      >
        <option value="ALL">{label}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatLabel(option)}
          </option>
        ))}
      </select>
    );
  }
  
  function StatCard({ label, value = 0, icon, tone }) {
    const toneClass = {
      blue: "text-blue-300 bg-blue-500/15",
      amber: "text-amber-300 bg-amber-500/15",
      emerald: "text-emerald-300 bg-emerald-500/15",
      red: "text-red-300 bg-red-500/15",
      purple: "text-purple-300 bg-purple-500/15",
      orange: "text-orange-300 bg-orange-500/15",
    }[tone];
  
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs text-zinc-400">{label}</p>
          <div className={`rounded-lg p-1.5 ${toneClass}`}>
            <div className="h-4 w-4">{icon}</div>
          </div>
        </div>
        <h3 className="text-2xl font-bold text-white">{value ?? 0}</h3>
      </div>
    );
  }
  
  function BreakdownPanel({ title, subtitle, items }) {
    const maxCount = Math.max(1, ...items.map((item) => Number(item.count || 0)));
  
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
        </div>
  
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950 p-6 text-center text-sm text-zinc-500">
            No data yet.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const width = Math.max(6, Math.round((Number(item.count || 0) / maxCount) * 100));
              return (
                <div key={item.label}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-zinc-200">{formatLabel(item.label)}</p>
                    <p className="shrink-0 text-xs text-zinc-500">{item.count} · {formatPercent(item.percentage)}</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  
  function PublicIssueCard({ issue, onClick }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-left transition hover:border-emerald-800/70 hover:bg-zinc-900"
      >
        <IssueBadges issue={issue} />
        <h3 className="mt-3 line-clamp-2 text-base font-semibold text-white">{issue.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-400">
          {issue.description || "No public description provided."}
        </p>
        <div className="mt-3 space-y-2 text-sm text-zinc-400">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
            <span>{issue.address || "Public location unavailable"}</span>
          </p>
          <p><span className="text-zinc-500">Department:</span> {formatLabel(issue.assignedDepartment)}</p>
          <p><span className="text-zinc-500">Reported:</span> {formatDate(issue.createdAt)}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {hasBeforeImage(issue) && (
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-900/70 bg-blue-950/30 px-2.5 py-1 text-[11px] font-semibold text-blue-200">
              <Image className="h-3 w-3" />
              Issue image
            </span>
          )}

          {hasAfterImage(issue) && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-900/70 bg-emerald-950/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
              <Image className="h-3 w-3" />
              Resolution proof
            </span>
          )}
        </div>

        <p className="mt-4 text-xs font-semibold text-emerald-300">Open public details</p>
      </button>
    );
  }
  
  function PublicIssueDrawer({ issue, onClose }) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
        <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
          <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 px-5 py-4 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Public Issue Details</p>
                <h2 className="mt-1 text-xl font-bold text-white">{issue.title}</h2>
              </div>
              <button type="button" onClick={onClose} className="rounded-xl border border-zinc-700 bg-zinc-900 p-2 text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
  
          <div className="space-y-5 p-5">
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <IssueBadges issue={issue} />
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Description</p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{issue.description || "No public description provided."}</p>
              </div>
            </section>
  
            <section className="grid gap-3 sm:grid-cols-2">
              <InfoBox label="Category" value={formatLabel(issue.category)} />
              <InfoBox label="Severity" value={formatLabel(issue.severity)} />
              <InfoBox label="Status" value={formatLabel(issue.status)} />
              <InfoBox label="Department" value={formatLabel(issue.assignedDepartment)} />
              <InfoBox label="Reported" value={formatDate(issue.createdAt)} />
              <InfoBox label="Resolved" value={formatDate(issue.resolvedAt)} />
            </section>
  
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Public Location</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{issue.address || "Public location unavailable"}</p>
              {issue.latitude != null && issue.longitude != null && (
                <p className="mt-2 text-xs text-zinc-500">
                  Approx. coordinates: {Number(issue.latitude).toFixed(4)}, {Number(issue.longitude).toFixed(4)}
                </p>
              )}
            </section>
  
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Public Operational Status</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <InfoBox label="SLA Breached" value={issue.slaBreached ? "Yes" : "No"} tone={issue.slaBreached ? "red" : "emerald"} />
                <InfoBox label="Escalated" value={issue.escalated ? "Yes" : "No"} tone={issue.escalated ? "orange" : "emerald"} />
              </div>
            </section>
  
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Public Images
                  </p>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    {isResolvedIssue(issue)
                      ? "Before and after evidence is shown when available."
                      : "Original issue image is shown when available."}
                  </p>
                </div>

                {(hasBeforeImage(issue) || hasAfterImage(issue)) && (
                  <span className="rounded-full border border-emerald-900/70 bg-emerald-950/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                    Evidence available
                  </span>
                )}
              </div>

              {!hasBeforeImage(issue) && !hasAfterImage(issue) ? (
                <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-8 text-center text-sm text-zinc-500">
                  No public images are available for this issue yet.
                </div>
              ) : (
                <div className={`grid gap-4 ${hasBeforeImage(issue) && hasAfterImage(issue) ? "lg:grid-cols-2" : "grid-cols-1"}`}>
                  {hasBeforeImage(issue) && (
                    <div className="overflow-hidden rounded-2xl border border-blue-900/60 bg-blue-950/20">
                      <div className="border-b border-blue-900/60 px-4 py-3">
                        <p className="text-sm font-semibold text-blue-200">
                          Before Image
                        </p>
                        <p className="mt-1 text-xs text-blue-300/80">
                          Original citizen report evidence
                        </p>
                      </div>

                      <img
                        src={issue.imageUrl}
                        alt={`${issue.title} before evidence`}
                        className="h-72 w-full bg-black object-contain"
                      />
                    </div>
                  )}

                  {hasAfterImage(issue) && (
                    <div className="overflow-hidden rounded-2xl border border-emerald-900/60 bg-emerald-950/20">
                      <div className="border-b border-emerald-900/60 px-4 py-3">
                        <p className="text-sm font-semibold text-emerald-200">
                          After Image
                        </p>
                        <p className="mt-1 text-xs text-emerald-300/80">
                          Worker-submitted resolution proof
                        </p>
                      </div>

                      <img
                        src={issue.resolutionImageUrl}
                        alt={`${issue.title} after resolution proof`}
                        className="h-72 w-full bg-black object-contain"
                      />
                    </div>
                  )}
                </div>
              )}
            </section>
  
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Privacy Notice</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                This public drawer hides reporter identity, worker identity, supervisor notes, internal rejection notes, and audit metadata.
              </p>
            </section>
          </div>
        </div>
      </div>
    );
  }
  
  function IssueBadges({ issue }) {
    return (
      <div className="flex flex-wrap gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusStyle(issue.status)}`}>{formatLabel(issue.status)}</span>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getSeverityStyle(issue.severity)}`}>{formatLabel(issue.severity)}</span>
        {issue.slaBreached && <span className="rounded-full border border-red-900/70 bg-red-950/30 px-2.5 py-1 text-[11px] font-semibold text-red-200">SLA Breached</span>}
        {issue.escalated && <span className="rounded-full border border-orange-900/70 bg-orange-950/30 px-2.5 py-1 text-[11px] font-semibold text-orange-200">Escalated</span>}
      </div>
    );
  }
  
  function InfoBox({ label, value, tone = "default" }) {
    const toneClass = {
      default: "border-zinc-800 bg-zinc-900 text-zinc-200",
      red: "border-red-900/70 bg-red-950/30 text-red-200",
      orange: "border-orange-900/70 bg-orange-950/30 text-orange-200",
      emerald: "border-emerald-900/70 bg-emerald-950/30 text-emerald-200",
    }[tone];
  
    return (
      <div className={`rounded-2xl border p-4 ${toneClass}`}>
        <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="mt-1 text-sm font-semibold">{value || "Not available"}</p>
      </div>
    );
  }
  