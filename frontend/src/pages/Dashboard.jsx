import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/useAuthStore";
import { useNavigate } from "react-router-dom";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  ZoomControl,
  useMapEvents,
} from "react-leaflet";

import { useCallback, useEffect, useMemo, useState } from "react";
import API from "@/services/api";
import L from "leaflet";

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
  useMapEvents({
    click(e) {
      const target = e.originalEvent.target;

      if (
        target?.closest?.(
          ".leaflet-marker-icon, .leaflet-popup, .leaflet-control"
        )
      ) {
        return;
      }

      onMapClick({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      });
    },
  });

  return null;
}

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

const severityDotStyles = {
  LOW: "bg-emerald-500",
  MEDIUM: "bg-amber-500",
  HIGH: "bg-red-500",
};

const fieldLabelClass =
  "text-sm font-medium text-slate-700 dark:text-slate-300";

const selectClass =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-300 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-[#333333]";

async function loadIssueData(lat, lng, currentFilter) {
  const res = await API.get(
    `/api/issues/nearby?lat=${lat}&lng=${lng}&radius=5`
  );

  let data = res.data || [];

  if (currentFilter.category) {
    data = data.filter((issue) => issue.category === currentFilter.category);
  }

  if (currentFilter.severity) {
    data = data.filter((issue) => issue.severity === currentFilter.severity);
  }

  return data;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  const [issues, setIssues] = useState([]);

  const [center, setCenter] = useState({
    lat: 18.5204,
    lng: 73.8567,
  });

  const [filter, setFilter] = useState({
    category: "",
    severity: "",
  });

  const [selectedLocation, setSelectedLocation] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "POTHOLE",
    severity: "MEDIUM",
  });

  const [imageFile, setImageFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("theme") === "dark"
  );

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filter.category) count += 1;
    if (filter.severity) count += 1;
    return count;
  }, [filter]);

  const highSeverityCount = useMemo(
    () => issues.filter((issue) => issue.severity === "HIGH").length,
    [issues]
  );

  const fetchIssues = useCallback(
    async (lat, lng) => {
      try {
        const data = await loadIssueData(lat, lng, filter);
        setIssues(data);
      } catch (err) {
        console.error("Failed to fetch nearby issues", err);
      }
    },
    [filter]
  );

  useEffect(() => {
    let ignore = false;

    async function loadIssuesForMapCenter() {
      try {
        const data = await loadIssueData(center.lat, center.lng, filter);
        if (!ignore) {
          setIssues(data);
        }
      } catch (err) {
        console.error("Failed to fetch nearby issues", err);
      }
    }

    loadIssuesForMapCenter();

    return () => {
      ignore = true;
    };
  }, [center.lat, center.lng, filter]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const openCreateForm = (location) => {
    setSelectedLocation(location);

    setForm({
      title: "",
      description: "",
      category: "POTHOLE",
      severity: "MEDIUM",
    });

    setImageFile(null);
    setIsSubmitting(false);
  };

  const closeCreateForm = () => {
    setSelectedLocation(null);

    setForm({
      title: "",
      description: "",
      category: "POTHOLE",
      severity: "MEDIUM",
    });

    setImageFile(null);
    setIsSubmitting(false);
  };

  const resetFilters = () => {
    setFilter({
      category: "",
      severity: "",
    });
  };

  const handleCreateIssue = async () => {
    if (!selectedLocation) return;

    if (!form.title.trim()) {
      alert("Please enter a title");
      return;
    }

    setIsSubmitting(true);

    try {
      const issueRes = await API.post("/api/issues", {
        title: form.title,
        description: form.description,
        category: form.category,
        severity: form.severity,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        address: "Selected from map",
      });

      const issueId = issueRes.data?.id;

      if (imageFile && issueId) {
        const uploadData = new FormData();
        uploadData.append("file", imageFile);

        const controller = new AbortController();

        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 20000);

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
      fetchIssues(center.lat, center.lng);
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
      fetchIssues(center.lat, center.lng);
    } catch (err) {
      console.error("Delete issue failed", err);
      alert("Delete failed");
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-50 text-slate-950 dark:bg-[#0f0f0f] dark:text-slate-100">
      <div className="grid h-full w-full grid-cols-[248px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside className="min-h-0 border-r border-slate-200 bg-white dark:border-[#2a2a2a] dark:bg-[#151515]">
          <div className="flex h-full flex-col">
            <div className="shrink-0 border-b border-slate-200 px-4 py-4 dark:border-[#2a2a2a]">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-900 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-100">
                  CS
                </div>

                <div>
                  <h1 className="text-sm font-semibold leading-5">
                    CivicSense
                  </h1>
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
                        setFilter((prev) => ({
                          ...prev,
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
                        setFilter((prev) => ({
                          ...prev,
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
                <h2 className="mb-3 text-sm font-semibold">Nearby issues</h2>

                <div className="space-y-2">
                  {issues.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-[#333333] dark:text-slate-400">
                      No issues found in this area.
                    </div>
                  ) : (
                    issues.slice(0, 8).map((issue) => (
                      <article
                        key={issue.id}
                        className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-[#2a2a2a] dark:bg-[#101010]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-medium text-slate-950 dark:text-slate-100">
                              {issue.title}
                            </h3>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {categoryLabels[issue.category] ||
                                issue.category}
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
                      </article>
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
                  <span>{issues.length}</span>
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

        {/* Main */}
        <main className="grid min-h-0 grid-rows-[56px_minmax(0,1fr)]">
          <header className="z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-5 dark:border-[#2a2a2a] dark:bg-[#0f0f0f]">
            <div>
              <h2 className="text-base font-semibold">Map dashboard</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select a marker or click the map to create a report
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 md:block dark:border-[#2a2a2a] dark:bg-[#151515] dark:text-slate-300">
                {center.lat.toFixed(3)}, {center.lng.toFixed(3)}
              </div>

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
            {/* Map */}
            <div className="min-h-0 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-[#2a2a2a] dark:bg-[#151515]">
              <MapContainer
                center={[center.lat, center.lng]}
                zoom={13}
                zoomControl={false}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                <ZoomControl position="bottomright" />

                <MapEvents onMove={(lat, lng) => setCenter({ lat, lng })} />

                <MapClickHandler onMapClick={openCreateForm} />

                {selectedLocation && (
                  <Marker position={[selectedLocation.lat, selectedLocation.lng]}>
                    <Popup>
                      <div className="text-sm font-medium">
                        New issue location selected
                      </div>
                    </Popup>
                  </Marker>
                )}

                {issues.map((issue) => {
                  if (issue.latitude == null || issue.longitude == null) {
                    return null;
                  }

                  return (
                    <Marker
                      key={issue.id}
                      position={[issue.latitude, issue.longitude]}
                    >
                      <Popup>
               <div className="min-w-[250px] overflow-hidden rounded-xl bg-white dark:bg-[#111111] p-1">

            {/* Image */}
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

    {/* Content */}
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
              severityStyles[issue.severity]
            }`}
          >
            {severityLabels[issue.severity] || issue.severity}
          </span>
         </div>
        </div>

        {issue.address && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#2a2a2a] dark:bg-[#101010]">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Location
            </p>

            <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
            {issue.address}
           </p>
          </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center gap-2 pt-1">
           <Button
             type="button"
            size="sm"
             variant="destructive"
             className="h-8 flex-1 rounded-md
             bg-red-600 text-white
             hover:bg-red-700
             dark:bg-red-600
             dark:hover:bg-red-700
              border-0
              shadow-none"
               onClick={(e) => {
                e.stopPropagation();
                handleDeleteIssue(issue.id);
                  }}
                  >
                    Delete
                    </Button>
                    </div>

                    </div>
                    </div>
                    </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>

            {/* Inspector */}
            <aside className="min-h-0 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-[#2a2a2a] dark:bg-[#151515]">
              {selectedLocation ? (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-[#2a2a2a]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold">Create issue</h2>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Selected at {selectedLocation.lat.toFixed(5)},{" "}
                          {selectedLocation.lng.toFixed(5)}
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
                            setForm((prev) => ({
                              ...prev,
                              title: e.target.value,
                            }))
                          }
                          className="border-slate-300 bg-white text-slate-900 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-100"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="description"
                          className={fieldLabelClass}
                        >
                          Description
                        </label>
                        <textarea
                          id="description"
                          name="description"
                          rows={3}
                          placeholder="Add a short description"
                          value={form.description}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              description: e.target.value,
                            }))
                          }
                          className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-1 focus:ring-slate-300 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-[#333333]"
                        />
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
                            setForm((prev) => ({
                              ...prev,
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
                            setForm((prev) => ({
                              ...prev,
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
                          Image
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
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
                  <div className="border-b border-slate-200 px-4 py-3 dark:border-[#2a2a2a]">
                    <h2 className="text-sm font-semibold">Issue details</h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Select a marker or click the map to create a report.
                    </p>
                  </div>

                  <div className="flex items-center justify-center p-6 text-center">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      No location selected
                    </p>
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