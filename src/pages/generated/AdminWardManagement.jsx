import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import {
  allocateWardToSupervisor,
  getAdminIssueMatrix,
  getAdminSupervisorDetail,
  getAdminWards,
  getAdminWorkforce,
  getWardDetail,
  getWardRecentIssues,
  uploadWardGeoJson,
  deleteWard,
  getAnalyticsTimeWise,
  getAnalyticsCritical,
  getAnalyticsYearGraph,
} from "../../services/api";
import { API_BASE_URL } from "../../config/env";

/* ───────── helpers ───────── */

function extractFeatureCollection(raw) {
  if (!raw) return null;
  if (raw?.type === "FeatureCollection" && Array.isArray(raw.features)) return raw;
  if (typeof raw === "string") {
    try { return extractFeatureCollection(JSON.parse(raw)); } catch { return null; }
  }
  if (typeof raw === "object") {
    for (const v of Object.values(raw)) { const fc = extractFeatureCollection(v); if (fc) return fc; }
  }
  return null;
}

function safeParseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try { return JSON.parse(value); } catch { return null; }
}

function pickWardFeature(fc, wardId, wardName) {
  if (!fc?.features?.length) return null;
  const wid = wardId != null ? String(wardId) : "";
  const wn = wardName != null ? String(wardName) : "";
  return fc.features.find((f) => {
    const p = f?.properties || {};
    if (wid && String(p.wardId ?? p.id ?? "") === wid) return true;
    if (wn && String(p.wardName ?? p.name ?? "") === wn) return true;
    return false;
  }) || null;
}

function normalizeWardId(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

const PIE_COLORS = ["#1d4ed8", "#f59e0b", "#16a34a"];

/* ───────── Sub-components ───────── */

function WardMiniMap({ feature }) {
  const nodeRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!nodeRef.current || mapRef.current) return;
    mapRef.current = L.map(nodeRef.current, { zoomControl: false, attributionControl: false }).setView([28.6139, 77.209], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(mapRef.current);
    setTimeout(() => mapRef.current?.invalidateSize(), 0);
    return () => { mapRef.current?.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    layerRef.current?.remove();
    layerRef.current = null;
    if (!feature) return;
    layerRef.current = L.geoJSON(feature, { style: { color: "#1d4ed8", weight: 2, fillOpacity: 0.18 } }).addTo(mapRef.current);
    try { mapRef.current.fitBounds(layerRef.current.getBounds().pad(0.35)); } catch { /* ignore */ }
  }, [feature]);

  return <div ref={nodeRef} className="h-56 rounded-xl" />;
}

/* Mini pie or placeholder */
function MiniPie({ title, data, hasData }) {
  if (!hasData) {
    return (
      <div className="bg-surface-container-low rounded-xl p-4 flex flex-col items-center justify-center min-h-[220px]">
        <p className="text-[10px] uppercase font-bold text-outline tracking-widest mb-3">{title}</p>
        <div className="w-28 h-28 rounded-full border-[6px] border-outline-variant/20 flex items-center justify-center">
          <span className="text-xs font-bold text-outline">No Data</span>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-surface-container-low rounded-xl p-4 min-h-[220px]">
      <p className="text-[10px] uppercase font-bold text-outline tracking-widest mb-2 text-center">{title}</p>
      <ResponsiveContainer width="100%" height={170}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={60} innerRadius={28} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
            {data.map((e, i) => <Cell key={e.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/* Backdrop overlay */
function Overlay({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 animate-[fadeInUp_0.25s_ease-out]">
        {children}
      </div>
    </div>
  );
}

/* ───────── MAIN COMPONENT ───────── */

function formatDate(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return String(value);
  }
}

export default function AdminWardManagement() {
  const navigate = useNavigate();
  // ── Data state
  const [wards, setWards] = useState([]);
  const [wardBoundaryGeoJson, setWardBoundaryGeoJson] = useState(null);
  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ── View state: "overview" | "add" | "detail"
  const [view, setView] = useState("overview");

  // ── Selected ward
  const [selectedWardId, setSelectedWardId] = useState("");
  const [selectedWardName, setSelectedWardName] = useState("");
  const [wardDetail, setWardDetail] = useState(null);
  const [wardMatrix, setWardMatrix] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [wardRecentIssues, setWardRecentIssues] = useState([]);

  const [wardTimeWise, setWardTimeWise] = useState([]);
  const [wardCritical, setWardCritical] = useState([]);
  const [wardYearGraph, setWardYearGraph] = useState([]);

  // ── Create ward
  const [wardNameInput, setWardNameInput] = useState("");
  const [wardRegionInput, setWardRegionInput] = useState("");
  const [createSupervisorId, setCreateSupervisorId] = useState("");
  const [drawnGeoJson, setDrawnGeoJson] = useState(null);
  const [createTab, setCreateTab] = useState("draw"); // "draw" | "upload"
  const [jsonFileName, setJsonFileName] = useState("");
  const [jsonFileContent, setJsonFileContent] = useState(null);
  const [uploadingJson, setUploadingJson] = useState(false);

  // ── Modals
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supervisorModalLoading, setSupervisorModalLoading] = useState(false);
  const [deletingWard, setDeletingWard] = useState(false);

  // ── Map refs
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const drawLayerRef = useRef(null);
  const drawControlRef = useRef(null);
  const wardOverlayRef = useRef(null);
  const hasInitialCenterRef = useRef(false);
  const mapInitializedRef = useRef(false);

  /* ── Load data ── */
  const load = useCallback(async (options = {}) => {
    const { focusWardId = "", fitAll = false } = options;
    setLoading(true);
    setError("");
    try {
      const [wardData, workforce] = await Promise.all([
        getAdminWards(),
        getAdminWorkforce(),
      ]);
      const nextWards = wardData.wards || [];
      const nextGeoJson = extractFeatureCollection(wardData.geojson);
      setWards(nextWards);
      setWardBoundaryGeoJson(nextGeoJson);
      setSupervisors(workforce.supervisors || []);

      if (mapRef.current && nextGeoJson) {
        const normalizedFocusId = normalizeWardId(focusWardId);
        let targetFeature = null;
        if (normalizedFocusId) {
          targetFeature = pickWardFeature(nextGeoJson, normalizedFocusId, "");
        }

        try {
          if (targetFeature) {
            const bounds = L.geoJSON(targetFeature).getBounds();
            mapRef.current.fitBounds(bounds.pad(0.2));
          } else if (fitAll) {
            const bounds = L.geoJSON(nextGeoJson).getBounds();
            mapRef.current.fitBounds(bounds.pad(0.2));
          }
        } catch {
          // ignore map fit errors
        }
      }
    } catch (err) {
      setError(err.message || "Failed to load ward data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Init map ONCE ── */
  const initMap = useCallback(() => {
    if (!mapNodeRef.current || mapInitializedRef.current) return;
    mapInitializedRef.current = true;

    mapRef.current = L.map(mapNodeRef.current).setView([28.6139, 77.209], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors", maxZoom: 19,
    }).addTo(mapRef.current);

    drawLayerRef.current = new L.FeatureGroup().addTo(mapRef.current);

    drawControlRef.current = new L.Control.Draw({
      draw: { polygon: true, rectangle: true, circle: false, marker: false, polyline: false, circlemarker: false },
      edit: { featureGroup: drawLayerRef.current },
    });

    mapRef.current.on(L.Draw.Event.CREATED, (e) => {
      drawLayerRef.current.clearLayers();
      drawLayerRef.current.addLayer(e.layer);
      setDrawnGeoJson(e.layer.toGeoJSON());
    });

    // Try user geolocation
    if (navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!mapRef.current || hasInitialCenterRef.current) return;
          const { latitude: lat, longitude: lng } = pos.coords;
          if (typeof lat === "number" && typeof lng === "number") {
            hasInitialCenterRef.current = true;
            mapRef.current.setView([lat, lng], 11);
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 60_000, timeout: 5_000 },
      );
    }

    setTimeout(() => mapRef.current?.invalidateSize(), 100);
  }, []);

  // Ref callback ensures map inits as soon as the DOM node exists
  const mapRefCallback = useCallback((node) => {
    mapNodeRef.current = node;
    if (node) {
      // Small delay to ensure DOM is painted
      requestAnimationFrame(() => {
        if (!mapInitializedRef.current) {
          initMap();
        } else if (mapRef.current) {
          // Map already exists, just invalidate size
          setTimeout(() => mapRef.current?.invalidateSize(), 50);
        } else {
          // Map was somehow destroyed, re-init
          mapInitializedRef.current = false;
          initMap();
        }
      });
    }
  }, [initMap]);

  /* ── Draw control toggle ── */
  useEffect(() => {
    if (!mapRef.current || !drawControlRef.current) return;
    const map = mapRef.current;
    const dc = drawControlRef.current;
    if (view === "add") {
      try { map.addControl(dc); } catch { /* already added */ }
    } else {
      try { map.removeControl(dc); } catch { /* not added */ }
      setDrawnGeoJson(null);
      drawLayerRef.current?.clearLayers();
    }
  }, [view]);

  /* ── Ward overlay on map ── */
  useEffect(() => {
    if (!mapRef.current) return;
    wardOverlayRef.current?.remove();
    wardOverlayRef.current = null;

    if (wardBoundaryGeoJson) {
      wardOverlayRef.current = L.geoJSON(wardBoundaryGeoJson, {
        style: { color: "#1d4ed8", weight: 2, fillOpacity: 0.12 },
        onEachFeature: (feature, layer) => {
          const props = feature?.properties || {};
          const wardId = props.wardId || props.id;
          const wName = props.wardName || props.name;
          const meta = wards.find((w) => (w.wardId || w.id) === wardId)
            || wards.find((w) => (w.wardName || w.name) === wName)
            || null;
          const name = meta?.wardName || meta?.name || wName || "Ward";
          const region = meta?.region || props.region || "Unknown";
          const supervisor = meta?.supervisorName || props.supervisorName || "Unassigned";

          layer.bindPopup(`<strong>${name}</strong><br/>${region}<br/>${supervisor}`);
          layer.on("click", () => {
            const eid = meta?.wardId || meta?.id || wardId || "";
            const ename = meta?.wardName || meta?.name || wName || "";
            selectWard(String(eid), String(ename));
          });
        },
      }).addTo(mapRef.current);

      if (!hasInitialCenterRef.current) {
        try { mapRef.current.fitBounds(wardOverlayRef.current.getBounds().pad(0.2)); } catch { /* ignore */ }
      }
      return;
    }

    // Fallback: parse boundary strings
    const group = L.layerGroup();
    wards.forEach((ward) => {
      const parsed = safeParseJson(ward.boundary);
      const geometry = parsed?.type === "Feature" ? parsed
        : parsed?.type ? { type: "Feature", properties: {}, geometry: parsed } : null;
      if (!geometry) return;
      const geo = L.geoJSON(geometry, { style: { color: "#1d4ed8", weight: 2, fillOpacity: 0.12 } });
      geo.eachLayer((layer) => {
        layer.bindPopup(`<strong>${ward.wardName || ward.name || "Ward"}</strong><br/>${ward.region || "Unknown"}<br/>${ward.supervisorName || "Unassigned"}`);
        layer.on("click", () => selectWard(ward.wardId || ward.id || "", ward.wardName || ward.name || ""));
      });
      group.addLayer(geo);
    });
    group.addTo(mapRef.current);
    wardOverlayRef.current = group;
    if (!hasInitialCenterRef.current) {
      try { mapRef.current.fitBounds(group.getBounds().pad(0.2)); } catch { /* ignore */ }
    }
  }, [wards, wardBoundaryGeoJson]);

  /* ── Invalidate on view changes ── */
  useEffect(() => {
    if (view !== "detail") {
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 100);
    }
  }, [view]);

  /* ── Computed ── */
  const selectedWardMeta = useMemo(() => {
    if (!selectedWardId && !selectedWardName) return null;
    return wards.find((w) => String(w.wardId || w.id || "") === String(selectedWardId))
      || wards.find((w) => String(w.wardName || w.name || "") === String(selectedWardName))
      || null;
  }, [wards, selectedWardId, selectedWardName]);

  const selectedWardFeature = useMemo(() => {
    if (!wardBoundaryGeoJson) return null;
    return pickWardFeature(wardBoundaryGeoJson, selectedWardId, selectedWardName);
  }, [wardBoundaryGeoJson, selectedWardId, selectedWardName]);

  const assignedWardCount = useMemo(() => wards.filter((w) => w.supervisorId || w.supervisorName).length, [wards]);

  const makePieData = (bucket) => {
    if (!bucket) return [];
    return [
      { name: "Reported", value: bucket.reported ?? 0 },
      { name: "In Progress", value: bucket.inBetween ?? 0 },
      { name: "Solved", value: bucket.solved ?? 0 },
    ];
  };

  const dailyPie = useMemo(() => makePieData(wardMatrix?.daily), [wardMatrix]);
  const weeklyPie = useMemo(() => makePieData(wardMatrix?.weekly), [wardMatrix]);
  const monthlyPie = useMemo(() => makePieData(wardMatrix?.monthly), [wardMatrix]);
  const hasDailyData = dailyPie.some((d) => d.value > 0);
  const hasWeeklyData = weeklyPie.some((d) => d.value > 0);
  const hasMonthlyData = monthlyPie.some((d) => d.value > 0);

  /* Supervisor list enriched with ward assignment status */
  const supervisorsWithStatus = useMemo(() => {
    return (supervisors || []).map((sup) => {
      const assignedWard = wards.find((w) => String(w.supervisorId) === String(sup.id));
      return {
        ...sup,
        assignedWardName: assignedWard?.wardName || assignedWard?.name || null,
        isAssigned: !!assignedWard,
      };
    });
  }, [supervisors, wards]);

  /* ── Actions ── */
  const selectWard = async (wardId, wardName) => {
    setSelectedWardId(wardId);
    setSelectedWardName(wardName);
    setMessage("");
    setWardMatrix(null);
    setWardDetail(null);
    setWardRecentIssues([]);

    // Guard: backend requires at least one of wardId or wardName
    const normalizedWardId = normalizeWardId(wardId);
    const normalizedWardName = String(wardName || "").trim();
    const hasWardId = !!normalizedWardId;
    const hasWardName = !!normalizedWardName;

    try {
      const [detail, matrix, recentIssues, timeWise, critical, yearGraph] = await Promise.all([
        (hasWardId || hasWardName)
          ? getWardDetail(
              hasWardId ? normalizedWardId : undefined,
              hasWardId ? undefined : normalizedWardName,
            ).catch(() => null)
          : Promise.resolve(null),
        hasWardId
          ? getAdminIssueMatrix(normalizedWardId).catch(() => null)
          : Promise.resolve(null),
        hasWardId
          ? getWardRecentIssues(normalizedWardId).catch(() => [])
          : Promise.resolve([]),
        hasWardId
          ? getAnalyticsTimeWise(normalizedWardId).catch(() => [])
          : Promise.resolve([]),
        hasWardId
          ? getAnalyticsCritical(normalizedWardId).catch(() => [])
          : Promise.resolve([]),
        hasWardId
          ? getAnalyticsYearGraph(normalizedWardId).catch(() => [])
          : Promise.resolve([]),
      ]);
      setWardDetail(detail);
      setWardMatrix(matrix);
      setWardRecentIssues(recentIssues || []);
      setWardTimeWise(timeWise || []);
      setWardCritical(critical || []);
      setWardYearGraph(yearGraph || []);
    } catch {
      setWardDetail(null);
    }
  };

  const handleAssign = async (supervisorId) => {
    if (!selectedWardId || !supervisorId) return;
    setSupervisorModalLoading(true);
    try {
      await allocateWardToSupervisor(selectedWardId, supervisorId);
      setMessage("Supervisor assigned successfully.");
      setShowSupervisorModal(false);
      // Small delay to let backend propagate
      await new Promise((r) => setTimeout(r, 500));
      await load({ fitAll: true });
      // re-select to refresh detail
      await selectWard(selectedWardId, selectedWardName);
    } catch (err) {
      setMessage(err.message || "Failed to assign supervisor.");
    } finally {
      setSupervisorModalLoading(false);
    }
  };

  const handleDeleteWard = async () => {
    const name = selectedWardMeta?.wardName || selectedWardMeta?.name || selectedWardName;
    if (!name) return;
    setDeletingWard(true);
    try {
      await deleteWard(name);
      setMessage("Ward deleted successfully.");
      setShowDeleteModal(false);
      setSelectedWardId("");
      setSelectedWardName("");
      setWardDetail(null);
      setWardMatrix(null);
      setView("overview");
      await load({ fitAll: true });
      setTimeout(() => mapRef.current?.invalidateSize(), 120);
    } catch (err) {
      setMessage(err.message || "Failed to delete ward.");
    } finally {
      setDeletingWard(false);
    }
  };

  const handleCreateWard = async () => {
    if (!wardNameInput.trim() || !wardRegionInput.trim() || !drawnGeoJson) {
      setMessage("Ward name, region, and drawn area are required.");
      return;
    }
    const names = wards.map((w) => (w.wardName || w.name || "").toLowerCase());
    if (names.includes(wardNameInput.trim().toLowerCase())) {
      setMessage("Ward name must be unique.");
      return;
    }
    setMessage("");
    try {
      const effectiveName = wardNameInput.trim();
      const effectiveRegion = wardRegionInput.trim();
      const geometry = drawnGeoJson?.type === "Feature" ? drawnGeoJson.geometry : drawnGeoJson?.geometry || drawnGeoJson;
      const fc = {
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: { Ward: effectiveName, ward: effectiveName, name: effectiveName, Region: effectiveRegion, region: effectiveRegion },
          geometry,
        }],
      };
      await uploadWardGeoJson(fc);

      const refreshed = await getAdminWards().catch(() => null);
      const match = (refreshed?.wards || []).find(
        (w) =>
          (w.wardName || w.name || "").toLowerCase() ===
          effectiveName.toLowerCase(),
      );
      const createdWardId = String(match?.wardId || match?.id || "");
      if (createSupervisorId) {
        if (match?.wardId || match?.id) {
          await allocateWardToSupervisor(String(match.wardId || match.id), String(createSupervisorId));
        }
      }

      setMessage("Ward created successfully!");
      setWardNameInput("");
      setWardRegionInput("");
      setDrawnGeoJson(null);
      setCreateSupervisorId("");
      drawLayerRef.current?.clearLayers();
      // Refresh without unmounting map
      await load({ focusWardId: createdWardId, fitAll: !createdWardId });
      if (createdWardId) {
        await selectWard(createdWardId, effectiveName);
      }
    } catch (err) {
      setMessage(err.message || "Failed to create ward.");
    }
  };

  const handleJsonFile = async (file) => {
    if (!file) { setJsonFileName(""); setJsonFileContent(null); return; }
    setJsonFileName(file.name);
    try {
      const text = await file.text();
      const parsed = safeParseJson(text);
      if (!parsed) { setJsonFileContent(null); setMessage("Invalid JSON file."); return; }
      setJsonFileContent(parsed);
      setMessage("GeoJSON loaded. Click 'Upload & Create' to proceed.");
    } catch {
      setJsonFileContent(null);
      setMessage("Invalid JSON file.");
    }
  };

  const handleUploadGeoJson = async () => {
    if (!jsonFileContent) { setMessage("Please choose a GeoJSON file first."); return; }
    const fc = extractFeatureCollection(jsonFileContent);
    if (!fc) { setMessage("GeoJSON file must be a FeatureCollection."); return; }
    setUploadingJson(true);
    setMessage("");
    try {
      const normalized = {
        ...fc,
        features: fc.features.map((feature, index) => {
          const props = feature?.properties || {};
          const name = props.Ward || props.ward || props.wardName || props.name || props.ward_name
            || (wardNameInput.trim() ? `${wardNameInput.trim()} ${index + 1}` : `Ward ${index + 1}`);
          const region = props.Region || props.region || props.regionName || props.region_name || wardRegionInput.trim() || "Unknown";
          return {
            type: "Feature",
            properties: { ...props, Ward: String(name), ward: String(name), name: String(name), Region: String(region), region: String(region) },
            geometry: feature?.type === "Feature" ? feature.geometry : feature?.geometry,
          };
        }),
      };
      await uploadWardGeoJson(normalized);
      setMessage(`Uploaded ${fc.features.length} ward(s) successfully!`);
      setJsonFileName("");
      setJsonFileContent(null);
      await load({ fitAll: true });
      setView("overview");
    } catch (err) {
      setMessage(err.message || "Failed to upload GeoJSON.");
    } finally {
      setUploadingJson(false);
    }
  };

  /* ── RENDER ── */
  return (
    <div className="pt-24 px-8 pb-12 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-black text-primary">Ward Management</h1>
        {view !== "overview" && (
          <button
            type="button"
            className="px-5 py-2.5 rounded-xl bg-surface-container-high font-bold text-sm hover:bg-surface-container-highest transition-colors"
            onClick={() => { setView("overview"); setMessage(""); }}
          >
            ← Back
          </button>
        )}
      </div>

      {loading && <p className="text-on-surface-variant animate-pulse">Loading wards...</p>}
      {error && <p className="text-error font-semibold">{error}</p>}
      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-semibold ${message.includes("success") || message.includes("Successfully") || message.includes("loaded") ? "bg-green-50 text-green-700 border border-green-200" : "bg-primary/5 text-primary border border-primary/10"}`}>
          {message}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ══════ Stat cards (overview ONLY, not detail or add) ══════ */}
          {view === "overview" && (
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-surface-container-lowest rounded-xl p-5 border-l-4 border-primary">
                <p className="text-xs uppercase font-bold text-outline">Total Wards</p>
                <p className="text-3xl font-black">{wards.length}</p>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-5 border-l-4 border-secondary">
                <p className="text-xs uppercase font-bold text-outline">Assigned</p>
                <p className="text-3xl font-black">{assignedWardCount}</p>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-5 border-l-4 border-tertiary">
                <p className="text-xs uppercase font-bold text-outline">Unassigned</p>
                <p className="text-3xl font-black">{wards.length - assignedWardCount}</p>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-5 border-l-4 border-error">
                <p className="text-xs uppercase font-bold text-outline">Supervisors</p>
                <p className="text-3xl font-black">{supervisors.length}</p>
              </div>
            </section>
          )}

          {/* ══════ OVERVIEW / ADD — Map + Side Panel ══════ */}
          {(view === "overview" || view === "add") && (
            <>
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Map */}
                <article className="lg:col-span-2 bg-surface-container-lowest rounded-xl p-3">
                  <div ref={mapRefCallback} className="h-[560px] rounded-xl" />
                </article>

                {/* Side panel */}
                <article className="bg-surface-container-lowest rounded-xl flex flex-col min-h-[560px]">
                  {view === "overview" ? (
                    /* ── Overview panel ── */
                    <div className="flex flex-col h-full">
                      <div className="p-5 flex-1 space-y-4">
                        <h2 className="font-bold text-lg">Selected Ward</h2>

                        {selectedWardMeta || wardDetail ? (
                          <div className="space-y-3">
                            <div className="rounded-xl border border-outline-variant/15 p-4 space-y-2.5 bg-surface-container-low/50">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary" />
                                <span className="font-semibold text-sm">
                                  {selectedWardMeta?.wardName || selectedWardMeta?.name || selectedWardName}
                                </span>
                              </div>
                              <div className="text-sm text-on-surface-variant space-y-1.5">
                                <p><span className="font-medium text-outline">Region:</span> {wardDetail?.regionName || selectedWardMeta?.region || "N/A"}</p>
                                <p><span className="font-medium text-outline">Supervisor:</span> {wardDetail?.supervisorName || selectedWardMeta?.supervisorName || "Unassigned"}</p>
                                <p><span className="font-medium text-outline">Workers:</span> {wardDetail?.workerCount ?? "—"}</p>
                                <p><span className="font-medium text-outline">Open Issues:</span> {wardDetail?.unfinishedIssueCount ?? "—"}</p>
                              </div>
                            </div>

                            <button
                              type="button"
                              className="w-full bg-primary text-white rounded-xl px-4 py-2.5 font-bold text-sm hover:opacity-90 transition-opacity"
                              onClick={() => setView("detail")}
                            >
                              More Detail
                            </button>
                          </div>
                        ) : (
                          <p className="text-sm text-outline leading-relaxed">
                            Click a ward polygon on the map for details.
                          </p>
                        )}
                      </div>

                      {/* Footer — Add Ward always at bottom */}
                      <div className="p-5 pt-3 border-t border-outline-variant/10">
                        <button
                          type="button"
                          className="w-full bg-surface-container-high rounded-xl px-4 py-2.5 font-bold text-sm hover:bg-surface-container-highest transition-colors"
                          onClick={() => { setView("add"); setMessage(""); }}
                        >
                          + Add Ward
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Add Ward panel ── */
                    <div className="flex flex-col h-full">
                      <div className="p-5 pb-3">
                        <h2 className="font-bold text-lg mb-4">Create Ward</h2>

                        {/* Tabs */}
                        <div className="flex gap-1 p-1 bg-surface-container-low rounded-xl mb-4">
                          <button
                            type="button"
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${createTab === "draw" ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:bg-surface-container-high"}`}
                            onClick={() => setCreateTab("draw")}
                          >
                            Draw on Map
                          </button>
                          <button
                            type="button"
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${createTab === "upload" ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:bg-surface-container-high"}`}
                            onClick={() => setCreateTab("upload")}
                          >
                            Upload GeoJSON
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 px-5 space-y-3 text-sm">
                        {createTab === "draw" && (
                          <>
                            <input
                              className="w-full bg-surface-container-low px-4 py-2.5 rounded-xl placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                              value={wardNameInput}
                              onChange={(e) => setWardNameInput(e.target.value)}
                              placeholder="Ward Name"
                            />
                            <input
                              className="w-full bg-surface-container-low px-4 py-2.5 rounded-xl placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                              value={wardRegionInput}
                              onChange={(e) => setWardRegionInput(e.target.value)}
                              placeholder="Region"
                            />
                            <select
                              className="w-full bg-surface-container-low px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                              value={createSupervisorId}
                              onChange={(e) => setCreateSupervisorId(e.target.value)}
                            >
                              <option value="">Assign Supervisor (optional)</option>
                              {(supervisors || []).map((sup) => (
                                <option key={sup.id} value={sup.id}>{sup.username}</option>
                              ))}
                            </select>
                            <div className="rounded-xl border border-dashed border-outline-variant/30 p-4 text-center">
                              <p className="text-xs text-outline">
                                {drawnGeoJson
                                  ? "✓ Polygon drawn on map. Ready to save."
                                  : "Use the draw tools on the map to draw a polygon."}
                              </p>
                            </div>
                          </>
                        )}

                        {createTab === "upload" && (
                          <div className="space-y-2">
                            <label className="block rounded-xl border border-dashed border-outline-variant/30 p-4 text-center cursor-pointer hover:border-primary/40 transition-colors">
                              <input
                                type="file"
                                accept=".json,.geojson,.txt,application/json,text/plain"
                                className="hidden"
                                onChange={(e) => handleJsonFile(e.target.files?.[0] || null)}
                              />
                              <p className="text-xs text-outline">
                                {jsonFileName ? `Selected: ${jsonFileName}` : "Click to select GeoJSON file"}
                              </p>
                            </label>
                            <p className="text-[10px] text-outline">Upload a FeatureCollection to create multiple wards at once.</p>
                          </div>
                        )}
                      </div>

                      <div className="p-5 pt-3 border-t border-outline-variant/10 space-y-2">
                        {createTab === "draw" ? (
                          <button
                            type="button"
                            className="w-full bg-primary text-white rounded-xl px-4 py-2.5 font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
                            onClick={handleCreateWard}
                            disabled={!wardNameInput.trim() || !wardRegionInput.trim() || !drawnGeoJson}
                          >
                            Save Ward
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="w-full bg-primary text-white rounded-xl px-4 py-2.5 font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
                            onClick={handleUploadGeoJson}
                            disabled={uploadingJson || !jsonFileContent}
                          >
                            {uploadingJson ? "Uploading..." : "Upload & Create"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              </section>

              {/* Ward table (overview only) */}
              {view === "overview" && (
                <section className="bg-surface-container-lowest rounded-xl overflow-hidden">
                  <div className="p-5 border-b border-outline-variant/10">
                    <h2 className="font-bold">All Wards</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-container-low">
                        <tr>
                          <th className="text-left px-5 py-3 font-bold text-xs uppercase text-outline">Ward</th>
                          <th className="text-left px-5 py-3 font-bold text-xs uppercase text-outline">Region</th>
                          <th className="text-left px-5 py-3 font-bold text-xs uppercase text-outline">Supervisor</th>
                          <th className="text-left px-5 py-3 font-bold text-xs uppercase text-outline">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wards.map((ward) => {
                          const wid = ward.wardId || ward.id;
                          const name = ward.wardName || ward.name;
                          const isSelected = String(wid) === String(selectedWardId);
                          return (
                            <tr
                              key={wid}
                              className={`border-b border-outline-variant/10 cursor-pointer hover:bg-surface-container-low/60 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                              onClick={() => selectWard(String(wid || ""), String(name || ""))}
                            >
                              <td className="px-5 py-3 font-semibold">{name}</td>
                              <td className="px-5 py-3 text-on-surface-variant">{ward.region || "N/A"}</td>
                              <td className="px-5 py-3 text-on-surface-variant">{ward.supervisorName || "Unassigned"}</td>
                              <td className="px-5 py-3">
                                <button
                                  type="button"
                                  className="text-primary font-semibold hover:underline text-xs"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await selectWard(String(wid || ""), String(name || ""));
                                    setView("detail");
                                  }}
                                >
                                  View detail →
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {!wards.length && (
                          <tr><td className="px-5 py-8 text-outline text-center" colSpan={4}>No wards found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}

          {/* ══════ DETAIL VIEW ══════ */}
          {view === "detail" && (
            <>
              {/* Ward Name Header */}
              <div className="bg-surface-container-lowest rounded-xl p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-black text-lg">
                    {(selectedWardMeta?.wardName || selectedWardMeta?.name || selectedWardName || "W")[0]?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-black text-primary">
                    {selectedWardMeta?.wardName || selectedWardMeta?.name || selectedWardName || "Ward"}
                  </h2>
                  <p className="text-xs text-outline">{wardDetail?.regionName || selectedWardMeta?.region || ""}</p>
                </div>
              </div>

              {/* Ward map + Supervisor */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Map */}
                <article className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
                  <h2 className="font-bold">Ward Map</h2>
                  {selectedWardFeature ? (
                    <WardMiniMap feature={selectedWardFeature} />
                  ) : (
                    <div className="h-56 rounded-xl bg-surface-container-low flex items-center justify-center">
                      <p className="text-sm text-outline">Ward polygon not available.</p>
                    </div>
                  )}
                </article>

                {/* Supervisor Section */}
                <article className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
                  <h2 className="font-bold">Supervisor</h2>

                  {(wardDetail?.supervisorName || selectedWardMeta?.supervisorName) ? (
                    <div className="rounded-xl border border-outline-variant/15 p-4 space-y-3 bg-gradient-to-br from-primary/3 to-transparent">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-black text-sm">
                            {((wardDetail?.supervisorName || selectedWardMeta?.supervisorName) || "?")[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-sm">{wardDetail?.supervisorName || selectedWardMeta?.supervisorName}</p>
                          <p className="text-xs text-outline">Assigned Supervisor</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex items-center gap-2 text-on-surface-variant">
                          <span className="text-xs font-medium text-outline w-16">Email</span>
                          <span className="break-all">{wardDetail?.supervisorEmail || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-on-surface-variant">
                          <span className="text-xs font-medium text-outline w-16">Phone</span>
                          <span>{wardDetail?.supervisorPhoneNumber || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-on-surface-variant">
                          <span className="text-xs font-medium text-outline w-16">Region</span>
                          <span>{wardDetail.regionName || "N/A"}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-outline-variant/30 p-6 text-center">
                      <p className="text-sm text-outline">No supervisor assigned to this ward.</p>
                    </div>
                  )}

                  <button
                    type="button"
                    className="w-full rounded-xl px-4 py-2.5 font-bold text-sm border-2 border-primary text-primary hover:bg-primary hover:text-white transition-all"
                    onClick={() => setShowSupervisorModal(true)}
                  >
                    Change Supervisor
                  </button>
                </article>
              </section>

              {/* Ward Info + Workers */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <article className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
                  <h2 className="font-bold">Ward Info</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-surface-container-low p-4 text-center">
                      <p className="text-[10px] uppercase font-bold text-outline tracking-widest">Workers</p>
                      <p className="text-2xl font-black text-primary mt-1">{wardDetail?.workerCount ?? 0}</p>
                    </div>
                    <div className="rounded-xl bg-surface-container-low p-4 text-center">
                      <p className="text-[10px] uppercase font-bold text-outline tracking-widest">Open Issues</p>
                      <p className="text-2xl font-black text-error mt-1">{wardDetail?.unfinishedIssueCount ?? 0}</p>
                    </div>
                  </div>
                </article>

                <article className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
                  <h2 className="font-bold">Region</h2>
                  <div className="rounded-xl border border-outline-variant/15 p-4">
                    <p className="text-sm text-on-surface-variant">
                      <span className="font-medium text-outline">Region:</span>{" "}
                      {wardDetail?.regionName || selectedWardMeta?.region || "N/A"}
                    </p>
                  </div>
                </article>
              </section>

              {/* Issue Statistics — Enhanced */}
              <section className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
                <h2 className="font-bold">Issue Statistics</h2>
                {/* Summary stat cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-blue-50 p-4 text-center">
                    <p className="text-[10px] uppercase font-bold text-blue-500 tracking-widest">Reported</p>
                    <p className="text-2xl font-black text-blue-700 mt-1">
                      {monthlyPie[0]?.value || 0}
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-4 text-center">
                    <p className="text-[10px] uppercase font-bold text-amber-500 tracking-widest">In Progress</p>
                    <p className="text-2xl font-black text-amber-700 mt-1">
                      {monthlyPie[1]?.value || 0}
                    </p>
                  </div>
                  <div className="rounded-xl bg-green-50 p-4 text-center">
                    <p className="text-[10px] uppercase font-bold text-green-500 tracking-widest">Solved</p>
                    <p className="text-2xl font-black text-green-700 mt-1">
                      {monthlyPie[2]?.value || 0}
                    </p>
                  </div>
                </div>
                {/* Pie charts */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <MiniPie title="Daily" data={dailyPie} hasData={hasDailyData} />
                  <MiniPie title="Weekly" data={weeklyPie} hasData={hasWeeklyData} />
                  <MiniPie title="Monthly" data={monthlyPie} hasData={hasMonthlyData} />
                </div>
              </section>

              {/* Recent Issues for this Ward */}
              <section className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
                <h2 className="font-bold">Recent Issues</h2>
                {wardRecentIssues.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {wardRecentIssues.map((issue) => (
                      <div
                        key={issue.id}
                        className="flex items-center gap-3 rounded-xl border border-outline-variant/15 p-3 hover:bg-surface-container-low/60 transition-colors cursor-pointer group"
                        onClick={() => navigate(`/admin/issues/${issue.id}`)}
                      >
                        <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-low">
                          {issue.imageUrl ? (
                            <img
                              src={issue.imageUrl.startsWith("http") ? issue.imageUrl : `${API_BASE_URL}${issue.imageUrl}`}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = "none";
                                e.target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center text-outline text-lg">📷</div>`;
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-outline text-lg">📷</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                            {issue.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary">
                              {(issue.issueType || "").replaceAll("_", " ")}
                            </span>
                            <span className="text-[11px] text-outline">
                              {formatDate(issue.createdAt)}
                            </span>
                          </div>
                        </div>
                        <span className="text-outline group-hover:text-primary transition-colors flex-shrink-0">→</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-outline py-4 text-center">No recent issues for this ward.</p>
                )}
              </section>

              {/* Ward Analytics Insights */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                <article className="bg-surface-container-low/30 rounded-2xl p-6 border border-outline-variant/10">
                  <h3 className="font-black text-primary mb-1">Report Patterns (24h)</h3>
                  <p className="text-[10px] text-outline mb-6 uppercase tracking-wider font-bold">Time-wise distribution</p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={wardTimeWise}>
                        <XAxis dataKey="timeSlot" hide />
                        <Tooltip cursor={{ fill: "rgba(29,78,216,0.04)" }} />
                        <Bar dataKey="count" fill="#1d4ed8" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                <article className="bg-surface-container-low/30 rounded-2xl p-6 border border-outline-variant/10">
                  <h3 className="font-black text-primary mb-1">Yearly Pulse</h3>
                  <p className="text-[10px] text-outline mb-6 uppercase tracking-wider font-bold">Activity over 365 days</p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={wardYearGraph}>
                        <Tooltip />
                        <Area type="monotone" dataKey="count" stroke="#1d4ed8" fill="rgba(29,78,216,0.1)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                <article className="lg:col-span-2 bg-surface-container-low/30 rounded-2xl p-6 border border-outline-variant/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-black text-primary">Priority Detector</h3>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-error/10 text-error font-black uppercase">Critical Unresolved</span>
                  </div>
                  {wardCritical.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {wardCritical.slice(0, 6).map(issue => (
                        <div key={issue.id} className="p-3 rounded-xl border border-outline-variant/10 bg-surface-container-lowest hover:bg-surface-container-low transition-colors cursor-pointer" onClick={() => navigate(`/admin/issues/${issue.id}`)}>
                          <p className="font-bold text-xs text-primary truncate">{issue.title}</p>
                          <div className="flex items-center justify-between mt-2 text-[9px] text-outline font-bold">
                            <span>SCORE: {Math.round(issue.priorityScore)}</span>
                            <span>{formatDate(issue.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-center text-outline py-8 font-medium">No critical issues detected in this ward.</p>
                  )}
                </article>
              </section>

              {/* Delete Ward */}
              <section className="flex justify-end">
                <button
                  type="button"
                  className="px-6 py-2.5 rounded-xl bg-error/10 text-error font-bold text-sm border border-error/20 hover:bg-error hover:text-white transition-all"
                  onClick={() => setShowDeleteModal(true)}
                >
                  Delete Ward
                </button>
              </section>
            </>
          )}
        </>
      )}

      {/* ══════ MODALS ══════ */}

      {/* Supervisor Modal */}
      <Overlay open={showSupervisorModal} onClose={() => setShowSupervisorModal(false)}>
        <div className="bg-surface-container-lowest rounded-2xl shadow-2xl overflow-hidden min-w-[420px]">
          <div className="px-6 py-5 border-b border-outline-variant/10 bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Change Supervisor</h3>
                <p className="text-xs text-outline mt-0.5">
                  Assigning for <span className="font-semibold text-primary">{selectedWardMeta?.wardName || selectedWardMeta?.name || selectedWardName || "Ward"}</span>
                </p>
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors"
                onClick={() => setShowSupervisorModal(false)}
              >
                ✕
              </button>
            </div>
          </div>
          <div className="px-6 py-4 max-h-[480px] overflow-y-auto space-y-3">
            {!supervisorsWithStatus.length && (
              <p className="text-sm text-outline text-center py-8">No supervisors found.</p>
            )}
            {supervisorsWithStatus.map((sup) => (
              <div
                key={sup.id}
                className="rounded-xl border border-outline-variant/15 p-4 flex items-center gap-4 hover:bg-surface-container-low/60 transition-colors"
              >
                {/* Avatar */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${sup.isAssigned ? "bg-secondary/10" : "bg-primary/10"}`}>
                  <span className={`font-black text-sm ${sup.isAssigned ? "text-secondary" : "text-primary"}`}>
                    {(sup.username || "?")[0]?.toUpperCase()}
                  </span>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{sup.username}</p>
                  <p className="text-[11px] text-outline truncate">
                    {sup.location || "No location"}
                  </p>
                  {sup.isAssigned ? (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-secondary/10 text-secondary text-[10px] font-bold">
                      Assigned → {sup.assignedWardName}
                    </span>
                  ) : (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-green-50 text-green-600 text-[10px] font-bold">
                      Available
                    </span>
                  )}
                </div>
                {/* Action */}
                <button
                  type="button"
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex-shrink-0 transition-all ${
                    sup.isAssigned
                      ? "bg-secondary/10 text-secondary hover:bg-secondary hover:text-white"
                      : "bg-primary text-white hover:opacity-90"
                  }`}
                  disabled={supervisorModalLoading}
                  onClick={() => handleAssign(sup.id)}
                >
                  {supervisorModalLoading ? "..." : sup.isAssigned ? "Reassign" : "Assign"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </Overlay>

      {/* Delete Confirmation Modal */}
      <Overlay open={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <div className="bg-surface-container-lowest rounded-2xl shadow-2xl p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-error/10 flex items-center justify-center mx-auto">
            <span className="text-error text-3xl font-black">!</span>
          </div>
          <h3 className="font-bold text-lg">Delete Ward</h3>
          <p className="text-sm text-on-surface-variant">
            Are you sure you want to delete{" "}
            <strong className="text-on-surface">{selectedWardMeta?.wardName || selectedWardMeta?.name || selectedWardName}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className="flex-1 px-4 py-2.5 rounded-xl bg-surface-container-high font-bold text-sm hover:bg-surface-container-highest transition-colors"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="flex-1 px-4 py-2.5 rounded-xl bg-error text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
              onClick={handleDeleteWard}
              disabled={deletingWard}
            >
              {deletingWard ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Overlay>

      {/* CSS for modal animation */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
