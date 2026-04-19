import React, { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  loginAnyRole,
  createIssue,
  getNearbyIssues,
  getUserIssues,
  getAdminStatsOverview,
} from "../../services/api";
import { clearSession, setSession } from "../../lib/session";

/* ─── Constants ───────────────────────────────────────────────── */

const ROLES = ["CITIZEN", "WORKER", "SUPERVISOR", "ADMIN"];

const ISSUE_TYPES = [
  "POTHOLE",
  "DRAINAGE_SEWER",
  "WASTE_MANAGEMENT",
  "INFRASTRUCTURE",
  "ENCROACHMENT",
  "OTHER",
];

const ROLE_COLORS = {
  CITIZEN: { bg: "from-emerald-500 to-teal-600", badge: "bg-emerald-500" },
  WORKER: { bg: "from-amber-500 to-orange-600", badge: "bg-amber-500" },
  SUPERVISOR: { bg: "from-violet-500 to-purple-600", badge: "bg-violet-500" },
  ADMIN: { bg: "from-rose-500 to-pink-600", badge: "bg-rose-500" },
};

const CRITICALITY_COLORS = {
  HIGH: "text-red-400 bg-red-500/10 border-red-500/20",
  MEDIUM: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  LOW: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

/* ─── Page ────────────────────────────────────────────────────── */

export default function TestIssuePage() {
  /* ┌── Auth State (page-scoped, not global) ─────────┐ */
  const [auth, setAuth] = useState(null);
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
    role: "CITIZEN",
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  /* ┌── Issue Form State ─────────────────────────────┐ */
  const [issueForm, setIssueForm] = useState({
    title: "",
    description: "",
    issueType: "POTHOLE",
    location: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [mapCoords, setMapCoords] = useState(null);
  const [creatingIssue, setCreatingIssue] = useState(false);
  const [createMsg, setCreateMsg] = useState({ text: "", type: "" });

  /* ┌── Nearby & My Issues ───────────────────────────┐ */
  const [nearbyIssues, setNearbyIssues] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyDismissed, setNearbyDismissed] = useState(false);
  const [myIssues, setMyIssues] = useState([]);
  const [myIssuesLoading, setMyIssuesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("create"); // "create" | "my-issues"

  /* ┌── Admin/Supervisor extras ──────────────────────┐ */
  const [adminOverview, setAdminOverview] = useState(null);

  /* ┌── Map Refs ─────────────────────────────────────┐ */
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

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
    setMyIssues([]);
    setNearbyIssues([]);
    setNearbyDismissed(false);
    setMapCoords(null);
    setImageFile(null);
    setImagePreview(null);
    setCreateMsg({ text: "", type: "" });
    setIssueForm({
      title: "",
      description: "",
      issueType: "POTHOLE",
      location: "",
    });
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  };

  /* ═══════════════════════════════════════════════════ */
  /*  MAP                                               */
  /* ═══════════════════════════════════════════════════ */

  useEffect(() => {
    if (!auth || mapRef.current) return;
    if (!mapNodeRef.current) return;

    const map = L.map(mapNodeRef.current).setView([28.6139, 77.209], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      setMapCoords({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
      setNearbyDismissed(false);

      if (markerRef.current) markerRef.current.remove();
      markerRef.current = L.marker([lat, lng]).addTo(map);
    });

    // Try geolocation
    if (navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 14),
        () => {},
        { timeout: 5000 },
      );
    }

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);
    setTimeout(() => map.invalidateSize(), 800);
  }, [auth]);

  /* ═══════════════════════════════════════════════════ */
  /*  NEARBY CHECK                                      */
  /* ═══════════════════════════════════════════════════ */

  useEffect(() => {
    if (!mapCoords || nearbyDismissed) return;
    let cancelled = false;

    async function check() {
      setNearbyLoading(true);
      try {
        const data = await getNearbyIssues(mapCoords.lat, mapCoords.lng, 1);
        if (!cancelled) {
          const list = Array.isArray(data) ? data : data?.content || [];
          setNearbyIssues(list);
        }
      } catch {
        if (!cancelled) setNearbyIssues([]);
      } finally {
        if (!cancelled) setNearbyLoading(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [mapCoords, nearbyDismissed]);

  /* ═══════════════════════════════════════════════════ */
  /*  CREATE ISSUE                                      */
  /* ═══════════════════════════════════════════════════ */

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!mapCoords) {
      setCreateMsg({
        text: "Please select a location on the map.",
        type: "error",
      });
      return;
    }
    setCreatingIssue(true);
    setCreateMsg({ text: "", type: "" });

    try {
      const fd = new FormData();
      fd.append("title", issueForm.title);
      fd.append("description", issueForm.description);
      fd.append("issueType", issueForm.issueType);
      fd.append("latitude", mapCoords.lat);
      fd.append("longitude", mapCoords.lng);
      fd.append(
        "location",
        issueForm.location || `${mapCoords.lat}, ${mapCoords.lng}`,
      );
      if (imageFile) fd.append("image", imageFile);

      await createIssue(fd);
      setCreateMsg({ text: "Issue created successfully!", type: "success" });
      setIssueForm({
        title: "",
        description: "",
        issueType: "POTHOLE",
        location: "",
      });
      setImageFile(null);
      setImagePreview(null);
      setMapCoords(null);
      setNearbyIssues([]);
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    } catch (err) {
      setCreateMsg({
        text: err.message || "Failed to create issue.",
        type: "error",
      });
    } finally {
      setCreatingIssue(false);
    }
  };

  /* ═══════════════════════════════════════════════════ */
  /*  MY ISSUES                                         */
  /* ═══════════════════════════════════════════════════ */

  const loadMyIssues = useCallback(async () => {
    if (!auth?.user?.id) return;
    setMyIssuesLoading(true);
    try {
      const data = await getUserIssues(auth.user.id);
      setMyIssues(Array.isArray(data) ? data : data?.content || []);
    } catch {
      setMyIssues([]);
    } finally {
      setMyIssuesLoading(false);
    }
  }, [auth?.user?.id]);

  useEffect(() => {
    if (activeTab === "my-issues" && auth?.user?.id) loadMyIssues();
  }, [activeTab, auth?.user?.id, loadMyIssues]);

  /* ── Admin overview ── */
  useEffect(() => {
    if (!auth) return;
    const r = auth.user?.role;
    if (r === "ADMIN" || r === "SUPERVISOR") {
      getAdminStatsOverview()
        .then(setAdminOverview)
        .catch(() => setAdminOverview(null));
    }
  }, [auth]);

  /* ═══════════════════════════════════════════════════ */
  /*  IMAGE HANDLER                                     */
  /* ═══════════════════════════════════════════════════ */

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  /* ═══════════════════════════════════════════════════ */
  /*  RENDER — Not Logged In                            */
  /* ═══════════════════════════════════════════════════ */

  if (!auth) {
    return (
      <main className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-6 font-['Inter']">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-gradient-to-br from-blue-600/10 to-transparent rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-gradient-to-tl from-emerald-600/10 to-transparent rounded-full blur-3xl" />
        </div>

        <section className="relative w-full max-w-md bg-[#111827]/80 backdrop-blur-2xl border border-white/[0.06] rounded-3xl p-8 shadow-2xl shadow-black/40">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-xl">
                bug_report
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Test Issue Endpoint
              </h1>
              <p className="text-xs text-gray-400">
                Citizen issue management test
              </p>
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label
                className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider"
                htmlFor="test-email"
              >
                Email
              </label>
              <input
                id="test-email"
                type="email"
                required
                value={loginForm.email}
                onChange={(e) =>
                  setLoginForm((p) => ({ ...p, email: e.target.value }))
                }
                className="w-full bg-white/[0.04] border border-white/[0.08] text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-gray-600"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label
                className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider"
                htmlFor="test-password"
              >
                Password
              </label>
              <input
                id="test-password"
                type="password"
                required
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm((p) => ({ ...p, password: e.target.value }))
                }
                className="w-full bg-white/[0.04] border border-white/[0.08] text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-gray-600"
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
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3.5 rounded-xl font-bold disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
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
            This endpoint is for{" "}
            <span className="text-gray-400 font-semibold">testing only</span> —
            mobile app integration pending.
          </p>
        </section>
      </main>
    );
  }

  /* ═══════════════════════════════════════════════════ */
  /*  RENDER — Authenticated                            */
  /* ═══════════════════════════════════════════════════ */

  const role = auth.user?.role || "CITIZEN";
  const roleColor = ROLE_COLORS[role] || ROLE_COLORS.CITIZEN;
  const canCreateIssue =
    role === "CITIZEN" ||
    role === "USER" ||
    role === "SUPERVISOR" ||
    role === "ADMIN";

  return (
    <main className="min-h-screen bg-[#0a0e1a] font-['Inter'] text-white">
      {/* ─── Background blobs ─── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-60 -right-60 w-[700px] h-[700px] bg-gradient-to-bl from-blue-600/[0.07] to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-gradient-to-tr from-emerald-600/[0.05] to-transparent rounded-full blur-3xl" />
      </div>

      {/* ─── Top Bar ─── */}
      <header className="sticky top-0 z-50 bg-[#0a0e1a]/80 backdrop-blur-2xl border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-lg">
                bug_report
              </span>
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">
                Test Issue
              </h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                Citizen Endpoint
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.06] rounded-full px-4 py-2">
              <div className={`w-2 h-2 rounded-full ${roleColor.badge}`} />
              <span className="text-xs font-semibold text-gray-300">
                {auth.user?.fullName}
              </span>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${roleColor.badge} text-white`}
              >
                {role}
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

      <div className="relative max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* ─── Worker: Access Denied ─── */}
        {role === "WORKER" && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-8 text-center">
            <span className="material-symbols-outlined text-5xl text-amber-400 mb-4 block">
              engineering
            </span>
            <h2 className="text-xl font-bold text-amber-300 mb-2">
              Worker Role Detected
            </h2>
            <p className="text-gray-400 mb-4">
              Workers manage assigned issues. Please use the{" "}
              <a
                href="#/test-worker"
                className="text-amber-400 underline font-semibold hover:text-amber-300 transition-colors"
              >
                Worker Test Endpoint
              </a>{" "}
              instead.
            </p>
          </div>
        )}

        {/* ─── Admin/Supervisor: Overview Stats ─── */}
        {(role === "ADMIN" || role === "SUPERVISOR") && adminOverview && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Total Issues",
                value: adminOverview.totalIssues ?? "–",
                icon: "report",
                color: "from-blue-500/20 to-blue-600/5",
              },
              {
                label: "Resolved",
                value: adminOverview.resolved ?? "–",
                icon: "check_circle",
                color: "from-emerald-500/20 to-emerald-600/5",
              },
              {
                label: "Pending",
                value: adminOverview.pending ?? "–",
                icon: "pending",
                color: "from-amber-500/20 to-amber-600/5",
              },
              {
                label: "Workers",
                value: adminOverview.totalWorkers ?? "–",
                icon: "groups",
                color: "from-violet-500/20 to-violet-600/5",
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
            <p className="col-span-full text-xs text-gray-600 text-right italic">
              {role === "SUPERVISOR" ? "Supervisor" : "Admin"} overview —
              role-specific data
            </p>
          </section>
        )}

        {/* ─── Tabs ─── */}
        {canCreateIssue && (
          <div className="flex gap-2 bg-white/[0.02] border border-white/[0.04] rounded-2xl p-1.5">
            {[
              { id: "create", label: "Create Issue", icon: "add_circle" },
              { id: "my-issues", label: "My Issues", icon: "list_alt" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-blue-600/20 to-indigo-600/20 text-blue-400 border border-blue-500/20"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
                }`}
              >
                <span className="material-symbols-outlined text-lg">
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* ─── Create Issue Tab ─── */}
        {canCreateIssue && activeTab === "create" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Form */}
            <section className="bg-[#111827]/60 backdrop-blur-xl border border-white/[0.04] rounded-2xl p-6 space-y-5">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-400">
                  edit_note
                </span>
                Issue Details
              </h2>

              <form
                id="issue-create-form"
                onSubmit={handleCreate}
                className="space-y-4"
              >
                <div>
                  <label
                    className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider"
                    htmlFor="issue-title"
                  >
                    Title
                  </label>
                  <input
                    id="issue-title"
                    required
                    value={issueForm.title}
                    onChange={(e) =>
                      setIssueForm((p) => ({ ...p, title: e.target.value }))
                    }
                    className="w-full bg-white/[0.04] border border-white/[0.08] text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 placeholder:text-gray-600"
                    placeholder="e.g. Large pothole on MG Road"
                  />
                </div>

                <div>
                  <label
                    className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider"
                    htmlFor="issue-desc"
                  >
                    Description
                  </label>
                  <textarea
                    id="issue-desc"
                    required
                    rows={3}
                    value={issueForm.description}
                    onChange={(e) =>
                      setIssueForm((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                    className="w-full bg-white/[0.04] border border-white/[0.08] text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 placeholder:text-gray-600 resize-none"
                    placeholder="Describe the issue in detail…"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider"
                      htmlFor="issue-type"
                    >
                      Type
                    </label>
                    <select
                      id="issue-type"
                      value={issueForm.issueType}
                      onChange={(e) =>
                        setIssueForm((p) => ({
                          ...p,
                          issueType: e.target.value,
                        }))
                      }
                      className="w-full bg-white/[0.04] border border-white/[0.08] text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    >
                      {ISSUE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider"
                      htmlFor="issue-location-text"
                    >
                      Address
                    </label>
                    <input
                      id="issue-location-text"
                      value={issueForm.location}
                      onChange={(e) =>
                        setIssueForm((p) => ({
                          ...p,
                          location: e.target.value,
                        }))
                      }
                      className="w-full bg-white/[0.04] border border-white/[0.08] text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 placeholder:text-gray-600"
                      placeholder="Street name / area"
                    />
                  </div>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                    Photo
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      id="issue-image-upload"
                    />
                    <div
                      className={`flex items-center justify-center gap-3 border-2 border-dashed rounded-xl py-4 transition-colors ${
                        imagePreview
                          ? "border-blue-500/30 bg-blue-500/5"
                          : "border-white/[0.08] hover:border-white/[0.15]"
                      }`}
                    >
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="h-20 rounded-lg object-cover"
                        />
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-gray-500 text-2xl">
                            add_a_photo
                          </span>
                          <span className="text-sm text-gray-500">
                            Upload issue photo
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {imageFile && (
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500 truncate">
                        {imageFile.name}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(null);
                        }}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {/* Map coordinates readout */}
                {mapCoords && (
                  <div className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-2.5 text-xs">
                    <span className="material-symbols-outlined text-blue-400 text-sm">
                      pin_drop
                    </span>
                    <span className="text-gray-400">
                      Location:{" "}
                      <span className="text-blue-300 font-mono font-semibold">
                        {mapCoords.lat}, {mapCoords.lng}
                      </span>
                    </span>
                  </div>
                )}

                {createMsg.text && (
                  <p
                    className={`text-sm px-4 py-2.5 rounded-xl border ${
                      createMsg.type === "success"
                        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                        : "text-red-400 bg-red-500/10 border-red-500/20"
                    }`}
                  >
                    {createMsg.text}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={creatingIssue}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3.5 rounded-xl font-bold disabled:opacity-50 transition-all shadow-lg shadow-blue-500/15"
                >
                  {creatingIssue ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating…
                    </span>
                  ) : (
                    "Submit Issue"
                  )}
                </button>
              </form>
            </section>

            {/* Right: Map + Nearby */}
            <section className="space-y-5">
              <div className="bg-[#111827]/60 backdrop-blur-xl border border-white/[0.04] rounded-2xl p-4">
                <h2 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400 text-lg">
                    map
                  </span>
                  Select Location
                  <span className="text-[10px] text-gray-600 font-normal ml-auto">
                    Click on the map
                  </span>
                </h2>
                <div
                  ref={mapNodeRef}
                  className="h-[340px] rounded-xl overflow-hidden border border-white/[0.06]"
                  style={{ background: "#1a2332" }}
                />
              </div>

              {/* Nearby Recommendations */}
              {nearbyLoading && (
                <div className="flex items-center gap-2 bg-white/[0.02] rounded-xl p-4 text-xs text-gray-500">
                  <span className="w-3.5 h-3.5 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin" />
                  Checking for nearby issues…
                </div>
              )}

              {!nearbyLoading &&
                nearbyIssues.length > 0 &&
                !nearbyDismissed && (
                  <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-400">
                          info
                        </span>
                        <h3 className="text-sm font-bold text-amber-300">
                          {nearbyIssues.length} Nearby Issue
                          {nearbyIssues.length > 1 ? "s" : ""} Found
                        </h3>
                      </div>
                      <button
                        onClick={() => setNearbyDismissed(true)}
                        className="text-xs text-gray-500 hover:text-gray-300 bg-white/[0.04] px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Dismiss & Continue
                      </button>
                    </div>
                    <p className="text-xs text-gray-400">
                      Similar issues have been reported nearby. Consider
                      upvoting an existing one instead.
                    </p>
                    <div className="space-y-2 max-h-48 overflow-auto pr-1">
                      {nearbyIssues.map((ni, i) => (
                        <div
                          key={ni.id || i}
                          className="flex items-center justify-between bg-white/[0.03] rounded-xl px-4 py-3 border border-white/[0.04]"
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-200">
                              {ni.title || ni.issueType || "Issue"}
                            </p>
                            <p className="text-[10px] text-gray-500 uppercase">
                              {(ni.issueType || "").replaceAll("_", " ")} ·{" "}
                              {(ni.stages || ni.stage || "").replaceAll(
                                "_",
                                " ",
                              )}
                            </p>
                          </div>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg border ${CRITICALITY_COLORS[ni.criticality] || CRITICALITY_COLORS.LOW}`}
                          >
                            {ni.criticality || "LOW"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {!nearbyLoading && mapCoords && nearbyIssues.length === 0 && (
                <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-4 py-3 text-xs text-emerald-400">
                  <span className="material-symbols-outlined text-sm">
                    check_circle
                  </span>
                  No existing issues nearby — you can proceed with creation.
                </div>
              )}
            </section>
          </div>
        )}

        {/* ─── My Issues Tab ─── */}
        {canCreateIssue && activeTab === "my-issues" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-400">
                  list_alt
                </span>
                My Submitted Issues
              </h2>
              <button
                onClick={loadMyIssues}
                disabled={myIssuesLoading}
                className="flex items-center gap-1.5 text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] px-4 py-2 rounded-xl transition-colors text-gray-400 hover:text-white"
              >
                <span
                  className={`material-symbols-outlined text-sm ${myIssuesLoading ? "animate-spin" : ""}`}
                >
                  refresh
                </span>
                Refresh
              </button>
            </div>

            {myIssuesLoading && (
              <div className="flex justify-center py-16">
                <span className="w-8 h-8 border-3 border-gray-700 border-t-blue-400 rounded-full animate-spin" />
              </div>
            )}

            {!myIssuesLoading && myIssues.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                <span className="material-symbols-outlined text-5xl mb-3 block text-gray-700">
                  inbox
                </span>
                <p>You haven't submitted any issues yet.</p>
              </div>
            )}

            {!myIssuesLoading && myIssues.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {myIssues.map((issue) => (
                  <article
                    key={issue.id}
                    className="bg-[#111827]/60 backdrop-blur-xl border border-white/[0.04] rounded-2xl overflow-hidden hover:border-white/[0.08] transition-all group"
                  >
                    {issue.imageUrl && (
                      <div className="h-36 overflow-hidden">
                        <img
                          src={issue.imageUrl}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                        />
                      </div>
                    )}
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-gray-200 line-clamp-1">
                          {issue.title || "Untitled"}
                        </h3>
                        <span
                          className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-lg border ${CRITICALITY_COLORS[issue.criticality] || CRITICALITY_COLORS.LOW}`}
                        >
                          {issue.criticality || "LOW"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {issue.location || "No location"}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-gray-600 uppercase">
                        <span>
                          {(issue.issueType || "").replaceAll("_", " ")}
                        </span>
                        <span className="bg-white/[0.04] px-2 py-0.5 rounded-md">
                          {(
                            issue.stages ||
                            issue.stage ||
                            "PENDING"
                          ).replaceAll("_", " ")}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
