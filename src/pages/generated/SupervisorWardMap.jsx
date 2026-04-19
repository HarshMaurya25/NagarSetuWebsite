import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  getIssueDetail,
  getSupervisorMap,
  getAdminWards,
} from "../../services/api";
import { getUser } from "../../lib/session";

function markerColor(criticality) {
  if (criticality === "HIGH") return "#dc2626";
  if (criticality === "MEDIUM") return "#f59e0b";
  return "#22c55e";
}

/* Hotspot color config */
const HOTSPOT_CONFIG = {
  CRITICAL: {
    fill: "rgba(153, 27, 27, 0.25)",
    stroke: "rgba(153, 27, 27, 0.6)",
    center: "#991b1b",
    label: "#fff",
  },
  HIGH: {
    fill: "rgba(220, 38, 38, 0.22)",
    stroke: "rgba(220, 38, 38, 0.55)",
    center: "#dc2626",
    label: "#fff",
  },
  MODERATE: {
    fill: "rgba(245, 158, 11, 0.20)",
    stroke: "rgba(245, 158, 11, 0.50)",
    center: "#f59e0b",
    label: "#fff",
  },
  LOW: {
    fill: "rgba(250, 204, 21, 0.18)",
    stroke: "rgba(250, 204, 21, 0.45)",
    center: "#eab308",
    label: "#fff",
  },
};

function getHotspotSeverity(count) {
  if (count >= 6) return "CRITICAL";
  if (count >= 4) return "HIGH";
  if (count >= 3) return "MODERATE";
  return "LOW";
}

function criticalityRank(value) {
  const v = String(value || "").toUpperCase();
  if (v === "HIGH") return 3;
  if (v === "MEDIUM") return 2;
  return 1;
}

/* Styled select wrapper component */
function StyledSelect({ value, onChange, children, icon }) {
  return (
    <div className="relative group">
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-outline pointer-events-none z-10">
          {icon}
        </span>
      )}
      <select
        className={`w-full appearance-none ${icon ? "pl-9" : "pl-4"} pr-10 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/20 text-sm font-semibold text-on-surface cursor-pointer transition-all hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none`}
        value={value}
        onChange={onChange}
      >
        {children}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <span className="material-symbols-outlined text-outline text-lg">
          expand_more
        </span>
      </div>
    </div>
  );
}

function hotspotKey(issue) {
  return `${Number(issue.latitude).toFixed(2)}:${Number(issue.longitude).toFixed(2)}`;
}

function escapeHtml(value) {
  const str = String(value ?? "");
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default function SupervisorWardMap() {
  const user = getUser();
  const [mapInstance, setMapInstance] = useState(null);
  const layerRef = useRef(null);
  const wardLayerRef = useRef(null);
  const hotspotLayerRef = useRef(null);
  const mapNodeRef = useRef(null);
  const boundsRef = useRef(null);

  const [issues, setIssues] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [matrix, setMatrix] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [selectedIssueDetail, setSelectedIssueDetail] = useState(null);
  const [assignedWardFeature, setAssignedWardFeature] = useState(null);

  const [criticalityFilter, setCriticalityFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("criticality");
  const [hotspotOnly, setHotspotOnly] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!user?.id) {
        setError("Supervisor ID missing in session. Please login again.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const [response, wardData] = await Promise.all([
          getSupervisorMap(user.id),
          getAdminWards().catch(() => null),
        ]);

        if (mounted) {
          setIssues(response?.issues || []);
          setWorkers(response?.workers || []);
          const matrixData = response?.matrix || null;
          setMatrix(matrixData);

          // Find ward feature
          const geojson = wardData?.geojson;
          if (matrixData?.wardId && geojson) {
            let features = [];
            if (geojson?.type === "FeatureCollection")
              features = geojson.features;
            else if (geojson?.features) features = geojson.features;

            const feature = (features || []).find(
              (f) =>
                (f?.properties?.wardId || f?.properties?.id) ===
                  matrixData.wardId ||
                (f?.properties?.wardName || f?.properties?.name) ===
                  (matrixData.wardName || matrixData.name),
            );
            setAssignedWardFeature(feature || null);

            // Get ward name from the feature or wards list
            if (!matrixData.wardName && feature?.properties) {
              matrixData.wardName =
                feature.properties.wardName ||
                feature.properties.name ||
                feature.properties.Ward;
            }
          }

          // Also try to find ward name from wards list
          if (!matrixData?.wardName && matrixData?.wardId && wardData?.wards) {
            const wardMatch = (wardData.wards || []).find(
              (w) => String(w.wardId || w.id) === String(matrixData.wardId),
            );
            if (wardMatch) {
              matrixData.wardName = wardMatch.wardName || wardMatch.name;
            }
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || "Failed to load supervisor map.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const hotspotCountMap = useMemo(() => {
    return issues.reduce((acc, issue) => {
      const key = hotspotKey(issue);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [issues]);

  const filteredIssues = useMemo(() => {
    return issues
      .filter((issue) => {
        if (
          criticalityFilter !== "ALL" &&
          issue.criticality !== criticalityFilter
        )
          return false;
        if (typeFilter !== "ALL" && issue.issueType !== typeFilter)
          return false;
        if (stageFilter !== "ALL" && issue.stages !== stageFilter) return false;
        if (hotspotOnly && (hotspotCountMap[hotspotKey(issue)] || 0) < 2)
          return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "issueType")
          return (a.issueType || "").localeCompare(b.issueType || "");
        if (sortBy === "hotspot")
          return (
            (hotspotCountMap[hotspotKey(b)] || 0) -
            (hotspotCountMap[hotspotKey(a)] || 0)
          );
        const level = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (level[b.criticality] || 0) - (level[a.criticality] || 0);
      });
  }, [
    issues,
    criticalityFilter,
    typeFilter,
    stageFilter,
    sortBy,
    hotspotOnly,
    hotspotCountMap,
  ]);

  const hotspotSeverityMap = useMemo(() => {
    const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return issues.reduce((acc, issue) => {
      const key = hotspotKey(issue);
      const next = String(issue.criticality || "LOW").toUpperCase();
      const current = acc[key];
      if (!current || (rank[next] || 0) > (rank[current] || 0)) {
        acc[key] = next;
      }
      return acc;
    }, {});
  }, [issues]);

  const hotspots = useMemo(() => {
    return Object.entries(hotspotCountMap)
      .filter(([, count]) => count >= 2)
      .map(([key, count]) => ({
        key,
        count,
        severity: getHotspotSeverity(count),
      }))
      .sort((a, b) => b.count - a.count);
  }, [hotspotCountMap]);

  /* Compute hotspot centers with averaged lat/lng */
  const hotspotCenters = useMemo(() => {
    const groups = {};
    issues.forEach((issue) => {
      const key = hotspotKey(issue);
      if (!groups[key])
        groups[key] = { lats: [], lngs: [], count: 0, maxCriticality: "LOW" };
      groups[key].lats.push(Number(issue.latitude));
      groups[key].lngs.push(Number(issue.longitude));
      groups[key].count += 1;
      if (
        criticalityRank(issue.criticality) >
        criticalityRank(groups[key].maxCriticality)
      ) {
        groups[key].maxCriticality = issue.criticality;
      }
    });

    return Object.entries(groups)
      .filter(([, g]) => g.count >= 2)
      .map(([key, g]) => ({
        key,
        count: g.count,
        lat: g.lats.reduce((a, b) => a + b, 0) / g.lats.length,
        lng: g.lngs.reduce((a, b) => a + b, 0) / g.lngs.length,
        severity: getHotspotSeverity(g.count),
        maxCriticality: g.maxCriticality,
      }))
      .sort((a, b) => b.count - a.count);
  }, [issues]);

  const wardDisplayName = useMemo(() => {
    return (
      matrix?.wardName ||
      matrix?.name ||
      assignedWardFeature?.properties?.wardName ||
      assignedWardFeature?.properties?.name ||
      assignedWardFeature?.properties?.Ward ||
      "Ward"
    );
  }, [matrix, assignedWardFeature]);

  const visibleCriticality = useMemo(() => {
    return filteredIssues.reduce(
      (acc, issue) => {
        const value = String(issue.criticality || "LOW").toUpperCase();
        if (value === "HIGH") acc.high += 1;
        else if (value === "MEDIUM") acc.medium += 1;
        else acc.low += 1;
        return acc;
      },
      { high: 0, medium: 0, low: 0 },
    );
  }, [filteredIssues]);

  const activeWardsCount = useMemo(() => {
    if (
      assignedWardFeature ||
      matrix?.wardId ||
      matrix?.wardName ||
      matrix?.name
    )
      return 1;
    return 0;
  }, [assignedWardFeature, matrix]);

  useEffect(() => {
    if (!mapNodeRef.current || mapInstance) return;

    const map = L.map(mapNodeRef.current).setView([28.6139, 77.209], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    setMapInstance(map);

    setTimeout(() => map?.invalidateSize(), 100);
    setTimeout(() => map?.invalidateSize(), 500);

    // Initial center fallback to geolocation if no data yet
    if (navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!map || filteredIssues.length > 0) return;
          map.setView(
            [pos.coords.latitude, pos.coords.longitude],
            13,
          );
        },
        () => {},
        { timeout: 5000 },
      );
    }
  }, [loading]);

  useEffect(() => {
    if (!mapInstance) return;

    if (layerRef.current) {
      layerRef.current.remove();
    }

    layerRef.current = L.layerGroup();

    filteredIssues.forEach((issue) => {
      const lat = Number(issue.latitude);
      const lng = Number(issue.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const color = markerColor(issue.criticality);

      // High-Fidelity marker: cross style
      const icon = L.divIcon({
        className: "custom-issue-marker",
        html: `<div style="
          width: 24px; height: 24px; border-radius: 50%;
          background: ${color}; border: 2px solid rgba(255,255,255,0.95);
          box-shadow: 0 4px 12px ${color}55;
          display: flex; align-items: center; justify-content: center;
        ">
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
            <path d="M5 1V9M1 5H9" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([lat, lng], { icon });

      const popupHtml = `<strong>${escapeHtml(
        (issue.issueType || "").replaceAll("_", " "),
      )}</strong><br/>${escapeHtml(issue.criticality)}<br/>${escapeHtml(
        (issue.stages || "").replaceAll("_", " "),
      )}`;

      marker.bindPopup(popupHtml);

      marker.on("click", async () => {
        setSelectedIssue(issue);
        try {
          const detail = await getIssueDetail(issue.id);
          setSelectedIssueDetail(detail);
        } catch {
          setSelectedIssueDetail(null);
        }
      });

      layerRef.current.addLayer(marker);
    });

    layerRef.current.addTo(mapInstance);

    // Radial Hotspots
    hotspotLayerRef.current?.remove();
    hotspotLayerRef.current = L.layerGroup();

    hotspotCenters.forEach((spot) => {
      const config = HOTSPOT_CONFIG[spot.severity];
      const radius = Math.min(60 + spot.count * 20, 150); // Adjusted for ward-level view

      // Outer glow
      L.circle([spot.lat, spot.lng], {
        radius: radius,
        fillColor: config.fill.replace(/[\d.]+\)$/, "0.15)"),
        fillOpacity: 1,
        color: config.stroke.replace(/[\d.]+\)$/, "0.2)"),
        weight: 0,
      }).addTo(hotspotLayerRef.current);

      // Main circle
      L.circle([spot.lat, spot.lng], {
        radius: radius * 0.6,
        fillColor: config.fill,
        fillOpacity: 1,
        color: config.stroke,
        weight: 2,
      }).addTo(hotspotLayerRef.current);

      // Center label
      const labelIcon = L.divIcon({
        className: "hotspot-count-label",
        html: `<div style="
          width: 32px; height: 32px; border-radius: 50%;
          background: ${config.center}; border: 2.5px solid rgba(255,255,255,0.9);
          color: ${config.label}; font-size: 12px; font-weight: 900;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 15px ${config.center}70;
        ">
          ${spot.count}
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker([spot.lat, spot.lng], {
        icon: labelIcon,
        interactive: false,
      }).addTo(hotspotLayerRef.current);
    });
    hotspotLayerRef.current.addTo(mapInstance);

    if (assignedWardFeature) {
      // Priority 1: Focus on the assigned ward polygon
      const geoLayer = L.geoJSON(assignedWardFeature);
      const bounds = geoLayer.getBounds();
      mapInstance.fitBounds(bounds.pad(0.1));

      // Also restrict panning to this ward area (+ buffer)
      const expandedBounds = bounds.pad(1.0);
      boundsRef.current = expandedBounds;
      mapInstance.setMaxBounds(expandedBounds);
      mapInstance.options.maxBoundsViscosity = 0.8;
    } else if (filteredIssues.length) {
      // Priority 2: Focus on issue clusters if polygon not found
      const bounds = L.latLngBounds(
        filteredIssues.map((issue) => [issue.latitude, issue.longitude]),
      );
      mapInstance.fitBounds(bounds.pad(0.2));

      // Set pan boundary at 1.5x the issue area
      const expandedBounds = bounds.pad(1.5);
      boundsRef.current = expandedBounds;
      mapInstance.setMaxBounds(expandedBounds);
      mapInstance.options.maxBoundsViscosity = 0.8;
    }
  }, [filteredIssues, assignedWardFeature, mapInstance]);

  // Draw colored ward polygon overlay
  useEffect(() => {
    if (!mapInstance) return;
    wardLayerRef.current?.remove();
    wardLayerRef.current = null;

    if (assignedWardFeature) {
      wardLayerRef.current = L.geoJSON(assignedWardFeature, {
        style: {
          color: "#1d4ed8",
          weight: 4,
          opacity: 0.9,
          fillColor: "#60a5fa",
          fillOpacity: 0.22,
        },
      }).addTo(mapInstance);

      // Add ward name label
      const center = wardLayerRef.current.getBounds().getCenter();
      const label = L.divIcon({
        className: "ward-label",
        html: `<div style="background:rgba(29,78,216,0.9);color:white;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:800;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.2);">${wardDisplayName}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker(center, { icon: label, interactive: false }).addTo(
        wardLayerRef.current,
      );
    }
  }, [assignedWardFeature, wardDisplayName, mapInstance]);

  const selectClass =
    "w-full appearance-none rounded-2xl bg-surface-container-lowest border border-outline-variant/20 px-4 py-3 pr-10 text-sm font-bold text-on-surface shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/25";

  const filterPillClass =
    "relative flex items-center gap-2 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 px-3 py-2.5";

  const statCardClass =
    "rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 px-4 py-3";

  function severityStyles(severity) {
    if (severity === "HIGH") return "bg-error/10 text-error";
    if (severity === "MEDIUM") return "bg-secondary/10 text-secondary";
    return "bg-tertiary/10 text-tertiary";
  }

  function severityDot(severity) {
    if (severity === "HIGH") return "bg-error";
    if (severity === "MEDIUM") return "bg-secondary";
    return "bg-tertiary";
  }

  const StyledSelect = ({ value, onChange, icon, children }) => (
    <div className="relative flex items-center gap-2 rounded-2xl bg-surface-container-low border border-outline-variant/10 px-3 py-2.5 hover:border-primary/30 transition-colors">
      <div className="text-outline">{icon}</div>
      <select
        className="w-full appearance-none bg-transparent text-sm font-bold text-on-surface focus:outline-none cursor-pointer"
        value={value}
        onChange={onChange}
      >
        {children}
      </select>
      <span className="material-symbols-outlined pointer-events-none text-outline text-lg">
        expand_more
      </span>
    </div>
  );

  return (
    <div className="pt-24 px-4 lg:px-10 pb-14 min-h-screen bg-surface-container-low/20">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-black text-primary tracking-tight">
              Ward Intelligence
            </h1>
            <p className="text-outline mt-1 font-medium">
              Geospatial monitoring and hotspot detection for{" "}
              <span className="text-primary font-bold">{wardDisplayName}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 group">
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-widest font-black text-outline">
                Active Jurisdiction
              </span>
              <span className="text-sm font-bold text-primary">
                {wardDisplayName}
              </span>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-xl">map</span>
            </div>
          </div>
        </header>

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-outline font-bold animate-pulse">
              Synchronizing Ward Data...
            </p>
          </div>
        )}
        {error && (
          <div className="bg-error/10 border border-error/20 rounded-2xl p-6 flex items-center gap-4 text-error">
            <span className="material-symbols-outlined text-3xl">error</span>
            <div>
              <p className="font-black text-lg">System Conflict</p>
              <p className="text-sm font-medium opacity-80">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Filter Bar */}
            <section className="rounded-3xl bg-surface-container-lowest border border-outline-variant/10 p-5 shadow-elevated transition-all hover:shadow-hover">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[11px] uppercase tracking-[0.3em] font-black text-outline">
                  Strategic Filters
                </span>
                <div className="flex-1 h-px bg-outline-variant/10" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                <StyledSelect
                  value={criticalityFilter}
                  onChange={(e) => setCriticalityFilter(e.target.value)}
                  icon={
                    <span className="material-symbols-outlined text-lg">
                      bolt
                    </span>
                  }
                >
                  <option value="ALL">All Criticality</option>
                  <option value="HIGH">High Priority</option>
                  <option value="MEDIUM">Moderate</option>
                  <option value="LOW">Low Priority</option>
                </StyledSelect>

                <StyledSelect
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  icon={
                    <span className="material-symbols-outlined text-lg">
                      category
                    </span>
                  }
                >
                  <option value="ALL">All Categories</option>
                  <option value="POTHOLE">Potholes</option>
                  <option value="DRAINAGE_SEWER">Drainage & Sewer</option>
                  <option value="WASTE_MANAGEMENT">Waste</option>
                  <option value="INFRASTRUCTURE">Infrastructure</option>
                  <option value="ENCROACHMENT">Encroachment</option>
                  <option value="OTHER">Other Issues</option>
                </StyledSelect>

                <StyledSelect
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  icon={
                    <span className="material-symbols-outlined text-lg">
                      schema
                    </span>
                  }
                >
                  <option value="ALL">All Stages</option>
                  <option value="PENDING">Pending</option>
                  <option value="ACKNOWLEDGED">Acknowledged</option>
                  <option value="TEAM_ASSIGNED">Team Assigned</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                </StyledSelect>

                <StyledSelect
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  icon={
                    <span className="material-symbols-outlined text-lg">
                      sort
                    </span>
                  }
                >
                  <option value="criticality">Sort: Severity</option>
                  <option value="issueType">Sort: Category</option>
                  <option value="hotspot">Sort: Density</option>
                </StyledSelect>

                <button
                  type="button"
                  className={`relative group flex items-center justify-center gap-2 rounded-xl h-[46px] px-5 text-sm font-black border transition-all duration-300 overflow-hidden ${
                    hotspotOnly
                      ? "bg-gradient-to-br from-red-600 to-orange-500 text-white border-transparent shadow-lg shadow-orange-500/30 ring-2 ring-orange-500/20"
                      : "bg-surface-container-low text-on-surface border-outline-variant/20 hover:bg-surface-container-high transition-transform active:scale-95"
                  }`}
                  onClick={() => setHotspotOnly((v) => !v)}
                >
                  <div
                    className={`absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity ${hotspotOnly ? "" : "hidden"}`}
                  />
                  <span className="material-symbols-outlined text-lg">
                    local_fire_department
                  </span>
                  <span>HOTSPOTS</span>
                  {hotspotOnly && (
                    <span className="bg-white/20 text-[10px] px-1.5 py-0.5 rounded-md ml-1">
                      {hotspots.length}
                    </span>
                  )}
                </button>
              </div>
            </section>

            {/* Matrix Strip */}
            <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                {
                  label: "Visible",
                  val: filteredIssues.length,
                  sub: "Issues",
                  color: "primary",
                  icon: "visibility",
                },
                {
                  label: "Active",
                  val: activeWardsCount,
                  sub: "Wards",
                  color: "blue",
                  icon: "ward",
                },
                {
                  label: "Critical",
                  val: visibleCriticality.high,
                  sub: "High Priority",
                  color: "red",
                  icon: "warning",
                },
                {
                  label: "Medium",
                  val: visibleCriticality.medium,
                  sub: "Moderate",
                  color: "amber",
                  icon: "priority_high",
                },
                {
                  label: "Low",
                  val: visibleCriticality.low,
                  sub: "Standard",
                  color: "green",
                  icon: "check_circle",
                },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="bg-surface-container-lowest p-4 rounded-3xl border border-outline-variant/10 shadow-sm flex items-center gap-4 group hover:border-primary/20 transition-all"
                >
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${
                      stat.color === "primary"
                        ? "bg-primary/10 text-primary"
                        : stat.color === "red"
                          ? "bg-red-500/10 text-red-600"
                          : stat.color === "amber"
                            ? "bg-amber-500/10 text-amber-600"
                            : stat.color === "blue"
                              ? "bg-blue-500/10 text-blue-600"
                              : "bg-green-500/10 text-green-600"
                    }`}
                  >
                    <span className="font-black text-xl">{stat.val}</span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-outline tracking-widest">
                      {stat.label}
                    </p>
                    <p className="text-sm font-black whitespace-nowrap">
                      {stat.sub}
                    </p>
                  </div>
                </div>
              ))}
            </section>

            <div className="flex items-center gap-4 text-xs">
              <span className="font-black text-outline uppercase tracking-wider">
                Color Legend
              </span>
              <div className="flex items-center gap-4 px-4 py-2 bg-surface-container-lowest rounded-full border border-outline-variant/10 shadow-sm overflow-x-auto no-scrollbar whitespace-nowrap">
                <span className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-600" />{" "}
                  <span className="font-bold text-on-surface">Critical</span>
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />{" "}
                  <span className="font-bold text-on-surface">Moderate</span>
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />{" "}
                  <span className="font-bold text-on-surface">Low</span>
                </span>
              </div>
            </div>

            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-6">
              {/* Main Map Area */}
              <article className="lg:col-span-8 rounded-[2.5rem] bg-surface-container-lowest border border-outline-variant/10 p-3 shadow-elevated overflow-hidden group">
                <div className="relative h-[650px] w-full rounded-[2rem] overflow-hidden">
                  <div ref={mapNodeRef} className="h-full w-full z-0" />

                  {/* Floating Map Label */}
                  <div className="absolute top-6 left-6 z-[400] bg-white/90 backdrop-blur-md border border-outline-variant/20 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white">
                      <span className="material-symbols-outlined text-lg">
                        explore
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-outline uppercase tracking-widest leading-none">
                        Perspective
                      </p>
                      <p className="text-sm font-bold text-primary">
                        Ward Intelligence Map
                      </p>
                    </div>
                  </div>

                  {/* Layer Control Placeholder style */}
                  <div className="absolute bottom-6 left-6 z-[400] flex flex-col gap-2">
                    <button className="w-12 h-12 rounded-2xl bg-white/90 backdrop-blur-md border border-outline-variant/20 flex items-center justify-center text-primary shadow-lg hover:scale-105 transition-transform shadow-primary/10">
                      <span className="material-symbols-outlined">layers</span>
                    </button>
                  </div>
                </div>
              </article>

              {/* Intelligence Sidebar */}
              <aside className="lg:col-span-4 space-y-6">
                <div className="rounded-[2.5rem] bg-surface-container-lowest border border-outline-variant/10 p-6 shadow-elevated space-y-6">
                  <header>
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="text-xl font-black text-primary tracking-tight">
                        Intelligence Panel
                      </h2>
                      <div className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
                        Live
                      </div>
                    </div>
                    <p className="text-xs text-outline font-medium">
                      Contextual insights from the field
                    </p>
                  </header>

                  {/* Ward Context */}
                  <div className="relative overflow-hidden rounded-3xl bg-surface-container-low/40 border border-outline-variant/10 p-5 group hover:bg-surface-container-low transition-colors duration-300">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-primary shadow-sm border border-outline-variant/10">
                        <span className="material-symbols-outlined text-xl">
                          apartment
                        </span>
                      </div>
                      <h3 className="font-black text-primary uppercase text-[11px] tracking-widest">
                        Ward Jurisdiction
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { l: "Identity", v: wardDisplayName, icon: "id_card" },
                        {
                          l: "Force",
                          v: `${workers.length} Personnel`,
                          icon: "groups",
                        },
                        {
                          l: "Reports",
                          v: filteredIssues.length,
                          icon: "analytics",
                        },
                        { l: "Anomalies", v: hotspots.length, icon: "hub" },
                      ].map((item, i) => (
                        <div
                          key={i}
                          className="bg-white/60 p-3 rounded-2xl border border-outline-variant/5"
                        >
                          <p className="text-[9px] font-black text-outline uppercase tracking-wider mb-0.5">
                            {item.l}
                          </p>
                          <p className="font-bold text-primary truncate text-sm">
                            {item.v}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Selected Object Detail */}
                  <div className="rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <span className="material-symbols-outlined text-6xl">
                        location_searching
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined text-xl">
                            pin_drop
                          </span>
                        </div>
                        <h3 className="font-black text-primary uppercase text-[11px] tracking-widest">
                          Report Detail
                        </h3>
                      </div>
                      {selectedIssue?.criticality && (
                        <div
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border tracking-widest flex items-center gap-1.5 ${
                            String(selectedIssue.criticality).toUpperCase() ===
                            "HIGH"
                              ? "bg-red-50 text-red-600 border-red-200"
                              : String(
                                    selectedIssue.criticality,
                                  ).toUpperCase() === "MEDIUM"
                                ? "bg-amber-50 text-amber-600 border-amber-200"
                                : "bg-green-50 text-green-600 border-green-200"
                          }`}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${
                              String(
                                selectedIssue.criticality,
                              ).toUpperCase() === "HIGH"
                                ? "bg-red-600"
                                : String(
                                      selectedIssue.criticality,
                                    ).toUpperCase() === "MEDIUM"
                                  ? "bg-amber-500"
                                  : "bg-green-500"
                            }`}
                          />
                          {selectedIssue.criticality}
                        </div>
                      )}
                    </div>

                    {!selectedIssue ? (
                      <div className="py-10 text-center flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-surface-container-low border border-dashed border-outline-variant/50 flex items-center justify-center text-outline/30 mb-4 scale-110">
                          <span className="material-symbols-outlined text-3xl">
                            map
                          </span>
                        </div>
                        <p className="text-sm font-bold text-primary tracking-tight">
                          System Ready
                        </p>
                        <p className="text-xs text-outline mt-1 font-medium">
                          Select a spatial report marker to initialize
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-surface-container-low/50 border border-outline-variant/5">
                          <p className="text-[10px] font-black text-outline uppercase tracking-wider mb-1">
                            Issue Category
                          </p>
                          <p className="font-bold text-primary uppercase text-sm">
                            {(selectedIssue.issueType || "").replaceAll(
                              "_",
                              " ",
                            )}
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-lg text-primary mt-1">
                              description
                            </span>
                            <div className="flex-1">
                              <p className="text-[10px] font-black text-outline uppercase tracking-wider">
                                Operational Context
                              </p>
                              <p className="text-sm text-on-surface leading-snug font-medium mt-0.5">
                                {selectedIssueDetail?.description ||
                                  "Awaiting detailed log..."}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-lg text-primary mt-1">
                              location_on
                            </span>
                            <div className="flex-1">
                              <p className="text-[10px] font-black text-outline uppercase tracking-wider">
                                Precise Location
                              </p>
                              <p className="text-sm text-on-surface font-medium mt-0.5">
                                {selectedIssueDetail?.location ||
                                  "Scanning coordinates..."}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-lg text-primary mt-1">
                              schedule
                            </span>
                            <div className="flex-1">
                              <p className="text-[10px] font-black text-outline uppercase tracking-wider">
                                Report Timeline
                              </p>
                              <p className="text-sm text-on-surface font-medium mt-0.5">
                                {selectedIssue.stages?.replaceAll("_", " ")}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Hotspots Feed */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-xl">
                          fire_hydrant
                        </span>
                        <h3 className="font-black text-primary uppercase text-[11px] tracking-widest">
                          Density Anomalies
                        </h3>
                      </div>
                      <span className="text-[10px] font-black text-outline bg-surface-container-low px-2 py-0.5 rounded-md">
                        {hotspots.length} Zones detected
                      </span>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1 no-scrollbar scroll-smooth">
                      {hotspots.map((spot, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-4 p-3 rounded-2xl bg-white border border-outline-variant/5 shadow-sm hover:border-primary/30 transition-all cursor-pointer group"
                        >
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-md transition-transform group-hover:scale-105 ${
                              spot.severity === "CRITICAL"
                                ? "bg-red-600 shadow-red-200"
                                : spot.severity === "HIGH"
                                  ? "bg-red-500 shadow-red-100"
                                  : spot.severity === "MODERATE"
                                    ? "bg-amber-500 shadow-amber-100"
                                    : "bg-green-500 shadow-green-100"
                            }`}
                          >
                            {spot.count}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-primary truncate leading-tight">
                              Clustered Activity
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] font-black text-outline uppercase tracking-wider">
                                {spot.severity} RISK
                              </span>
                              <div className="w-1 h-1 rounded-full bg-outline-variant" />
                              <span className="text-[9px] font-bold text-outline uppercase tracking-wider">
                                {spot.count} REPORTS
                              </span>
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-outline/30 group-hover:text-primary transition-colors text-lg">
                            arrow_forward
                          </span>
                        </div>
                      ))}
                      {hotspots.length === 0 && (
                        <div className="py-8 text-center bg-surface-container-low/30 rounded-2xl border border-dashed border-outline-variant/20 italic text-outline text-xs">
                          No geographic clusters identified in current selection
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </aside>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
