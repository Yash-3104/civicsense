import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/useAuthStore";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Popup,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";

import MarkerClusterGroup from "react-leaflet-cluster";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import API from "@/services/api";
import {
  connectIssueSocket,
  disconnectIssueSocket,
} from "@/services/realtime";
import L from "leaflet";
import "leaflet.heat";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function MapEvents({ onMove }) {
  useMapEvents({
    moveend(e) {
      const center = e.target.getCenter();
      onMove(center.lat, center.lng);
    },
  });

  return null;
}

function MapClickHandler({ onMapClick }) {
  const map = useMapEvents({
    click(e) {
      const target = e.originalEvent.target;

      if (
        target?.closest?.(
          ".leaflet-marker-icon, .leaflet-popup, .leaflet-control, .marker-cluster"
        )
      ) {
        return;
      }

      map.closePopup();

      onMapClick({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      });
    },
  });

  return null;
}

function HeatmapLayer({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !points?.length || !L.heatLayer) return;

    const heatLayer = L.heatLayer(points, {
      radius: 30,
      blur: 24,
      maxZoom: 17,
      minOpacity: 0.35,
      gradient: {
        0.2: "#60a5fa",
        0.4: "#22c55e",
        0.6: "#facc15",
        0.8: "#f97316",
        1.0: "#ef4444",
      },
    });

    heatLayer.addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
}

function getHeatmapGlowStyle(severity) {
  switch (severity) {
    case "HIGH":
      return {
        color: "#ef4444",
        fillColor: "#ef4444",
        radius: 130,
        fillOpacity: 0.2,
      };

    case "MEDIUM":
      return {
        color: "#f59e0b",
        fillColor: "#f59e0b",
        radius: 100,
        fillOpacity: 0.16,
      };

    default:
      return {
        color: "#3b82f6",
        fillColor: "#3b82f6",
        radius: 75,
        fillOpacity: 0.13,
      };
  }
}

const LOCATION_PLACEHOLDER = "Selected from map";
const AREA_LOADING = "Resolving area...";
const AREA_UNAVAILABLE = "Pune area";

const categoryOptions = [
  { value: "POTHOLE", label: "Pothole" },
  { value: "GARBAGE", label: "Garbage Overflow" },
  { value: "STREETLIGHT", label: "Streetlight Failure" },
  { value: "WATER_LEAK", label: "Water Leak" },
];

const severityOptions = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

const categoryLabels = categoryOptions.reduce((labels, category) => {
  labels[category.value] = category.label;
  return labels;
}, {});

const severityLabels = severityOptions.reduce((labels, severity) => {
  labels[severity.value] = severity.label;
  return labels;
}, {});

const severityStyles = {
  LOW: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  MEDIUM:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  HIGH: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
};

const statusStyles = {
  REPORTED:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-300",
  VERIFIED:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  IN_PROGRESS:
    "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300",
  RESOLVED:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  REJECTED:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
};

const severityDotStyles = {
  LOW: "bg-emerald-500",
  MEDIUM: "bg-amber-500",
  HIGH: "bg-red-500",
};

const fieldLabelClass =
  "text-sm font-medium text-slate-700 dark:text-slate-300";

const selectClass =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-300 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-[#333333]";

function roundCoordinate(value) {
  return Number(value.toFixed(4));
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

function isPlaceholderAddress(address) {
  return (
    !address ||
    address.trim().toLowerCase() === LOCATION_PLACEHOLDER.toLowerCase()
  );
}

function getIssueLocationKey(issue) {
  if (!issue) return null;

  if (issue.id) return issue.id;

  if (issue.latitude != null && issue.longitude != null) {
    return `${Number(issue.latitude).toFixed(5)},${Number(
      issue.longitude
    ).toFixed(5)}`;
  }

  return null;
}

function cleanAreaName(value) {
  if (!value || typeof value !== "string") return null;

  const cleaned = value.trim();

  if (!cleaned) return null;
  if (cleaned.toLowerCase() === "null") return null;
  if (cleaned.toLowerCase() === "undefined") return null;
  if (/^[0-9.,\s-]+$/.test(cleaned)) return null;

  return cleaned;
}

function getApproxPuneArea(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return AREA_UNAVAILABLE;
  }

  const areas = [
    { name: "Kasba Peth", lat: 18.5208, lng: 73.8582 },
    { name: "Shaniwar Peth", lat: 18.5196, lng: 73.8553 },
    { name: "Shivajinagar", lat: 18.5308, lng: 73.8475 },
    { name: "Deccan Gymkhana", lat: 18.5167, lng: 73.8416 },
    { name: "Rasta Peth", lat: 18.5171, lng: 73.8665 },
    { name: "Somwar Peth", lat: 18.5251, lng: 73.8653 },
    { name: "Budhwar Peth", lat: 18.5159, lng: 73.8566 },
    { name: "Sadashiv Peth", lat: 18.5104, lng: 73.8527 },
    { name: "Swargate", lat: 18.5018, lng: 73.8636 },
    { name: "Koregaon Park", lat: 18.5362, lng: 73.8938 },
    { name: "Kothrud", lat: 18.5074, lng: 73.8077 },
    { name: "Yerawada", lat: 18.5526, lng: 73.8797 },
  ];

  const nearest = areas
    .map((area) => ({
      ...area,
      distance:
        Math.pow(latitude - area.lat, 2) + Math.pow(longitude - area.lng, 2),
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  if (!nearest) return AREA_UNAVAILABLE;

  return `${nearest.name}, Pune`;
}

// Area names are resolved locally for now to avoid browser-side reverse-geocoding
// CORS/rate-limit issues and repeated map re-renders. Later, move reverse
// geocoding to the Spring backend and persist the resolved address.

async function fetchNearbyIssues({ queryKey }) {
  const [_key, lat, lng, category, severity] = queryKey;

  const res = await API.get(
    `/api/issues/nearby?lat=${lat}&lng=${lng}&radius=5`
  );

  let data = res.data || [];

  if (category) data = data.filter((issue) => issue.category === category);
  if (severity) data = data.filter((issue) => issue.severity === severity);

  return data;
}

async function fetchIssueDetail({ queryKey }) {
  const [_key, issueId] = queryKey;
  const res = await API.get(`/api/issues/${issueId}`);
  return res.data;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();
  const selectedIssueIdRef = useRef(null);

  const [center, setCenter] = useState({ lat: 18.5204, lng: 73.8567 });
  const [filter, setFilter] = useState({ category: "", severity: "" });

  const [drawerMode, setDrawerMode] = useState("empty");
  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "POTHOLE",
    severity: "MEDIUM",
    descriptionSource: "manual",
  });

  const [imageFile, setImageFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [descriptionMode, setDescriptionMode] = useState("handwritten");

  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("theme") === "dark"
  );

  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  const queryCenter = useMemo(
    () => ({ lat: roundCoordinate(center.lat), lng: roundCoordinate(center.lng) }),
    [center.lat, center.lng]
  );

  const nearbyIssuesQueryKey = useMemo(
    () => [
      "nearby-issues",
      queryCenter.lat,
      queryCenter.lng,
      filter.category,
      filter.severity,
    ],
    [queryCenter.lat, queryCenter.lng, filter.category, filter.severity]
  );

  const {
    data: issues = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: nearbyIssuesQueryKey,
    queryFn: fetchNearbyIssues,
    enabled: Boolean(queryCenter.lat && queryCenter.lng),
    staleTime: 1000 * 30,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const {
    data: selectedIssue,
    isLoading: isIssueDetailLoading,
    isFetching: isIssueDetailFetching,
  } = useQuery({
    queryKey: ["issue-detail", selectedIssueId],
    queryFn: fetchIssueDetail,
    enabled: drawerMode === "detail" && Boolean(selectedIssueId),
    staleTime: 1000 * 30,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  useEffect(() => {
    selectedIssueIdRef.current = selectedIssueId;
  }, [selectedIssueId]);

  useEffect(() => {
    connectIssueSocket({
      onConnect: () => {
        setIsRealtimeConnected(true);
      },
      onDisconnect: () => {
        setIsRealtimeConnected(false);
      },
      onIssueEvent: async (event) => {
        console.log("Realtime issue event received:", event);

        // ================= TOAST NOTIFICATIONS =================

        if (event?.type === "NEW_ISSUE") {
          toast.info("New civic issue reported nearby", {
            description:
              event?.title || "Realtime map updated with a new report",
          });
        }

        if (event?.type === "AI_ANALYSIS_COMPLETED") {
          toast.success("AI verification completed", {
            description:
              event?.status === "REJECTED"
                ? "Issue flagged as invalid"
                : "Issue verified successfully",
          });
        }

        if (event?.type === "ISSUE_DELETED") {
          toast.error("Issue removed from map");
        }

        if (event?.type === "ISSUE_UPDATED" && event?.status) {
          toast.message(`Issue status changed to ${event.status}`);
        }

        // ================= TANSTACK QUERY INVALIDATION =================

        queryClient.invalidateQueries({
          queryKey: ["nearby-issues"],
        });

        const activeIssueId = selectedIssueIdRef.current;

        if (event?.issueId) {
          queryClient.invalidateQueries({
            queryKey: ["issue-detail", event.issueId],
          });
        }

        if (activeIssueId && event?.issueId === activeIssueId) {
          queryClient.invalidateQueries({
            queryKey: ["issue-detail", activeIssueId],
          });
        }

        if (
          event?.type === "ISSUE_DELETED" &&
          activeIssueId &&
          event?.issueId === activeIssueId
        ) {
          setDrawerMode("empty");
          setSelectedIssueId(null);
        }
      },
    });

    return () => {
      setIsRealtimeConnected(false);
      disconnectIssueSocket();
    };
  }, [queryClient]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filter.category) count += 1;
    if (filter.severity) count += 1;
    return count;
  }, [filter]);

  const validIssues = useMemo(
    () => issues.filter((issue) => issue.latitude != null && issue.longitude != null),
    [issues]
  );

  const highSeverityCount = useMemo(
    () => validIssues.filter((issue) => issue.severity === "HIGH").length,
    [validIssues]
  );

  const heatmapPoints = useMemo(() => {
    return validIssues.map((issue) => {
      let intensity = 0.55;

      if (issue.severity === "HIGH") {
        intensity = 1;
      } else if (issue.severity === "MEDIUM") {
        intensity = 0.75;
      }

      return [Number(issue.latitude), Number(issue.longitude), intensity];
    });
  }, [validIssues]);

  const clusterVersion = useMemo(() => {
    const issueSignature = validIssues
      .map((issue) => {
        const lat = Number(issue.latitude).toFixed(5);
        const lng = Number(issue.longitude).toFixed(5);
        return `${issue.id}:${lat}:${lng}:${issue.severity}:${issue.category}`;
      })
      .sort()
      .join("|");

    return [
      queryCenter.lat,
      queryCenter.lng,
      filter.category || "all-categories",
      filter.severity || "all-severities",
      validIssues.length,
      issueSignature,
    ].join("__");
  }, [validIssues, queryCenter.lat, queryCenter.lng, filter.category, filter.severity]);

  const getDisplayArea = (issue) => {
    if (!issue) return AREA_UNAVAILABLE;

    if (!isPlaceholderAddress(issue.address)) {
      return issue.address;
    }

    return getApproxPuneArea(issue.latitude, issue.longitude);
  };

  useEffect(() => {
    if (!selectedIssueId) return;
    setDescriptionMode("handwritten");
  }, [selectedIssueId]);

  const handleMapMove = (lat, lng) => {
    setCenter((previous) => {
      const nextLat = roundCoordinate(lat);
      const nextLng = roundCoordinate(lng);
      const previousLat = roundCoordinate(previous.lat);
      const previousLng = roundCoordinate(previous.lng);

      if (nextLat === previousLat && nextLng === previousLng) return previous;

      return { lat, lng };
    });
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const resetCreateForm = () => {
    setForm({
      title: "",
      description: "",
      category: "POTHOLE",
      severity: "MEDIUM",
      descriptionSource: "manual",
    });
    setImageFile(null);
    setIsSubmitting(false);
  };

  const openCreateForm = (location) => {
    setDrawerMode("create");
    setSelectedIssueId(null);
    setSelectedLocation(location);
    resetCreateForm();
  };

  const closeCreateForm = () => {
    setDrawerMode("empty");
    setSelectedIssueId(null);
    setSelectedLocation(null);
    resetCreateForm();
  };

  const openIssueDetail = (issueId) => {
    setDrawerMode("detail");
    setSelectedIssueId(issueId);
    setSelectedLocation(null);
    setImageFile(null);
    setIsSubmitting(false);
  };

  const closeIssueDetail = () => {
    setDrawerMode("empty");
    setSelectedIssueId(null);
  };

  const resetFilters = () => {
    setFilter({ category: "", severity: "" });
  };

  const refreshIssues = async () => {
    await queryClient.invalidateQueries({ queryKey: ["nearby-issues"] });
    await queryClient.invalidateQueries({ queryKey: ["issue-detail"] });
    await refetch();
  };

  const handleCreateIssue = async () => {
    if (!selectedLocation) return;

    if (!form.title.trim()) {
      alert("Please enter a title");
      return;
    }

    if (form.descriptionSource === "manual" && !form.description.trim()) {
      alert("Please enter a description or choose AI-generated description");
      return;
    }

    if (form.descriptionSource === "ai" && !imageFile) {
      alert("Please upload an image to use AI-generated description");
      return;
    }

    setIsSubmitting(true);

    try {
      const issueRes = await API.post("/api/issues", {
        title: form.title,
        description:
          form.descriptionSource === "manual"
            ? form.description
            : "AI-generated description requested from uploaded image.",
        category: form.category,
        severity: form.severity,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        address: LOCATION_PLACEHOLDER,
      });

      const issueId = issueRes.data?.id;

      if (imageFile && issueId) {
        const uploadData = new FormData();
        uploadData.append("file", imageFile);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        try {
          await API.post(`/api/issues/${issueId}/upload`, uploadData, {
            signal: controller.signal,
          });
        } catch (uploadErr) {
          console.error("Image upload failed or timed out", uploadErr);
          alert(
            "Issue was created, but image upload failed or took too long. The issue will still appear on the map."
          );
        } finally {
          clearTimeout(timeoutId);
        }
      }

      closeCreateForm();
      await refreshIssues();

      if (issueId) openIssueDetail(issueId);
    } catch (err) {
      console.error("Create issue failed", err);
      alert("Failed to create issue");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteIssue = async (issueId) => {
    const confirmed = window.confirm("Delete this issue?");
    if (!confirmed) return;

    try {
      await API.delete(`/api/issues/${issueId}`);

      if (selectedIssueId === issueId) closeIssueDetail();

      await refreshIssues();
    } catch (err) {
      console.error("Delete issue failed", err);
      alert("Delete failed");
    }
  };

  const renderDescriptionContent = () => {
    if (!selectedIssue) return null;

    if (descriptionMode === "ai") {
      return (
        <div className="mt-3 rounded-md border border-blue-100 bg-blue-50/70 p-3 dark:border-blue-900/60 dark:bg-blue-950/20">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              AI
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Generated from uploaded image
            </span>
          </div>

          <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
            {selectedIssue.aiDescription ||
              "AI-generated description is not available yet. The image may still be processing."}
          </p>
        </div>
      );
    }

    return (
      <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 dark:border-[#333333] dark:bg-[#151515]">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-slate-100 dark:text-slate-900">
            Handwritten
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Added by reporter while creating the issue
          </span>
        </div>

        <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
          {selectedIssue.description || "No handwritten description provided."}
        </p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-50 text-slate-950 dark:bg-[#0f0f0f] dark:text-slate-100">
      <div className="grid h-full w-full grid-cols-[248px_minmax(0,1fr)]">
        <aside className="min-h-0 border-r border-slate-200 bg-white dark:border-[#2a2a2a] dark:bg-[#151515]">
          <div className="flex h-full flex-col">
            <div className="shrink-0 border-b border-slate-200 px-4 py-4 dark:border-[#2a2a2a]">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-900 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-100">
                  CS
                </div>

                <div>
                  <h1 className="text-sm font-semibold leading-5">CivicSense</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Civic issue platform
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
              <nav className="space-y-1">
                <button
                  type="button"
                  className="flex h-9 w-full items-center rounded-md bg-slate-100 px-3 text-left text-sm font-medium text-slate-950 dark:bg-[#222222] dark:text-slate-100"
                >
                  Map
                </button>

                <button
                  type="button"
                  className="flex h-9 w-full items-center rounded-md px-3 text-left text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-[#1d1d1d] dark:hover:text-slate-100"
                >
                  Issues
                </button>

                <button
                  type="button"
                  className="flex h-9 w-full items-center rounded-md px-3 text-left text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-[#1d1d1d] dark:hover:text-slate-100"
                >
                  Reports
                </button>
              </nav>

              <div className="mt-6 border-t border-slate-200 pt-4 dark:border-[#2a2a2a]">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Filters</h2>

                  <button
                    type="button"
                    onClick={resetFilters}
                    disabled={activeFilterCount === 0}
                    className="text-xs text-slate-500 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-500 dark:hover:text-slate-100"
                  >
                    Reset
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label htmlFor="filter-category" className={fieldLabelClass}>
                      Category
                    </label>
                    <select
                      id="filter-category"
                      name="filterCategory"
                      className={selectClass}
                      value={filter.category}
                      onChange={(e) =>
                        setFilter((previous) => ({
                          ...previous,
                          category: e.target.value,
                        }))
                      }
                    >
                      <option value="">All categories</option>
                      {categoryOptions.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="filter-severity" className={fieldLabelClass}>
                      Severity
                    </label>
                    <select
                      id="filter-severity"
                      name="filterSeverity"
                      className={selectClass}
                      value={filter.severity}
                      onChange={(e) =>
                        setFilter((previous) => ({
                          ...previous,
                          severity: e.target.value,
                        }))
                      }
                    >
                      <option value="">All severity levels</option>
                      {severityOptions.map((severity) => (
                        <option key={severity.value} value={severity.value}>
                          {severity.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-200 pt-4 dark:border-[#2a2a2a]">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Nearby issues</h2>

                  {isFetching && (
                    <span className="text-xs text-slate-400">Refreshing</span>
                  )}
                </div>

                <div className="space-y-2">
                  {isLoading ? (
                    <div className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-[#333333] dark:text-slate-400">
                      Loading nearby issues...
                    </div>
                  ) : validIssues.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-[#333333] dark:text-slate-400">
                      No issues found in this area.
                    </div>
                  ) : (
                    validIssues.slice(0, 8).map((issue) => (
                      <button
                        key={issue.id}
                        type="button"
                        onClick={() => openIssueDetail(issue.id)}
                        className={`w-full rounded-md border p-3 text-left transition-colors ${
                          selectedIssueId === issue.id
                            ? "border-slate-400 bg-slate-100 dark:border-slate-600 dark:bg-[#222222]"
                            : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-[#2a2a2a] dark:bg-[#101010] dark:hover:bg-[#1d1d1d]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-medium text-slate-950 dark:text-slate-100">
                              {issue.title}
                            </h3>
                            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                              {getDisplayArea(issue)}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium ${
                              severityStyles[issue.severity] ||
                              "border-slate-200 bg-white text-slate-700 dark:border-[#333333] dark:bg-[#151515] dark:text-slate-200"
                            }`}
                          >
                            {severityLabels[issue.severity] || issue.severity}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 p-3 dark:border-[#2a2a2a]">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-[#2a2a2a] dark:bg-[#101010]">
                <p className="text-sm font-medium">Nearby</p>

                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    Issues
                  </span>
                  <span>{validIssues.length}</span>
                </div>

                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    High severity
                  </span>
                  <span>{highSeverityCount}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="grid min-h-0 grid-rows-[56px_minmax(0,1fr)]">
          <header className="z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-5 dark:border-[#2a2a2a] dark:bg-[#0f0f0f]">
            <div>
              <h2 className="text-base font-semibold">Map dashboard</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select a marker for details or click the map to create a report
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 md:flex dark:border-[#2a2a2a] dark:bg-[#151515] dark:text-slate-300">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isRealtimeConnected ? "bg-emerald-500" : "bg-slate-400"
                  }`}
                />
                {isRealtimeConnected ? "Live" : "Offline"}
              </div>

              <div className="hidden rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 md:block dark:border-[#2a2a2a] dark:bg-[#151515] dark:text-slate-300">
                {queryCenter.lat.toFixed(3)}, {queryCenter.lng.toFixed(3)}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowHeatmap((value) => !value)}
                className={`h-8 px-3 ${
                  showHeatmap
                    ? "border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300 dark:hover:bg-orange-950/60"
                    : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50 dark:border-[#333333] dark:bg-[#151515] dark:text-slate-100 dark:hover:bg-[#222222]"
                }`}
              >
                {showHeatmap ? "Hide Heatmap" : "Show Heatmap"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setDarkMode((value) => !value)}
                className="h-8 border-slate-300 bg-white px-3 text-slate-900 hover:bg-slate-50 dark:border-[#333333] dark:bg-[#151515] dark:text-slate-100 dark:hover:bg-[#222222]"
              >
                {darkMode ? "Light" : "Dark"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleLogout}
                className="h-8 border-slate-300 bg-white px-3 text-slate-900 hover:bg-slate-50 dark:border-[#333333] dark:bg-[#151515] dark:text-slate-100 dark:hover:bg-[#222222]"
              >
                Logout
              </Button>
            </div>
          </header>

          <section className="grid min-h-0 grid-cols-[minmax(0,1fr)_360px] gap-3 p-3">
            <div className="relative min-h-0 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-[#2a2a2a] dark:bg-[#151515]">
              <MapContainer
                center={[center.lat, center.lng]}
                zoom={13}
                zoomControl={false}
                closePopupOnClick={false}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                <ZoomControl position="bottomright" />

                <MapEvents onMove={handleMapMove} />

                <MapClickHandler onMapClick={openCreateForm} />

                {showHeatmap && heatmapPoints.length > 0 && (
                  <HeatmapLayer points={heatmapPoints} />
                )}

                {showHeatmap &&
                  validIssues.map((issue) => {
                    const glowStyle = getHeatmapGlowStyle(issue.severity);

                    return (
                      <Circle
                        key={`glow-${issue.id}`}
                        center={[Number(issue.latitude), Number(issue.longitude)]}
                        radius={glowStyle.radius}
                        pathOptions={{
                          color: glowStyle.color,
                          fillColor: glowStyle.fillColor,
                          fillOpacity: glowStyle.fillOpacity,
                          opacity: 0,
                          interactive: false,
                        }}
                      />
                    );
                  })}

                {selectedLocation && drawerMode === "create" && (
                  <Marker position={[selectedLocation.lat, selectedLocation.lng]}>
                    <Popup autoPan={false} closeOnClick={false}>
                      <div className="text-sm font-medium">
                        New issue location selected
                      </div>
                    </Popup>
                  </Marker>
                )}

                <MarkerClusterGroup
                  key={clusterVersion}
                  chunkedLoading
                  maxClusterRadius={80}
                  showCoverageOnHover={false}
                  spiderfyOnMaxZoom
                  removeOutsideVisibleBounds
                  animate
                  animateAddingMarkers
                >
                  {validIssues.map((issue) => (
                    <Marker
                      key={issue.id}
                      position={[
                        Number(issue.latitude),
                        Number(issue.longitude),
                      ]}
                      eventHandlers={{ click: () => openIssueDetail(issue.id) }}
                    >
                      <Popup autoPan={false} closeOnClick={false}>
                        <div className="min-w-[250px] overflow-hidden rounded-xl bg-white p-1 dark:bg-[#111111]">
                          {issue.imageUrl ? (
                            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-[#2a2a2a]">
                              <img
                                src={issue.imageUrl}
                                alt={issue.title}
                                className="h-40 w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                              />
                            </div>
                          ) : (
                            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400 dark:border-[#2a2a2a] dark:bg-[#101010] dark:text-slate-500">
                              No image uploaded
                            </div>
                          )}

                          <div className="space-y-3 px-2 pb-2 pt-3">
                            <div>
                              <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
                                {issue.title}
                              </h3>

                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 dark:border-[#2a2a2a] dark:bg-[#101010] dark:text-slate-300">
                                  {categoryLabels[issue.category] || issue.category}
                                </span>

                                <span
                                  className={`rounded-md border px-2 py-1 text-[11px] font-medium ${
                                    severityStyles[issue.severity] ||
                                    "border-slate-200 bg-slate-50 text-slate-700"
                                  }`}
                                >
                                  {severityLabels[issue.severity] || issue.severity}
                                </span>
                              </div>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#2a2a2a] dark:bg-[#101010]">
                              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                Area
                              </p>

                              <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
                                {getDisplayArea(issue)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MarkerClusterGroup>
              </MapContainer>

              {showHeatmap && (
                <div className="absolute bottom-6 left-6 z-[1000] rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-2xl backdrop-blur-xl dark:border-[#2a2a2a] dark:bg-[#111111]/90">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Civic Density
                  </div>

                  <div className="h-3 w-28 rounded-full bg-gradient-to-r from-indigo-600 via-cyan-400 via-lime-400 via-yellow-300 via-orange-500 to-red-700 shadow-inner shadow-black/30" />

                  <div className="mt-2 flex justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                </div>
              )}
            </div>

            <aside className="min-h-0 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-[#2a2a2a] dark:bg-[#151515]">
              {drawerMode === "create" && selectedLocation ? (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-[#2a2a2a]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold">Create issue</h2>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Pin selected on map
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={closeCreateForm}
                        className="shrink-0 rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#222222] dark:hover:text-slate-100"
                        aria-label="Close create issue form"
                        disabled={isSubmitting}
                      >
                        Close
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 w-full border-slate-300 bg-white text-slate-900 hover:bg-slate-50 dark:border-[#333333] dark:bg-[#151515] dark:text-slate-100 dark:hover:bg-[#222222]"
                        onClick={closeCreateForm}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>

                      <Button
                        type="button"
                        className="h-9 w-full"
                        onClick={handleCreateIssue}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Submitting..." : "Submit issue"}
                      </Button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    <div className="space-y-4 pb-6">
                      <div className="space-y-1.5">
                        <label htmlFor="title" className={fieldLabelClass}>
                          Issue title
                        </label>
                        <Input
                          id="title"
                          name="title"
                          placeholder="Large pothole near signal"
                          value={form.title}
                          onChange={(e) =>
                            setForm((previous) => ({
                              ...previous,
                              title: e.target.value,
                            }))
                          }
                          className="border-slate-300 bg-white text-slate-900 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-100"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className={fieldLabelClass}>Description</label>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setForm((previous) => ({
                                ...previous,
                                descriptionSource: "manual",
                              }))
                            }
                            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                              form.descriptionSource === "manual"
                                ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-300 dark:hover:bg-[#1d1d1d]"
                            }`}
                          >
                            Write manually
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setForm((previous) => ({
                                ...previous,
                                descriptionSource: "ai",
                                description: "",
                              }))
                            }
                            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                              form.descriptionSource === "ai"
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-300 dark:hover:bg-[#1d1d1d]"
                            }`}
                          >
                            Use AI-generated
                          </button>
                        </div>

                        {form.descriptionSource === "manual" ? (
                          <textarea
                            id="description"
                            name="description"
                            rows={3}
                            placeholder="Add a short description"
                            value={form.description}
                            onChange={(e) =>
                              setForm((previous) => ({
                                ...previous,
                                description: e.target.value,
                              }))
                            }
                            className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-1 focus:ring-slate-300 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-[#333333]"
                          />
                        ) : (
                          <div className="rounded-md border border-blue-100 bg-blue-50/70 p-3 text-sm leading-6 text-slate-700 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-slate-300">
                            Upload an image and CivicSense AI will generate the
                            issue description after submission. You can inspect it
                            in the AI tab of the issue details panel.
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="category" className={fieldLabelClass}>
                          Category
                        </label>
                        <select
                          id="category"
                          name="category"
                          className={selectClass}
                          value={form.category}
                          onChange={(e) =>
                            setForm((previous) => ({
                              ...previous,
                              category: e.target.value,
                            }))
                          }
                        >
                          {categoryOptions.map((category) => (
                            <option key={category.value} value={category.value}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="severity" className={fieldLabelClass}>
                          Severity
                        </label>
                        <select
                          id="severity"
                          name="severity"
                          className={selectClass}
                          value={form.severity}
                          onChange={(e) =>
                            setForm((previous) => ({
                              ...previous,
                              severity: e.target.value,
                            }))
                          }
                        >
                          {severityOptions.map((severity) => (
                            <option key={severity.value} value={severity.value}>
                              {severity.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="issueImage" className={fieldLabelClass}>
                          Image{" "}
                          {form.descriptionSource === "ai" && (
                            <span className="text-xs text-blue-500">
                              required for AI description
                            </span>
                          )}
                        </label>

                        <input
                          id="issueImage"
                          name="issueImage"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            setImageFile(file || null);
                          }}
                          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-100 dark:file:bg-[#222222] dark:file:text-slate-200 dark:hover:file:bg-[#2a2a2a]"
                        />

                        {imageFile && (
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            Selected: {imageFile.name}
                          </p>
                        )}
                      </div>

                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-[#2a2a2a] dark:bg-[#101010] dark:text-slate-300">
                        <span
                          className={`mr-2 inline-block h-2 w-2 rounded-full ${
                            severityDotStyles[form.severity]
                          }`}
                        />
                        {severityLabels[form.severity]} severity report
                        {imageFile ? " with image" : ""}
                        {form.descriptionSource === "ai"
                          ? " using AI-generated description"
                          : ""}
                      </div>
                    </div>
                  </div>
                </div>
              ) : drawerMode === "detail" && selectedIssueId ? (
                <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
                  <div className="border-b border-slate-200 px-4 py-3 dark:border-[#2a2a2a]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold">Issue details</h2>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Full civic report inspection
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={closeIssueDetail}
                        className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#222222] dark:hover:text-slate-100"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 overflow-y-auto p-4">
                    {isIssueDetailLoading ? (
                      <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-[#333333] dark:text-slate-400">
                        Loading issue details...
                      </div>
                    ) : !selectedIssue ? (
                      <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-[#333333] dark:text-slate-400">
                        Issue details unavailable.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {selectedIssue.imageUrl ? (
                          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-[#2a2a2a]">
                            <img
                              src={selectedIssue.imageUrl}
                              alt={selectedIssue.title}
                              className="h-44 w-full object-cover"
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
                              {selectedIssue.title}
                            </h1>

                            {isIssueDetailFetching && (
                              <span className="shrink-0 text-xs text-slate-400">
                                Syncing
                              </span>
                            )}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 dark:border-[#2a2a2a] dark:bg-[#101010] dark:text-slate-300">
                              {categoryLabels[selectedIssue.category] ||
                                selectedIssue.category}
                            </span>

                            <span
                              className={`rounded-md border px-2 py-1 text-xs font-medium ${
                                severityStyles[selectedIssue.severity] ||
                                "border-slate-200 bg-slate-50 text-slate-700"
                              }`}
                            >
                              {severityLabels[selectedIssue.severity] ||
                                selectedIssue.severity}
                            </span>

                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-300 ${
                                selectedIssue.status === "VERIFIED"
                                  ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
                                  : selectedIssue.status === "REJECTED"
                                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                                  : selectedIssue.status === "RESOLVED"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : selectedIssue.status === "IN_PROGRESS"
                                  ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                                  : "border-slate-200 bg-slate-50 text-slate-700 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-300"
                              }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full animate-pulse ${
                                  selectedIssue.status === "VERIFIED"
                                    ? "bg-blue-500"
                                    : selectedIssue.status === "REJECTED"
                                    ? "bg-red-500"
                                    : selectedIssue.status === "RESOLVED"
                                    ? "bg-emerald-500"
                                    : selectedIssue.status === "IN_PROGRESS"
                                    ? "bg-amber-500"
                                    : "bg-slate-400"
                                }`}
                              />

                              {selectedIssue.status === "REPORTED"
                                ? "AI Processing"
                                : selectedIssue.status
                                ? selectedIssue.status.replace("_", " ")
                                : "AI Processing"}
                            </span>
                          </div>
                        </div>

                        <section className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-[#2a2a2a] dark:bg-[#101010]">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Description
                            </h3>

                            <div className="flex rounded-md border border-slate-200 bg-white p-0.5 dark:border-[#333333] dark:bg-[#151515]">
                              <button
                                type="button"
                                onClick={() => setDescriptionMode("handwritten")}
                                className={`rounded px-2 py-1 text-[11px] font-medium ${
                                  descriptionMode === "handwritten"
                                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                                }`}
                              >
                                Handwritten
                              </button>

                              <button
                                type="button"
                                onClick={() => setDescriptionMode("ai")}
                                className={`rounded px-2 py-1 text-[11px] font-medium ${
                                  descriptionMode === "ai"
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                                }`}
                              >
                                AI
                              </button>
                            </div>
                          </div>

                          {renderDescriptionContent()}
                        </section>

                        <section className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[#2a2a2a] dark:bg-[#101010]">
                            <p className="text-xs text-slate-400">Reporter</p>
                            <p className="mt-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                              {selectedIssue.reportedBy?.name || "Unknown"}
                            </p>
                          </div>

                          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[#2a2a2a] dark:bg-[#101010]">
                            <p className="text-xs text-slate-400">Assigned</p>
                            <p className="mt-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                              {selectedIssue.assignedTo?.name || "Unassigned"}
                            </p>
                          </div>

                          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[#2a2a2a] dark:bg-[#101010]">
                            <p className="text-xs text-slate-400">Created</p>
                            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                              {formatDate(selectedIssue.createdAt)}
                            </p>
                          </div>

                          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[#2a2a2a] dark:bg-[#101010]">
                            <p className="text-xs text-slate-400">Updated</p>
                            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                              {formatDate(selectedIssue.updatedAt)}
                            </p>
                          </div>
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
                                {getDisplayArea(selectedIssue)}
                              </span>
                            </div>

                            <div className="flex justify-between gap-3">
                              <span className="text-slate-500 dark:text-slate-400">
                                Latitude
                              </span>
                              <span className="text-slate-800 dark:text-slate-200">
                                {selectedIssue.latitude}
                              </span>
                            </div>

                            <div className="flex justify-between gap-3">
                              <span className="text-slate-500 dark:text-slate-400">
                                Longitude
                              </span>
                              <span className="text-slate-800 dark:text-slate-200">
                                {selectedIssue.longitude}
                              </span>
                            </div>
                          </div>
                        </section>

                        <section className="rounded-lg border border-dashed border-slate-300 bg-white p-3 dark:border-[#333333] dark:bg-[#101010]">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Timeline & comments
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            Timeline, status history, comments, and admin notes
                            will be added in the next backend/frontend upgrade.
                          </p>
                        </section>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-200 p-4 dark:border-[#2a2a2a]">
                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full border-0 bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                      onClick={() => handleDeleteIssue(selectedIssueId)}
                    >
                      Delete issue
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
                  <div className="border-b border-slate-200 px-4 py-3 dark:border-[#2a2a2a]">
                    <h2 className="text-sm font-semibold">Issue details</h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Select a marker to inspect details or click the map to
                      create a report.
                    </p>
                  </div>

                  <div className="flex items-center justify-center p-6 text-center">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        No issue selected
                      </p>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Choose any marker or nearby issue from the sidebar.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </section>
        </main>
      </div>
    </div>
  );
}
