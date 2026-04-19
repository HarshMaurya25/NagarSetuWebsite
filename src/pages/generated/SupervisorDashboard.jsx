import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getIssueDetail,
  getSupervisorDashboard,
  getWorkerAssignedIssues,
  getWorkerDetail,
  resolveIssueEvidence,
  getAnalyticsTimeWise,
  getAnalyticsCritical,
} from "../../services/api";
import { getUser } from "../../lib/session";
import { API_BASE_URL } from "../../config/env";

function totalFromMatrix(matrix, key) {
  if (!matrix) return 0;
  return (
    (matrix.daily?.[key] || 0) +
    (matrix.weekly?.[key] || 0) +
    (matrix.monthly?.[key] || 0)
  );
}

function toAbsoluteImageUrl(url) {
  if (!url) return null;
  return String(url).startsWith("http") ? url : `${API_BASE_URL}${url}`;
}

function toCount(value) {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value === "object") {
    if (Array.isArray(value.items)) return value.items.length;
    if (Array.isArray(value.issues)) return value.issues.length;
    return toCount(
      value.count ?? value.total ?? value.slaBreached ?? value.value,
    );
  }
  return 0;
}

export default function SupervisorDashboard() {
  const user = getUser();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [workerDetail, setWorkerDetail] = useState(null);
  const [workerIssues, setWorkerIssues] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [enrichedRecent, setEnrichedRecent] = useState([]);

  const [timeWiseData, setTimeWiseData] = useState([]);
  const [criticalIssues, setCriticalIssues] = useState([]);
  const scrollRef = useRef(null);

  const scroll = (dir) => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = clientWidth * 0.8;
      scrollRef.current.scrollTo({
        left:
          dir === "left"
            ? scrollLeft - scrollAmount
            : scrollLeft + scrollAmount,
        behavior: "smooth",
      });
    }
  };

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
          setData(response);

          const wardNameFromMatrix =
            response?.matrix?.wardName ||
            response?.matrix?.name ||
            response?.wardMatrix?.[0]?.wardName ||
            response?.wardMatrix?.[0]?.name ||
            "";

          const recentRows = response?.recent || [];
          const enriched = await Promise.all(
            recentRows.slice(0, 8).map(async (issue) => {
              const detail = await getIssueDetail(issue.id).catch(() => null);
              const evidence = resolveIssueEvidence(issue, detail);
              return {
                id: issue.id,
                title: detail?.title || issue.title || "Untitled",
                issueType: detail?.issueType || issue.issueType || "OTHER",
                wardName:
                  detail?.wardName ||
                  detail?.ward?.wardName ||
                  detail?.ward?.name ||
                  issue.wardName ||
                  issue.ward?.wardName ||
                  issue.ward?.name ||
                  wardNameFromMatrix ||
                  "",
                createdAt:
                  detail?.createAt ||
                  detail?.createdAt ||
                  issue.createdAt ||
                  "",
                stage: detail?.stages || issue.stages || "",
                ...evidence,
              };
            }),
          );
          if (mounted) setEnrichedRecent(enriched);

          const assignedWardId =
            response?.matrix?.wardId || response?.wardMatrix?.[0]?.wardId;
          if (assignedWardId) {
            const [timeWise, critical] = await Promise.all([
              getAnalyticsTimeWise(assignedWardId).catch(() => []),
              getAnalyticsCritical(assignedWardId).catch(() => []),
            ]);
            if (mounted) {
              setTimeWiseData(timeWise || []);
              setCriticalIssues(critical || []);
            }
          }
        }
      } catch (err) {
        if (mounted)
          setError(err.message || "Failed to load supervisor dashboard.");
        if (mounted) setEnrichedRecent([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const metrics = useMemo(() => {
    const wardRow = Array.isArray(data?.wardMatrix) ? data.wardMatrix[0] : null;
    if (!data?.matrix && !wardRow) {
      return { reported: 0, solved: 0, inBetween: 0, slaBreached: 0 };
    }

    const reported =
      toCount(wardRow?.reported) || totalFromMatrix(data?.matrix, "reported");
    const solved =
      toCount(wardRow?.solved) || totalFromMatrix(data?.matrix, "solved");
    const inBetween =
      toCount(wardRow?.inBetween) || totalFromMatrix(data?.matrix, "inBetween");

    return {
      reported,
      solved,
      inBetween,
      slaBreached: toCount(data?.slaBreaches),
    };
  }, [data]);

  const wardName = useMemo(() => {
    const wardRow = Array.isArray(data?.wardMatrix) ? data.wardMatrix[0] : null;
    return (
      data?.matrix?.wardName ||
      data?.matrix?.name ||
      wardRow?.wardName ||
      wardRow?.name ||
      (wardRow?.wardId ? `Ward ${wardRow.wardId}` : "")
    );
  }, [data]);

  const stageBreakdown = useMemo(() => {
    const rows = Array.isArray(data?.stageMatrix) ? data.stageMatrix : [];
    return rows
      .map((row) => ({
        stage: String(row.stage || "").replaceAll("_", " "),
        count: toCount(row.count),
      }))
      .filter((row) => row.count > 0);
  }, [data]);

  const totalWorkerLoad = useMemo(() => {
    const workers = Array.isArray(data?.workers) ? data.workers : [];
    return workers.reduce((sum, w) => sum + (Number(w.issueCount) || 0), 0);
  }, [data]);

  async function openWorkerDetail(worker) {
    setSelectedWorker(worker);
    setDetailLoading(true);
    setDetailError("");

    try {
      const [detail, issues] = await Promise.all([
        getWorkerDetail(worker.id).catch(() => null),
        getWorkerAssignedIssues(worker.id).catch(() => []),
      ]);
      setWorkerDetail(detail);
      setWorkerIssues(issues || []);
    } catch (err) {
      setDetailError(err.message || "Failed to load worker details.");
      setWorkerDetail(null);
      setWorkerIssues([]);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="pt-24 px-4 sm:px-8 pb-12 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-outline">
            Command Center
          </p>
          <h1 className="text-3xl font-black text-primary mt-1">
            Supervisor Dashboard
          </h1>
          <p className="text-outline mt-1">
            {wardName ? `Ward • ${wardName}` : "Ward overview"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5 transition"
            onClick={() => navigate("/supervisor/issues")}
          >
            <span className="material-symbols-outlined text-[18px]">
              inventory_2
            </span>
            Issues
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5 transition"
            onClick={() => navigate("/supervisor/ward-map")}
          >
            <span className="material-symbols-outlined text-[18px]">map</span>
            Ward Map
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5 transition"
            onClick={() => navigate("/supervisor/workers")}
          >
            <span className="material-symbols-outlined text-[18px]">
              groups
            </span>
            Workers
          </button>
        </div>
      </div>

      {loading && <p>Loading dashboard...</p>}
      {error && <p className="text-error">{error}</p>}

      {!loading && !error && data && (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 p-6">
              <span className="material-symbols-outlined pointer-events-none absolute -right-3 -top-3 text-primary/10 text-[72px]">
                report
              </span>
              <p className="text-xs uppercase font-bold text-outline tracking-wide">
                Reported (30d)
              </p>
              <p className="text-3xl font-black text-primary mt-2">
                {metrics.reported}
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 p-6">
              <span className="material-symbols-outlined pointer-events-none absolute -right-3 -top-3 text-secondary/10 text-[72px]">
                sync
              </span>
              <p className="text-xs uppercase font-bold text-outline tracking-wide">
                In Progress (30d)
              </p>
              <p className="text-3xl font-black text-primary mt-2">
                {metrics.inBetween}
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 p-6">
              <span className="material-symbols-outlined pointer-events-none absolute -right-3 -top-3 text-tertiary/10 text-[72px]">
                task_alt
              </span>
              <p className="text-xs uppercase font-bold text-outline tracking-wide">
                Resolved (30d)
              </p>
              <p className="text-3xl font-black text-primary mt-2">
                {metrics.solved}
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 p-6">
              <span className="material-symbols-outlined pointer-events-none absolute -right-3 -top-3 text-primary/10 text-[72px]">
                groups
              </span>
              <p className="text-xs uppercase font-bold text-outline tracking-wide">
                Workers
              </p>
              <p className="text-3xl font-black text-primary mt-2">
                {data.workers?.length || 0}
              </p>
              <p className="text-xs text-outline mt-1">
                Total load: {totalWorkerLoad}
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 p-6">
              <span className="material-symbols-outlined pointer-events-none absolute -right-3 -top-3 text-error/10 text-[72px]">
                warning
              </span>
              <p className="text-xs uppercase font-bold text-outline tracking-wide">
                SLA Breaches (30d)
              </p>
              <p className="text-3xl font-black text-primary mt-2">
                {metrics.slaBreached}
              </p>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <article className="lg:col-span-2 rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-black text-primary">
                    Weekly Stage Breakdown
                  </h2>
                  <p className="text-sm text-outline mt-1">
                    Issues by stage (last 7 days).
                  </p>
                </div>
                <button
                  type="button"
                  className="text-sm font-bold text-primary hover:underline"
                  onClick={() => navigate("/supervisor/matrix")}
                >
                  View analytics
                </button>
              </div>

              {stageBreakdown.length ? (
                <div className="h-72 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stageBreakdown}
                      margin={{ left: 8, right: 8 }}
                    >
                      <XAxis
                        dataKey="stage"
                        interval={0}
                        angle={-18}
                        textAnchor="end"
                        height={60}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip
                        cursor={{ fill: "rgba(29,78,216,0.06)" }}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid rgba(0,0,0,0.06)",
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#1d4ed8"
                        radius={[10, 10, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 mt-4 rounded-2xl bg-surface-container-low flex items-center justify-center">
                  <p className="text-sm text-outline">
                    No stage data available.
                  </p>
                </div>
              )}
            </article>

            {/* Time Wise Pattern */}
            <article className="lg:col-span-1 rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 p-6">
              <h2 className="font-black text-primary mb-1">Time Patterns</h2>
              <p className="text-xs text-outline mb-4">ward activity cycle</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeWiseData}>
                    <Tooltip cursor={{ fill: "rgba(29,78,216,0.06)" }} />
                    <Bar dataKey="count" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
                    <XAxis dataKey="timeSlot" hide />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-center text-outline mt-2 uppercase tracking-widest">
                24-hour distribution
              </p>
            </article>

            {/* Critical Issues (Supervisor) */}
            <article className="lg:col-span-3 rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="font-black text-primary">
                  High Priority Detectors
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-error/10 text-error font-black uppercase">
                  Critical
                </span>
              </div>
              {criticalIssues.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {criticalIssues.slice(0, 4).map((issue) => (
                    <div
                      key={issue.id}
                      className="rounded-2xl border border-outline-variant/10 p-4 space-y-2 group hover:bg-surface-container-low transition-all cursor-pointer"
                      onClick={() => navigate(`/supervisor/issues/${issue.id}`)}
                    >
                      <h3 className="font-bold text-sm text-primary line-clamp-1">
                        {issue.title}
                      </h3>
                      <div className="flex items-center justify-between text-[11px] text-outline">
                        <span>Score: {Math.round(issue.priorityScore)}</span>
                        <span>
                          {new Date(issue.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-outline text-center py-6">
                  No critical unresolved issues in your ward.
                </p>
              )}
            </article>
          </section>

          <article className="rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 p-6">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div>
                <h2 className="font-black text-2xl text-primary">
                  Recent Issues
                </h2>
                <p className="text-sm text-outline mt-1">
                  Recently reported activities in your ward.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => scroll("left")}
                  className="w-10 h-10 rounded-full border border-outline-variant/20 bg-surface-container-low flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-sm"
                >
                  <span className="material-symbols-outlined">
                    chevron_left
                  </span>
                </button>
                <button
                  onClick={() => scroll("right")}
                  className="w-10 h-10 rounded-full border border-outline-variant/20 bg-surface-container-low flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-sm"
                >
                  <span className="material-symbols-outlined">
                    chevron_right
                  </span>
                </button>
                <div className="w-px h-6 bg-outline-variant/20 mx-2" />
                <button
                  type="button"
                  className="text-sm font-bold text-primary hover:underline flex items-center gap-1"
                  onClick={() => navigate("/supervisor/issues")}
                >
                  View all{" "}
                  <span className="material-symbols-outlined text-sm">
                    arrow_forward
                  </span>
                </button>
              </div>
            </div>

            {/* Horizontal Scroll Carousel */}
            <div
              ref={scrollRef}
              className="flex gap-6 overflow-x-auto pb-6 pt-1 snap-x snap-mandatory scrollbar-hide no-scrollbar scroll-smooth"
            >
              {(enrichedRecent || []).map((issue) => {
                const bestThumb = toAbsoluteImageUrl(
                  issue.resolvedImageUrl ||
                    issue.previousImageUrl ||
                    issue.imageUrl,
                );

                return (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => navigate(`/supervisor/issues/${issue.id}`)}
                    className="min-w-[280px] w-[280px] text-left rounded-2xl border border-outline-variant/10 bg-surface-container-low/30 hover:bg-surface-container-low transition-all duration-300 snap-start overflow-hidden group shadow-sm hover:shadow-md"
                  >
                    {/* Image Top */}
                    <div className="h-40 w-full bg-surface-container-high overflow-hidden relative">
                      {bestThumb ? (
                        <img
                          src={bestThumb}
                          alt="Evidence"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-outline text-3xl">
                          <span className="material-symbols-outlined">
                            image
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Text Bottom */}
                    <div className="p-4">
                      <p className="font-black text-base text-primary truncate">
                        {issue.title}
                      </p>
                      <p className="text-xs text-outline mt-1 truncate font-medium uppercase tracking-wide">
                        {(issue.stage || "").replaceAll("_", " ")}
                      </p>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-bold">
                          {issue.wardName || "Ward"}
                        </span>
                        <span className="material-symbols-outlined text-primary text-[20px] opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                          arrow_forward
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}

              {!enrichedRecent.length && (
                <div className="w-full py-12 text-center rounded-2xl border border-dashed border-outline-variant/20">
                  <p className="text-sm text-outline">
                    No recent issues found.
                  </p>
                </div>
              )}
            </div>

            <style>{`
              .scrollbar-hide::-webkit-scrollbar { display: none; }
              .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
              .no-scrollbar::-webkit-scrollbar { display: none; }
              .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
          </article>

          <section className="rounded-2xl bg-surface-container-lowest shadow-elevated border border-outline-variant/10 p-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-black text-primary">My Workers</h2>
                <p className="text-sm text-outline mt-1">
                  Select a worker to see profile and assigned issues.
                </p>
              </div>
              <button
                type="button"
                className="text-sm font-bold text-primary hover:underline"
                onClick={() => navigate("/supervisor/workers")}
              >
                Open workers page
              </button>
            </div>

            <div className="mt-4 divide-y divide-outline-variant/10">
              {(data.workers || []).slice(0, 8).map((worker) => (
                <div
                  key={worker.id}
                  className="py-3 flex items-center justify-between gap-4"
                >
                  <button
                    type="button"
                    className="text-left min-w-0"
                    onClick={() => openWorkerDetail(worker)}
                  >
                    <p className="font-bold text-primary truncate">
                      {worker.fullName || "Unnamed worker"}
                    </p>
                    <p className="text-xs text-outline mt-0.5">
                      Click to view detail
                    </p>
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-outline">Issues</span>
                    <span className="font-black text-primary">
                      {worker.issueCount ?? 0}
                    </span>
                  </div>
                </div>
              ))}

              {!data.workers?.length && (
                <p className="text-sm text-outline py-3">
                  No workers assigned.
                </p>
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
                  <p className="text-outline mt-1">
                    {selectedWorker.fullName || "Worker"}
                  </p>
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

              {detailLoading && (
                <p className="text-sm">Loading worker detail...</p>
              )}
              {detailError && (
                <p className="text-sm text-error">{detailError}</p>
              )}

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
                    <div className="space-y-2 max-h-72 overflow-auto">
                      {workerIssues.map((issue) => (
                        <button
                          key={issue.id}
                          type="button"
                          onClick={() =>
                            navigate(`/supervisor/issues/${issue.id}`)
                          }
                          className="w-full text-left rounded-2xl border border-outline-variant/10 bg-surface-container-lowest hover:bg-surface-container-low transition p-3"
                        >
                          <p className="font-semibold text-primary">
                            {issue.title}
                          </p>
                          <p className="text-outline text-sm mt-1">
                            {issue.issueType} | {issue.criticality} |{" "}
                            {(issue.stages || "").replaceAll("_", " ")}
                          </p>
                        </button>
                      ))}
                      {!workerIssues.length && (
                        <p className="text-sm text-outline">
                          No assigned issues for this worker.
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
