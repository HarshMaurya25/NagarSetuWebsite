import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  getAdminIssueMatrix,
  getAdminSupervisorDetail,
  getAdminWards,
  getAdminWorkforce,
  getSupervisorMatrixSlaBreaches,
  getSupervisorMatrixStages,
  getSupervisorMatrixWards,
  getWardDetail,
  getWardRecentIssues,
} from "../../services/api";
import { API_BASE_URL } from "../../config/env";

function formatDate(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(value);
  }
}

function extractFeatureCollection(raw) {
  if (!raw) return null;
  if (raw?.type === "FeatureCollection" && Array.isArray(raw.features))
    return raw;
  if (typeof raw === "string") {
    try {
      return extractFeatureCollection(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") {
    for (const value of Object.values(raw)) {
      const fc = extractFeatureCollection(value);
      if (fc) return fc;
    }
  }
  return null;
}

function pickWardFeature(featureCollection, wardId, wardName) {
  if (!featureCollection?.features?.length) return null;
  const wardIdStr = wardId != null ? String(wardId) : "";
  const wardNameStr = wardName != null ? String(wardName) : "";
  return (
    featureCollection.features.find(
      (f) =>
        (wardIdStr &&
          String(f?.properties?.wardId ?? f?.properties?.id ?? "") ===
            wardIdStr) ||
        (wardNameStr &&
          String(f?.properties?.wardName ?? f?.properties?.name ?? "") ===
            wardNameStr),
    ) || null
  );
}

function WardMiniMap({ feature }) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;
    mapRef.current = L.map(mapNodeRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([28.6139, 77.209], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(mapRef.current);
    setTimeout(() => mapRef.current?.invalidateSize(), 0);
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    layerRef.current?.remove();
    layerRef.current = null;
    if (!feature) return;
    layerRef.current = L.geoJSON(feature, {
      style: {
        color: "#1d4ed8",
        weight: 3,
        fillColor: "#3b82f6",
        fillOpacity: 0.15,
        dashArray: "5 3",
      },
    }).addTo(mapRef.current);
    try {
      mapRef.current.fitBounds(layerRef.current.getBounds().pad(0.3));
    } catch {
      /* ignore */
    }
  }, [feature]);

  return <div ref={mapNodeRef} className="h-56 rounded-lg" />;
}

const PIE_COLORS = ["#1d4ed8", "#f59e0b", "#16a34a"];

function MiniPie({ title, data, hasData }) {
  return (
    <div className="text-center space-y-2">
      <p className="text-xs font-bold uppercase text-outline tracking-widest">
        {title}
      </p>
      {hasData ? (
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              outerRadius={55}
              innerRadius={22}
              label={({ name, value }) => `${value}`}
              labelLine={false}
            >
              {data.map((e, i) => (
                <Cell key={e.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[150px] flex items-center justify-center">
          <div className="w-20 h-20 rounded-full border-4 border-outline-variant/20 flex items-center justify-center">
            <span className="text-xs text-outline font-bold">No Data</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminSupervisorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [workforce, setWorkforce] = useState(null);
  const [supervisorProfile, setSupervisorProfile] = useState(null);

  const [wardGeoJson, setWardGeoJson] = useState(null);
  const [wardDetail, setWardDetail] = useState(null);
  const [wardMatrix, setWardMatrix] = useState(null);
  const [supervisorWardMatrix, setSupervisorWardMatrix] = useState([]);
  const [supervisorStageMatrix, setSupervisorStageMatrix] = useState([]);
  const [supervisorSlaBreaches, setSupervisorSlaBreaches] = useState([]);
  const [wardRecentIssues, setWardRecentIssues] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [wf, wardsData, profile] = await Promise.all([
          getAdminWorkforce(),
          getAdminWards().catch(() => null),
          getAdminSupervisorDetail(id),
        ]);

        if (!mounted) return;

        setWorkforce(wf);
        setWardGeoJson(extractFeatureCollection(wardsData?.geojson));
        setSupervisorProfile(profile);

        const supervisorRow = (wf?.supervisors || []).find(
          (s) => String(s.id) === String(id),
        );
        const wardId = String(supervisorRow?.wardId || "").trim();
        const wardName = supervisorRow?.wardName || "";

        const [wd, matrix, supWards, supStages, supSla] = await Promise.all([
          wardId || wardName
            ? getWardDetail(
                wardId || undefined,
                wardId ? undefined : wardName || undefined,
              ).catch(() => null)
            : Promise.resolve(null),
          wardId
            ? getAdminIssueMatrix(wardId).catch(() => null)
            : Promise.resolve(null),
          getSupervisorMatrixWards({ supervisorId: id, days: 30 }).catch(
            () => [],
          ),
          getSupervisorMatrixStages({ supervisorId: id, days: 7 }).catch(
            () => [],
          ),
          getSupervisorMatrixSlaBreaches({ supervisorId: id, days: 30 }).catch(
            () => null,
          ),
        ]);

        if (!mounted) return;
        setWardDetail(wd);
        setWardMatrix(matrix);
        setSupervisorWardMatrix(Array.isArray(supWards) ? supWards : []);
        setSupervisorStageMatrix(Array.isArray(supStages) ? supStages : []);

        const breaches = Array.isArray(supSla)
          ? supSla
          : Array.isArray(supSla?.issues)
            ? supSla.issues
            : Array.isArray(supSla?.items)
              ? supSla.items
              : [];
        setSupervisorSlaBreaches(breaches);

        // Fetch recent issues for ward
        if (wardId) {
          const recentIssues = await getWardRecentIssues(wardId).catch(
            () => [],
          );
          if (mounted) setWardRecentIssues(recentIssues || []);
        }
      } catch (err) {
        if (mounted)
          setError(err.message || "Failed to load supervisor detail.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const supervisorRow = useMemo(() => {
    return (
      (workforce?.supervisors || []).find((s) => String(s.id) === String(id)) ||
      null
    );
  }, [workforce, id]);

  const wardFeature = useMemo(() => {
    if (!wardGeoJson) return null;
    const wardId = supervisorRow?.wardId || "";
    const wardName = supervisorRow?.wardName || "";
    return pickWardFeature(wardGeoJson, wardId, wardName);
  }, [wardGeoJson, supervisorRow]);

  const makePieData = (bucket) => {
    if (!bucket) return [];
    return [
      { name: "Reported", value: bucket.reported ?? 0 },
      { name: "In Progress", value: bucket.inBetween ?? 0 },
      { name: "Solved", value: bucket.solved ?? 0 },
    ];
  };

  const dailyPie = useMemo(() => makePieData(wardMatrix?.daily), [wardMatrix]);
  const weeklyPie = useMemo(
    () => makePieData(wardMatrix?.weekly),
    [wardMatrix],
  );
  const monthlyPie = useMemo(
    () => makePieData(wardMatrix?.monthly),
    [wardMatrix],
  );
  const hasDailyData = dailyPie.some((d) => d.value > 0);
  const hasWeeklyData = weeklyPie.some((d) => d.value > 0);
  const hasMonthlyData = monthlyPie.some((d) => d.value > 0);

  const effectiveWardName =
    wardDetail?.wardName ||
    wardDetail?.name ||
    supervisorRow?.wardName ||
    wardFeature?.properties?.wardName ||
    wardFeature?.properties?.name ||
    "Unassigned";

  return (
    <div className="pt-24 px-8 pb-12 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-black text-primary">Supervisor Detail</h1>
        <button
          className="px-5 py-2.5 rounded-xl bg-surface-container-high font-bold text-sm hover:bg-surface-container-highest transition-colors"
          onClick={() => navigate("/admin/workforce")}
        >
          ← Back
        </button>
      </div>

      {loading && (
        <p className="text-on-surface-variant animate-pulse">
          Loading supervisor...
        </p>
      )}
      {error && <p className="text-error font-semibold">{error}</p>}

      {!loading && !error && (
        <>
          {/* Profile + Ward Map */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <article className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
              <h2 className="font-bold">Personal Details</h2>
              <div className="flex items-center gap-4 mb-3">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-black text-xl">
                    {(supervisorProfile?.fullName ||
                      supervisorRow?.username ||
                      "?")[0]?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-lg">
                    {supervisorProfile?.fullName ||
                      supervisorRow?.username ||
                      "N/A"}
                  </p>
                  <p className="text-xs text-outline">
                    Supervisor • {effectiveWardName}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="bg-surface-container-low rounded-lg p-3">
                  <p className="text-xs uppercase text-outline">Email</p>
                  <p className="font-semibold break-all">
                    {supervisorProfile?.email || "N/A"}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-lg p-3">
                  <p className="text-xs uppercase text-outline">Phone</p>
                  <p className="font-semibold">
                    {supervisorProfile?.phoneNumber || "N/A"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-container-low rounded-lg p-3">
                    <p className="text-xs uppercase text-outline">Age</p>
                    <p className="font-semibold">
                      {supervisorProfile?.age || "N/A"}
                    </p>
                  </div>
                  <div className="bg-surface-container-low rounded-lg p-3">
                    <p className="text-xs uppercase text-outline">Ward</p>
                    <p className="font-semibold">{effectiveWardName}</p>
                  </div>
                </div>
                <div className="bg-surface-container-low rounded-lg p-3">
                  <p className="text-xs uppercase text-outline">Status</p>
                  <p className="font-semibold">
                    {supervisorRow?.started ? (
                      <span className="text-green-600">● Active</span>
                    ) : (
                      <span className="text-amber-600">● Not started</span>
                    )}
                  </p>
                </div>
              </div>
            </article>

            <article className="lg:col-span-2 bg-surface-container-lowest rounded-xl p-5 space-y-4">
              <h2 className="font-bold">Ward Map</h2>
              {wardFeature ? (
                <WardMiniMap feature={wardFeature} />
              ) : (
                <div className="h-56 rounded-xl bg-surface-container-low flex items-center justify-center">
                  <p className="text-sm text-outline">
                    Ward polygon not available.
                  </p>
                </div>
              )}
            </article>
          </section>

          {/* Ward Details + Stats */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <article className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
              <h2 className="font-bold">Ward Details</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-surface-container-low rounded-lg p-3">
                  <p className="text-xs uppercase text-outline">Ward</p>
                  <p className="font-semibold">{effectiveWardName}</p>
                </div>
                <div className="bg-surface-container-low rounded-lg p-3">
                  <p className="text-xs uppercase text-outline">Workers</p>
                  <p className="font-semibold">
                    {wardDetail?.workerCount ?? 0}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-lg p-3">
                  <p className="text-xs uppercase text-outline">Open Issues</p>
                  <p className="font-semibold">
                    {wardDetail?.unfinishedIssueCount ?? 0}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-lg p-3">
                  <p className="text-xs uppercase text-outline">Region</p>
                  <p className="font-semibold">
                    {wardDetail?.regionName || supervisorRow?.location || "N/A"}
                  </p>
                </div>
              </div>
            </article>

            <article className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
              <h2 className="font-bold">Issue Statistics</h2>
              {/* Summary stats - use monthly only to avoid double-count */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-blue-50 p-3 text-center">
                  <p className="text-[10px] uppercase font-bold text-blue-500 tracking-widest">
                    Reported
                  </p>
                  <p className="text-xl font-black text-blue-700 mt-1">
                    {monthlyPie[0]?.value || 0}
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3 text-center">
                  <p className="text-[10px] uppercase font-bold text-amber-500 tracking-widest">
                    In Progress
                  </p>
                  <p className="text-xl font-black text-amber-700 mt-1">
                    {monthlyPie[1]?.value || 0}
                  </p>
                </div>
                <div className="rounded-xl bg-green-50 p-3 text-center">
                  <p className="text-[10px] uppercase font-bold text-green-500 tracking-widest">
                    Solved
                  </p>
                  <p className="text-xl font-black text-green-700 mt-1">
                    {monthlyPie[2]?.value || 0}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <MiniPie title="Daily" data={dailyPie} hasData={hasDailyData} />
                <MiniPie
                  title="Weekly"
                  data={weeklyPie}
                  hasData={hasWeeklyData}
                />
                <MiniPie
                  title="Monthly"
                  data={monthlyPie}
                  hasData={hasMonthlyData}
                />
              </div>

              <div className="h-px bg-outline-variant/15" />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-surface-container-low rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase text-outline font-bold">
                    Reported (30d)
                  </p>
                  <p className="text-xl font-black mt-1">
                    {supervisorWardMatrix?.[0]?.reported ?? 0}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase text-outline font-bold">
                    In Progress (30d)
                  </p>
                  <p className="text-xl font-black mt-1">
                    {supervisorWardMatrix?.[0]?.inBetween ?? 0}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase text-outline font-bold">
                    Solved (30d)
                  </p>
                  <p className="text-xl font-black mt-1">
                    {supervisorWardMatrix?.[0]?.solved ?? 0}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase text-outline font-bold">
                    SLA Breached (30d)
                  </p>
                  <p className="text-xl font-black text-red-600 mt-1">
                    {supervisorSlaBreaches.length}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-surface-container-low rounded-lg p-3">
                  <p className="text-xs uppercase text-outline font-bold">
                    Stage Breakdown (7d)
                  </p>
                  {supervisorStageMatrix.length ? (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      {supervisorStageMatrix.map((row) => (
                        <div
                          key={row.stage}
                          className="flex items-center justify-between rounded-lg bg-surface-container-lowest border border-outline-variant/10 px-2 py-1.5"
                        >
                          <span className="text-[10px] font-bold text-outline uppercase">
                            {(row.stage || "").replaceAll("_", " ")}
                          </span>
                          <span className="font-black">{row.count ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-outline mt-2">No stage data.</p>
                  )}
                </div>

                <div className="bg-surface-container-low rounded-lg p-3">
                  <p className="text-xs uppercase text-outline font-bold">
                    SLA Breaches (30d)
                  </p>
                  {supervisorSlaBreaches.length ? (
                    <div className="mt-2 space-y-2">
                      {supervisorSlaBreaches.slice(0, 3).map((row, idx) => (
                        <div
                          key={row.id || row.issueId || row.title || idx}
                          className="rounded-lg bg-surface-container-lowest border border-outline-variant/10 p-2"
                        >
                          <p className="text-sm font-semibold truncate">
                            {row.title ||
                              `Issue ${row.issueId || row.id || ""}`}
                          </p>
                          <p className="text-[11px] text-outline mt-0.5">
                            Overdue:{" "}
                            {row.overdueDays ??
                              row.overdue ??
                              row.daysOverdue ??
                              "N/A"}{" "}
                            days
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-outline mt-2">
                      No SLA breaches.
                    </p>
                  )}
                </div>
              </div>
            </article>
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
                          src={
                            issue.imageUrl.startsWith("http")
                              ? issue.imageUrl
                              : `${API_BASE_URL}${issue.imageUrl}`
                          }
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center text-outline text-lg">📷</div>`;
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-outline text-lg">
                          📷
                        </div>
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
                    <span className="text-outline group-hover:text-primary transition-colors flex-shrink-0">
                      →
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-outline py-4 text-center">
                No recent issues for this supervisor's ward.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
