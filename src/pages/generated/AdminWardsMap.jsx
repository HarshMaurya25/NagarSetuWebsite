import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  getAdminMapIssues,
  getAdminMatrixSlaBreaches,
  getAdminMatrixStages,
  getAdminWards,
  getIssueDetail,
  getWardDetail,
} from "../../services/api";

function extractFeatureCollection(raw) {
  if (!raw) return null;
  if (raw?.type === "FeatureCollection" && Array.isArray(raw.features)) {
    return raw;
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return extractFeatureCollection(parsed);
    } catch {
      return null;
    }
  }

  if (typeof raw === "object") {
    const values = Object.values(raw);
    for (const value of values) {
      const fc = extractFeatureCollection(value);
      if (fc) return fc;
    }
  }

  return null;
}

function safeParseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function wardFromFeatureProps(props, wards) {
  if (!props) return null;
  const wardId = props.wardId || props.id;
  const wardName = props.wardName || props.name;
  if (wardId) {
    const hit = wards.find((w) => (w.wardId || w.id) === wardId);
    if (hit) return hit;
  }
  if (wardName) {
    const hit = wards.find((w) => (w.wardName || w.name) === wardName);
    if (hit) return hit;
  }
  return {
    wardId,
    wardName,
    name: wardName,
    region: props.region,
    supervisorId: props.supervisorId,
    supervisorName: props.supervisorName,
  };
}

function markerColor(criticality) {
  if (criticality === "HIGH") return "#dc2626";
  if (criticality === "MEDIUM") return "#f59e0b";
  return "#22c55e";
}

/* Hotspot color config matching the app's style */
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

function hotspotKey(issue) {
  return `${Number(issue.latitude).toFixed(2)}:${Number(issue.longitude).toFixed(2)}`;
}

function criticalityRank(value) {
  if (value === "HIGH") return 3;
  if (value === "MEDIUM") return 2;
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
        style={{ fontFamily: "inherit" }}
      >
        {children}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="text-outline"
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

export default function AdminWardsMap() {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapNodeRef = useRef(null);
  const issueLayerRef = useRef(null);
  const wardLayerRef = useRef(null);
  const hotspotLayerRef = useRef(null);

  const [wards, setWards] = useState([]);
  const [wardGeoJson, setWardGeoJson] = useState(null);
  const [issues, setIssues] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [selectedIssueDetail, setSelectedIssueDetail] = useState(null);
  const [selectedWard, setSelectedWard] = useState(null);
  const [selectedWardDetail, setSelectedWardDetail] = useState(null);
  const [wardStageMatrix, setWardStageMatrix] = useState([]);
  const [wardSlaBreaches, setWardSlaBreaches] = useState([]);
  const [wardAnalyticsLoading, setWardAnalyticsLoading] = useState(false);

  const [criticalityFilter, setCriticalityFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("criticality");
  const [hotspotOnly, setHotspotOnly] = useState(false);
  const [showWards, setShowWards] = useState(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [wardData, mapIssues] = await Promise.all([
          getAdminWards(),
          getAdminMapIssues().catch(() => []),
        ]);
        if (mounted) {
          setWards(wardData.wards || []);
          setWardGeoJson(extractFeatureCollection(wardData.geojson));
          setIssues(mapIssues || []);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || "Failed to load admin map data.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const hotspotCountMap = useMemo(() => {
    return issues.reduce((acc, issue) => {
      const key = hotspotKey(issue);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [issues]);

  const hotspots = useMemo(() => {
    return Object.entries(hotspotCountMap)
      .filter(([, count]) => count >= 2)
      .map(([key, count]) => ({ key, count }))
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
        if (sortBy === "criticality")
          return (
            criticalityRank(b.criticality) - criticalityRank(a.criticality)
          );
        if (sortBy === "issueType")
          return (a.issueType || "").localeCompare(b.issueType || "");
        if (sortBy === "hotspot")
          return (
            (hotspotCountMap[hotspotKey(b)] || 0) -
            (hotspotCountMap[hotspotKey(a)] || 0)
          );
        return 0;
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

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;

    mapRef.current = L.map(mapNodeRef.current, {
      zoomControl: false,
    }).setView([28.6139, 77.209], 11);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(mapRef.current);

    // Add zoom control to bottom-right
    L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);

    // Try user geolocation for city-level view
    if (navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!mapRef.current) return;
          const { latitude: lat, longitude: lng } = pos.coords;
          if (typeof lat === "number" && typeof lng === "number") {
            mapRef.current.setView([lat, lng], 11);
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 60_000, timeout: 5_000 },
      );
    }

    // Invalidate size with multiple delays to handle layout timing
    setTimeout(() => mapRef.current?.invalidateSize(), 100);
    setTimeout(() => mapRef.current?.invalidateSize(), 500);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [loading]);

  // Issue markers
  useEffect(() => {
    if (!mapRef.current) return;

    issueLayerRef.current?.remove();
    issueLayerRef.current = L.layerGroup();

    filteredIssues.forEach((issue) => {
      const color = markerColor(issue.criticality);

      // Create custom div icon marker (cross/plus style like the app)
      const icon = L.divIcon({
        className: "custom-issue-marker",
        html: `<div style="
          width: 22px; height: 22px; border-radius: 50%;
          background: ${color}; border: 2px solid rgba(255,255,255,0.9);
          box-shadow: 0 2px 6px ${color}66;
          display: flex; align-items: center; justify-content: center;
        ">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1V9M1 5H9" stroke="white" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([issue.latitude, issue.longitude], { icon });

      marker.bindPopup(
        `<strong>${issue.issueType}</strong><br/>${issue.criticality}<br/>${(issue.stages || "").replaceAll("_", " ")}`,
      );

      marker.on("click", async () => {
        setSelectedIssue(issue);
        try {
          const detail = await getIssueDetail(issue.id);
          setSelectedIssueDetail(detail);
        } catch {
          setSelectedIssueDetail(null);
        }
      });

      issueLayerRef.current.addLayer(marker);
    });

    issueLayerRef.current.addTo(mapRef.current);

    if (filteredIssues.length) {
      const bounds = L.latLngBounds(
        filteredIssues.map((issue) => [issue.latitude, issue.longitude]),
      );
      mapRef.current.fitBounds(bounds.pad(0.2));
    }
  }, [filteredIssues]);

  // Hotspot radial circles (matching app style)
  useEffect(() => {
    if (!mapRef.current) return;

    hotspotLayerRef.current?.remove();
    hotspotLayerRef.current = L.layerGroup();

    hotspotCenters.forEach((spot) => {
      const config = HOTSPOT_CONFIG[spot.severity];
      const radius = Math.min(300 + spot.count * 80, 800);

      // Outer glow circle
      L.circle([spot.lat, spot.lng], {
        radius: radius,
        fillColor: config.fill.replace(/[\d.]+\)$/, "0.12)"),
        fillOpacity: 1,
        color: config.stroke.replace(/[\d.]+\)$/, "0.2)"),
        weight: 0,
      }).addTo(hotspotLayerRef.current);

      // Main hotspot circle
      L.circle([spot.lat, spot.lng], {
        radius: radius * 0.7,
        fillColor: config.fill,
        fillOpacity: 1,
        color: config.stroke,
        weight: 2,
        dashArray: null,
      }).addTo(hotspotLayerRef.current);

      // Center count label
      const labelIcon = L.divIcon({
        className: "hotspot-count-label",
        html: `<div style="
          width: 36px; height: 36px; border-radius: 50%;
          background: ${config.center}; border: 3px solid rgba(255,255,255,0.9);
          color: ${config.label}; font-size: 13px; font-weight: 900;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 3px 12px ${config.center}80;
          font-family: inherit;
        ">
          <div style="display:flex;flex-direction:column;align-items:center;line-height:1;">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style="margin-bottom:1px;">
              <path d="M5 0L6 3.5H10L7 5.5L8 9L5 7L2 9L3 5.5L0 3.5H4Z" fill="white" opacity="0.9"/>
            </svg>
            <span>${spot.count}</span>
          </div>
        </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      L.marker([spot.lat, spot.lng], {
        icon: labelIcon,
        interactive: false,
      }).addTo(hotspotLayerRef.current);
    });

    hotspotLayerRef.current.addTo(mapRef.current);
  }, [hotspotCenters]);

  // Ward polygons
  useEffect(() => {
    if (!mapRef.current) return;

    wardLayerRef.current?.remove();

    if (!showWards) {
      wardLayerRef.current = L.layerGroup().addTo(mapRef.current);
      return;
    }

    // Prefer the official GeoJSON export endpoint.
    if (wardGeoJson) {
      wardLayerRef.current = L.geoJSON(wardGeoJson, {
        style: {
          color: "#1d4ed8",
          weight: 2,
          fillOpacity: 0.12,
        },
        onEachFeature: (feature, layer) => {
          const ward = wardFromFeatureProps(feature?.properties, wards);
          const name = ward?.wardName || ward?.name || "Ward";
          const region = ward?.region || "Unknown region";
          const supervisor =
            ward?.supervisorName ||
            ward?.supervisor?.user?.fullName ||
            "Unassigned";

          layer.bindPopup(
            `<strong>${name}</strong><br/>${region}<br/>${supervisor}`,
          );

          layer.on("click", async () => {
            if (!ward) return;
            setSelectedWard(ward);
            setWardStageMatrix([]);
            setWardSlaBreaches([]);
            setWardAnalyticsLoading(true);

            const wardId = ward.wardId || ward.id;

            try {
              const [detail, stages, sla] = await Promise.all([
                getWardDetail(wardId, ward.wardName || ward.name).catch(
                  () => null,
                ),
                getAdminMatrixStages({ days: 7, wardId }).catch(() => []),
                getAdminMatrixSlaBreaches({ days: 30, wardId }).catch(
                  () => null,
                ),
              ]);

              setSelectedWardDetail(detail);
              setWardStageMatrix(Array.isArray(stages) ? stages : []);

              const breaches = Array.isArray(sla)
                ? sla
                : Array.isArray(sla?.issues)
                  ? sla.issues
                  : Array.isArray(sla?.items)
                    ? sla.items
                    : [];
              setWardSlaBreaches(breaches);
            } catch {
              setSelectedWardDetail(null);
              setWardStageMatrix([]);
              setWardSlaBreaches([]);
            } finally {
              setWardAnalyticsLoading(false);
            }
          });
        },
      }).addTo(mapRef.current);

      return;
    }

    // Fallback: try parsing `boundary` if backend sends JSON strings.
    wardLayerRef.current = L.layerGroup();
    wards.forEach((ward) => {
      const parsed = safeParseJson(ward.boundary);
      const geometry =
        parsed?.type === "Feature"
          ? parsed
          : parsed?.type
            ? { type: "Feature", properties: {}, geometry: parsed }
            : null;
      if (!geometry) return;

      const geo = L.geoJSON(geometry, {
        style: {
          color: "#1d4ed8",
          weight: 2,
          fillOpacity: 0.12,
        },
      });

      geo.eachLayer((layer) => {
        layer.bindPopup(
          `<strong>${ward.wardName || ward.name || "Ward"}</strong><br/>${ward.region || "Unknown region"}<br/>${ward.supervisorName || "Unassigned"}`,
        );
        layer.on("click", async () => {
          setSelectedWard(ward);
          setWardStageMatrix([]);
          setWardSlaBreaches([]);
          setWardAnalyticsLoading(true);

          const wardId = ward.wardId || ward.id;

          try {
            const [detail, stages, sla] = await Promise.all([
              getWardDetail(wardId, ward.wardName || ward.name).catch(
                () => null,
              ),
              getAdminMatrixStages({ days: 7, wardId }).catch(() => []),
              getAdminMatrixSlaBreaches({ days: 30, wardId }).catch(() => null),
            ]);

            setSelectedWardDetail(detail);
            setWardStageMatrix(Array.isArray(stages) ? stages : []);

            const breaches = Array.isArray(sla)
              ? sla
              : Array.isArray(sla?.issues)
                ? sla.issues
                : Array.isArray(sla?.items)
                  ? sla.items
                  : [];
            setWardSlaBreaches(breaches);
          } catch {
            setSelectedWardDetail(null);
            setWardStageMatrix([]);
            setWardSlaBreaches([]);
          } finally {
            setWardAnalyticsLoading(false);
          }
        });
      });

      wardLayerRef.current.addLayer(geo);
    });

    wardLayerRef.current.addTo(mapRef.current);
  }, [wards, wardGeoJson, showWards]);

  const criticalCount = useMemo(
    () => issues.filter((i) => i.criticality === "HIGH").length,
    [issues],
  );
  const moderateCount = useMemo(
    () => issues.filter((i) => i.criticality === "MEDIUM").length,
    [issues],
  );
  const lowCount = useMemo(
    () => issues.filter((i) => i.criticality === "LOW").length,
    [issues],
  );

  return (
    <div className="pt-24 px-8 pb-12 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-primary">
            Admin Ward Intelligence Map
          </h1>
          <p className="text-sm text-outline mt-1">
            Real-time overview of civic issues across all wards
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/15">
          <span className="text-sm font-bold text-on-surface">
            {issues.length}
          </span>
          <span className="text-xs text-outline">Total Issues</span>
        </div>
      </div>

      {loading && (
        <p className="text-on-surface-variant animate-pulse">
          Loading map data...
        </p>
      )}
      {error && <p className="text-error font-semibold">{error}</p>}

      {!loading && !error && (
        <>
          {/* Filter Bar */}
          <section className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/10">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase text-outline tracking-widest">
                Filters
              </span>
              <div className="flex-1 h-px bg-outline-variant/15" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <StyledSelect
                value={criticalityFilter}
                onChange={(e) => setCriticalityFilter(e.target.value)}
                icon="⚡"
              >
                <option value="ALL">All Criticality</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </StyledSelect>
              <StyledSelect
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                icon="📋"
              >
                <option value="ALL">All Issue Types</option>
                <option value="POTHOLE">Pothole</option>
                <option value="DRAINAGE_SEWER">Drainage / Sewer</option>
                <option value="WASTE_MANAGEMENT">Waste Management</option>
                <option value="INFRASTRUCTURE">Infrastructure</option>
                <option value="ENCROACHMENT">Encroachment</option>
                <option value="OTHER">Other</option>
              </StyledSelect>
              <StyledSelect
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                icon="📊"
              >
                <option value="ALL">All Stages</option>
                <option value="PENDING">Pending</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="TEAM_ASSIGNED">Team Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="RECONSIDERED">Reconsidered</option>
              </StyledSelect>
              <StyledSelect
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                icon="↕️"
              >
                <option value="criticality">Sort: Criticality</option>
                <option value="issueType">Sort: Issue Type</option>
                <option value="hotspot">Sort: Hotspot Density</option>
              </StyledSelect>
              <div className="flex gap-2">
                <button
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    hotspotOnly
                      ? "bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/20"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/20"
                  }`}
                  onClick={() => setHotspotOnly((v) => !v)}
                >
                  <span>🔥</span>
                  <span>Hotspots</span>
                  {hotspotOnly && (
                    <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-md">
                      {hotspots.length}
                    </span>
                  )}
                </button>
                <button
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                    showWards
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/20"
                  }`}
                  onClick={() => setShowWards((value) => !value)}
                  title={
                    showWards ? "Hide ward boundaries" : "Show ward boundaries"
                  }
                >
                  <span>🗺️</span>
                </button>
              </div>
            </div>
          </section>

          {/* Stats Strip */}
          <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-black text-sm">
                  {filteredIssues.length}
                </span>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-outline tracking-widest">
                  Visible
                </p>
                <p className="text-sm font-bold">Issues</p>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-black text-sm">
                  {wards.length}
                </span>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-outline tracking-widest">
                  Active
                </p>
                <p className="text-sm font-bold">Wards</p>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <span className="text-red-600 font-black text-sm">
                  {criticalCount}
                </span>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-outline tracking-widest">
                  Critical
                </p>
                <p className="text-sm font-bold text-red-600">High Priority</p>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-600 font-black text-sm">
                  {moderateCount}
                </span>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-outline tracking-widest">
                  Medium
                </p>
                <p className="text-sm font-bold text-amber-600">Moderate</p>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 font-black text-sm">
                  {lowCount}
                </span>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-outline tracking-widest">
                  Low
                </p>
                <p className="text-sm font-bold text-green-600">Priority</p>
              </div>
            </div>
          </section>

          {/* Criticality Legend */}
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="text-outline">Legend:</span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-600 inline-block border border-white shadow-sm" />{" "}
              Critical
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block border border-white shadow-sm" />{" "}
              High
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block border border-white shadow-sm" />{" "}
              Moderate
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block border border-white shadow-sm" />{" "}
              Low
            </span>
          </div>

          {/* Map + Sidebar */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <article className="lg:col-span-2 bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/10">
              <div ref={mapNodeRef} className="h-[600px]" />
            </article>

            <article className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden flex flex-col">
              {/* Sidebar Header */}
              <div className="px-5 py-4 border-b border-outline-variant/10 bg-gradient-to-r from-primary/5 to-transparent">
                <h2 className="font-bold text-sm">Intelligence Panel</h2>
                <p className="text-[10px] text-outline mt-0.5">
                  Click map elements for details
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Ward Detail */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-primary text-xs">🏘</span>
                    </div>
                    <h3 className="font-bold text-sm">Ward Detail</h3>
                  </div>
                  {!selectedWard ? (
                    <div className="rounded-xl border border-dashed border-outline-variant/25 p-4 text-center">
                      <p className="text-xs text-outline">
                        Click a ward polygon to inspect details
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-surface-container-low p-4 space-y-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-black text-xs">
                            {
                              (selectedWard.wardName ||
                                selectedWard.name ||
                                "W")[0]
                            }
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-sm">
                            {selectedWard.wardName ||
                              selectedWard.name ||
                              "N/A"}
                          </p>
                          <p className="text-[10px] text-outline">
                            {selectedWard.region || "Unknown region"}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs space-y-1.5 pt-1">
                        <div className="flex justify-between">
                          <span className="text-outline">Supervisor</span>
                          <span className="font-semibold">
                            {selectedWard.supervisorName ||
                              selectedWard.supervisor?.user?.fullName ||
                              "Unassigned"}
                          </span>
                        </div>
                        {selectedWardDetail && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-outline">Workers</span>
                              <span className="font-semibold">
                                {selectedWardDetail.workerCount ?? "N/A"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-outline">Open Issues</span>
                              <span className="font-semibold text-red-600">
                                {selectedWardDetail.unfinishedIssueCount ??
                                  "N/A"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-outline">Sup. Email</span>
                              <span className="font-semibold text-[10px] break-all">
                                {selectedWardDetail.supervisorEmail || "N/A"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-outline">Sup. Phone</span>
                              <span className="font-semibold">
                                {selectedWardDetail.supervisorPhoneNumber ||
                                  "N/A"}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="pt-3 space-y-3">
                        <div>
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] uppercase font-bold text-outline tracking-widest">
                              Stage Breakdown (7d)
                            </p>
                            {wardAnalyticsLoading && (
                              <span className="text-[10px] text-outline">
                                Loading…
                              </span>
                            )}
                          </div>
                          {wardStageMatrix.length ? (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              {wardStageMatrix.map((row) => (
                                <div
                                  key={row.stage}
                                  className="rounded-lg bg-surface-container-lowest border border-outline-variant/10 px-2 py-1.5 flex items-center justify-between"
                                >
                                  <span className="text-[10px] font-bold text-outline uppercase">
                                    {(row.stage || "").replaceAll("_", " ")}
                                  </span>
                                  <span className="text-xs font-black">
                                    {row.count ?? 0}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-outline mt-2">
                              No stage data.
                            </p>
                          )}
                        </div>

                        <div>
                          <p className="text-[10px] uppercase font-bold text-outline tracking-widest">
                            SLA Breaches (30d)
                          </p>
                          <p className="text-xs mt-1">
                            <span className="font-black text-error">
                              {wardSlaBreaches.length}
                            </span>{" "}
                            issues overdue
                          </p>
                          {wardSlaBreaches.length ? (
                            <ul className="mt-2 space-y-1">
                              {wardSlaBreaches.slice(0, 3).map((row, idx) => (
                                <li
                                  key={
                                    row.id || row.issueId || row.title || idx
                                  }
                                  className="text-[11px] text-outline"
                                >
                                  {String(
                                    row.title ||
                                      `Issue ${row.issueId || row.id || ""}`,
                                  ).slice(0, 80)}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[11px] text-outline mt-1">
                              None found.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-px bg-outline-variant/15" />

                {/* Issue Detail */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-secondary/10 flex items-center justify-center">
                      <span className="text-secondary text-xs">📍</span>
                    </div>
                    <h3 className="font-bold text-sm">Issue Detail</h3>
                  </div>
                  {!selectedIssue ? (
                    <div className="rounded-xl border border-dashed border-outline-variant/25 p-4 text-center">
                      <p className="text-xs text-outline">
                        Click a marker to inspect issue details
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-surface-container-low p-4 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${selectedIssue.criticality === "HIGH" ? "bg-red-500" : selectedIssue.criticality === "MEDIUM" ? "bg-amber-500" : "bg-green-500"}`}
                        />
                        <p className="font-bold text-sm">
                          {(selectedIssue.issueType || "").replaceAll("_", " ")}
                        </p>
                      </div>
                      <div className="text-xs space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-outline">Criticality</span>
                          <span
                            className={`font-bold ${selectedIssue.criticality === "HIGH" ? "text-red-600" : selectedIssue.criticality === "MEDIUM" ? "text-amber-600" : "text-green-600"}`}
                          >
                            {selectedIssue.criticality}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-outline">Stage</span>
                          <span className="font-semibold">
                            {(selectedIssue.stages || "").replaceAll("_", " ")}
                          </span>
                        </div>
                        {selectedIssueDetail && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-outline">Title</span>
                              <span className="font-semibold text-right max-w-[150px] truncate">
                                {selectedIssueDetail.title || "N/A"}
                              </span>
                            </div>
                            <div>
                              <span className="text-outline">Location</span>
                              <p className="font-semibold mt-0.5">
                                {selectedIssueDetail.location || "N/A"}
                              </p>
                            </div>
                            {selectedIssueDetail.description && (
                              <div>
                                <span className="text-outline">
                                  Description
                                </span>
                                <p className="font-semibold mt-0.5 line-clamp-2">
                                  {selectedIssueDetail.description}
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <button
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-white text-xs font-bold hover:shadow-lg hover:shadow-primary/20 transition-all"
                        onClick={() =>
                          navigate(`/admin/issues/${selectedIssue.id}`)
                        }
                      >
                        View Full Detail →
                      </button>
                    </div>
                  )}
                </div>

                <div className="h-px bg-outline-variant/15" />

                {/* Hotspots Panel */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <span className="text-red-500 text-xs">🔥</span>
                      </div>
                      <h3 className="font-bold text-sm">Hotspots</h3>
                    </div>
                    {hotspotCenters.length > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 text-[10px] font-bold">
                        {hotspotCenters.length} zones
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 max-h-36 overflow-auto pr-1">
                    {hotspotCenters.map((spot) => {
                      const config = HOTSPOT_CONFIG[spot.severity];
                      return (
                        <div
                          key={spot.key}
                          className="rounded-xl border border-outline-variant/10 p-3 flex items-center gap-3 hover:bg-surface-container-low/60 transition-colors"
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{
                              background: config.center,
                              boxShadow: `0 2px 8px ${config.center}40`,
                            }}
                          >
                            <span className="text-white text-xs font-black">
                              {spot.count}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-xs">
                              {spot.count} issues clustered
                            </p>
                            <p className="text-[10px] text-outline">
                              Severity: {spot.severity}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {!hotspotCenters.length && (
                      <div className="rounded-xl border border-dashed border-outline-variant/25 p-4 text-center">
                        <p className="text-xs text-outline">
                          No hotspot clusters detected
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </article>
          </section>
        </>
      )}
    </div>
  );
}
