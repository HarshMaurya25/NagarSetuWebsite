import React, { useCallback, useEffect, useState } from "react";
import {
  loginAnyRole,
  getWorkerAssignedIssues,
  acceptIssue,
  completeIssue,
  getIssueDetail,
} from "../../services/api";
import { clearSession, setSession } from "../../lib/session";

/* ─── Constants ───────────────────────────────────── */

const ROLES = ["CITIZEN", "WORKER", "SUPERVISOR", "ADMIN"];

const ROLE_COLORS = {
  CITIZEN: { bg: "from-emerald-500 to-teal-600", badge: "bg-emerald-500" },
  WORKER: { bg: "from-amber-500 to-orange-600", badge: "bg-amber-500" },
  SUPERVISOR: { bg: "from-violet-500 to-purple-600", badge: "bg-violet-500" },
  ADMIN: { bg: "from-rose-500 to-pink-600", badge: "bg-rose-500" },
};

const STAGE_CHIPS = {
  PENDING: "bg-gray-500/15 text-gray-400 border-gray-500/20",
  ACKNOWLEDGED: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  TEAM_ASSIGNED: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  IN_PROGRESS: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  RESOLVED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  RECONSIDERED: "bg-rose-500/15 text-rose-400 border-rose-500/20",
};

const CRITICALITY_DOT = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-emerald-500",
};

/* ─── Denial messages per role ────────────────────── */

const DENIAL_MAP = {
  CITIZEN: {
    icon: "person",
    title: "Citizen Account Detected",
    message: "Citizens report and track issues. Please use the",
    link: "#/test-issue",
    linkText: "Citizen Test Endpoint",
    color: "emerald",
  },
  USER: {
    icon: "person",
    title: "User Account Detected",
    message: "Users report and track issues. Please use the",
    link: "#/test-issue",
    linkText: "Citizen Test Endpoint",
    color: "emerald",
  },
  SUPERVISOR: {
    icon: "supervisor_account",
    title: "Supervisor Access",
    message:
      "Supervisors manage workers and wards through the supervisor dashboard. Worker-level actions are not available for this role.",
    link: "#/supervisor/dashboard",
    linkText: "Supervisor Dashboard",
    color: "violet",
  },
  ADMIN: {
    icon: "admin_panel_settings",
    title: "Administrator Access",
    message:
      "Admins manage the entire workforce from the admin panel. Worker-level actions are not available for this role.",
    link: "#/admin/workforce",
    linkText: "Admin Workforce Panel",
    color: "rose",
  },
};

/* ─── Page ────────────────────────────────────────── */

export default function TestWorkerPage() {
  /* ┌── Auth ─────────────────────────────────────────┐ */
  const [auth, setAuth] = useState(null);
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
    role: "WORKER",
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  /* ┌── Issues ───────────────────────────────────────┐ */
  const [issues, setIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({}); // { [issueId]: "accept"|"complete" }
  const [actionMsg, setActionMsg] = useState({ id: null, text: "", type: "" });
  const [expandedId, setExpandedId] = useState(null);
  const [expandedDetail, setExpandedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /* ═══════════════════════════════════════════════════ */
  /*  LOGIN                                             */
  /* ═══════════════════════════════════════════════════ */

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      const result = await loginAnyRole(loginForm);
      if (!result?.token) throw new Error("No token returned from server.");
      setSession(result);
      setAuth(result);
    } catch (err) {
      setLoginError(err.message || "Login failed.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setAuth(null);
    setIssues([]);
    setExpandedId(null);
    setExpandedDetail(null);
  };

  /* ═══════════════════════════════════════════════════ */
  /*  LOAD ISSUES                                       */
  /* ═══════════════════════════════════════════════════ */

  const loadIssues = useCallback(async () => {
    if (!auth?.user?.id) return;
    setIssuesLoading(true);
    try {
      const data = await getWorkerAssignedIssues(auth.user.id);
      setIssues(Array.isArray(data) ? data : data?.content || []);
    } catch {
      setIssues([]);
    } finally {
      setIssuesLoading(false);
    }
  }, [auth?.user?.id]);

  useEffect(() => {
    if (auth && auth.user?.role === "WORKER") loadIssues();
  }, [auth, loadIssues]);

  /* ═══════════════════════════════════════════════════ */
  /*  ACCEPT / COMPLETE                                  */
  /* ═══════════════════════════════════════════════════ */

  const handleAccept = async (issueId) => {
    setActionLoading((p) => ({ ...p, [issueId]: "accept" }));
    setActionMsg({ id: null, text: "", type: "" });
    try {
      await acceptIssue(issueId);
      setActionMsg({ id: issueId, text: "Issue accepted!", type: "success" });
      await loadIssues();
    } catch (err) {
      setActionMsg({
        id: issueId,
        text: err.message || "Accept failed.",
        type: "error",
      });
    } finally {
      setActionLoading((p) => {
        const n = { ...p };
        delete n[issueId];
        return n;
      });
    }
  };

  const handleComplete = async (issueId) => {
    setActionLoading((p) => ({ ...p, [issueId]: "complete" }));
    setActionMsg({ id: null, text: "", type: "" });
    try {
      await completeIssue(issueId);
      setActionMsg({
        id: issueId,
        text: "Issue marked as completed!",
        type: "success",
      });
      await loadIssues();
    } catch (err) {
      setActionMsg({
        id: issueId,
        text: err.message || "Complete failed.",
        type: "error",
      });
    } finally {
      setActionLoading((p) => {
        const n = { ...p };
        delete n[issueId];
        return n;
      });
    }
  };

  /* ═══════════════════════════════════════════════════ */
  /*  EXPAND DETAIL                                     */
  /* ═══════════════════════════════════════════════════ */

  const toggleExpand = async (issueId) => {
    if (expandedId === issueId) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(issueId);
    setDetailLoading(true);
    try {
      const d = await getIssueDetail(issueId);
      setExpandedDetail(d);
    } catch {
      setExpandedDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  /* ═══════════════════════════════════════════════════ */
  /*  RENDER — Not Logged In                            */
  /* ═══════════════════════════════════════════════════ */

  if (!auth) {
    return (
      <main className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-6 font-['Inter']">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-gradient-to-bl from-amber-600/10 to-transparent rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-gradient-to-tr from-orange-600/8 to-transparent rounded-full blur-3xl" />
        </div>

        <section className="relative w-full max-w-md bg-[#111827]/80 backdrop-blur-2xl border border-white/[0.06] rounded-3xl p-8 shadow-2xl shadow-black/40">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-xl">
                engineering
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Test Worker Endpoint
              </h1>
              <p className="text-xs text-gray-400">
                Worker issue management test
              </p>
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label
                className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider"
                htmlFor="worker-email"
              >
                Email
              </label>
              <input
                id="worker-email"
                type="email"
                required
                value={loginForm.email}
                onChange={(e) =>
                  setLoginForm((p) => ({ ...p, email: e.target.value }))
                }
                className="w-full bg-white/[0.04] border border-white/[0.08] text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-all placeholder:text-gray-600"
                placeholder="worker@example.com"
              />
            </div>
            <div>
              <label
                className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider"
                htmlFor="worker-password"
              >
                Password
              </label>
              <input
                id="worker-password"
                type="password"
                required
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm((p) => ({ ...p, password: e.target.value }))
                }
                className="w-full bg-white/[0.04] border border-white/[0.08] text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-all placeholder:text-gray-600"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                Role
              </label>
              <div className="grid grid-cols-4 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setLoginForm((p) => ({ ...p, role: r }))}
                    className={`px-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      loginForm.role === r
                        ? `bg-gradient-to-r ${ROLE_COLORS[r].bg} text-white shadow-lg scale-[1.03]`
                        : "bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] border border-white/[0.06]"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {loginError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white py-3.5 rounded-xl font-bold disabled:opacity-50 transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30"
            >
              {loginLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] text-gray-500">
            Worker-only endpoint —{" "}
            <span className="text-gray-400 font-semibold">
              non-worker roles will be denied access
            </span>
            .
          </p>
        </section>
      </main>
    );
  }

  /* ═══════════════════════════════════════════════════ */
  /*  RENDER — Authenticated but NOT Worker             */
  /* ═══════════════════════════════════════════════════ */

  const role = auth.user?.role || "CITIZEN";
  const roleColor = ROLE_COLORS[role] || ROLE_COLORS.CITIZEN;

  if (role !== "WORKER") {
    const denial = DENIAL_MAP[role] || DENIAL_MAP.CITIZEN;
    const colorMap = {
      emerald: {
        border: "border-emerald-500/20",
        bg: "bg-emerald-500/5",
        icon: "text-emerald-400",
        title: "text-emerald-300",
        link: "text-emerald-400 hover:text-emerald-300",
      },
      violet: {
        border: "border-violet-500/20",
        bg: "bg-violet-500/5",
        icon: "text-violet-400",
        title: "text-violet-300",
        link: "text-violet-400 hover:text-violet-300",
      },
      rose: {
        border: "border-rose-500/20",
        bg: "bg-rose-500/5",
        icon: "text-rose-400",
        title: "text-rose-300",
        link: "text-rose-400 hover:text-rose-300",
      },
    };
    const c = colorMap[denial.color] || colorMap.emerald;

    return (
      <main className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-6 font-['Inter']">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-gradient-to-bl from-red-600/8 to-transparent rounded-full blur-3xl" />
        </div>

        <section
          className={`relative w-full max-w-lg ${c.bg} border ${c.border} rounded-3xl p-10 text-center`}
        >
          <span
            className={`material-symbols-outlined text-6xl ${c.icon} mb-4 block`}
          >
            {denial.icon}
          </span>

          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={`w-2 h-2 rounded-full ${roleColor.badge}`} />
            <span className="text-xs text-gray-400 font-semibold">
              {auth.user?.fullName}
            </span>
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${roleColor.badge} text-white`}
            >
              {role}
            </span>
          </div>

          <h2 className={`text-2xl font-bold ${c.title} mb-3`}>
            {denial.title}
          </h2>
          <p className="text-gray-400 mb-6 max-w-sm mx-auto">
            {denial.message}{" "}
            {denial.link && (
              <a
                href={denial.link}
                className={`underline font-semibold transition-colors ${c.link}`}
              >
                {denial.linkText}
              </a>
            )}
            .
          </p>

          <button
            onClick={handleLogout}
            className="bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-gray-300 px-8 py-3 rounded-xl font-semibold transition-all"
          >
            Logout & Try Again
          </button>
        </section>
      </main>
    );
  }

  /* ═══════════════════════════════════════════════════ */
  /*  RENDER — Worker Dashboard                         */
  /* ═══════════════════════════════════════════════════ */

  const countByStage = issues.reduce((acc, i) => {
    const s = i.stages || i.stage || "PENDING";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-[#0a0e1a] font-['Inter'] text-white">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-60 -left-60 w-[700px] h-[700px] bg-gradient-to-br from-amber-600/[0.06] to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-gradient-to-tl from-orange-600/[0.04] to-transparent rounded-full blur-3xl" />
      </div>

      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-[#0a0e1a]/80 backdrop-blur-2xl border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-lg">
                engineering
              </span>
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">
                Test Worker
              </h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                Worker Endpoint
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.06] rounded-full px-4 py-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs font-semibold text-gray-300">
                {auth.user?.fullName}
              </span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500 text-white">
                WORKER
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors group"
              title="Logout"
            >
              <span className="material-symbols-outlined text-gray-500 group-hover:text-red-400 transition-colors">
                logout
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="relative max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Row */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Assigned",
              value: issues.length,
              icon: "assignment",
              color: "from-amber-500/20 to-amber-600/5",
            },
            {
              label: "In Progress",
              value: countByStage.IN_PROGRESS || 0,
              icon: "pending_actions",
              color: "from-blue-500/20 to-blue-600/5",
            },
            {
              label: "Completed",
              value: countByStage.RESOLVED || 0,
              icon: "task_alt",
              color: "from-emerald-500/20 to-emerald-600/5",
            },
            {
              label: "Pending",
              value:
                (countByStage.PENDING || 0) +
                (countByStage.ACKNOWLEDGED || 0) +
                (countByStage.TEAM_ASSIGNED || 0),
              icon: "schedule",
              color: "from-gray-500/20 to-gray-600/5",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`bg-gradient-to-br ${s.color} border border-white/[0.04] rounded-2xl p-5`}
            >
              <span className="material-symbols-outlined text-gray-500 text-xl mb-2 block">
                {s.icon}
              </span>
              <p className="text-2xl font-black text-white">{s.value}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">
                {s.label}
              </p>
            </div>
          ))}
        </section>

        {/* Header + Refresh */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400">
              assignment
            </span>
            Assigned Issues
          </h2>
          <button
            onClick={loadIssues}
            disabled={issuesLoading}
            className="flex items-center gap-1.5 text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] px-4 py-2 rounded-xl transition-colors text-gray-400 hover:text-white"
          >
            <span
              className={`material-symbols-outlined text-sm ${issuesLoading ? "animate-spin" : ""}`}
            >
              refresh
            </span>
            Refresh
          </button>
        </div>

        {/* Loading */}
        {issuesLoading && (
          <div className="flex justify-center py-20">
            <span className="w-10 h-10 border-4 border-gray-700 border-t-amber-400 rounded-full animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!issuesLoading && issues.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <span className="material-symbols-outlined text-6xl mb-4 block text-gray-700">
              work_off
            </span>
            <p className="text-lg font-semibold text-gray-400 mb-1">
              No Issues Assigned
            </p>
            <p className="text-sm">
              There are no issues assigned to you at this time.
            </p>
          </div>
        )}

        {/* Issue Cards */}
        {!issuesLoading && issues.length > 0 && (
          <div className="space-y-4">
            {issues.map((issue) => {
              const stage = issue.stages || issue.stage || "PENDING";
              const stageClass = STAGE_CHIPS[stage] || STAGE_CHIPS.PENDING;
              const isExpanded = expandedId === issue.id;
              const isActionLoading = actionLoading[issue.id];

              return (
                <article
                  key={issue.id}
                  className={`bg-[#111827]/60 backdrop-blur-xl border rounded-2xl overflow-hidden transition-all ${
                    isExpanded
                      ? "border-amber-500/20"
                      : "border-white/[0.04] hover:border-white/[0.08]"
                  }`}
                >
                  <div
                    className="flex items-center gap-4 p-5 cursor-pointer"
                    onClick={() => toggleExpand(issue.id)}
                  >
                    {/* Criticality dot */}
                    <div
                      className={`w-3 h-3 rounded-full shrink-0 ${CRITICALITY_DOT[issue.criticality] || CRITICALITY_DOT.LOW}`}
                    />

                    {/* Image thumb */}
                    {issue.imageUrl && (
                      <img
                        src={issue.imageUrl}
                        alt=""
                        className="w-14 h-14 rounded-xl object-cover shrink-0 border border-white/[0.06]"
                      />
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-200 truncate">
                        {issue.title || issue.issueType || "Untitled"}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 uppercase">
                        <span>
                          {(issue.issueType || "").replaceAll("_", " ")}
                        </span>
                        <span>·</span>
                        <span>{issue.location || "No location"}</span>
                      </div>
                    </div>

                    {/* Stage chip */}
                    <span
                      className={`shrink-0 text-[10px] font-bold uppercase px-3 py-1.5 rounded-xl border ${stageClass}`}
                    >
                      {stage.replaceAll("_", " ")}
                    </span>

                    {/* Expand arrow */}
                    <span
                      className={`material-symbols-outlined text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    >
                      expand_more
                    </span>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t border-white/[0.04] px-5 py-5 space-y-4">
                      {detailLoading && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="w-3.5 h-3.5 border-2 border-gray-600 border-t-amber-400 rounded-full animate-spin" />
                          Loading details…
                        </div>
                      )}

                      {!detailLoading && expandedDetail && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            <p className="text-gray-500">
                              <span className="text-gray-300 font-semibold">
                                Title:
                              </span>{" "}
                              {expandedDetail.title || "N/A"}
                            </p>
                            <p className="text-gray-500">
                              <span className="text-gray-300 font-semibold">
                                Description:
                              </span>{" "}
                              {expandedDetail.description || "N/A"}
                            </p>
                            <p className="text-gray-500">
                              <span className="text-gray-300 font-semibold">
                                Location:
                              </span>{" "}
                              {expandedDetail.location || "N/A"}
                            </p>
                            <p className="text-gray-500">
                              <span className="text-gray-300 font-semibold">
                                Criticality:
                              </span>{" "}
                              {expandedDetail.criticality || "N/A"}
                            </p>
                          </div>
                          {expandedDetail.imageUrl && (
                            <div>
                              <img
                                src={expandedDetail.imageUrl}
                                alt="Issue"
                                className="w-full max-h-48 rounded-xl object-cover border border-white/[0.06]"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action feedback */}
                      {actionMsg.id === issue.id && actionMsg.text && (
                        <p
                          className={`text-xs px-3 py-2 rounded-xl border ${
                            actionMsg.type === "success"
                              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                              : "text-red-400 bg-red-500/10 border-red-500/20"
                          }`}
                        >
                          {actionMsg.text}
                        </p>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-1">
                        <button
                          onClick={() => handleAccept(issue.id)}
                          disabled={
                            !!isActionLoading ||
                            stage === "IN_PROGRESS" ||
                            stage === "RESOLVED"
                          }
                          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold disabled:opacity-30 transition-all shadow-lg shadow-blue-500/15"
                        >
                          {isActionLoading === "accept" ? (
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <span className="material-symbols-outlined text-sm">
                              check
                            </span>
                          )}
                          Accept Issue
                        </button>
                        <button
                          onClick={() => handleComplete(issue.id)}
                          disabled={!!isActionLoading || stage === "RESOLVED"}
                          className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold disabled:opacity-30 transition-all shadow-lg shadow-emerald-500/15"
                        >
                          {isActionLoading === "complete" ? (
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <span className="material-symbols-outlined text-sm">
                              task_alt
                            </span>
                          )}
                          Mark Completed
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
