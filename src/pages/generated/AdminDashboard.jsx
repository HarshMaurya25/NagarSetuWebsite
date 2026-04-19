import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useNavigate } from "react-router-dom";
import {
  getAdminCitizenDetail,
  getAdminDashboard,
  getIssueDetail,
  getTopWards,
  resolveIssueEvidence,
} from "../../services/api";
import { get } from "../../lib/http";
import { API_BASE_URL } from "../../config/env";

const STAGE_COLORS = {
  PENDING: "#f59e0b",
  ACKNOWLEDGED: "#3b82f6",
  TEAM_ASSIGNED: "#6366f1",
  IN_PROGRESS: "#f97316",
  RESOLVED: "#22c55e",
  RECONSIDERED: "#a855f7",
};

const STAGE_BADGE = {
  PENDING: { bg: "bg-amber-100", text: "text-amber-700" },
  ACKNOWLEDGED: { bg: "bg-blue-100", text: "text-blue-700" },
  TEAM_ASSIGNED: { bg: "bg-indigo-100", text: "text-indigo-700" },
  IN_PROGRESS: { bg: "bg-orange-100", text: "text-orange-700" },
  RESOLVED: { bg: "bg-green-100", text: "text-green-700" },
  RECONSIDERED: { bg: "bg-purple-100", text: "text-purple-700" },
};

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

function sumRows(rows, key) {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((acc, row) => acc + toCount(row?.[key]), 0);
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCitizen, setSelectedCitizen] = useState(null);
  const [citizenDetail, setCitizenDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [topWards, setTopWards] = useState([]);
  const [enrichedRecent, setEnrichedRecent] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [response, wards, statsOverview, wardListResponse] =
          await Promise.all([
            getAdminDashboard(),
            getTopWards().catch(() => []),
            get("/api/admin/stats/overview").catch(() => null),
            get("/api/admin/wards").catch(() => []),
          ]);

        const wardList = Array.isArray(wardListResponse)
          ? wardListResponse
          : wardListResponse?.wards || [];

        const wardNameById = new Map(
          (wardList || [])
            .map((w) => {
              const id = w?.wardId ?? w?.id;
              const name = w?.wardName || w?.name || w?.Ward;
              return [id != null ? String(id) : "", name || ""];
            })
            .filter(([id, name]) => Boolean(id) && Boolean(name)),
        );

        if (mounted) {
          setData(response);
          setTopWards(wards);
          setOverview(statsOverview);

          // Enrich recent issues with full detail (image, type, ward)
          const recentList = response.recent || [];
          const enriched = await Promise.all(
            recentList.slice(0, 6).map(async (issue) => {
              try {
                const detail = await getIssueDetail(issue.id);
                const evidence = resolveIssueEvidence(issue, detail);

                const wardId =
                  detail?.wardId ??
                  detail?.ward?.wardId ??
                  detail?.ward?.id ??
                  issue.wardId ??
                  issue.ward?.wardId ??
                  issue.ward?.id;

                const wardName =
                  detail?.wardName ||
                  detail?.ward?.wardName ||
                  detail?.ward?.name ||
                  issue.wardName ||
                  issue.ward?.wardName ||
                  issue.ward?.name ||
                  (wardId != null ? wardNameById.get(String(wardId)) : "") ||
                  "";

                return {
                  id: issue.id,
                  title: detail?.title || issue.title || "Untitled",
                  issueType: detail?.issueType || "OTHER",
                  wardId,
                  wardName,
                  ...evidence,
                  createdAt:
                    detail?.createAt ||
                    detail?.createdAt ||
                    issue.createdAt ||
                    "",
                  stages: detail?.stages || issue.stages || "",
                };
              } catch {
                const evidence = resolveIssueEvidence(issue, null);
                const wardId =
                  issue.wardId ?? issue.ward?.wardId ?? issue.ward?.id;
                const wardName =
                  issue.wardName ||
                  issue.ward?.wardName ||
                  issue.ward?.name ||
                  (wardId != null ? wardNameById.get(String(wardId)) : "") ||
                  "";
                return {
                  id: issue.id,
                  title: issue.title || "Untitled",
                  issueType: "OTHER",
                  wardId,
                  wardName,
                  ...evidence,
                  createdAt: issue.createdAt || "",
                  stages: issue.stages || "",
                };
              }
            }),
          );
          if (mounted) setEnrichedRecent(enriched);
        }
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load dashboard.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Use /api/admin/stats/overview for accurate counts
  const metrics = useMemo(() => {
    if (!data && !overview) return null;
    const reportedFromWards = sumRows(data?.wardMatrix, "reported");
    const solvedFromWards = sumRows(data?.wardMatrix, "solved");
    const inBetweenFromWards = sumRows(data?.wardMatrix, "inBetween");
    return {
      totalReported: reportedFromWards || overview?.totalIssuesReported || 0,
      totalSolved: solvedFromWards || overview?.totalIssuesResolved || 0,
      inBetween:
        inBetweenFromWards ||
        Math.max(
          (reportedFromWards || overview?.totalIssuesReported || 0) -
            (solvedFromWards || overview?.totalIssuesResolved || 0),
          0,
        ),
      workers: overview?.workerCount ?? data?.workers?.length ?? 0,
      supervisors: overview?.supervisorCount ?? data?.supervisors?.length ?? 0,
      slaBreached: toCount(data?.slaBreaches),
    };
  }, [data, overview]);

  const stageChartData = useMemo(() => {
    const source =
      Array.isArray(data?.stageMatrix) && data.stageMatrix.length
        ? data.stageMatrix
        : data?.weeklyStages || [];
    if (!source.length) return [];
    return source.map((item) => {
      const rawStage = String(
        item.stage || item.stages || item.name || "",
      ).toUpperCase();
      return {
        stage: rawStage.replaceAll("_", " "),
        count: toCount(item.count),
        rawStage,
      };
    });
  }, [data]);

  async function openCitizenDetail(item) {
    setSelectedCitizen(item);
    setCitizenDetail(null);
    setDetailError("");

    const citizenId = item?.id || item?.userId;
    if (!citizenId) {
      setDetailError(
        "Citizen detail ID is missing in leaderboard response for this user.",
      );
      return;
    }

    setDetailLoading(true);
    try {
      const detail = await getAdminCitizenDetail(citizenId);
      setCitizenDetail(detail);
    } catch (err) {
      setDetailError(err.message || "Failed to load citizen details.");
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="pt-24 px-8 pb-12 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black text-primary">Command Center</h1>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl bg-surface-container-high text-sm font-bold"
        >
          Refresh
        </button>
      </div>

      {loading && (
        <p className="text-on-surface-variant">Loading dashboard...</p>
      )}
      {error && <p className="text-error">{error}</p>}

      {!loading && !error && metrics && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-surface-container-lowest rounded-xl p-5 border-l-4 border-primary">
              <p className="text-xs uppercase font-bold text-outline">
                Reported
              </p>
              <p className="text-3xl font-black">{metrics.totalReported}</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 border-l-4 border-secondary">
              <p className="text-xs uppercase font-bold text-outline">Solved</p>
              <p className="text-3xl font-black">{metrics.totalSolved}</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 border-l-4 border-tertiary">
              <p className="text-xs uppercase font-bold text-outline">
                In Progress
              </p>
              <p className="text-3xl font-black">{metrics.inBetween}</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 border-l-4 border-primary-container">
              <p className="text-xs uppercase font-bold text-outline">
                Workers
              </p>
              <p className="text-3xl font-black">{metrics.workers}</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 border-l-4 border-secondary-container">
              <p className="text-xs uppercase font-bold text-outline">
                Supervisors
              </p>
              <p className="text-3xl font-black">{metrics.supervisors}</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-5 border-l-4 border-error">
              <p className="text-xs uppercase font-bold text-outline">
                SLA Breached (30d)
              </p>
              <p className="text-3xl font-black">{metrics.slaBreached}</p>
            </div>
          </section>

          {/* Weekly Stage Breakdown — BAR CHART */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <article className="bg-surface-container-lowest rounded-xl p-6">
              <h2 className="font-bold text-lg mb-4">Weekly Stage Breakdown</h2>
              {stageChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={stageChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis
                      dataKey="stage"
                      type="category"
                      width={110}
                      tick={{ fontSize: 11, fontWeight: 600 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(255,255,255,0.96)",
                        border: "1px solid rgba(0,0,0,0.08)",
                        borderRadius: "12px",
                        fontSize: 13,
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={24}>
                      {stageChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={STAGE_COLORS[entry.rawStage] || "#94a3b8"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center">
                  <p className="text-sm text-outline">
                    No stage stats available.
                  </p>
                </div>
              )}
            </article>

            {/* Recent Issues — Cards with Image, Title, Type, Date */}
            <article className="bg-surface-container-lowest rounded-xl p-6">
              <h2 className="font-bold text-lg mb-4">Recent Issues</h2>
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {enrichedRecent.length > 0
                  ? enrichedRecent.map((issue) => {
                      const bestThumb = toAbsoluteImageUrl(
                        issue.resolvedImageUrl ||
                          issue.previousImageUrl ||
                          issue.imageUrl,
                      );

                      return (
                        <div
                          key={issue.id}
                          className="flex items-center gap-3 rounded-xl border border-outline-variant/15 p-3 hover:bg-surface-container-low/60 transition-colors cursor-pointer group"
                          onClick={() => navigate(`/admin/issues/${issue.id}`)}
                        >
                          {/* Thumbnail */}
                          <div className="w-20 h-14 rounded-lg overflow-hidden bg-surface-container-low flex-shrink-0">
                            {bestThumb ? (
                              <img
                                src={bestThumb}
                                alt="Evidence"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-outline text-xs">
                                -
                              </div>
                            )}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                              {issue.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary">
                                {(issue.issueType || "").replaceAll("_", " ")}
                              </span>
                              {(issue.wardName || issue.wardId) && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface-container-low text-on-surface-variant">
                                  {issue.wardName || `Ward ${issue.wardId}`}
                                </span>
                              )}
                              <span className="text-[11px] text-outline">
                                {formatDate(issue.createdAt)}
                              </span>
                            </div>
                          </div>
                          {/* Arrow */}
                          <span className="text-outline group-hover:text-primary transition-colors flex-shrink-0">
                            →
                          </span>
                        </div>
                      );
                    })
                  : !loading && (
                      <p className="text-sm text-outline py-4 text-center">
                        No recent issues found.
                      </p>
                    )}
              </div>
            </article>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <article className="bg-surface-container-lowest rounded-xl p-6">
              <h2 className="font-bold text-lg mb-4">
                Top Wards by Efficiency
              </h2>
              <div className="space-y-2">
                {(topWards || []).map((ward, index) => (
                  <div
                    key={ward.wardName}
                    className="flex justify-between items-center rounded-lg border border-outline-variant/15 p-3"
                  >
                    <div>
                      <div className="font-semibold text-primary">
                        #{index + 1} {ward.wardName}
                      </div>
                      <p className="text-[10px] text-outline uppercase font-bold">
                        Sup: {ward.supervisorName || "N/A"}
                      </p>
                    </div>
                    <span className="font-black text-sm">
                      {Number(ward.points || 0).toFixed(1)} Pts
                    </span>
                  </div>
                ))}
                {!topWards?.length && (
                  <p className="text-sm text-outline">
                    No top ward data found.
                  </p>
                )}
              </div>
            </article>
            <article className="bg-surface-container-lowest rounded-xl p-6">
              <h2 className="font-bold text-lg mb-4">Citizen Ranking</h2>
              <div className="space-y-2">
                {(data.leaderboard || []).slice(0, 5).map((citizen, index) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  const medal = medals[index] || null;
                  const isTop3 = index < 3;
                  return (
                    <div
                      key={`${citizen.fullName}-${index}`}
                      className={`flex items-center gap-3 rounded-xl p-3 transition-colors cursor-pointer ${
                        isTop3
                          ? "bg-gradient-to-r from-primary/5 to-transparent border border-primary/10"
                          : "border border-outline-variant/10 hover:bg-surface-container-low/60"
                      }`}
                      onClick={() => openCitizenDetail(citizen)}
                    >
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isTop3 ? "bg-primary/10" : "bg-surface-container-low"
                        }`}
                      >
                        {medal ? (
                          <span className="text-lg">{medal}</span>
                        ) : (
                          <span className="text-xs font-black text-outline">
                            {index + 1}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-semibold text-sm truncate ${isTop3 ? "text-primary" : ""}`}
                        >
                          {citizen.fullName || "Unknown Citizen"}
                        </p>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-lg text-xs font-black ${
                          isTop3
                            ? "bg-primary/10 text-primary"
                            : "bg-surface-container-low text-on-surface"
                        }`}
                      >
                        {citizen.score ?? 0}
                      </div>
                    </div>
                  );
                })}
                {!data.leaderboard?.length && (
                  <p className="text-sm text-outline py-4 text-center">
                    No citizen ranking data found.
                  </p>
                )}
              </div>
            </article>
          </section>
        </>
      )}
    </div>
  );
}
