import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Bar,
  BarChart,
  Pie,
  PieChart,
  Cell,
  Area,
  AreaChart,
} from "recharts";
import {
  getAdminAnalytics,
  getAdminWards,
  getAdminWorkforce,
  getAnalyticsTimeWise,
  getAnalyticsCritical,
} from "../../services/api";

function formatDateLabel(value) {
  if (!value) return "";
  const str = String(value);
  // expects YYYY-MM-DD
  return str.length >= 10 ? str.slice(5, 10) : str;
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function StatCard({ label, value, icon, accentClass = "border-primary" }) {
  return (
    <div
      className={`rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-6 shadow-lg shadow-slate-900/5 ${accentClass}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] font-bold text-outline">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black text-on-surface leading-none">
            {value}
          </p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: '"FILL" 1' }}
          >
            {icon}
          </span>
        </div>
      </div>
    </div>
  );
}

function CircularProgressRing({ value = 0, label = "", caption = "" }) {
  const pct = Math.round(clamp01(value) * 100);
  const size = 140;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div className="flex items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="block">
          <defs>
            <linearGradient id="nsRing" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1d4ed8" stopOpacity="1" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="1" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(148,163,184,0.25)"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="url(#nsRing)"
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${dash} ${c - dash}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-black text-primary">{pct}%</div>
          <div className="text-[11px] uppercase tracking-[0.24em] font-bold text-outline mt-1">
            {label}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-lg font-black text-on-surface">Resolution Rate</p>
        <p className="text-sm text-on-surface-variant max-w-sm leading-relaxed">
          {caption}
        </p>
      </div>
    </div>
  );
}

export default function AdminAnalyticsDashboard() {
  const [data, setData] = useState(null);

  const [wards, setWards] = useState([]);
  const [workforce, setWorkforce] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [timeWiseData, setTimeWiseData] = useState([]);
  const [criticalIssues, setCriticalIssues] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [response, wardData, workforceData, timeWise, critical] = await Promise.all([
          getAdminAnalytics(),
          getAdminWards().catch(() => null),
          getAdminWorkforce().catch(() => null),
          getAnalyticsTimeWise().catch(() => []),
          getAnalyticsCritical().catch(() => []),
        ]);

        if (!mounted) return;
        setData(response);
        setWards(wardData?.wards || []);
        setWorkforce(workforceData);
        setTimeWiseData(timeWise || []);
        setCriticalIssues(critical || []);
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load analytics.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const totals = useMemo(() => {
    if (!data?.thirtyDays) return { created: 0, resolved: 0 };
    const created = (data.thirtyDays.created || []).reduce(
      (sum, d) => sum + (d.count || 0),
      0,
    );
    const resolved = (data.thirtyDays.resolved || []).reduce(
      (sum, d) => sum + (d.count || 0),
      0,
    );
    return { created, resolved };
  }, [data]);

  const thirtyDaySeries = useMemo(() => {
    const created = data?.thirtyDays?.created || [];
    const resolved = data?.thirtyDays?.resolved || [];

    const map = new Map();
    created.forEach((row) => {
      map.set(row.date, {
        date: row.date,
        created: row.count || 0,
        resolved: 0,
      });
    });
    resolved.forEach((row) => {
      const existing = map.get(row.date);
      if (existing) {
        existing.resolved = row.count || 0;
      } else {
        map.set(row.date, {
          date: row.date,
          created: 0,
          resolved: row.count || 0,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
  }, [data]);

  const stageSource = useMemo(() => {
    const source =
      Array.isArray(data?.stageMatrix) && data.stageMatrix.length
        ? data.stageMatrix
        : data?.weeklyStages || [];
    return Array.isArray(source) ? source : [];
  }, [data]);

  const wardMatrix = useMemo(() => {
    return Array.isArray(data?.wardMatrix) ? data.wardMatrix : [];
  }, [data]);

  const wardMatrixTop = useMemo(() => {
    return [...wardMatrix]
      .sort(
        (a, b) =>
          (Number(b?.reported || 0) || 0) - (Number(a?.reported || 0) || 0),
      )
      .slice(0, 12);
  }, [wardMatrix]);

  const slaBreaches = useMemo(() => {
    if (Array.isArray(data?.slaBreaches)) return data.slaBreaches;
    if (Array.isArray(data?.slaBreaches?.issues))
      return data.slaBreaches.issues;
    if (Array.isArray(data?.slaBreaches?.items)) return data.slaBreaches.items;
    return [];
  }, [data]);

  return (
    <div className="pt-24 px-6 lg:px-10 pb-14">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] font-bold text-outline">
              Admin
            </p>
            <h1 className="mt-1 text-4xl font-black text-on-surface tracking-tight">
              City Analytics
            </h1>
            <p className="mt-2 text-sm text-on-surface-variant max-w-2xl">
              Track creation, resolution velocity, stage distribution, and
              workforce readiness.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-surface-container-lowest/70 backdrop-blur border border-outline-variant/10 px-4 py-2 text-xs font-bold text-outline">
              <span
                className="material-symbols-outlined text-base"
                style={{ fontVariationSettings: '"FILL" 1' }}
              >
                calendar_month
              </span>
              Last 30 days
            </span>
          </div>
        </header>

        {loading && (
          <p className="text-on-surface-variant">Loading analytics...</p>
        )}
        {error && <p className="text-error">{error}</p>}

        {!loading && !error && data && (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                label="Created (30d)"
                value={totals.created}
                icon="add_circle"
                accentClass="border-l-4 border-primary"
              />
              <StatCard
                label="Resolved (30d)"
                value={totals.resolved}
                icon="task_alt"
                accentClass="border-l-4 border-secondary"
              />
              <StatCard
                label="Wards"
                value={wards.length}
                icon="location_city"
                accentClass="border-l-4 border-tertiary"
              />
              <StatCard
                label="Workers"
                value={workforce?.workers?.length || 0}
                icon="engineering"
                accentClass="border-l-4 border-error"
              />
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 30d Trend */}
              <article className="lg:col-span-8 rounded-3xl bg-surface-container-lowest/70 backdrop-blur border border-outline-variant/10 p-6 shadow-xl shadow-slate-900/5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black text-on-surface">
                      Issues Trend
                    </h2>
                    <p className="text-xs text-outline mt-1">
                      Created vs Resolved
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 text-xs text-outline">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                      Created
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-600" />
                      Resolved
                    </span>
                  </div>
                </div>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={thirtyDaySeries}
                      margin={{ top: 10, right: 24, bottom: 0, left: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="nsCreatedFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#2563eb"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="100%"
                            stopColor="#2563eb"
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                        <linearGradient
                          id="nsResolvedFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#16a34a"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="100%"
                            stopColor="#16a34a"
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(148,163,184,0.35)"
                      />
                      <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="created"
                        stroke="#2563eb"
                        strokeWidth={2}
                        fill="url(#nsCreatedFill)"
                        name="Created"
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="resolved"
                        stroke="#16a34a"
                        strokeWidth={2}
                        fill="url(#nsResolvedFill)"
                        name="Resolved"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </article>

              {/* Resolution Rate */}
              <article className="lg:col-span-4 rounded-3xl bg-surface-container-lowest/70 backdrop-blur border border-outline-variant/10 p-6 shadow-xl shadow-slate-900/5 space-y-6">
                {(() => {
                  const rate01 =
                    totals.created > 0 ? totals.resolved / totals.created : 0;
                  const pending = Math.max(0, totals.created - totals.resolved);
                  return (
                    <>
                      <CircularProgressRing
                        value={rate01}
                        label="30d"
                        caption={`${totals.resolved} resolved out of ${totals.created} created.`}
                      />

                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="rounded-2xl bg-surface-container-low border border-outline-variant/10 p-3 text-center">
                          <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-outline">
                            Created
                          </p>
                          <p className="mt-1 text-xl font-black">
                            {totals.created}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-surface-container-low border border-outline-variant/10 p-3 text-center">
                          <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-outline">
                            Resolved
                          </p>
                          <p className="mt-1 text-xl font-black text-green-600">
                            {totals.resolved}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-surface-container-low border border-outline-variant/10 p-3 text-center">
                          <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-outline">
                            Pending
                          </p>
                          <p className="mt-1 text-xl font-black text-amber-600">
                            {pending}
                          </p>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </article>

              {/* Stage Distribution */}
              <article className="lg:col-span-5 rounded-3xl bg-surface-container-lowest/70 backdrop-blur border border-outline-variant/10 p-6 shadow-xl shadow-slate-900/5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-black text-on-surface">
                    Stage Distribution
                  </h2>
                  <p className="text-xs text-outline">last 7 days</p>
                </div>

                {stageSource.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stageSource.map((s) => ({
                            name: (s.stage || "").replaceAll("_", " "),
                            value: s.count || 0,
                          }))}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={98}
                          innerRadius={44}
                        >
                          {stageSource.map((_, i) => (
                            <Cell
                              key={i}
                              fill={
                                [
                                  "#2563eb",
                                  "#f59e0b",
                                  "#16a34a",
                                  "#ef4444",
                                  "#8b5cf6",
                                  "#06b6d4",
                                ][i % 6]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-72 flex items-center justify-center">
                    <div className="w-32 h-32 rounded-full border-[6px] border-outline-variant/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-outline">
                        No Data
                      </span>
                    </div>
                  </div>
                )}
              </article>

              {/* Workforce */}
              {workforce ? (
                <article className="lg:col-span-7 rounded-3xl bg-surface-container-lowest/70 backdrop-blur border border-outline-variant/10 p-6 shadow-xl shadow-slate-900/5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-black text-on-surface">
                      Workforce Summary
                    </h2>
                    <p className="text-xs text-outline">
                      availability snapshot
                    </p>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          {
                            name: "Supervisors",
                            total: workforce.supervisors?.length || 0,
                            notStarted:
                              workforce.supervisorsNoStart?.length || 0,
                          },
                          {
                            name: "Workers",
                            total: workforce.workers?.length || 0,
                            notStarted: workforce.workersNoStart?.length || 0,
                          },
                        ]}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(148,163,184,0.35)"
                        />
                        <XAxis dataKey="name" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="total"
                          name="Total"
                          fill="#2563eb"
                          radius={[8, 8, 0, 0]}
                        />
                        <Bar
                          dataKey="notStarted"
                          name="Not Started"
                          fill="#f59e0b"
                          radius={[8, 8, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </article>
              ) : (
                <article className="lg:col-span-7 rounded-3xl bg-surface-container-lowest/70 backdrop-blur border border-outline-variant/10 p-6 shadow-xl shadow-slate-900/5 flex items-center justify-center">
                  <p className="text-sm text-outline">
                    No workforce data found.
                  </p>
                </article>
              )}

              {/* Time Wise Distribution */}
              <article className="lg:col-span-12 rounded-3xl bg-surface-container-lowest/70 backdrop-blur border border-outline-variant/10 p-6 shadow-xl shadow-slate-900/5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-black text-on-surface">Time-Wise Distribution</h2>
                  <p className="text-xs text-outline">reported patterns</p>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timeWiseData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
                      <XAxis dataKey="timeSlot" tick={{ fontSize: 10 }} interval={0} />
                      <YAxis allowDecimals={false} />
                      <Tooltip cursor={{ fill: "rgba(37,99,235,0.06)" }} />
                      <Bar dataKey="count" name="Issues" fill="#2563eb" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>

              {/* Critical Issues */}
              <article className="lg:col-span-full rounded-3xl bg-surface-container-lowest/70 backdrop-blur border border-outline-variant/10 p-6 shadow-xl shadow-slate-900/5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-black text-on-surface">Most Critical Issues</h2>
                  <p className="text-xs text-outline">priority detector</p>
                </div>
                {criticalIssues.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {criticalIssues.map((issue) => (
                      <div key={issue.id} className="rounded-2xl border border-outline-variant/10 p-4 space-y-2 hover:bg-surface-container-low transition-colors group">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-sm text-on-surface line-clamp-1">{issue.title}</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${issue.criticality === "HIGH" ? "bg-error/10 text-error" : "bg-warning/10 text-warning"}`}>
                            {issue.criticality}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-outline">
                          <span>Score: {Math.round(issue.priorityScore)}</span>
                          <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="pt-2">
                          <button onClick={() => navigate(`/issues/${issue.id}`)} className="text-xs font-bold text-primary group-hover:underline flex items-center gap-1">
                            View Details <span className="material-symbols-outlined text-xs">arrow_forward</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-outline text-center py-8">No high priority unresolved issues detected.</p>
                )}
              </article>


              {/* Ward Matrix */}
              <article className="lg:col-span-6 rounded-3xl bg-surface-container-lowest/70 backdrop-blur border border-outline-variant/10 p-6 shadow-xl shadow-slate-900/5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="text-lg font-black text-on-surface">
                    Ward Matrix (30d)
                  </h2>
                  <p className="text-xs text-outline">
                    {wardMatrix.length} wards
                  </p>
                </div>

                {wardMatrixTop.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-outline border-b border-outline-variant/10">
                          <th className="py-2 pr-3 font-bold">Ward</th>
                          <th className="py-2 px-3 font-bold">Reported</th>
                          <th className="py-2 px-3 font-bold">In Progress</th>
                          <th className="py-2 px-3 font-bold">Solved</th>
                          <th className="py-2 pl-3 font-bold">SLA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wardMatrixTop.map((row) => {
                          const key = row.wardId || row.wardName || row.name;
                          return (
                            <tr
                              key={key}
                              className="border-b border-outline-variant/10"
                            >
                              <td className="py-2 pr-3 font-semibold">
                                {row.wardName ||
                                  row.name ||
                                  `Ward ${row.wardId}`}
                              </td>
                              <td className="py-2 px-3">{row.reported ?? 0}</td>
                              <td className="py-2 px-3">
                                {row.inBetween ?? 0}
                              </td>
                              <td className="py-2 px-3">{row.solved ?? 0}</td>
                              <td className="py-2 pl-3">
                                {row.slaBreached ?? 0}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-outline py-6 text-center">
                    No ward matrix data.
                  </p>
                )}
              </article>

              {/* SLA Breaches */}
              <article className="lg:col-span-6 rounded-3xl bg-surface-container-lowest/70 backdrop-blur border border-outline-variant/10 p-6 shadow-xl shadow-slate-900/5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="text-lg font-black text-on-surface">
                    SLA Breaches (30d)
                  </h2>
                  <span className="text-xs font-black text-error">
                    {slaBreaches.length}
                  </span>
                </div>

                {slaBreaches.length ? (
                  <div className="space-y-2">
                    {slaBreaches.slice(0, 8).map((row) => {
                      const key = row.id || row.issueId || row.title;
                      const overdue =
                        row.overdueDays ?? row.overdue ?? row.daysOverdue;
                      return (
                        <div
                          key={key}
                          className="rounded-2xl border border-outline-variant/10 p-3"
                        >
                          <p className="font-semibold text-sm truncate">
                            {row.title || `Issue ${row.issueId || row.id}`}
                          </p>
                          <p className="text-xs text-outline mt-1">
                            Overdue: {overdue ?? "N/A"} days
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-outline py-6 text-center">
                    No SLA breaches in the last 30 days.
                  </p>
                )}
              </article>

              {/* Leaderboard */}
              <article className="lg:col-span-6 rounded-3xl bg-surface-container-lowest/70 backdrop-blur border border-outline-variant/10 p-6 shadow-xl shadow-slate-900/5">
                <h2 className="text-lg font-black text-on-surface mb-4">
                  Citizen Leaderboard
                </h2>
                <div className="space-y-2">
                  {(data.leaderboard || []).slice(0, 10).map((row, idx) => {
                    const medals = ["🥇", "🥈", "🥉"];
                    const medal = medals[idx] || null;
                    const isTop3 = idx < 3;
                    return (
                      <div
                        key={`${row.fullName}-${idx}`}
                        className={`flex items-center gap-3 rounded-2xl p-3 transition-colors ${
                          isTop3
                            ? "bg-gradient-to-r from-primary/5 to-transparent border border-primary/10"
                            : "border border-outline-variant/10 hover:bg-surface-container-low/60"
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isTop3
                              ? "bg-primary/10"
                              : "bg-surface-container-low"
                          }`}
                        >
                          {medal ? (
                            <span className="text-lg">{medal}</span>
                          ) : (
                            <span className="text-xs font-black text-outline">
                              {idx + 1}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-semibold text-sm truncate ${isTop3 ? "text-primary" : ""}`}
                          >
                            {row.fullName || "Unknown"}
                          </p>
                        </div>
                        <div
                          className={`px-3 py-1 rounded-xl text-xs font-black ${
                            isTop3
                              ? "bg-primary/10 text-primary"
                              : "bg-surface-container-low text-on-surface"
                          }`}
                        >
                          {row.score ?? 0}
                        </div>
                      </div>
                    );
                  })}
                  {!data.leaderboard?.length && (
                    <p className="text-sm text-outline py-4 text-center">
                      No leaderboard data found.
                    </p>
                  )}
                </div>
              </article>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
