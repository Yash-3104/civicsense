import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Filter,
  LogOut,
  MapPinned,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import API from "@/services/api";
import IssueDetailsDrawer from "@/components/issues/IssueDetailsDrawer";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useAuthStore } from "@/store/useAuthStore";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const DEFAULT_MAP_CENTER = [18.5204, 73.8567];
const CITIZEN_MAP_RADIUS_KM = 50;

// Keep the operations map consistent with the citizen dashboard:
// issues are only visible while the viewport is focused on a known city/region.
// If the user zooms out far enough to include another region, markers/clusters hide
// so one city's operational data does not look globally available.
const CITY_REGIONS = [
  {
    key: "PUNE",
    label: "Pune",
    issueBounds: { south: 18.43, north: 18.63, west: 73.73, east: 74.0 },
    viewBounds: { south: 18.05, north: 19.0, west: 73.25, east: 74.35 },
  },
  {
    key: "MUMBAI",
    label: "Mumbai",
    issueBounds: { south: 18.85, north: 19.35, west: 72.75, east: 73.15 },
    viewBounds: { south: 18.6, north: 19.55, west: 72.55, east: 73.35 },
  },
  {
    key: "NAVI_MUMBAI",
    label: "Navi Mumbai",
    issueBounds: { south: 18.88, north: 19.25, west: 73.0, east: 73.25 },
    viewBounds: { south: 18.72, north: 19.42, west: 72.85, east: 73.45 },
  },
  {
    key: "THANE",
    label: "Thane",
    issueBounds: { south: 19.12, north: 19.36, west: 72.88, east: 73.13 },
    viewBounds: { south: 18.95, north: 19.55, west: 72.72, east: 73.32 },
  },
  {
    key: "NASHIK",
    label: "Nashik",
    issueBounds: { south: 19.88, north: 20.12, west: 73.68, east: 74.0 },
    viewBounds: { south: 19.65, north: 20.35, west: 73.45, east: 74.25 },
  },
  {
    key: "NAGPUR",
    label: "Nagpur",
    issueBounds: { south: 21.02, north: 21.28, west: 78.95, east: 79.22 },
    viewBounds: { south: 20.82, north: 21.48, west: 78.75, east: 79.42 },
  },
];


const ROLE_COPY = {
  ADMIN: {
    subtitle: "Review city issues by location and open operational details.",
    scope: "City-wide operations",
    backTo: "/admin",
    backLabel: "Admin Dashboard",
  },
  SUPERVISOR: {
    subtitle:
      "Review mapped department issues by location and handle supervisor actions.",
    scope: "Mapped departments",
    backTo: "/supervisor",
    backLabel: "Supervisor Dashboard",
  },
  CITIZEN: {
    subtitle: "View reported civic issues by location.",
    scope: "Citizen issue map",
    backTo: "/dashboard",
    backLabel: "Citizen Dashboard",
  },
  WORKER: {
    subtitle: "Worker map view is not enabled for this role.",
    scope: "Worker map disabled",
    backTo: "/worker",
    backLabel: "Worker Dashboard",
  },
  OFFICER: {
    subtitle: "Worker map view is not enabled for this role.",
    scope: "Worker map disabled",
    backTo: "/worker",
    backLabel: "Worker Dashboard",
  },
};

function formatLabel(value) {
  if (!value) return "Not available";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getIssueCoordinates(issue) {
  const latitude = Number(issue?.latitude);
  const longitude = Number(issue?.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return [latitude, longitude];
}


function isCoordinateInsideBounds(lat, lng, bounds) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !bounds) {
    return false;
  }

  return (
    latitude >= bounds.south &&
    latitude <= bounds.north &&
    longitude >= bounds.west &&
    longitude <= bounds.east
  );
}

function getCityRegionForCoordinate(lat, lng, boundsKey = "viewBounds") {
  return CITY_REGIONS.find((city) =>
    isCoordinateInsideBounds(lat, lng, city[boundsKey])
  );
}

function getIssueCityRegion(issue) {
  return getCityRegionForCoordinate(
    issue?.latitude,
    issue?.longitude,
    "issueBounds"
  );
}

function doesLeafletBoundsIntersectBox(leafletBounds, box) {
  if (!leafletBounds || !box) return false;

  const mapSouth = leafletBounds.getSouth();
  const mapNorth = leafletBounds.getNorth();
  const mapWest = leafletBounds.getWest();
  const mapEast = leafletBounds.getEast();

  return !(
    mapNorth < box.south ||
    mapSouth > box.north ||
    mapEast < box.west ||
    mapWest > box.east
  );
}

function doesViewportShowDifferentCity(leafletBounds, activeCityKey) {
  if (!leafletBounds || !activeCityKey) return false;

  return CITY_REGIONS.some((city) => {
    if (city.key === activeCityKey) return false;
    return doesLeafletBoundsIntersectBox(leafletBounds, city.issueBounds);
  });
}

function MapEvents({ onMove }) {
  useMapEvents({
    moveend(event) {
      const center = event.target.getCenter();
      const bounds = event.target.getBounds();

      onMove(center.lat, center.lng, bounds);
    },
    zoomend(event) {
      const center = event.target.getCenter();
      const bounds = event.target.getBounds();

      onMove(center.lat, center.lng, bounds);
    },
  });

  return null;
}

function getSlaState(issue) {
  if (!issue || issue.status === "RESOLVED" || issue.status === "REJECTED") {
    return "CLOSED";
  }

  if (issue.slaBreached) return "BREACHED";
  if (!issue.slaDeadline) return "NOT_STARTED";

  const deadline = new Date(issue.slaDeadline).getTime();
  if (!Number.isFinite(deadline)) return "UNKNOWN";

  const diffMs = deadline - Date.now();
  if (diffMs < 0) return "BREACHED";
  if (diffMs <= 24 * 60 * 60 * 1000) return "DUE_SOON";
  return "ON_TRACK";
}

function getRoleHome(role) {
  return ROLE_COPY[role]?.backTo || "/dashboard";
}

function MapBoundsController({ markerIssues }) {
  const map = useMap();

  useEffect(() => {
    if (!map || markerIssues.length === 0) return;

    const bounds = L.latLngBounds(
      markerIssues.map((issue) => getIssueCoordinates(issue))
    );

    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.16), {
        animate: false,
        maxZoom: 14,
      });
    }
  }, [map, markerIssues]);

  return null;
}

function uniqueIssues(issues) {
  const byId = new Map();

  issues.forEach((issue) => {
    if (issue?.id && !byId.has(issue.id)) {
      byId.set(issue.id, issue);
    }
  });

  return Array.from(byId.values());
}

async function fetchRoleScopedMapData(role) {
  if (role === "ADMIN") {
    const response = await API.get("/api/issues?page=0&size=100");
    return {
      issues: response.data?.data || response.data?.content || [],
      departments: [],
    };
  }

  if (role === "SUPERVISOR") {
    const response = await API.get("/api/supervisor/overview");
    const overview = response.data || {};

    return {
      issues: uniqueIssues([
        ...(overview.taskQueue || []),
        ...(overview.slaQueue || []),
      ]),
      departments: overview.supervisorDepartments || [],
    };
  }

  if (role === "CITIZEN") {
    const response = await API.get(
      `/api/issues/nearby?lat=${DEFAULT_MAP_CENTER[0]}&lng=${DEFAULT_MAP_CENTER[1]}&radius=${CITIZEN_MAP_RADIUS_KM}`
    );

    return {
      issues: response.data || [],
      departments: [],
    };
  }

  return {
    issues: [],
    departments: [],
    disabled: true,
  };
}

async function fetchIssueDetail({ queryKey }) {
  const [, , issueId] = queryKey;
  const response = await API.get(`/api/issues/${issueId}`);
  return response.data;
}

function buildOptionValues(issues, key) {
  return [...new Set(issues.map((issue) => issue?.[key]).filter(Boolean))].sort();
}

function matchesSearch(issue, searchTerm) {
  if (!searchTerm) return true;

  const haystack = [
    issue.title,
    issue.address,
    issue.category,
    issue.assignedDepartment,
    issue.department,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(searchTerm.toLowerCase());
}

function filterIssues(issues, filters, role) {
  return issues.filter((issue) => {
    if (!matchesSearch(issue, filters.search)) return false;
    if (filters.status && issue.status !== filters.status) return false;
    if (filters.category && issue.category !== filters.category) return false;
    if (filters.severity && issue.severity !== filters.severity) return false;
    if (
      role === "SUPERVISOR" &&
      filters.department &&
      issue.assignedDepartment !== filters.department
    ) {
      return false;
    }
    if (role === "SUPERVISOR" && filters.slaState && getSlaState(issue) !== filters.slaState) {
      return false;
    }
    if (
      role === "SUPERVISOR" &&
      filters.escalatedOnly &&
      !issue.escalationReason &&
      !issue.escalatedAt &&
      !issue.slaBreached
    ) {
      return false;
    }

    return true;
  });
}

function activeFilterLabel(filters, role) {
  const labels = [];

  if (filters.search) labels.push(`Search: ${filters.search}`);
  if (filters.status) labels.push(formatLabel(filters.status));
  if (filters.category) labels.push(formatLabel(filters.category));
  if (filters.severity) labels.push(formatLabel(filters.severity));
  if (role === "SUPERVISOR" && filters.department) {
    labels.push(formatLabel(filters.department));
  }
  if (role === "SUPERVISOR" && filters.slaState) {
    labels.push(formatLabel(filters.slaState));
  }
  if (role === "SUPERVISOR" && filters.escalatedOnly) {
    labels.push("Escalated only");
  }

  return labels.length > 0 ? labels.join(" / ") : "All visible issues";
}

export default function OperationsMap() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const role = user?.role;
  const copy = ROLE_COPY[role] || ROLE_COPY.CITIZEN;

  const [filters, setFilters] = useState({
    search: "",
    status: "",
    category: "",
    severity: "",
    department: "",
    slaState: "",
    escalatedOnly: false,
  });
  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [selectedIssueSummary, setSelectedIssueSummary] = useState(null);
  const [deleteCandidateIssue, setDeleteCandidateIssue] = useState(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isDeletingIssue, setIsDeletingIssue] = useState(false);
  const [mapCenter, setMapCenter] = useState({
    lat: DEFAULT_MAP_CENTER[0],
    lng: DEFAULT_MAP_CENTER[1],
  });
  const [mapBounds, setMapBounds] = useState(null);

  const {
    data: mapData = { issues: [], departments: [] },
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["operations-map", role],
    queryFn: () => fetchRoleScopedMapData(role),
    enabled: role === "ADMIN" || role === "SUPERVISOR",
    retry: 1,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });

  const {
    data: selectedIssue,
    isLoading: isSelectedIssueLoading,
    isFetching: isSelectedIssueFetching,
  } = useQuery({
    queryKey: ["operations-map-issue-detail", role, selectedIssueId],
    queryFn: fetchIssueDetail,
    enabled:
      Boolean(selectedIssueId) &&
      (role === "ADMIN" || role === "SUPERVISOR"),
    staleTime: 1000 * 20,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const possibleDuplicateIssueId = selectedIssue?.possibleDuplicateIssueId;

  const {
    data: possibleDuplicateIssue,
    isFetching: isPossibleDuplicateFetching,
  } = useQuery({
    queryKey: ["operations-map-issue-detail", role, possibleDuplicateIssueId],
    queryFn: fetchIssueDetail,
    enabled:
      Boolean(selectedIssueId) &&
      Boolean(possibleDuplicateIssueId) &&
      possibleDuplicateIssueId !== selectedIssueId &&
      (role === "ADMIN" || role === "SUPERVISOR"),
    staleTime: 1000 * 20,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const issues = mapData.issues || [];
  const filteredIssues = useMemo(
    () => filterIssues(issues, filters, role),
    [issues, filters, role]
  );
  const geocodedIssues = useMemo(
    () => filteredIssues.filter((issue) => getIssueCoordinates(issue)),
    [filteredIssues]
  );
  const activeCityRegion = useMemo(
    () =>
      getCityRegionForCoordinate(mapCenter.lat, mapCenter.lng, "viewBounds") ||
      null,
    [mapCenter.lat, mapCenter.lng]
  );
  const shouldShowCityIssueLayer = useMemo(() => {
    if (!activeCityRegion) return false;
    return !doesViewportShowDifferentCity(mapBounds, activeCityRegion.key);
  }, [activeCityRegion, mapBounds]);
  const markerIssues = useMemo(() => {
    if (!shouldShowCityIssueLayer || !activeCityRegion) return [];

    return geocodedIssues.filter((issue) => {
      const issueCity = getIssueCityRegion(issue);
      return issueCity?.key === activeCityRegion.key;
    });
  }, [geocodedIssues, shouldShowCityIssueLayer, activeCityRegion]);
  const clusterVersion = useMemo(() => {
    const issueSignature = markerIssues
      .map((issue) => {
        const coordinates = getIssueCoordinates(issue);
        return `${issue.id}:${coordinates?.[0]}:${coordinates?.[1]}:${issue.status || ""}:${issue.severity || ""}`;
      })
      .sort()
      .join("|");

    return [
      role || "unknown",
      filters.search || "all-search",
      filters.status || "all-status",
      filters.category || "all-category",
      filters.severity || "all-severity",
      filters.department || "all-department",
      filters.slaState || "all-sla",
      filters.escalatedOnly ? "escalated" : "all-risk",
      issueSignature,
    ].join("__");
  }, [markerIssues, filters, role]);

  const hiddenCoordinateCount = filteredIssues.length - geocodedIssues.length;
  const hiddenRegionCount = geocodedIssues.length - markerIssues.length;
  const hasFilters = activeFilterLabel(filters, role) !== "All visible issues";
  const statusOptions = useMemo(() => buildOptionValues(issues, "status"), [issues]);
  const categoryOptions = useMemo(
    () => buildOptionValues(issues, "category"),
    [issues]
  );
  const severityOptions = useMemo(
    () => buildOptionValues(issues, "severity"),
    [issues]
  );
  const departmentOptions = useMemo(
    () =>
      mapData.departments?.length
        ? mapData.departments
        : buildOptionValues(issues, "assignedDepartment"),
    [issues, mapData.departments]
  );

  const handleLogout = () => {
    queryClient.clear();
    logout();
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  const handleMapMove = (lat, lng, bounds) => {
    setMapCenter({ lat, lng });
    setMapBounds(bounds);
  };

  useEffect(() => {
    if (role === "CITIZEN") {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, role]);

  const handleSelectIssue = (issue) => {
    if (role !== "ADMIN" && role !== "SUPERVISOR") return;
    setSelectedIssueId(issue.id);
    setSelectedIssueSummary(issue);
  };

  const handleCloseDrawer = () => {
    setSelectedIssueId(null);
    setSelectedIssueSummary(null);
  };

  const handleOpenMatchedIssue = (matchedIssue) => {
    if (!matchedIssue?.id) return;
    setSelectedIssueId(matchedIssue.id);
    setSelectedIssueSummary(matchedIssue);
  };

  const resetFilters = () => {
    setFilters({
      search: "",
      status: "",
      category: "",
      severity: "",
      department: "",
      slaState: "",
      escalatedOnly: false,
    });
  };

  const handleRequestDeleteIssue = (issue) => {
    if (!issue || isDeletingIssue || role !== "ADMIN") return;
    setDeleteConfirmationText("");
    setDeleteCandidateIssue(issue);
  };

  const handleConfirmDeleteIssue = async () => {
    const issueId = deleteCandidateIssue?.id;

    if (!issueId || deleteConfirmationText !== "DELETE" || isDeletingIssue) return;

    setIsDeletingIssue(true);

    try {
      await API.delete(`/api/issues/${issueId}`);

      toast.success("Issue deleted", {
        description: "The issue was removed from operational map data.",
      });

      if (selectedIssueId === issueId) {
        handleCloseDrawer();
      }

      setDeleteCandidateIssue(null);
      setDeleteConfirmationText("");

      await queryClient.invalidateQueries({ queryKey: ["operations-map"] });
      await queryClient.invalidateQueries({ queryKey: ["issues"] });
      await queryClient.invalidateQueries({ queryKey: ["nearby-issues"] });
    } catch (deleteError) {
      console.error("Operations map delete failed", deleteError);
      toast.error("Failed to delete issue", {
        description:
          deleteError?.response?.data?.message ||
          deleteError?.response?.data ||
          "Check that you are logged in as ADMIN and try again.",
      });
    } finally {
      setIsDeletingIssue(false);
    }
  };

  const drawerIssue = selectedIssue || selectedIssueSummary;

  if (role === "CITIZEN") {
    return (
      <div className="min-h-screen bg-zinc-950 p-10 text-zinc-100">
        Opening citizen dashboard map...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/90">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-900/60 bg-blue-950/30">
              <MapPinned className="h-5 w-5 text-blue-300" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-white">
                  Operations Map
                </h1>
                <span className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs font-medium text-zinc-300">
                  {copy.scope}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-400">{copy.subtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <NotificationBell />
            <Link
              to={copy.backTo}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
            >
              <ArrowLeft className="h-4 w-4" />
              {copy.backLabel}
            </Link>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-red-900/70 bg-red-950/30 px-3 py-2 text-sm font-medium text-red-300 transition hover:border-red-700 hover:bg-red-950/60"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-4 lg:px-6">
        <section className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          <div className="grid gap-3 md:grid-cols-[minmax(220px,1.3fr)_repeat(3,minmax(140px,0.65fr))]">
            <label className="relative block">
              <span className="sr-only">Search issues</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                placeholder="Search title, address, category, department"
                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-9 pr-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-blue-500"
              />
            </label>

            <MapSelect
              label="Status"
              value={filters.status}
              options={statusOptions}
              onChange={(value) =>
                setFilters((current) => ({ ...current, status: value }))
              }
            />
            <MapSelect
              label="Category"
              value={filters.category}
              options={categoryOptions}
              onChange={(value) =>
                setFilters((current) => ({ ...current, category: value }))
              }
            />
            <MapSelect
              label="Severity"
              value={filters.severity}
              options={severityOptions}
              onChange={(value) =>
                setFilters((current) => ({ ...current, severity: value }))
              }
            />
          </div>

          {role === "SUPERVISOR" && (
            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(160px,0.8fr)_minmax(160px,0.8fr)_auto]">
              <MapSelect
                label="Department"
                value={filters.department}
                options={departmentOptions}
                onChange={(value) =>
                  setFilters((current) => ({ ...current, department: value }))
                }
              />
              <MapSelect
                label="SLA state"
                value={filters.slaState}
                options={["BREACHED", "DUE_SOON", "ON_TRACK", "NOT_STARTED"]}
                onChange={(value) =>
                  setFilters((current) => ({ ...current, slaState: value }))
                }
              />
              <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={filters.escalatedOnly}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      escalatedOnly: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
                />
                Escalated only
              </label>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-3 text-sm">
            <div className="flex flex-wrap items-center gap-2 text-zinc-400">
              <span>{markerIssues.length} visible issues</span>
              <span className="text-zinc-700">/</span>
              <span>{hiddenCoordinateCount} hidden because missing location</span>
              <span className="text-zinc-700">/</span>
              <span>{hiddenRegionCount} hidden outside focused city/region</span>
              <span className="text-zinc-700">/</span>
              <span>{copy.scope}</span>
              <span className="text-zinc-700">/</span>
              <span>{activeFilterLabel(filters, role)}</span>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasFilters}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Filter className="h-4 w-4" />
              Reset filters
            </button>
          </div>
        </section>

        {role !== "ADMIN" && role !== "SUPERVISOR" && role !== "CITIZEN" ? (
          <RoleDisabledState role={role} backTo={getRoleHome(role)} />
        ) : (
          <section className="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
            <MapContainer
              center={DEFAULT_MAP_CENTER}
              zoom={12}
              zoomControl={false}
              className="z-0 h-[calc(100vh-310px)] min-h-[430px] w-full bg-zinc-900 md:h-[calc(100vh-260px)]"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ZoomControl position="bottomright" />
              <MapEvents onMove={handleMapMove} />
              <MapBoundsController markerIssues={markerIssues} />

              <MarkerClusterGroup
                key={clusterVersion}
                maxClusterRadius={(zoom) => {
                  if (zoom <= 9) return 260;
                  if (zoom <= 10) return 190;
                  if (zoom <= 11) return 130;
                  return 60;
                }}
                disableClusteringAtZoom={16}
                showCoverageOnHover={false}
                spiderfyOnMaxZoom
                removeOutsideVisibleBounds={false}
                animate={false}
                chunkedLoading={false}
              >
                {markerIssues.map((issue) => {
                  const coordinates = getIssueCoordinates(issue);

                  return (
                    <Marker
                      key={issue.id}
                      position={coordinates}
                      eventHandlers={{
                        click: (event) => {
                          event?.originalEvent?.stopPropagation?.();
                          handleSelectIssue(issue);
                        },
                      }}
                    />
                  );
                })}
              </MarkerClusterGroup>
            </MapContainer>

            {isLoading && (
              <MapNotice>Loading role-scoped map data...</MapNotice>
            )}

            {isError && (
              <MapNotice tone="error">
                {error?.response?.data?.message ||
                  error?.response?.data ||
                  "Failed to load map data for this role."}
              </MapNotice>
            )}

            {!isLoading && !isError && filteredIssues.length === 0 && (
              <MapNotice>No issues match the current filters.</MapNotice>
            )}

            {!isLoading &&
              !isError &&
              filteredIssues.length > 0 &&
              markerIssues.length === 0 && (
                <MapNotice>
                  {geocodedIssues.length === 0
                    ? "No geocoded issues available for the current view."
                    : "Zoom back into the focused city/region to view issue markers."}
                </MapNotice>
              )}

            {!isLoading && (hiddenCoordinateCount > 0 || hiddenRegionCount > 0) && (
              <div className="absolute bottom-4 left-4 z-[500] max-w-sm rounded-lg border border-zinc-700 bg-zinc-950/95 px-4 py-3 text-sm text-zinc-300 shadow-lg">
                {hiddenCoordinateCount > 0 && (
                  <div>
                    {hiddenCoordinateCount} issues hidden because they do not have coordinates.
                  </div>
                )}
                {hiddenRegionCount > 0 && (
                  <div>
                    {hiddenRegionCount} issues hidden outside the focused city/region.
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </main>

      {(role === "ADMIN" || role === "SUPERVISOR") && selectedIssueId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="dark h-full w-full max-w-2xl border-l border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
            <IssueDetailsDrawer
              issue={drawerIssue}
              isLoading={isSelectedIssueLoading}
              isFetching={isSelectedIssueFetching}
              onClose={handleCloseDrawer}
              possibleDuplicateIssue={possibleDuplicateIssue}
              isPossibleDuplicateFetching={isPossibleDuplicateFetching}
              onOpenMatchedIssue={handleOpenMatchedIssue}
              isAdmin={role === "ADMIN"}
              isSupervisor={role === "SUPERVISOR"}
              canAddSupervisorNote={role === "SUPERVISOR"}
              actions={
                role === "ADMIN" && drawerIssue ? (
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
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
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
            <h3 className="text-base font-semibold text-white">
              Delete issue from CivicSense?
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Deleting this issue removes it from dashboards, exports, public registry, and workflow views.
            </p>
            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-xs font-medium text-zinc-500">Issue title</p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">
                {deleteCandidateIssue.title || "Untitled issue"}
              </p>
            </div>
            <label
              htmlFor="operations-map-delete-confirmation"
              className="mt-4 block text-sm font-medium text-zinc-200"
            >
              Type DELETE to confirm
            </label>
            <input
              id="operations-map-delete-confirmation"
              value={deleteConfirmationText}
              disabled={isDeletingIssue}
              onChange={(event) => setDeleteConfirmationText(event.target.value)}
              autoComplete="off"
              placeholder="DELETE"
              className="mt-2 h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-red-400 focus:ring-2 focus:ring-red-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                disabled={isDeletingIssue}
                onClick={() => {
                  setDeleteCandidateIssue(null);
                  setDeleteConfirmationText("");
                }}
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

function MapSelect({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition focus:border-blue-500"
      >
        <option value="">All {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function MapNotice({ children, tone = "default" }) {
  const toneClass =
    tone === "error"
      ? "border-red-900/70 bg-red-950/95 text-red-200"
      : "border-zinc-700 bg-zinc-950/95 text-zinc-300";

  return (
    <div
      className={`absolute inset-x-4 top-4 z-[500] rounded-lg border px-4 py-3 text-sm shadow-lg ${toneClass}`}
    >
      {children}
    </div>
  );
}

function RoleDisabledState({ role, backTo }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
      <h2 className="text-lg font-semibold text-white">
        Worker map view is not enabled for this role.
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-400">
        The current role is {formatLabel(role)}. This V1 route is enabled for citizen,
        admin, and supervisor map workflows.
      </p>
      <Link
        to={backTo}
        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>
    </section>
  );
}