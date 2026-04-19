import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getIssueDetail } from "../../services/api";
import { get } from "../../lib/http";
import { API_BASE_URL } from "../../config/env";

const STAGES_ORDER = [
  "PENDING",
  "ACKNOWLEDGED",
  "TEAM_ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
];

const STAGE_LABELS = {
  PENDING: "Pending",
  ACKNOWLEDGED: "Acknowledged",
  TEAM_ASSIGNED: "Team Assigned",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  RECONSIDERED: "Reconsidered",
};

const CRITICALITY_COLORS = {
  HIGH: { bg: "bg-red-100", text: "text-red-700", border: "border-red-200" },
  MEDIUM: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  LOW: {
    bg: "bg-green-100",
    text: "text-green-700",
    border: "border-green-200",
  },
};

function formatDate(value) {
  if (!value) return "N/A";
  try {
    const d = new Date(value);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

/* ── Stage Progress Line ── */
function StageProgressLine({ currentStage }) {
  const currentIndex = STAGES_ORDER.indexOf(currentStage);
  const isReconsidered = currentStage === "RECONSIDERED";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between relative">
        {/* Background line */}
        <div className="absolute top-4 left-0 right-0 h-1 bg-surface-container-low rounded-full z-0" />
        {/* Progress fill */}
        <div
          className="absolute top-4 left-0 h-1 rounded-full z-[1] transition-all duration-500"
          style={{
            width: isReconsidered
              ? "100%"
              : currentIndex >= 0
                ? `${(currentIndex / (STAGES_ORDER.length - 1)) * 100}%`
                : "0%",
            background: isReconsidered
              ? "linear-gradient(90deg, #a855f7, #7c3aed)"
              : "linear-gradient(90deg, #3b82f6, #22c55e)",
          }}
        />
        {STAGES_ORDER.map((stage, idx) => {
          const isPast = currentIndex >= idx;
          const isCurrent = currentIndex === idx;
          return (
            <div
              key={stage}
              className="flex flex-col items-center z-10 relative"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  isCurrent
                    ? "bg-primary border-primary text-white scale-110 shadow-lg shadow-primary/30"
                    : isPast
                      ? "bg-green-500 border-green-500 text-white"
                      : "bg-surface-container-lowest border-outline-variant/30 text-outline"
                }`}
              >
                {isPast && !isCurrent ? (
                  <span className="text-xs">✓</span>
                ) : (
                  <span className="text-[10px] font-black">{idx + 1}</span>
                )}
              </div>
              <span
                className={`text-[9px] mt-1.5 font-bold text-center leading-tight max-w-[60px] ${
                  isCurrent
                    ? "text-primary"
                    : isPast
                      ? "text-green-600"
                      : "text-outline"
                }`}
              >
                {STAGE_LABELS[stage]}
              </span>
            </div>
          );
        })}
      </div>
      {isReconsidered && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200">
          <span className="text-purple-600 text-sm">⟳</span>
          <span className="text-xs font-bold text-purple-700">
            Issue has been reconsidered & sent back for review
          </span>
        </div>
      )}
    </div>
  );
}

function IssueLocationMap({ latitude, longitude }) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    mapRef.current = L.map(mapNodeRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([lat, lng], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(mapRef.current);

    L.circleMarker([lat, lng], {
      radius: 10,
      fillColor: "#dc2626",
      color: "#dc2626",
      weight: 2,
      fillOpacity: 0.8,
    })
      .addTo(mapRef.current)
      .bindPopup("Issue Location")
      .openPopup();

    setTimeout(() => mapRef.current?.invalidateSize(), 100);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude]);

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return (
      <div className="h-64 rounded-xl bg-surface-container-low flex items-center justify-center">
        <p className="text-sm text-outline">Location not available.</p>
      </div>
    );
  }

  return <div ref={mapNodeRef} className="h-64 rounded-xl" />;
}

export default function AdminIssueDetail() {
  const { issueId } = useParams();
  const navigate = useNavigate();

  const [issue, setIssue] = useState(null);
  const [worker, setWorker] = useState(null);
  const [supervisor, setSupervisor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [detail, workerInfo] = await Promise.all([
          getIssueDetail(issueId),
          get(`/api/issue/${issueId}/worker`).catch(() => null),
        ]);

        let resolvedDetail = detail;
        if (!resolvedDetail?.wardName) {
          const wardId =
            resolvedDetail?.wardId ||
            resolvedDetail?.ward?.wardId ||
            resolvedDetail?.ward?.id;
          if (wardId != null) {
            const wardListResponse = await get("/api/admin/wards").catch(
              () => [],
            );
            const wardList = Array.isArray(wardListResponse)
              ? wardListResponse
              : wardListResponse?.wards || [];
            const match = (wardList || []).find(
              (w) => String(w?.wardId ?? w?.id) === String(wardId),
            );
            const wardName = match?.wardName || match?.name || match?.Ward;
            if (wardName) {
              resolvedDetail = { ...resolvedDetail, wardName };
            }
          }
        }

        if (mounted) {
          setIssue(resolvedDetail);
          setWorker(workerInfo);

          // Try to get supervisor info
          if (resolvedDetail?.supervisorId) {
            const supDetail = await get(
              `/api/admin/users/supervisors/${resolvedDetail.supervisorId}/detail`,
            ).catch(() => null);
            if (mounted) setSupervisor(supDetail);
          }
        }
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load issue detail.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [issueId]);

  const critStyle =
    CRITICALITY_COLORS[issue?.criticality] || CRITICALITY_COLORS.LOW;

  return (
    <div className="pt-24 px-8 pb-12 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-black text-primary">Issue Detail</h1>
        <button
          className="px-5 py-2.5 rounded-xl bg-surface-container-high font-bold text-sm hover:bg-surface-container-highest transition-colors"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>
      </div>

      {loading && (
        <p className="text-on-surface-variant animate-pulse">
          Loading issue...
        </p>
      )}
      {error && <p className="text-error font-semibold">{error}</p>}

      {!loading && !error && issue && (
        <>
          {/* Hero Section: Image + Title */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Image */}
            <article className="bg-surface-container-lowest rounded-xl overflow-hidden">
              {issue.imageUrl ? (
                <img
                  src={
                    issue.imageUrl.startsWith("http")
                      ? issue.imageUrl
                      : `${API_BASE_URL}${issue.imageUrl}`
                  }
                  alt={issue.title}
                  className="w-full h-80 object-cover"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              ) : (
                <div className="w-full h-80 bg-surface-container-low flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <span className="text-primary text-3xl">📷</span>
                    </div>
                    <p className="text-sm text-outline">No image available</p>
                  </div>
                </div>
              )}
            </article>

            {/* Title + Key Info */}
            <article className="bg-surface-container-lowest rounded-xl p-6 space-y-5">
              <div>
                <h2 className="text-2xl font-black text-on-surface mb-2">
                  {issue.title || "Untitled Issue"}
                </h2>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  {issue.description || "No description provided."}
                </p>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <span
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${critStyle.bg} ${critStyle.text} border ${critStyle.border}`}
                >
                  {issue.criticality || "LOW"} Priority
                </span>
                <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary">
                  {(issue.issueType || "OTHER").replaceAll("_", " ")}
                </span>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-container-low rounded-xl p-3">
                  <p className="text-[10px] uppercase font-bold text-outline tracking-widest">
                    Location
                  </p>
                  <p className="font-semibold text-sm mt-1">
                    {issue.location || "N/A"}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-xl p-3">
                  <p className="text-[10px] uppercase font-bold text-outline tracking-widest">
                    Created
                  </p>
                  <p className="font-semibold text-sm mt-1">
                    {formatDate(issue.createAt || issue.createdAt)}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-xl p-3">
                  <p className="text-[10px] uppercase font-bold text-outline tracking-widest">
                    Upvotes
                  </p>
                  <p className="font-semibold text-sm mt-1">
                    {issue.upvoteCount ?? 0}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-xl p-3">
                  <p className="text-[10px] uppercase font-bold text-outline tracking-widest">
                    Ward
                  </p>
                  <p className="font-semibold text-sm mt-1">
                    {issue.wardName ||
                      (issue.wardId ? `Ward ${issue.wardId}` : "N/A")}
                  </p>
                </div>
              </div>
            </article>
          </section>

          {/* Stage Progress Line */}
          <section className="bg-surface-container-lowest rounded-xl p-6 space-y-3">
            <h2 className="font-bold">Issue Progress</h2>
            <StageProgressLine currentStage={issue.stages || "PENDING"} />
          </section>

          {/* Map + Worker + Supervisor */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Map */}
            <article className="bg-surface-container-lowest rounded-xl p-5 space-y-3">
              <h2 className="font-bold">Issue Location</h2>
              <IssueLocationMap
                latitude={issue.latitude}
                longitude={issue.longitude}
              />
              {Number.isFinite(Number(issue.latitude)) && (
                <p className="text-xs text-outline">
                  Coordinates: {Number(issue.latitude).toFixed(6)},{" "}
                  {Number(issue.longitude).toFixed(6)}
                </p>
              )}
            </article>

            {/* Assigned Worker */}
            <article className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
              <h2 className="font-bold">Assigned Worker</h2>
              {worker ? (
                <div className="rounded-xl border border-outline-variant/15 p-5 space-y-4 bg-gradient-to-br from-primary/3 to-transparent">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-black text-lg">
                        {(worker.workerName || "?")[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold">
                        {worker.workerName || "Unknown"}
                      </p>
                      <p className="text-xs text-outline">Assigned Worker</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    {worker.workerEmail && (
                      <div className="flex items-center gap-2 text-on-surface-variant">
                        <span className="text-xs font-medium text-outline w-14">
                          Email
                        </span>
                        <span className="break-all">{worker.workerEmail}</span>
                      </div>
                    )}
                    {worker.workerPhone && (
                      <div className="flex items-center gap-2 text-on-surface-variant">
                        <span className="text-xs font-medium text-outline w-14">
                          Phone
                        </span>
                        <span>{worker.workerPhone}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-outline-variant/30 p-8 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-surface-container-low flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">👷</span>
                  </div>
                  <p className="text-sm text-outline">
                    No worker assigned yet.
                  </p>
                </div>
              )}
            </article>

            {/* Supervisor Detail */}
            <article className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
              <h2 className="font-bold">Supervisor</h2>
              {issue.supervisorName || supervisor ? (
                <div className="rounded-xl border border-outline-variant/15 p-5 space-y-4 bg-gradient-to-br from-secondary/3 to-transparent">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-secondary font-black text-lg">
                        {(supervisor?.fullName ||
                          issue.supervisorName ||
                          "?")[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold">
                        {supervisor?.fullName ||
                          issue.supervisorName ||
                          "Unknown"}
                      </p>
                      <p className="text-xs text-outline">Ward Supervisor</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    {supervisor?.email && (
                      <div className="flex items-center gap-2 text-on-surface-variant">
                        <span className="text-xs font-medium text-outline w-14">
                          Email
                        </span>
                        <span className="break-all">{supervisor.email}</span>
                      </div>
                    )}
                    {supervisor?.phoneNumber && (
                      <div className="flex items-center gap-2 text-on-surface-variant">
                        <span className="text-xs font-medium text-outline w-14">
                          Phone
                        </span>
                        <span>{supervisor.phoneNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-outline-variant/30 p-8 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-surface-container-low flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">👤</span>
                  </div>
                  <p className="text-sm text-outline">
                    No supervisor info available.
                  </p>
                </div>
              )}

              {/* Reported By */}
              {issue.reportedBy && (
                <>
                  <h2 className="font-bold pt-2">Reported By</h2>
                  <div className="rounded-xl border border-outline-variant/15 p-4">
                    <p className="text-sm font-semibold">{issue.reportedBy}</p>
                  </div>
                </>
              )}
            </article>
          </section>
        </>
      )}
    </div>
  );
}
