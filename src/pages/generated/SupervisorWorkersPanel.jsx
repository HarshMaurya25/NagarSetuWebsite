import React, { useEffect, useMemo, useState } from "react";
import {
  getSupervisorDashboard,
  getWorkerAssignedIssues,
  getWorkerDetail,
} from "../../services/api";
import { getUser } from "../../lib/session";

function stageLabel(stage) {
  return (stage || "").replaceAll("_", " ");
}

function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);

  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  const value = (first + last).toUpperCase();

  return value || "W";
}

export default function SupervisorWorkersPanel() {
  const user = getUser();
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [workerDetail, setWorkerDetail] = useState(null);
  const [workerIssues, setWorkerIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");

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
        const response = await getSupervisorDashboard(user.id);
        if (mounted) {
          setWorkers(response?.workers || []);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || "Failed to load workers.");
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

  async function openWorker(worker) {
    setSelectedWorker(worker);
    setDetailLoading(true);
    setDetailError("");

    try {
      const [profile, issues] = await Promise.all([
        getWorkerDetail(worker.id).catch(() => null),
        getWorkerAssignedIssues(worker.id).catch(() => []),
      ]);
      setWorkerDetail(profile);
      setWorkerIssues(issues || []);
    } catch (err) {
      setDetailError(err.message || "Failed to load worker details.");
      setWorkerDetail(null);
      setWorkerIssues([]);
    } finally {
      setDetailLoading(false);
    }
  }

  const totalIssues = useMemo(
    () => workers.reduce((acc, worker) => acc + (worker.issueCount || 0), 0),
    [workers],
  );

  return (
    <div className="pt-24 px-4 sm:px-8 pb-12 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary">
            Worker Operations
          </h1>
          <p className="text-outline mt-1">
            Monitor worker load and quickly drill into assignments.
          </p>
        </div>
      </div>

      {loading && <p>Loading workers...</p>}
      {error && <p className="text-error">{error}</p>}

      {!loading && !error && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 p-6">
              <span className="material-symbols-outlined pointer-events-none absolute -right-3 -top-3 text-primary/10 text-[72px]">
                groups
              </span>
              <p className="text-xs uppercase font-bold text-outline tracking-wide">
                Workers
              </p>
              <p className="text-3xl font-black text-primary mt-2">
                {workers.length}
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 p-6">
              <span className="material-symbols-outlined pointer-events-none absolute -right-3 -top-3 text-secondary/10 text-[72px]">
                assignment
              </span>
              <p className="text-xs uppercase font-bold text-outline tracking-wide">
                Assigned Issues
              </p>
              <p className="text-3xl font-black text-primary mt-2">
                {totalIssues}
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 p-6">
              <span className="material-symbols-outlined pointer-events-none absolute -right-3 -top-3 text-tertiary/10 text-[72px]">
                monitoring
              </span>
              <p className="text-xs uppercase font-bold text-outline tracking-wide">
                Average Load
              </p>
              <p className="text-3xl font-black text-primary mt-2">
                {workers.length
                  ? (totalIssues / workers.length).toFixed(1)
                  : "0.0"}
              </p>
            </div>
          </section>

          <section className="rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-primary">
                  Worker workload
                </h2>
                <p className="text-sm text-outline mt-1">
                  Select a worker to view profile and assigned issues.
                </p>
              </div>
              <div className="hidden md:flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-1.5 text-sm">
                <span className="text-outline">Total open issues</span>
                <span className="font-black text-primary">{totalIssues}</span>
              </div>
            </div>

            <div className="divide-y divide-outline-variant/10">
              {workers.map((worker) => (
                <div
                  key={worker.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openWorker(worker)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openWorker(worker);
                  }}
                  className="px-6 py-4 flex items-center gap-4 hover:bg-surface-container-low transition cursor-pointer"
                >
                  <div className="h-11 w-11 rounded-full bg-gradient-primary flex items-center justify-center text-white font-black">
                    {initials(worker.fullName)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-primary truncate">
                      {worker.fullName}
                    </p>
                    <p className="text-xs text-outline mt-0.5">
                      Click to view worker detail
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-wide text-outline">
                        Open issues
                      </p>
                      <p className="text-xl font-black text-primary">
                        {worker.issueCount || 0}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openWorker(worker);
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 text-sm font-bold text-primary hover:bg-primary/5 transition"
                    >
                      View Details
                      <span className="material-symbols-outlined text-[18px]">
                        chevron_right
                      </span>
                    </button>
                  </div>
                </div>
              ))}

              {!workers.length && (
                <div className="px-6 py-6 text-outline">
                  No workers assigned to this supervisor.
                </div>
              )}
            </div>
          </section>

          {selectedWorker && (
            <section className="rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-primary">
                    Worker Detail
                  </h2>
                  <p className="text-outline mt-1">{selectedWorker.fullName}</p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 font-bold text-sm text-primary hover:bg-primary/5 transition"
                  onClick={() => {
                    setSelectedWorker(null);
                    setWorkerDetail(null);
                    setWorkerIssues([]);
                    setDetailError("");
                  }}
                >
                  Close
                </button>
              </div>

              {detailLoading && <p>Loading worker detail...</p>}
              {detailError && <p className="text-error">{detailError}</p>}

              {!detailLoading && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                    <div className="bg-surface-container-low rounded-lg p-3">
                      <p className="text-xs text-outline uppercase">Name</p>
                      <p className="font-semibold">
                        {workerDetail?.fullName || selectedWorker.fullName}
                      </p>
                    </div>
                    <div className="bg-surface-container-low rounded-lg p-3">
                      <p className="text-xs text-outline uppercase">Email</p>
                      <p className="font-semibold">
                        {workerDetail?.email || "N/A"}
                      </p>
                    </div>
                    <div className="bg-surface-container-low rounded-lg p-3">
                      <p className="text-xs text-outline uppercase">Phone</p>
                      <p className="font-semibold">
                        {workerDetail?.phoneNumber || "N/A"}
                      </p>
                    </div>
                    <div className="bg-surface-container-low rounded-lg p-3">
                      <p className="text-xs text-outline uppercase">Age</p>
                      <p className="font-semibold">
                        {workerDetail?.age || "N/A"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold mb-3">Assigned Issues</h3>
                    <div className="space-y-2 max-h-80 overflow-auto">
                      {workerIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className="rounded-lg border border-outline-variant/15 p-3 text-sm"
                        >
                          <p className="font-semibold">{issue.title}</p>
                          <p className="text-outline">
                            {issue.issueType} | {issue.criticality}
                          </p>
                          <p className="text-outline">
                            Stage: {stageLabel(issue.stages)}
                          </p>
                        </div>
                      ))}
                      {!workerIssues.length && (
                        <p className="text-sm text-outline">
                          No assigned issues found for this worker.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
