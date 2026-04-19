import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  getAdminSupervisorDetail,
  getAdminWards,
  getAdminWorkforce,
  getAdminWorkerDetail,
  getWorkerAssignedIssues,
  reassignWorker,
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
        color: "#16a34a",
        weight: 2,
        fillOpacity: 0.18,
      },
    }).addTo(mapRef.current);

    try {
      mapRef.current.fitBounds(layerRef.current.getBounds().pad(0.3));
    } catch {
      // ignore
    }
  }, [feature]);

  return <div ref={mapNodeRef} className="h-56 rounded-lg" />;
}

function stageLabel(stage) {
  return (stage || "").replaceAll("_", " ");
}

export default function AdminWorkerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [workforce, setWorkforce] = useState(null);
  const [workerProfile, setWorkerProfile] = useState(null);
  const [supervisorProfile, setSupervisorProfile] = useState(null);

  const [wardGeoJson, setWardGeoJson] = useState(null);

  const [issues, setIssues] = useState([]);
  const [issuesError, setIssuesError] = useState("");

  const [newSupervisorId, setNewSupervisorId] = useState("");
  const [reassignLoading, setReassignLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");
      setMessage("");
      try {
        const [wf, wardsData, profile] = await Promise.all([
          getAdminWorkforce(),
          getAdminWards().catch(() => null),
          getAdminWorkerDetail(id),
        ]);

        if (!mounted) return;

        setWorkforce(wf);
        setWardGeoJson(extractFeatureCollection(wardsData?.geojson));
        setWorkerProfile(profile);

        const workerRow =
          (wf?.workers || []).find((w) => String(w.id) === String(id)) || null;
        const supervisorId = workerRow?.supervisorId || "";
        setNewSupervisorId(supervisorId);

        const [supProfile, assignedIssues] = await Promise.all([
          supervisorId
            ? getAdminSupervisorDetail(supervisorId).catch(() => null)
            : Promise.resolve(null),
          getWorkerAssignedIssues(id).catch((err) => {
            setIssuesError(err.message || "Worker issues not available.");
            return [];
          }),
        ]);

        if (!mounted) return;

        setSupervisorProfile(supProfile);
        setIssues(Array.isArray(assignedIssues) ? assignedIssues : []);
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load worker detail.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const workerRow = useMemo(() => {
    return (
      (workforce?.workers || []).find((w) => String(w.id) === String(id)) ||
      null
    );
  }, [workforce, id]);

  const wardFeature = useMemo(() => {
    if (!wardGeoJson) return null;
    const wardId = workerRow?.wardId || "";
    const wardName = workerRow?.wardName || "";
    return pickWardFeature(wardGeoJson, wardId, wardName);
  }, [wardGeoJson, workerRow]);

  const stageCounts = useMemo(() => {
    const counts = {
      PENDING: 0,
      ACKNOWLEDGED: 0,
      TEAM_ASSIGNED: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      RECONSIDERED: 0,
    };

    issues.forEach((issue) => {
      const stage = issue?.stages;
      if (stage && Object.prototype.hasOwnProperty.call(counts, stage)) {
        counts[stage] += 1;
      }
    });

    const solved = counts.RESOLVED;
    const working = counts.IN_PROGRESS + counts.TEAM_ASSIGNED;

    return {
      ...counts,
      total: issues.length,
      solved,
      working,
    };
  }, [issues]);

  const handleReassign = async () => {
    if (!newSupervisorId) {
      setMessage("Please select a supervisor.");
      return;
    }

    setReassignLoading(true);
    setMessage("");
    try {
      await reassignWorker(id, newSupervisorId);
      setMessage("Supervisor updated successfully.");

      // refresh workforce mapping
      const wf = await getAdminWorkforce();
      setWorkforce(wf);
    } catch (err) {
      setMessage(err.message || "Failed to change supervisor.");
    } finally {
      setReassignLoading(false);
    }
  };

  return (
    <div className="pt-24 px-8 pb-12 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-black text-primary">Worker Detail</h1>
        <button
          className="px-4 py-2 rounded-lg bg-surface-container-lowest font-bold"
          onClick={() => navigate("/admin/workforce")}
        >
          Back
        </button>
      </div>

      {loading && <p>Loading worker...</p>}
      {error && <p className="text-error">{error}</p>}
      {message && (
        <p className="text-sm text-primary font-semibold">{message}</p>
      )}

      {!loading && !error && (
        <>
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <article className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
              <h2 className="font-bold">Personal Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="bg-surface-container-low rounded-lg p-3">
                  <p className="text-xs uppercase text-outline">Name</p>
                  <p className="font-semibold">
                    {workerProfile?.fullName || workerRow?.username || "N/A"}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-lg p-3">
                  <p className="text-xs uppercase text-outline">Email</p>
                  <p className="font-semibold">
                    {workerProfile?.email || "N/A"}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-lg p-3">
                  <p className="text-xs uppercase text-outline">Phone</p>
                  <p className="font-semibold">
                    {workerProfile?.phoneNumber || "N/A"}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-lg p-3">
                  <p className="text-xs uppercase text-outline">Age</p>
                  <p className="font-semibold">{workerProfile?.age || "N/A"}</p>
                </div>
                <div className="bg-surface-container-low rounded-lg p-3">
                  <p className="text-xs uppercase text-outline">Ward</p>
                  <p className="font-semibold">
                    {workerRow?.wardName || "N/A"}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-lg p-3">
                  <p className="text-xs uppercase text-outline">Started</p>
                  <p className="font-semibold">{String(workerRow?.started)}</p>
                </div>
              </div>
            </article>

            <article className="lg:col-span-2 bg-surface-container-lowest rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Ward Map</h2>
                <p className="text-xs text-outline">Ward-only view</p>
              </div>
              {wardFeature ? (
                <WardMiniMap feature={wardFeature} />
              ) : (
                <p className="text-sm text-outline">
                  Ward polygon not available.
                </p>
              )}
            </article>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <article className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
              <h2 className="font-bold">Supervisor Details</h2>
              {supervisorProfile ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="bg-surface-container-low rounded-lg p-3">
                    <p className="text-xs uppercase text-outline">Name</p>
                    <p className="font-semibold">
                      {supervisorProfile.fullName || "N/A"}
                    </p>
                  </div>
                  <div className="bg-surface-container-low rounded-lg p-3">
                    <p className="text-xs uppercase text-outline">Email</p>
                    <p className="font-semibold">
                      {supervisorProfile.email || "N/A"}
                    </p>
                  </div>
                  <div className="bg-surface-container-low rounded-lg p-3">
                    <p className="text-xs uppercase text-outline">Phone</p>
                    <p className="font-semibold">
                      {supervisorProfile.phoneNumber || "N/A"}
                    </p>
                  </div>
                  <div className="bg-surface-container-low rounded-lg p-3">
                    <p className="text-xs uppercase text-outline">Age</p>
                    <p className="font-semibold">
                      {supervisorProfile.age || "N/A"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-outline">No supervisor assigned.</p>
              )}

              <h3 className="font-bold pt-2">Change Supervisor</h3>
              <div className="flex flex-col md:flex-row gap-3">
                <select
                  className="bg-surface-container-lowest px-3 py-2 rounded-lg flex-1"
                  value={newSupervisorId}
                  onChange={(e) => setNewSupervisorId(e.target.value)}
                >
                  <option value="">Select Supervisor</option>
                  {(workforce?.supervisors || []).map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.username} ({sup.wardName || "No ward"})
                    </option>
                  ))}
                </select>
                <button
                  className="bg-primary text-white rounded-lg px-4 py-2 font-bold disabled:opacity-50"
                  onClick={handleReassign}
                  disabled={reassignLoading}
                >
                  {reassignLoading ? "Updating..." : "Update"}
                </button>
              </div>
            </article>

            <article className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
              <h2 className="font-bold">Issue Stats</h2>
              {issuesError && (
                <p className="text-sm text-outline">{issuesError}</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="bg-surface-container-low rounded-lg p-3">
                  <p className="text-xs uppercase text-outline">Total</p>
                  <p className="font-semibold">{stageCounts.total}</p>
                </div>
                <div className="bg-surface-container-low rounded-lg p-3">
                  <p className="text-xs uppercase text-outline">Working</p>
                  <p className="font-semibold">{stageCounts.working}</p>
                </div>
                <div className="bg-surface-container-low rounded-lg p-3">
                  <p className="text-xs uppercase text-outline">Solved</p>
                  <p className="font-semibold">{stageCounts.solved}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                {[
                  "PENDING",
                  "ACKNOWLEDGED",
                  "TEAM_ASSIGNED",
                  "IN_PROGRESS",
                  "RESOLVED",
                  "RECONSIDERED",
                ].map((stage) => (
                  <div
                    key={stage}
                    className="bg-surface-container-low rounded-lg p-3"
                  >
                    <p className="text-xs uppercase text-outline">
                      {stageLabel(stage)}
                    </p>
                    <p className="font-semibold">{stageCounts[stage]}</p>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="bg-surface-container-lowest rounded-xl overflow-auto">
            <div className="p-4 border-b border-outline-variant/10">
              <h2 className="font-bold">Assigned Issues</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low">
                <tr>
                  <th className="text-left px-4 py-3">Title</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Criticality</th>
                  <th className="text-left px-4 py-3">Stage</th>
                </tr>
              </thead>
              <tbody>
                {issues.slice(0, 20).map((issue) => (
                  <tr
                    key={issue.id}
                    className="border-b border-outline-variant/10"
                  >
                    <td className="px-4 py-3 font-semibold">{issue.title}</td>
                    <td className="px-4 py-3">{issue.issueType}</td>
                    <td className="px-4 py-3">{issue.criticality}</td>
                    <td className="px-4 py-3">{stageLabel(issue.stages)}</td>
                  </tr>
                ))}
                {!issues.length && (
                  <tr>
                    <td className="px-4 py-3 text-outline" colSpan={4}>
                      No assigned issues found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {issues.length > 20 && (
              <p className="text-xs text-outline p-4">
                Showing first 20 issues.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
