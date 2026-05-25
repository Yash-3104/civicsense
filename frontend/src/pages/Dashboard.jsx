import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import IssueDetailsDrawer from "@/components/issues/IssueDetailsDrawer";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useAuthStore } from "@/store/useAuthStore";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
      const bounds = e.target.getBounds();

      onMove(center.lat, center.lng, e.target.getZoom(), bounds);
    },
    zoomend(e) {
      const center = e.target.getCenter();
      const bounds = e.target.getBounds();

      onMove(center.lat, center.lng, e.target.getZoom(), bounds);
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

function MapFocusController({ focusTarget }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !focusTarget?.lat || !focusTarget?.lng) return;

    // Do not force-close marker popups here. Closing the popup during focus
    // was the reason some issue popups disappeared immediately after click.
    const currentZoom = map.getZoom();
    const targetZoom = focusTarget.zoom ?? Math.min(Math.max(currentZoom, 14), 15);

    map.flyTo(
      [Number(focusTarget.lat), Number(focusTarget.lng)],
      targetZoom,
      {
        duration: 0.35,
      }
    );
  }, [map, focusTarget?.id, focusTarget?.lat, focusTarget?.lng, focusTarget?.zoom]);

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

function normalizeScore(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.max(0, Math.min(number, 1));
}

function formatPercent(value) {
  const normalized = normalizeScore(value);

  if (normalized === null) {
    return "--";
  }

  return `${Math.round(normalized * 100)}%`;
}

function getPositiveScoreBarColor(value) {
  const normalized = normalizeScore(value) || 0;

  if (normalized >= 0.85) {
    return "bg-emerald-500";
  }

  if (normalized >= 0.6) {
    return "bg-amber-500";
  }

  return "bg-red-500";
}

function getRiskScoreBarColor(value) {
  const normalized = normalizeScore(value) || 0;

  if (normalized >= 0.65) {
    return "bg-red-500";
  }

  if (normalized >= 0.35) {
    return "bg-amber-500";
  }

  return "bg-emerald-500";
}

function getAiVerificationBadge(issue) {
  const confidence = normalizeScore(issue?.aiConfidenceScore);
  const fakeRisk = normalizeScore(issue?.fakeReportLikelihood);
  const duplicateRisk = normalizeScore(issue?.duplicateLikelihood);

  if (issue?.status === "REJECTED" || (fakeRisk !== null && fakeRisk >= 0.65)) {
    return {
      label: "High Risk",
      className:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    };
  }

  if (duplicateRisk !== null && duplicateRisk >= 0.55) {
    return {
      label: "Possible Duplicate",
      className:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    };
  }

  if (confidence !== null && confidence >= 0.75) {
    return {
      label: "AI Verified",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    };
  }

  return {
    label: "AI Pending",
    className:
      "border-slate-200 bg-slate-50 text-slate-600 dark:border-[#333333] dark:bg-[#151515] dark:text-slate-300",
  };
}

function parseAiReasoning(reasoning) {
  if (!reasoning) {
    return [];
  }

  if (Array.isArray(reasoning)) {
    return reasoning.map(String).map((item) => item.trim()).filter(Boolean);
  }

  const text = String(reasoning).trim();

  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed)) {
      return parsed.map(String).map((item) => item.trim()).filter(Boolean);
    }
  } catch {
    // Backend currently may return Java List.toString(): [a, b, c]
  }

  return text
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(/,(?=\s*[A-Z])/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function AiMetricBar({ label, value, colorClass, helper }) {
  const normalized = normalizeScore(value);
  const width = normalized === null ? 0 : normalized * 100;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <div>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {label}
          </span>

          {helper && (
            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              {helper}
            </p>
          )}
        </div>

        <span className="shrink-0 text-xs font-semibold text-slate-800 dark:text-slate-100">
          {formatPercent(value)}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-[#1f1f1f]">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colorClass}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

const LOCATION_PLACEHOLDER = "Selected from map";
const AREA_LOADING = "Resolving area...";
const AREA_UNAVAILABLE = "Pune area";
const DEFAULT_MAP_CENTER = { lat: 18.5204, lng: 73.8567 };

// City-aware operational regions.
// Each city has:
// - issueBounds: where that city's civic issues are considered valid/visible
// - viewBounds: how far the user can zoom/pan while still being considered
//   focused on that city.
// If the viewport starts showing another known city region, we hide clusters
// so one city's issues do not look globally available.
const CITY_REGIONS = [
  {
    key: "PUNE",
    label: "Pune",
    issueBounds: {
      south: 18.43,
      north: 18.63,
      west: 73.73,
      east: 74.0,
    },
    viewBounds: {
      south: 18.05,
      north: 19.0,
      west: 73.25,
      east: 74.35,
    },
  },
  {
    key: "MUMBAI",
    label: "Mumbai",
    issueBounds: {
      south: 18.85,
      north: 19.35,
      west: 72.75,
      east: 73.15,
    },
    viewBounds: {
      south: 18.6,
      north: 19.55,
      west: 72.55,
      east: 73.35,
    },
  },
  {
    key: "NAVI_MUMBAI",
    label: "Navi Mumbai",
    issueBounds: {
      south: 18.88,
      north: 19.25,
      west: 73.0,
      east: 73.25,
    },
    viewBounds: {
      south: 18.72,
      north: 19.42,
      west: 72.85,
      east: 73.45,
    },
  },
  {
    key: "THANE",
    label: "Thane",
    issueBounds: {
      south: 19.12,
      north: 19.36,
      west: 72.88,
      east: 73.13,
    },
    viewBounds: {
      south: 18.95,
      north: 19.55,
      west: 72.72,
      east: 73.32,
    },
  },
  {
    key: "NASHIK",
    label: "Nashik",
    issueBounds: {
      south: 19.88,
      north: 20.12,
      west: 73.68,
      east: 74.0,
    },
    viewBounds: {
      south: 19.65,
      north: 20.35,
      west: 73.45,
      east: 74.25,
    },
  },
  {
    key: "NAGPUR",
    label: "Nagpur",
    issueBounds: {
      south: 21.02,
      north: 21.28,
      west: 78.95,
      east: 79.22,
    },
    viewBounds: {
      south: 20.82,
      north: 21.48,
      west: 78.75,
      east: 79.42,
    },
  },
];

const MAP_FETCH_RADIUS_KM = 50;
const AI_PREVIEW_URL = import.meta.env.VITE_AI_PREVIEW_URL || "http://localhost:8000/analyze-preview";
const MAX_UPLOAD_IMAGE_SIZE_BYTES = 1.5 * 1024 * 1024;
const MAX_UPLOAD_IMAGE_DIMENSION = 1600;
const IMAGE_UPLOAD_TIMEOUT_MS = 45000;
const IMAGE_UPLOAD_RETRY_COUNT = 1;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCompressedFileName(fileName) {
  const safeName = fileName || "issue-image";
  return safeName.replace(/\.[^.]+$/, "") + ".jpg";
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("Could not read selected image"));
    };

    image.src = imageUrl;
  });
}

async function prepareImageForUpload(file) {
  if (!file || !file.type?.startsWith("image/")) {
    return file;
  }

  const image = await loadImageFromFile(file);

  const needsResize =
    image.width > MAX_UPLOAD_IMAGE_DIMENSION ||
    image.height > MAX_UPLOAD_IMAGE_DIMENSION;

  const needsCompression = file.size > MAX_UPLOAD_IMAGE_SIZE_BYTES;

  if (!needsResize && !needsCompression) {
    return file;
  }

  const scale = Math.min(
    1,
    MAX_UPLOAD_IMAGE_DIMENSION / Math.max(image.width, image.height)
  );

  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82)
  );

  if (!blob) {
    return file;
  }

  return new File([blob], getCompressedFileName(file.name), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
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

const statusStyles = {
  REPORTED:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-300",
  VERIFIED:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  IN_PROGRESS:
    "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300",
  PENDING_CLOSURE:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
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
function isCoordinateInsideBounds(lat, lng, bounds) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
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
  if (!issue) {
    return null;
  }

  return getCityRegionForCoordinate(
    issue.latitude,
    issue.longitude,
    "issueBounds"
  );
}

function doesLeafletBoundsIntersectBox(leafletBounds, box) {
  if (!leafletBounds || !box) {
    return false;
  }

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
  if (!leafletBounds || !activeCityKey) {
    return false;
  }

  return CITY_REGIONS.some((city) => {
    if (city.key === activeCityKey) {
      return false;
    }

    return doesLeafletBoundsIntersectBox(leafletBounds, city.issueBounds);
  });
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

function hasResolutionProof(issue) {
  return Boolean(
    issue?.resolutionImageUrl ||
      issue?.resolutionNotes ||
      issue?.resolvedAt
  );
}

// Area names are resolved locally for now to avoid browser-side reverse-geocoding
// CORS/rate-limit issues and repeated map re-renders. Later, move reverse
// geocoding to the Spring backend and persist the resolved address.

async function fetchNearbyIssues({ queryKey }) {
  const [_key, category, severity] = queryKey;

  // Fetch a stable city-wide issue set instead of refetching/remounting
  // markers on every map pan/flyTo. This keeps marker popups reliable.
  const res = await API.get(
    `/api/issues/nearby?lat=${DEFAULT_MAP_CENTER.lat}&lng=${DEFAULT_MAP_CENTER.lng}&radius=${MAP_FETCH_RADIUS_KM}`
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

async function fetchCitizenReports() {
  const res = await API.get("/api/citizen/my-reports");
  return res.data || [];
}

async function fetchCitizenReportDetail({ queryKey }) {
  const [_key, reportId] = queryKey;
  const res = await API.get(`/api/citizen/my-reports/${reportId}`);
  return res.data;
}


function getCitizenStatusStyle(status) {
  switch (status) {
    case "RESOLVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";

    case "REJECTED":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300";

    case "PENDING_CLOSURE":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";

    case "IN_PROGRESS":
      return "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300";

    case "ASSIGNED":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300";

    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-300";
  }
}

function getCitizenSlaStyle(slaStatus) {
  switch (slaStatus) {
    case "RESOLVED":
    case "ON_TRACK":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";

    case "DUE_SOON":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";

    case "DELAYED":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300";

    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-300";
  }
}

function formatCitizenStatus(status, label) {
  return label || status?.replaceAll("_", " ") || "Submitted";
}

function formatCitizenSlaStatus(slaStatus) {
  if (!slaStatus) return "Not started";

  return String(slaStatus)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function CitizenReportCard({ report, isSelected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-md border p-3 text-left transition-colors ${
        isSelected
          ? "border-slate-400 bg-slate-100 dark:border-slate-600 dark:bg-[#222222]"
          : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-[#2a2a2a] dark:bg-[#101010] dark:hover:bg-[#1d1d1d]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-slate-950 dark:text-slate-100">
            {report.title}
          </h3>

          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
            {report.address || "Selected from map"}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${getCitizenStatusStyle(
            report.status
          )}`}
        >
          {formatCitizenStatus(report.status, report.citizenStatusLabel)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <span
          className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${getCitizenSlaStyle(
            report.slaStatus
          )}`}
        >
          {formatCitizenSlaStatus(report.slaStatus)}
        </span>

        {report.status === "REJECTED" && (
          <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {report.rejectionReasonLabel || "Rejected"}
          </span>
        )}

        {report.status === "RESOLVED" && report.resolutionImageUrl && (
          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            Proof
          </span>
        )}
      </div>
    </button>
  );
}

function CitizenInfoBox({ label, value, tone = "default" }) {
  const toneClass = {
    default:
      "border-slate-200 bg-slate-50 text-slate-800 dark:border-[#2a2a2a] dark:bg-[#101010] dark:text-slate-200",
    green:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    red:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  }[tone];

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value || "Not available"}</p>
    </div>
  );
}


function CitizenFeedbackPanel({ report }) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState("SATISFIED");
  const [comment, setComment] = useState("");

  const issueId = report?.id;
  const isResolved = report?.status === "RESOLVED";

  const {
    data: feedback,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["citizen-report-feedback", issueId],
    queryFn: async () => {
      const response = await API.get(`/api/citizen/my-reports/${issueId}/feedback`);
      return response.data || null;
    },
    enabled: Boolean(issueId) && isResolved,
    retry: 1,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async () => {
      const response = await API.post(`/api/citizen/my-reports/${issueId}/feedback`, {
        rating,
        comment,
      });

      return response.data;
    },
    onSuccess: async () => {
      setComment("");

      await queryClient.invalidateQueries({
        queryKey: ["citizen-report-feedback", issueId],
      });

      toast.success("Feedback submitted", {
        description: "Thanks for helping improve CivicSense resolutions.",
      });
    },
    onError: (error) => {
      toast.error("Failed to submit feedback", {
        description:
          error?.response?.data?.message ||
          error?.response?.data ||
          "Please try again.",
      });
    },
  });

  if (!isResolved) {
    return null;
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#101010]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Resolution Feedback
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Tell us whether the resolved issue was handled satisfactorily.
          </p>
        </div>

        {isFetching && (
          <span className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 dark:border-[#333333] dark:text-slate-400">
            Syncing
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="mt-4 rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-[#333333] dark:text-slate-400">
          Loading feedback...
        </div>
      ) : feedback ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <p className="text-sm font-semibold">
            You marked this as: {feedback.ratingLabel || feedback.rating}
          </p>

          {feedback.comment && (
            <p className="mt-2 text-sm leading-6">{feedback.comment}</p>
          )}

          <p className="mt-2 text-xs opacity-80">
            Submitted at: {formatDate(feedback.createdAt)}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRating("SATISFIED")}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                rating === "SATISFIED"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-[#333333] dark:bg-[#151515] dark:text-slate-300 dark:hover:bg-[#1f1f1f]"
              }`}
            >
              Satisfied
            </button>

            <button
              type="button"
              onClick={() => setRating("NOT_SATISFIED")}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                rating === "NOT_SATISFIED"
                  ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-[#333333] dark:bg-[#151515] dark:text-slate-300 dark:hover:bg-[#1f1f1f]"
              }`}
            >
              Not satisfied
            </button>
          </div>

          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value.slice(0, 500))}
            rows={3}
            placeholder="Optional comment about the resolution..."
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-1 focus:ring-slate-300 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-100 dark:placeholder:text-slate-500"
          />

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">{comment.length}/500</span>

            <button
              type="button"
              disabled={submitFeedbackMutation.isPending}
              onClick={() => submitFeedbackMutation.mutate()}
              className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            >
              {submitFeedbackMutation.isPending ? "Submitting..." : "Submit Feedback"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}


function CitizenReportDrawer({ report, isLoading, isFetching, onClose }) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-slate-500 dark:text-slate-400">
        Loading your report...
      </div>
    );
  }

  if (!report) {
    return (
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-[#2a2a2a]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">My Report</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Report details unavailable.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#222222] dark:hover:text-slate-100"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const beforeImage = report.imageUrl || report.mediaUrls?.[0];
  const afterImage = report.resolutionImageUrl;
  const isResolved = report.status === "RESOLVED";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-[#2a2a2a]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">My Report</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {isFetching ? "Refreshing..." : "Citizen tracking view"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#222222] dark:hover:text-slate-100"
          >
            Close
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-4 pb-6">
          <section className="rounded-md border border-slate-200 bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#101010]">
            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-md border px-2 py-1 text-xs font-medium ${getCitizenStatusStyle(
                  report.status
                )}`}
              >
                {formatCitizenStatus(report.status, report.citizenStatusLabel)}
              </span>

              <span
                className={`rounded-md border px-2 py-1 text-xs font-medium ${getCitizenSlaStyle(
                  report.slaStatus
                )}`}
              >
                {formatCitizenSlaStatus(report.slaStatus)}
              </span>

              {report.category && (
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 dark:border-[#333333] dark:bg-[#151515] dark:text-slate-300">
                  {categoryLabels[report.category] || report.category}
                </span>
              )}
            </div>

            <h3 className="mt-3 text-lg font-semibold text-slate-950 dark:text-slate-100">
              {report.title}
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {report.description || "No description provided."}
            </p>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <CitizenInfoBox label="Reported" value={formatDate(report.createdAt)} />
            <CitizenInfoBox label="Last Updated" value={formatDate(report.updatedAt)} />
            <CitizenInfoBox
              label="Department"
              value={report.assignedDepartment?.replaceAll("_", " ")}
            />
            <CitizenInfoBox label="SLA Deadline" value={formatDate(report.slaDeadline)} />
          </section>

          <section className={`rounded-md border p-4 ${getCitizenSlaStyle(report.slaStatus)}`}>
            <p className="text-sm font-semibold">SLA Status</p>
            <p className="mt-1 text-sm leading-6">
              {report.slaMessage || "SLA status is currently unavailable."}
            </p>
          </section>

          {report.status === "REJECTED" && (
            <section className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              <p className="text-sm font-semibold">Rejection Reason</p>
              <p className="mt-1 text-sm">
                {report.rejectionReasonLabel || report.rejectionReason || "Rejected"}
              </p>

              {report.rejectionNotes && (
                <p className="mt-2 text-sm leading-6">{report.rejectionNotes}</p>
              )}

              <p className="mt-2 text-xs opacity-80">
                Rejected at: {formatDate(report.rejectedAt)}
              </p>
            </section>
          )}

          {!isResolved && beforeImage && (
            <section className="rounded-md border border-slate-200 bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#101010]">
              <div className="mb-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Report Image
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Original image attached when you created this report.
                </p>
              </div>

              <div className="overflow-hidden rounded-md border border-slate-200 dark:border-[#2a2a2a]">
                <img
                  src={beforeImage}
                  alt={`${report.title} report evidence`}
                  className="h-48 w-full bg-black object-contain"
                />
              </div>
            </section>
          )}

          {isResolved && (beforeImage || afterImage) && (
            <section className="rounded-md border border-slate-200 bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#101010]">
              <div className="mb-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Before & After Evidence
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Original report image and resolution proof when available.
                </p>
              </div>

              <div
                className={`grid gap-3 ${
                  beforeImage && afterImage ? "grid-cols-2" : "grid-cols-1"
                }`}
              >
                {beforeImage && (
                  <div className="overflow-hidden rounded-md border border-slate-200 dark:border-[#2a2a2a]">
                    <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-[#2a2a2a] dark:text-slate-300">
                      Before
                    </div>

                    <img
                      src={beforeImage}
                      alt={`${report.title} before evidence`}
                      className="h-48 w-full bg-black object-contain"
                    />
                  </div>
                )}

                {afterImage && (
                  <div className="overflow-hidden rounded-md border border-emerald-200 dark:border-emerald-900">
                    <div className="border-b border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:text-emerald-300">
                      After
                    </div>

                    <img
                      src={afterImage}
                      alt={`${report.title} resolution proof`}
                      className="h-48 w-full bg-black object-contain"
                    />
                  </div>
                )}
              </div>
            </section>
          )}

          {isResolved && (report.resolutionNotes || report.resolvedAt) && (
            <section className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
              <p className="text-sm font-semibold">Resolution Evidence</p>

              {report.resolutionNotes && (
                <p className="mt-2 text-sm leading-6">{report.resolutionNotes}</p>
              )}

              <p className="mt-2 text-xs">
                Resolved at: {formatDate(report.resolvedAt)}
              </p>
            </section>
          )}

          <CitizenFeedbackPanel report={report} />

          <section className="rounded-md border border-slate-200 bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#101010]">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Status Timeline
            </p>

            <div className="mt-4 space-y-4">
              {Array.isArray(report.timeline) && report.timeline.length > 0 ? (
                report.timeline.map((item) => (
                  <div key={item.id} className="relative pl-5">
                    <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-blue-500" />

                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {item.title}
                    </p>

                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {item.message}
                    </p>

                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Timeline will appear as your report moves through verification and resolution.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}



function CitizenReportsWorkspace({
  reports,
  isLoading,
  isFetching,
  selectedReportId,
  selectedReport,
  isReportLoading,
  isReportFetching,
  onOpenReport,
  onCloseReport,
}) {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredReports = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesSearch =
        !query ||
        report.title?.toLowerCase().includes(query) ||
        report.description?.toLowerCase().includes(query) ||
        report.address?.toLowerCase().includes(query) ||
        report.category?.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" &&
          ["REPORTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS"].includes(
            report.status
          )) ||
        report.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [reports, searchTerm, statusFilter]);

  const resolvedCount = reports.filter((report) => report.status === "RESOLVED").length;
  const rejectedCount = reports.filter((report) => report.status === "REJECTED").length;
  const activeCount = reports.filter((report) =>
    ["REPORTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS"].includes(report.status)
  ).length;
  const pendingClosureCount = reports.filter(
    (report) => report.status === "PENDING_CLOSURE"
  ).length;

  return (
    <section className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_420px] gap-3 overflow-hidden p-3">
      <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-md border border-slate-200 bg-white dark:border-[#2a2a2a] dark:bg-[#151515]">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-[#2a2a2a]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">
                My Reports
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Track reports you created, review progress, SLA status, rejection details, and resolution evidence.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#2a2a2a] dark:bg-[#101010]">
                <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
                <p className="text-base font-semibold">{reports.length}</p>
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                <p className="text-xs opacity-80">Active</p>
                <p className="text-base font-semibold">{activeCount}</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                <p className="text-xs opacity-80">Review</p>
                <p className="text-base font-semibold">{pendingClosureCount}</p>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                <p className="text-xs opacity-80">Resolved</p>
                <p className="text-base font-semibold">{resolvedCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 px-5 py-3 dark:border-[#2a2a2a]">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search your reports by title, description, address, or category..."
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-1 focus:ring-slate-300 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-100 dark:placeholder:text-slate-500"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={selectClass}
            >
              <option value="ALL">All reports</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING_CLOSURE">Pending closure</option>
              <option value="RESOLVED">Resolved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto p-5 [scrollbar-gutter:stable]">
          {isLoading ? (
            <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-[#333333] dark:text-slate-400">
              Loading your reports...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 p-8 text-center dark:border-[#333333]">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                No reports match this view
              </p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Try changing the filters, or create a new report from the Map tab.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {filteredReports.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => onOpenReport(report.id)}
                  className={`rounded-md border p-4 text-left transition-colors ${
                    selectedReportId === report.id
                      ? "border-slate-400 bg-slate-100 dark:border-slate-600 dark:bg-[#222222]"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-[#2a2a2a] dark:bg-[#101010] dark:hover:bg-[#1d1d1d]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 text-sm font-semibold text-slate-950 dark:text-slate-100">
                        {report.title}
                      </h3>

                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {report.description || "No description provided."}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${getCitizenStatusStyle(
                        report.status
                      )}`}
                    >
                      {formatCitizenStatus(report.status, report.citizenStatusLabel)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${getCitizenSlaStyle(
                        report.slaStatus
                      )}`}
                    >
                      {formatCitizenSlaStatus(report.slaStatus)}
                    </span>

                    {report.category && (
                      <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-[#333333] dark:bg-[#151515] dark:text-slate-300">
                        {categoryLabels[report.category] || report.category}
                      </span>
                    )}

                    {report.status === "REJECTED" && (
                      <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        {report.rejectionReasonLabel || "Rejected"}
                      </span>
                    )}

                    {report.status === "RESOLVED" && report.resolutionImageUrl && (
                      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                        Resolution proof
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="min-w-0 truncate">
                      {report.address || "Selected from map"}
                    </span>

                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {report.updatedAt ? "Updated" : "Created"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(report.updatedAt || report.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <aside className="h-full min-h-0 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-[#2a2a2a] dark:bg-[#151515]">
        {selectedReportId ? (
          <CitizenReportDrawer
            report={selectedReport}
            isLoading={isReportLoading}
            isFetching={isReportFetching}
            onClose={onCloseReport}
          />
        ) : (
          <div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-[#2a2a2a]">
              <h2 className="text-sm font-semibold">Report details</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Select a report to inspect timeline, SLA status, rejection reason, or resolution evidence.
              </p>
            </div>

            <div className="flex items-center justify-center p-6 text-center">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  No report selected
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Choose any report from the registry.
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </section>
  );
}


export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const logout = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();
  const selectedIssueIdRef = useRef(null);
  const markerRefs = useRef({});

  const [activePopupIssueId, setActivePopupIssueId] = useState(null);

  const [center, setCenter] = useState(DEFAULT_MAP_CENTER);
  const [mapZoom, setMapZoom] = useState(13);
  const [mapBounds, setMapBounds] = useState(null);
  const [filter, setFilter] = useState({ category: "", severity: "" });

  const [activeSidebarTab, setActiveSidebarTab] = useState("map");
  const [drawerMode, setDrawerMode] = useState("empty");
  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [selectedCitizenReportId, setSelectedCitizenReportId] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "POTHOLE",
    severity: "MEDIUM",
  });

  const [imageFile, setImageFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isAiAutofilling, setIsAiAutofilling] = useState(false);
  const [aiAutofillMessage, setAiAutofillMessage] = useState(null);
  const [mapFocusTarget, setMapFocusTarget] = useState(null);

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
      filter.category,
      filter.severity,
    ],
    [filter.category, filter.severity]
  );

  const {
    data: issues = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: nearbyIssuesQueryKey,
    queryFn: fetchNearbyIssues,
    enabled: true,
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

  const possibleDuplicateIssueId = selectedIssue?.possibleDuplicateIssueId;

  const {
    data: possibleDuplicateIssue,
    isFetching: isPossibleDuplicateFetching,
  } = useQuery({
    queryKey: ["issue-detail", possibleDuplicateIssueId],
    queryFn: fetchIssueDetail,
    enabled:
      drawerMode === "detail" &&
      Boolean(possibleDuplicateIssueId) &&
      possibleDuplicateIssueId !== selectedIssueId,
    staleTime: 1000 * 30,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const {
    data: myReports = [],
    isLoading: isMyReportsLoading,
    isFetching: isMyReportsFetching,
  } = useQuery({
    queryKey: ["citizen-my-reports"],
    queryFn: fetchCitizenReports,
    staleTime: 1000 * 30,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const {
    data: selectedCitizenReport,
    isLoading: isCitizenReportLoading,
    isFetching: isCitizenReportFetching,
  } = useQuery({
    queryKey: ["citizen-my-report", selectedCitizenReportId],
    queryFn: fetchCitizenReportDetail,
    enabled: drawerMode === "my-report" && Boolean(selectedCitizenReportId),
    staleTime: 1000 * 30,
    retry: 1,
    refetchOnWindowFocus: false,
  });


  useEffect(() => {
    const notificationIssueId = searchParams.get("issueId");
    const notificationReportId = searchParams.get("reportId");
    const tab = searchParams.get("tab");

    if (notificationReportId || tab === "my-reports") {
      setActiveSidebarTab("my-reports");
      setDrawerMode(notificationReportId ? "my-report" : "empty");
      setSelectedCitizenReportId(notificationReportId);
      setSelectedIssueId(null);
      setSelectedLocation(null);
      return;
    }

    if (notificationIssueId) {
      setActiveSidebarTab("map");
      setDrawerMode("detail");
      setSelectedIssueId(notificationIssueId);
      setSelectedCitizenReportId(null);
      setSelectedLocation(null);
    }
  }, [searchParams]);

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

        if (event?.type === "ISSUE_ESCALATED") {
          toast.warning("Issue delayed", {
            description: event?.title || "An issue has been escalated due to SLA risk.",
          });
        }

        if (
          event?.type === "ISSUE_RESOLVED" ||
          (event?.type === "ISSUE_UPDATED" && event?.status === "RESOLVED")
        ) {
          toast.success("Issue resolved with evidence", {
            description:
              event?.title || "Resolution proof is now available.",
          });
        } else if (event?.type === "ISSUE_UPDATED" && event?.status) {
          toast.message(`Issue status changed to ${event.status}`);
        }

        if (
          event?.type === "ISSUE_UPDATED" &&
          event?.status !== "RESOLVED" &&
          event?.issueId &&
          selectedIssueIdRef.current === event.issueId
        ) {
          toast.message("Duplicate analysis refreshed", {
            description:
              "AI-enhanced duplicate detection was recomputed after image analysis.",
          });
        }

        // ================= TANSTACK QUERY INVALIDATION =================

        const eventIssueId =
          event?.issueId ||
          event?.id ||
          event?.issue?.id ||
          event?.data?.id;

        const activeIssueId = selectedIssueIdRef.current;

        if (event?.type === "ISSUE_DELETED" && eventIssueId) {
          const marker = markerRefs.current[eventIssueId];

          if (marker && typeof marker.closePopup === "function") {
            marker.closePopup();
          }

          delete markerRefs.current[eventIssueId];

          setActivePopupIssueId((currentIssueId) =>
            currentIssueId === eventIssueId ? null : currentIssueId
          );

          queryClient.setQueriesData(
            {
              queryKey: ["nearby-issues"],
              exact: false,
            },
            (oldIssues) => {
              if (!Array.isArray(oldIssues)) return oldIssues;
              return oldIssues.filter((issue) => issue.id !== eventIssueId);
            }
          );

          queryClient.removeQueries({
            queryKey: ["issue-detail", eventIssueId],
            exact: true,
          });

          if (activeIssueId === eventIssueId) {
            setDrawerMode("empty");
            setSelectedIssueId(null);
            setSelectedCitizenReportId(null);
            setSelectedLocation(null);
          }
        }

        await queryClient.invalidateQueries({
          queryKey: ["nearby-issues"],
          exact: false,
        });

        await queryClient.invalidateQueries({
          queryKey: ["citizen-my-reports"],
        });

        // Also invalidate admin/moderation issue lists when this page is mounted.
        queryClient.invalidateQueries({
          queryKey: ["issues"],
        });

        if (eventIssueId) {
          queryClient.invalidateQueries({
            queryKey: ["issue-detail", eventIssueId],
          });
        }

        if (activeIssueId && activeIssueId !== eventIssueId) {
          queryClient.invalidateQueries({
            queryKey: ["issue-detail", activeIssueId],
          });
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

  const activeCityRegion = useMemo(() => {
    return getCityRegionForCoordinate(center.lat, center.lng, "viewBounds") || null;
  }, [center.lat, center.lng]);

  const shouldShowCityIssueLayer = useMemo(() => {
    if (!activeCityRegion) {
      return false;
    }

    return !doesViewportShowDifferentCity(mapBounds, activeCityRegion.key);
  }, [activeCityRegion, mapBounds]);

  const mapVisibleIssues = useMemo(() => {
    if (!shouldShowCityIssueLayer || !activeCityRegion) {
      return [];
    }

    return validIssues.filter((issue) => {
      const issueCity = getIssueCityRegion(issue);
      return issueCity?.key === activeCityRegion.key;
    });
  }, [validIssues, shouldShowCityIssueLayer, activeCityRegion]);

  const nearbyPanelIssues = mapVisibleIssues;

  useEffect(() => {
    if (!shouldShowCityIssueLayer) {
      setActivePopupIssueId(null);
    }
  }, [shouldShowCityIssueLayer]);

  useEffect(() => {
    if (!activePopupIssueId) return;

    const openActivePopup = () => {
      Object.entries(markerRefs.current).forEach(([issueId, marker]) => {
        if (
          issueId !== activePopupIssueId &&
          typeof marker?.closePopup === "function"
        ) {
          marker.closePopup();
        }
      });

      const marker = markerRefs.current[activePopupIssueId];

      if (marker && typeof marker.openPopup === "function") {
        marker.openPopup();
      }
    };

    // Try immediately, then again after React/Leaflet finishes rendering.
    // This makes popups appear on the first click instead of only after zoom/pan.
    openActivePopup();

    const timers = [
      window.setTimeout(openActivePopup, 60),
      window.setTimeout(openActivePopup, 180),
      window.setTimeout(openActivePopup, 420),
    ];

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [activePopupIssueId, mapVisibleIssues.length]);

  const highSeverityCount = useMemo(
    () => nearbyPanelIssues.filter((issue) => issue.severity === "HIGH").length,
    [nearbyPanelIssues]
  );

  const heatmapPoints = useMemo(() => {
    return mapVisibleIssues.map((issue) => {
      let intensity = 0.55;

      if (issue.severity === "HIGH") {
        intensity = 1;
      } else if (issue.severity === "MEDIUM") {
        intensity = 0.75;
      }

      return [Number(issue.latitude), Number(issue.longitude), intensity];
    });
  }, [mapVisibleIssues]);

  const clusterVersion = useMemo(() => {
    // Keep this independent from map center. Including queryCenter here caused
    // MarkerClusterGroup to remount after every pan/flyTo, which made some
    // marker popups close or fail to appear inconsistently.
    const issueSignature = mapVisibleIssues
      .map((issue) => {
        const lat = Number(issue.latitude).toFixed(5);
        const lng = Number(issue.longitude).toFixed(5);
        return `${issue.id}:${lat}:${lng}:${issue.severity}:${issue.category}:${issue.status || ""}:${issue.imageUrl || ""}:${issue.resolutionImageUrl || ""}:${issue.resolvedAt || ""}`;
      })
      .sort()
      .join("|");

    return [
      filter.category || "all-categories",
      filter.severity || "all-severities",
      mapVisibleIssues.length,
      issueSignature,
      shouldShowCityIssueLayer ? "city-layer-visible" : "city-layer-hidden",
    ].join("__");
  }, [mapVisibleIssues, filter.category, filter.severity, shouldShowCityIssueLayer]);

  const getDisplayArea = (issue) => {
    if (!issue) return AREA_UNAVAILABLE;

    if (!isPlaceholderAddress(issue.address)) {
      return issue.address;
    }

    return getApproxPuneArea(issue.latitude, issue.longitude);
  };


  const handleMapMove = (lat, lng, zoom, bounds) => {
    if (Number.isFinite(Number(zoom))) {
      setMapZoom(Number(zoom));
    }

    if (bounds) {
      setMapBounds(bounds);
    }

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
    });
    setImageFile(null);
    setIsSubmitting(false);
    setIsUploadingImage(false);
    setIsAiAutofilling(false);
    setAiAutofillMessage(null);
  };

  const openCreateForm = (location) => {
    setActivePopupIssueId(null);
    setActiveSidebarTab("map");
    setDrawerMode("create");
    setSelectedIssueId(null);
    setSelectedCitizenReportId(null);
    setSelectedLocation(location);
    resetCreateForm();
  };

  const closeCreateForm = () => {
    setDrawerMode("empty");
    setSelectedIssueId(null);
    setSelectedCitizenReportId(null);
    setSelectedLocation(null);
    resetCreateForm();
  };

  const openIssueDetail = (issueId, options = {}) => {
    if (options.openPopup) {
      setActivePopupIssueId(issueId);
    }

    setActiveSidebarTab("map");
    setDrawerMode("detail");
    setSelectedIssueId(issueId);
    setSelectedCitizenReportId(null);
    setSelectedLocation(null);
    setImageFile(null);
    setIsSubmitting(false);
    setIsUploadingImage(false);
    setIsAiAutofilling(false);
    setAiAutofillMessage(null);

    const focusIssue = options.focusIssue;

    if (focusIssue?.latitude != null && focusIssue?.longitude != null) {
      setMapFocusTarget({
        id: focusIssue.id || issueId,
        lat: Number(focusIssue.latitude),
        lng: Number(focusIssue.longitude),
        zoom: options.zoom ?? 14,
      });
    }
  };

  const closeIssueDetail = () => {
    setDrawerMode("empty");
    setSelectedIssueId(null);
    setSelectedCitizenReportId(null);
    setActivePopupIssueId(null);
    setSearchParams({});
  };

  const openMapTab = () => {
    setActiveSidebarTab("map");
    setDrawerMode("empty");
    setSelectedIssueId(null);
    setSelectedCitizenReportId(null);
    setSelectedLocation(null);
    setActivePopupIssueId(null);
  };

  const openMyReportsTab = () => {
    setActiveSidebarTab("my-reports");
    setDrawerMode("empty");
    setSelectedIssueId(null);
    setSelectedCitizenReportId(null);
    setSelectedLocation(null);
    setActivePopupIssueId(null);
  };

  const openMyReport = (reportId) => {
    if (!reportId) return;

    setActiveSidebarTab("my-reports");
    setDrawerMode("my-report");
    setSelectedCitizenReportId(reportId);
    setSelectedIssueId(null);
    setSelectedLocation(null);
    setActivePopupIssueId(null);
  };

  const closeMyReport = () => {
    setDrawerMode("empty");
    setSelectedCitizenReportId(null);
    setSearchParams({});
  };

  const handleOpenMatchedIssue = async (matchedIssue) => {
    const matchedIssueId =
      matchedIssue?.id || selectedIssue?.possibleDuplicateIssueId;

    if (!matchedIssueId) return;

    try {
      let issueToOpen = matchedIssue;

      if (!issueToOpen?.latitude || !issueToOpen?.longitude) {
        const response = await API.get(`/api/issues/${matchedIssueId}`);
        issueToOpen = response.data;

        queryClient.setQueryData(
          ["issue-detail", matchedIssueId],
          issueToOpen
        );
      }

      openIssueDetail(matchedIssueId, {
        focusIssue: issueToOpen,
        openPopup: true,
        zoom: 13,
      });

      toast.message("Opened matched issue", {
        description:
          "Map focus moved from the duplicate report to the original matched report.",
      });
    } catch (error) {
      console.error("Failed to open matched issue", error);
      toast.error("Failed to open matched issue");
    }
  };

  const resetFilters = () => {
    setFilter({ category: "", severity: "" });
  };

  const refreshIssues = async () => {
    await queryClient.invalidateQueries({ queryKey: ["nearby-issues"] });
    await queryClient.invalidateQueries({ queryKey: ["issue-detail"] });
    await queryClient.invalidateQueries({ queryKey: ["citizen-my-reports"] });
    await refetch();
  };

  const handleAiImageUpload = async (file) => {
    if (!file) return;

    setIsAiAutofilling(true);
    setAiAutofillMessage(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const preparedFile = await prepareImageForUpload(file);

      setImageFile(preparedFile);

      const formData = new FormData();
      formData.append("file", preparedFile);

      const response = await fetch(AI_PREVIEW_URL, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`AI preview request failed with status ${response.status}`);
      }

      const data = await response.json();

      if (data?.error) {
        throw new Error(data.error);
      }

      setForm((previous) => ({
        ...previous,
        title: previous.title?.trim() ? previous.title : data.title || previous.title,
        category: data.category || previous.category,
        severity: data.severity || previous.severity,
        description: previous.description?.trim()
          ? previous.description
          : data.description || previous.description,
      }));

      setAiAutofillMessage(
        "AI suggestions were applied. Review and edit them before submitting."
      );

      toast.success("AI autofill completed", {
        description:
          "Title, category, severity, and description were suggested automatically.",
      });
    } catch (error) {
      const isAbort = error?.name === "AbortError";
      const message = isAbort
        ? "AI autofill took too long. The image is still attached, so you can complete the report manually."
        : "AI service is offline or unreachable. The image is still attached, so fill the report manually and submit.";

      console.warn("AI autofill unavailable", error);

      setImageFile(file);
      setAiAutofillMessage(message);

      toast.warning("AI autofill unavailable", {
        description: message,
      });
    } finally {
      clearTimeout(timeoutId);
      setIsAiAutofilling(false);
    }
  };

  const uploadIssueImageWithRetry = async (issueId, file) => {
    let lastError = null;

    for (let attempt = 1; attempt <= IMAGE_UPLOAD_RETRY_COUNT; attempt += 1) {
      const uploadData = new FormData();
      uploadData.append("file", file);

      try {
        await API.post(`/api/issues/${issueId}/upload`, uploadData, {
          timeout: IMAGE_UPLOAD_TIMEOUT_MS,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        return;
      } catch (error) {
        lastError = error;
        console.error(`Image upload attempt ${attempt} failed`, error);

        if (attempt < IMAGE_UPLOAD_RETRY_COUNT) {
          await wait(1200 * attempt);
        }
      }
    }

    throw lastError;
  };

  const handleCreateIssue = async () => {
    if (!selectedLocation) return;

    if (!form.title.trim()) {
      toast.error("Missing title", {
        description: "Please enter a title before submitting the report.",
      });
      return;
    }

    if (!form.description.trim()) {
      toast.error("Missing description", {
        description: "Please enter a description before submitting the report.",
      });
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
        address: LOCATION_PLACEHOLDER,
      });

      const issueId = issueRes.data?.id;

      if (imageFile && issueId) {
        setIsUploadingImage(true);

        try {
          await uploadIssueImageWithRetry(issueId, imageFile);

          toast.success("Image uploaded", {
            description: "The report image was attached successfully.",
          });
        } catch (uploadErr) {
          console.error("Image upload failed", uploadErr);

          toast.error("Issue created, but image upload failed", {
            description:
              "The issue will still appear on the map. If this repeats, check backend logs for /upload because the backend is resetting the connection.",
          });
        } finally {
          setIsUploadingImage(false);
        }
      }

      closeCreateForm();
      await refreshIssues();

      if (issueId) openIssueDetail(issueId);
    } catch (err) {
      console.error("Create issue failed", err);
      toast.error("Failed to create issue", {
        description:
          err?.response?.data?.message ||
          err?.response?.data ||
          "Check the report details and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDescriptionContent = () => {
    if (!selectedIssue) return null;

    return (
      <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 dark:border-[#333333] dark:bg-[#151515]">
        <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
          {selectedIssue.description || "No description provided."}
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
                  onClick={openMapTab}
                  className={`flex h-9 w-full items-center rounded-md px-3 text-left text-sm ${
                    activeSidebarTab === "map"
                      ? "bg-slate-100 font-medium text-slate-950 dark:bg-[#222222] dark:text-slate-100"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-[#1d1d1d] dark:hover:text-slate-100"
                  }`}
                >
                  Map
                </button>

                <button
                  type="button"
                  onClick={openMyReportsTab}
                  className={`flex h-9 w-full items-center rounded-md px-3 text-left text-sm ${
                    activeSidebarTab === "my-reports"
                      ? "bg-slate-100 font-medium text-slate-950 dark:bg-[#222222] dark:text-slate-100"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-[#1d1d1d] dark:hover:text-slate-100"
                  }`}
                >
                  My Reports
                </button>
              </nav>

              {activeSidebarTab === "map" ? (
                <>
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
                  ) : nearbyPanelIssues.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-[#333333] dark:text-slate-400">
                      No civic issues match this map view or filter.
                    </div>
                  ) : (
                    nearbyPanelIssues.slice(0, 8).map((issue) => (
                      <button
                        key={issue.id}
                        type="button"
                        onClick={() =>
                          openIssueDetail(issue.id, {
                            focusIssue: issue,
                            openPopup: true,
                            zoom: 13,
                          })
                        }
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

                            {hasResolutionProof(issue) && (
                              <span className="mt-2 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                                ✔ Resolution proof available
                              </span>
                            )}
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
                </>
              ) : (
                <div className="mt-6 border-t border-slate-200 pt-4 dark:border-[#2a2a2a]">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-[#2a2a2a] dark:bg-[#101010]">
                    <h2 className="text-sm font-semibold">My Reports</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      Your report registry is open in the main workspace. Select a report there to view its tracking drawer.
                    </p>

                    {isMyReportsFetching && (
                      <p className="mt-3 text-xs text-slate-400">Refreshing reports...</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-200 p-3 dark:border-[#2a2a2a]">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-[#2a2a2a] dark:bg-[#101010]">
                <p className="text-sm font-medium">
                  {activeSidebarTab === "my-reports" ? "My Reports" : "Nearby"}
                </p>

                {activeSidebarTab === "my-reports" ? (
                  <>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Total
                      </span>
                      <span>{myReports.length}</span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Resolved
                      </span>
                      <span>
                        {myReports.filter((report) => report.status === "RESOLVED").length}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Issues
                      </span>
                      <span>{nearbyPanelIssues.length}</span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        High severity
                      </span>
                      <span>{highSeverityCount}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </aside>

        <main className="grid min-h-0 grid-rows-[56px_minmax(0,1fr)]">
          <header className="z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-5 dark:border-[#2a2a2a] dark:bg-[#0f0f0f]">
            <div>
              <h2 className="text-base font-semibold">
                {activeSidebarTab === "my-reports" ? "My Reports" : "Map dashboard"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeSidebarTab === "my-reports"
                  ? "Track your submitted reports, timeline, SLA status, and resolution evidence"
                  : "Select a marker for details or click the map to create a report"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <NotificationBell variant={darkMode ? "dark" : "light"} />

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

          {activeSidebarTab === "my-reports" ? (
            <CitizenReportsWorkspace
              reports={myReports}
              isLoading={isMyReportsLoading}
              isFetching={isMyReportsFetching}
              selectedReportId={selectedCitizenReportId}
              selectedReport={selectedCitizenReport}
              isReportLoading={isCitizenReportLoading}
              isReportFetching={isCitizenReportFetching}
              onOpenReport={openMyReport}
              onCloseReport={closeMyReport}
            />
          ) : (
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

                <MapFocusController focusTarget={mapFocusTarget} />

                {showHeatmap && heatmapPoints.length > 0 && (
                  <HeatmapLayer points={heatmapPoints} />
                )}

                {showHeatmap &&
                  mapVisibleIssues.map((issue) => {
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
                  {mapVisibleIssues.map((issue) => (
                    <Marker
                      key={issue.id}
                      ref={(marker) => {
                        if (marker) {
                          markerRefs.current[issue.id] = marker;
                        } else {
                          delete markerRefs.current[issue.id];
                        }
                      }}
                      position={[
                        Number(issue.latitude),
                        Number(issue.longitude),
                      ]}
                      eventHandlers={{
                        click: (event) => {
                          // Marker click should show the popup immediately.
                          // Do not flyTo/zoom here because map movement can close
                          // the Leaflet popup before the user sees it.
                          event?.originalEvent?.stopPropagation?.();
                          event.target?.openPopup?.();
                          setActivePopupIssueId(issue.id);

                          openIssueDetail(issue.id, {
                            openPopup: false,
                          });
                        },
                        popupclose: () => {
                          setActivePopupIssueId((current) =>
                            current === issue.id ? null : current
                          );
                        },
                      }}
                    >
                      <Popup
                        autoPan={false}
                        autoClose={false}
                        closeOnClick={false}
                        keepInView={false}
                      >
                        <div className="min-w-[250px] overflow-hidden rounded-xl bg-white p-1 dark:bg-[#111111]">
                          {issue.imageUrl ? (
                            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-[#2a2a2a]">
                              <img
                                src={issue.imageUrl}
                                alt={issue.title}
                                className="h-40 w-full bg-black object-contain transition-transform duration-300 hover:scale-[1.02]"
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

                                {hasResolutionProof(issue) && (
                                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                                    ✔ Resolution proof available
                                  </span>
                                )}
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

              {showHeatmap && shouldShowCityIssueLayer && (
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
                        disabled={isSubmitting || isUploadingImage || isAiAutofilling}
                      >
                        {isUploadingImage
                          ? "Uploading image..."
                          : isSubmitting
                          ? "Submitting..."
                          : isAiAutofilling
                          ? "Analyzing image..."
                          : "Submit issue"}
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

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <label htmlFor="description" className={fieldLabelClass}>
                            Description
                          </label>

                          {imageFile && !isAiAutofilling && (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                              AI suggested · editable
                            </span>
                          )}
                        </div>

                        <textarea
                          id="description"
                          name="description"
                          rows={4}
                          placeholder="Upload an image to let AI suggest a description, or write the details manually."
                          value={form.description}
                          onChange={(e) =>
                            setForm((previous) => ({
                              ...previous,
                              description: e.target.value,
                            }))
                          }
                          className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-1 focus:ring-slate-300 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-[#333333]"
                        />

                        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                          AI autofill can suggest this from the uploaded image. You can edit it before submitting.
                        </p>
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
                          Image
                        </label>

                        <input
                          id="issueImage"
                          name="issueImage"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];

                            if (!file) {
                              setImageFile(null);
                              return;
                            }

                            handleAiImageUpload(file);
                          }}
                          disabled={isAiAutofilling || isSubmitting}
                          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#333333] dark:bg-[#101010] dark:text-slate-100 dark:file:bg-[#222222] dark:file:text-slate-200 dark:hover:file:bg-[#2a2a2a]"
                        />

                        {imageFile && (
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            Selected: {imageFile.name}
                          </p>
                        )}

                        {isAiAutofilling && (
                          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm leading-6 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                            AI is analyzing the uploaded image and generating title, category, severity, and description suggestions...
                          </div>
                        )}

                        {isUploadingImage && (
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                            Uploading image and starting AI verification.
                          </div>
                        )}

                        {!isAiAutofilling && imageFile && aiAutofillMessage && (
                          <div
                            className={`rounded-md border px-3 py-2 text-xs leading-5 ${
                              aiAutofillMessage.startsWith("AI suggestions")
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
                            }`}
                          >
                            {aiAutofillMessage}
                          </div>
                        )}

                        {!isAiAutofilling && imageFile && !aiAutofillMessage && (
                          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-[#2a2a2a] dark:bg-[#101010] dark:text-slate-300">
                            Image attached. AI suggestions are optional; you can complete the report manually.
                          </div>
                        )}
                      </div>

                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-[#2a2a2a] dark:bg-[#101010] dark:text-slate-300">
                        <span
                          className={`mr-2 inline-block h-2 w-2 rounded-full ${
                            severityDotStyles[form.severity]
                          }`}
                        />
                        {isAiAutofilling
                          ? "AI is preparing report suggestions"
                          : `${severityLabels[form.severity]} severity report`}
                        {!isAiAutofilling && imageFile ? " with image" : ""}
                      </div>
                    </div>
                  </div>
                </div>
               ) : drawerMode === "detail" && selectedIssueId ? (
                <IssueDetailsDrawer
                  issue={selectedIssue}
                  isLoading={isIssueDetailLoading}
                  isFetching={isIssueDetailFetching}
                  onClose={closeIssueDetail}
                  possibleDuplicateIssue={possibleDuplicateIssue}
                  isPossibleDuplicateFetching={isPossibleDuplicateFetching}
                  onOpenMatchedIssue={handleOpenMatchedIssue}
                  getDisplayArea={getDisplayArea}
                />
              ) : drawerMode === "my-report" && selectedCitizenReportId ? (
                <CitizenReportDrawer
                  report={selectedCitizenReport}
                  isLoading={isCitizenReportLoading}
                  isFetching={isCitizenReportFetching}
                  onClose={closeMyReport}
                />
              ) : (
                <div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
                  <div className="border-b border-slate-200 px-4 py-3 dark:border-[#2a2a2a]">
                    <h2 className="text-sm font-semibold">Issue details</h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Select a marker, nearby issue, or notification-linked report.
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
          )}
        </main>
      </div>
    </div>
  );
}
