import React, { useEffect, useMemo, useState } from "react";
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
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  getSupervisorMatrixSlaBreaches,
  getSupervisorMatrixStages,
  getSupervisorMatrixWards,
  getAnalyticsDayWise,
  getAnalyticsYearGraph,
} from "../../services/api";
import { getUser } from "../../lib/session";

const PIE_COLORS = [
  "#1d4ed8",
  "#f59e0b",
  "#16a34a",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

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

function wardRowToPieData(row) {
  if (!row) return [];
  return [
    { name: "Reported", value: toCount(row.reported) },
    { name: "In Progress", value: toCount(row.inBetween) },
    { name: "Solved", value: toCount(row.solved) },
  ];
}

export default function SupervisorMatrix() {
  const user = getUser();
  const [wardRow, setWardRow] = useState(null);
  const [stageMatrix, setStageMatrix] = useState([]);
  const [slaBreaches, setSlaBreaches] = useState([]);
  const [slaBreachCount, setSlaBreachCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dayWise, setDayWise] = useState([]);
  const [yearGraph, setYearGraph] = useState([]);

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
        const supervisorId = user.id;
        const [wards, stages, sla] = await Promise.all([
          getSupervisorMatrixWards({ supervisorId, days: 30 }).catch(() => []),
          getSupervisorMatrixStages({ supervisorId, days: 7 }).catch(() => []),
          getSupervisorMatrixSlaBreaches({ supervisorId, days: 30 }).catch(
            () => null,
          ),
          getAnalyticsDayWise(null, 7).catch(() => []), // Overall/Ward fallback
          getAnalyticsYearGraph(null).catch(() => []),
        ]);

        if (!mounted) return;

        const firstWard = Array.isArray(wards) ? wards[0] : null;

        // If we have a wardId, re-fetch specifically for it if needed (but the API usually returns ward-bound for supervisor)
        const wardId = firstWard?.wardId || firstWard?.id;
        if (wardId) {
          const [dw, yg] = await Promise.all([
            getAnalyticsDayWise(wardId, 7).catch(() => []),
            getAnalyticsYearGraph(wardId).catch(() => []),
          ]);
          if (mounted) {
            setDayWise(dw || []);
            setYearGraph(yg || []);
          }
        }
        setWardRow(firstWard || null);
        setStageMatrix(Array.isArray(stages) ? stages : []);

        const breaches = Array.isArray(sla)
          ? sla
          : Array.isArray(sla?.issues)
            ? sla.issues
            : Array.isArray(sla?.items)
              ? sla.items
              : [];
        setSlaBreaches(breaches);
        setSlaBreachCount(toCount(sla));
      } catch (err) {
        if (mounted) {
          setError(err.message || "Failed to load supervisor matrix.");
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

  const wardPieData = useMemo(() => wardRowToPieData(wardRow), [wardRow]);
  const hasWardData = wardPieData.some((d) => d.value > 0);

  const stagePieData = useMemo(() => {
    return (Array.isArray(stageMatrix) ? stageMatrix : [])
      .map((row) => ({
        name: String(row.stage || "").replaceAll("_", " "),
        value: toCount(row.count),
      }))
      .filter((d) => d.value > 0);
  }, [stageMatrix]);
  const hasStageData = stagePieData.some((d) => d.value > 0);

  const wardName =
    wardRow?.wardName ||
    wardRow?.name ||
    (wardRow?.wardId ? `Ward ${wardRow.wardId}` : "N/A");

  return (
    <div className="pt-24 px-8 pb-12 space-y-6">
      <h1 className="text-3xl font-black text-primary">Supervisor Analytics</h1>
      {loading && <p>Loading analytics...</p>}
      {error && <p className="text-error">{error}</p>}

      {!loading && !error && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-surface-container-lowest rounded-xl p-5 border-l-4 border-primary">
              <p className="text-xs uppercase font-bold text-outline">Ward</p>
              <p className="text-2xl font-black">{wardName}</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 border-l-4 border-secondary">
              <p className="text-xs uppercase font-bold text-outline">
                Reported (30d)
              </p>
              <p className="text-3xl font-black">
                {toCount(wardRow?.reported)}
              </p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 border-l-4 border-tertiary">
              <p className="text-xs uppercase font-bold text-outline">
                In Progress (30d)
              </p>
              <p className="text-3xl font-black">
                {toCount(wardRow?.inBetween)}
              </p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 border-l-4 border-green-600">
              <p className="text-xs uppercase font-bold text-outline">
                Solved (30d)
              </p>
              <p className="text-3xl font-black">{toCount(wardRow?.solved)}</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 border-l-4 border-error">
              <p className="text-xs uppercase font-bold text-outline">
                SLA Breaches (30d)
              </p>
              <p className="text-3xl font-black">{slaBreachCount}</p>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <article className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Ward Matrix (30d)</h2>
                <span className="text-xs font-semibold text-outline">
                  Total:{" "}
                  {wardPieData.reduce((sum, d) => sum + (d.value || 0), 0)}
                </span>
              </div>
              {hasWardData ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={wardPieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={80}
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false}
                      >
                        {wardPieData.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 rounded-xl bg-surface-container-low flex items-center justify-center">
                  <p className="text-sm text-outline">No ward matrix data.</p>
                </div>
              )}
            </article>

            <article className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Stage Distribution (7d)</h2>
                <span className="text-xs font-semibold text-outline">
                  Total:{" "}
                  {stagePieData.reduce((sum, d) => sum + (d.value || 0), 0)}
                </span>
              </div>
              {hasStageData ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stagePieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={80}
                        label={({ value }) => `${value}`}
                        labelLine={false}
                      >
                        {stagePieData.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 rounded-xl bg-surface-container-low flex items-center justify-center">
                  <p className="text-sm text-outline">No stage data.</p>
                </div>
              )}
            </article>

            <article className="bg-surface-container-lowest rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">SLA Breaches (30d)</h2>
                <span className="text-xs font-semibold text-outline">
                  Total: {slaBreachCount}
                </span>
              </div>

              {slaBreaches.length ? (
                <div className="space-y-2">
                  {slaBreaches.slice(0, 8).map((row, idx) => (
                    <div
                      key={row.id || row.issueId || row.title || idx}
                      className="rounded-xl border border-outline-variant/10 p-3"
                    >
                      <p className="text-sm font-semibold truncate">
                        {row.title || `Issue ${row.issueId || row.id || ""}`}
                      </p>
                      <p className="text-xs text-outline mt-1">
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
              ) : slaBreachCount > 0 ? (
                <div className="h-64 rounded-xl bg-surface-container-low flex items-center justify-center">
                  <p className="text-sm text-outline">
                    {slaBreachCount} SLA breaches detected (details not provided
                    by the API).
                  </p>
                </div>
              ) : (
                <div className="h-64 rounded-xl bg-surface-container-low flex items-center justify-center">
                  <p className="text-sm text-outline">No SLA breaches found.</p>
                </div>
              )}
            </article>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <article className="bg-surface-container-lowest rounded-xl p-5 space-y-4 shadow-sm border border-outline-variant/5">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg text-primary">
                  Activity Trend
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-black uppercase">
                  7 Days
                </span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dayWise}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="barGradientMatrix"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#1d4ed8" stopOpacity={1} />
                        <stop
                          offset="100%"
                          stopColor="#1d4ed8"
                          stopOpacity={0.6}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="rgba(0,0,0,0.05)"
                    />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      dy={10}
                      tickFormatter={(val) => {
                        try {
                          return new Date(val).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                          });
                        } catch {
                          return val;
                        }
                      }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#64748b" }}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(29,78,216,0.04)" }}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="url(#barGradientMatrix)"
                      radius={[6, 6, 0, 0]}
                      barSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="bg-surface-container-lowest rounded-xl p-5 space-y-4 shadow-sm border border-outline-variant/5">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg text-primary">Annual Pulse</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-black uppercase">
                  365 Days
                </span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={yearGraph}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="areaGradientMatrix"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#4f46e5"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="100%"
                          stopColor="#4f46e5"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="rgba(0,0,0,0.05)"
                    />
                    <XAxis dataKey="date" hide />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#64748b" }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#4f46e5"
                      strokeWidth={2.5}
                      fill="url(#areaGradientMatrix)"
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 0, fill: "#4f46e5" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>
        </>
      )}
    </div>
  );
}
