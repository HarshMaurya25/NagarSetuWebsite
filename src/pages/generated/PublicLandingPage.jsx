import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUser } from "../../lib/session";
import { getPublicLandingData, getTopWards } from "../../services/api";
import { API_BASE_URL } from "../../config/env";

function matrixTotal(matrix, key) {
  if (!matrix) return 0;
  return (
    (matrix?.daily?.[key] || 0) +
    (matrix?.weekly?.[key] || 0) +
    (matrix?.monthly?.[key] || 0)
  );
}

function resolveImageUrl(url) {
  if (!url) return null;
  return String(url).startsWith("http") ? url : `${API_BASE_URL}${url}`;
}

export default function PublicLandingPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("home");
  const [landingData, setLandingData] = useState({
    leaderboard: [],
    adminMatrix: null,
    overview: null,
    solvedIssues: [],
    userMatrix: null,
    topWards: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.5 },
    ); // 50% visibility

    const sections = ["home", "about", "live-issues", "leaderboard"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    sections.forEach((s) => observer.observe(s));

    let mounted = true;
    async function loadLanding() {
      setLoading(true);
      try {
        const user = getUser();
        const [response, topWards] = await Promise.all([
          getPublicLandingData(user?.id),
          getTopWards().catch(() => []),
        ]);
        if (mounted) {
          setLandingData({
            leaderboard: response?.leaderboard || [],
            adminMatrix: response?.adminMatrix || null,
            overview: response?.overview || null,
            solvedIssues: response?.solvedIssues || [],
            userMatrix: response?.userMatrix || null,
            topWards: topWards || [],
          });
        }
      } catch {
        if (mounted) {
          setLandingData({
            leaderboard: [],
            adminMatrix: null,
            overview: null,
            solvedIssues: [],
            userMatrix: null,
            topWards: [],
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadLanding();

    return () => {
      observer.disconnect();
      mounted = false;
    };
  }, []);

  const scrollTo = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const totalReported =
    landingData.overview?.totalIssuesReported ??
    matrixTotal(landingData.adminMatrix, "reported");

  const totalResolved =
    landingData.overview?.totalIssuesResolved ??
    matrixTotal(landingData.adminMatrix, "solved");

  const totalInProgress = Math.max(totalReported - totalResolved, 0);

  return (
    <>
      {/*  TopNavBar Component  */}
      <header className="fixed top-0 w-full z-50 bg-[#f6f9ff]/80 backdrop-blur-md border-b border-outline-variant/15 shadow-sm">
        <nav className="flex justify-between items-center px-8 py-4 w-full max-w-full">
          <div className="text-2xl font-black text-[#1E40AF] flex items-center gap-2 font-headline tracking-tight">
            <span
              className="material-symbols-outlined text-3xl"
              data-icon="account_balance"
            >
              account_balance
            </span>
            Nagar Setu
          </div>
          <div className="hidden md:flex items-center gap-8 font-headline font-bold text-sm tracking-tight">
            {[
              { id: "home", label: "Home" },
              { id: "about", label: "About" },
              { id: "live-issues", label: "Live Issues" },
              { id: "leaderboard", label: "Leaderboard" },
            ].map((item) => (
              <a
                key={item.id}
                className={`transition-colors hover:cursor-pointer ${activeSection === item.id ? "text-[#1E40AF] border-b-2 border-[#1E40AF] pb-1" : "text-on-surface hover:text-[#1E40AF]"}`}
                onClick={(e) => scrollTo(e, item.id)}
              >
                {item.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex gap-3 items-center mr-4">
              <span
                className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors"
                data-icon="notifications"
              >
                notifications
              </span>
              <span
                className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors"
                data-icon="contrast"
              >
                contrast
              </span>
            </div>
            <button
              onClick={() => navigate("/login?role=supervisor")}
              className="px-5 py-2.5 rounded-xl text-primary font-bold text-sm border-2 border-primary hover:bg-primary-fixed-dim transition-all"
            >
              Supervisor Login
            </button>
            <button
              onClick={() => navigate("/login?role=admin")}
              className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm shadow-md hover:opacity-90 transition-all"
            >
              Admin Login
            </button>
          </div>
        </nav>
      </header>
      <main className="pt-20">
        {/*  Hero Section  */}
        <section
          id="home"
          className="relative min-h-[700px] flex flex-col justify-center px-8 md:px-16 overflow-hidden pt-10"
        >
          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="z-10 space-y-6">
              <h1 className="text-6xl md:text-8xl font-headline font-black text-primary leading-tight tracking-tighter">
                Bridging <br />
                <span className="text-secondary">Citizens</span> With
                <br />
                Solutions
              </h1>
              <p className="text-xl text-on-surface-variant max-w-lg leading-relaxed font-medium">
                The ultimate civic interface for real-time problem reporting,
                transparent tracking, and urban excellence. Every citizen, every
                street, every solution.
              </p>
              <div className="flex gap-4">
                <button className="px-8 py-4 rounded-xl bg-primary text-white font-bold text-lg flex items-center gap-3 shadow-xl hover:translate-y-[-2px] transition-all">
                  <span
                    className="material-symbols-outlined"
                    data-icon="add_circle"
                  >
                    add_circle
                  </span>
                  Report Issue
                </button>
                <button className="px-8 py-4 rounded-xl bg-surface-container-highest text-on-surface font-bold text-lg hover:bg-surface-container-high transition-all">
                  View Live Map
                </button>
              </div>
            </div>
            <div className="relative hidden lg:block -translate-y-8">
              <div className="absolute inset-0 bg-primary/5 rounded-[4rem] rotate-3 blur-3xl"></div>
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/40">
                <img
                  className="w-full h-auto object-cover scale-[1.02] -translate-y-2"
                  data-alt="isometric 3d map of a clean modern city with holographic blue pins indicating civic issue locations and progress markers"
                  data-location="New Delhi"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuC1_cVa7h0WqVMdFDKsHMle5hK6VFTUaFnNZ9gwzHNB-JEN9QqAKahc-rps5QEg72rfvDtfnw_3hmpr1WFQIEOQ5yK8eoz-aj7DXWq-bqffQ-qU_nGlXyOg7TQBBwyCKdNpVAZV77gzPeLawUr96N_0ivxFUC994_ZzjdsulxVsyo71taqWOFk0NoQAlySYgE--SGz45UzeXMstvNoCG1una-5tA8ygT7Aa_x01MhBhsJf893me-Tbi3RvTu8iO_qTluvIHMOY2qCwp"
                />
              </div>
            </div>
          </div>
          {/*  Stats Ticker  */}
          <div className="mt-24 w-full bg-surface-container-low py-8 border-y border-outline-variant/15 overflow-hidden">
            <div className="flex justify-around items-center max-w-7xl mx-auto px-4 space-x-12">
              <div className="text-center">
                <div className="text-4xl font-headline font-black text-primary tracking-tighter">
                  {loading ? "..." : totalReported}
                </div>
                <div className="text-xs uppercase font-bold tracking-widest text-outline mt-1">
                  Issues Reported
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-headline font-black text-secondary tracking-tighter">
                  {loading ? "..." : totalResolved}
                </div>
                <div className="text-xs uppercase font-bold tracking-widest text-outline mt-1">
                  Issues Resolved
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-headline font-black text-primary-container tracking-tighter">
                  {loading ? "..." : totalInProgress}
                </div>
                <div className="text-xs uppercase font-bold tracking-widest text-outline mt-1">
                  In Progress
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-headline font-black text-primary tracking-tighter">
                  {loading ? "..." : (Array.isArray(landingData.leaderboard) ? landingData.leaderboard.length : 0)}
                </div>
                <div className="text-xs uppercase font-bold tracking-widest text-outline mt-1">
                  Ranked Citizens
                </div>
              </div>
            </div>
          </div>
        </section>
        {/*  How It Works  */}
        <section id="about" className="py-32 px-8 bg-surface-container-lowest">
          <div className="max-w-7xl mx-auto">
            {landingData.userMatrix && (
              <div className="mb-12 rounded-3xl bg-primary text-white p-8 md:p-10 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/70 font-bold mb-2">
                      Personal Civic Snapshot
                    </p>
                    <h2 className="text-3xl md:text-4xl font-black">
                      Your issue matrix at a glance
                    </h2>
                  </div>
                  <p className="text-white/80 max-w-lg">
                    This snapshot uses your session-linked matrix to show your
                    current civic activity.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                  <div className="rounded-2xl bg-white/10 p-5">
                    <p className="text-xs uppercase tracking-widest text-white/70">
                      Reported
                    </p>
                    <p className="text-3xl font-black">
                      {landingData.userMatrix.reportedIssue ?? 0}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-5">
                    <p className="text-xs uppercase tracking-widest text-white/70">
                      In Progress
                    </p>
                    <p className="text-3xl font-black">
                      {landingData.userMatrix.inProgressIssue ?? 0}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-5">
                    <p className="text-xs uppercase tracking-widest text-white/70">
                      Resolved
                    </p>
                    <p className="text-3xl font-black">
                      {landingData.userMatrix.resolvedIssue ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-20 text-center lg:text-left">
              <h2 className="text-4xl font-headline font-black text-on-surface mb-4">
                How It Works
              </h2>
              <p className="text-on-surface-variant max-w-xl">
                A seamless four-step process connecting your concerns directly
                to the city's dispatch systems.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
              {/*  Step 1  */}
              <div className="group p-8 rounded-2xl bg-surface-container-low hover:bg-primary-container transition-all cursor-default">
                <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center mb-6 group-hover:bg-white group-hover:text-primary transition-colors">
                  <span
                    className="material-symbols-outlined"
                    data-icon="app_registration"
                  >
                    app_registration
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-3 group-hover:text-white">
                  Report
                </h3>
                <p className="text-sm text-on-surface-variant group-hover:text-white/80">
                  Snapshot the issue, pin the location, and submit via the
                  mobile app or web portal.
                </p>
              </div>
              {/*  Step 2  */}
              <div className="group p-8 rounded-2xl bg-surface-container-low hover:bg-primary-container transition-all cursor-default">
                <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center mb-6 group-hover:bg-white group-hover:text-primary transition-colors">
                  <span
                    className="material-symbols-outlined"
                    data-icon="fact_check"
                  >
                    fact_check
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-3 group-hover:text-white">
                  Review
                </h3>
                <p className="text-sm text-on-surface-variant group-hover:text-white/80">
                  Our smart algorithm and civic officers verify the urgency and
                  classify the report.
                </p>
              </div>
              {/*  Step 3  */}
              <div className="group p-8 rounded-2xl bg-surface-container-low hover:bg-primary-container transition-all cursor-default">
                <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center mb-6 group-hover:bg-white group-hover:text-primary transition-colors">
                  <span
                    className="material-symbols-outlined"
                    data-icon="engineering"
                  >
                    engineering
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-3 group-hover:text-white">
                  Dispatch
                </h3>
                <p className="text-sm text-on-surface-variant group-hover:text-white/80">
                  The relevant ward supervisor assigns a ground team to address
                  the problem immediately.
                </p>
              </div>
              {/*  Step 4  */}
              <div className="group p-8 rounded-2xl bg-surface-container-low hover:bg-primary-container transition-all cursor-default">
                <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center mb-6 group-hover:bg-white group-hover:text-primary transition-colors">
                  <span
                    className="material-symbols-outlined"
                    data-icon="task_alt"
                  >
                    task_alt
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-3 group-hover:text-white">
                  Resolved
                </h3>
                <p className="text-sm text-on-surface-variant group-hover:text-white/80">
                  Verification photos are uploaded and the ticket is closed with
                  your final rating.
                </p>
              </div>
            </div>
          </div>
        </section>
        {/*  Pipeline Transparency  */}
        <section className="py-24 px-8 bg-surface">
          <div className="max-w-7xl mx-auto text-center mb-12">
            <span className="text-primary font-bold tracking-widest text-xs uppercase mb-2 block">
              Transparency Loop
            </span>
            <h2 className="text-4xl font-headline font-black mb-12">
              Real-Time Resolution Pipeline
            </h2>
            <div className="flex flex-wrap justify-center gap-4 overflow-x-auto pb-4">
              <div className="px-6 py-3 bg-white text-on-surface font-bold rounded-full shadow-sm border-2 border-primary/20 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>{" "}
                PENDING
              </div>
              <div className="px-6 py-3 bg-white text-on-surface font-bold rounded-full shadow-sm border-2 border-blue-500/20 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>{" "}
                REVIEWING
              </div>
              <div className="px-6 py-3 bg-primary text-white font-bold rounded-full shadow-md flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white"></span>{" "}
                DISPATCHED
              </div>
              <div className="px-6 py-3 bg-white text-on-surface font-bold rounded-full shadow-sm border-2 border-emerald-500/20 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>{" "}
                WORK IN PROGRESS
              </div>
              <div className="px-6 py-3 bg-white text-on-surface font-bold rounded-full shadow-sm border-2 border-emerald-600/20 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-700"></span>{" "}
                RESOLVED
              </div>
              <div className="px-6 py-3 bg-white text-on-surface font-bold rounded-full shadow-sm border-2 border-error/20 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-error"></span>{" "}
                RECONSIDERED
              </div>
            </div>
          </div>
        </section>
        {/*  City Stats Grid  */}
        <section className="py-32 px-8 bg-surface-container-low">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/*  Stat Card 1  */}
              <div className="bg-surface-container-lowest p-10 rounded-2xl shadow-sm hover:shadow-xl transition-shadow border-t-4 border-primary">
                <span
                  className="material-symbols-outlined text-primary text-4xl mb-4"
                  data-icon="speed"
                >
                  speed
                </span>
                <h3 className="text-3xl font-headline font-black mb-2">
                  {landingData.overview?.monthlyReportedIssues ?? 0}
                </h3>
                <p className="text-on-surface-variant font-medium">
                  Monthly Reported Issues
                </p>
              </div>
              {/*  Stat Card 2  */}
              <div className="bg-surface-container-lowest p-10 rounded-2xl shadow-sm hover:shadow-xl transition-shadow border-t-4 border-primary">
                <span
                  className="material-symbols-outlined text-primary text-4xl mb-4"
                  data-icon="location_city"
                >
                  location_city
                </span>
                <h3 className="text-3xl font-headline font-black mb-2">
                  {landingData.overview?.totalIssuesReported ?? 0}
                </h3>
                <p className="text-on-surface-variant font-medium">
                  Total Issues Reported
                </p>
              </div>
              {/*  Stat Card 3  */}
              <div className="bg-surface-container-lowest p-10 rounded-2xl shadow-sm hover:shadow-xl transition-shadow border-t-4 border-primary">
                <span
                  className="material-symbols-outlined text-primary text-4xl mb-4"
                  data-icon="sentiment_very_satisfied"
                >
                  sentiment_very_satisfied
                </span>
                <h3 className="text-3xl font-headline font-black mb-2">
                  {landingData.overview?.monthlySolvedIssues ?? 0}
                </h3>
                <p className="text-on-surface-variant font-medium">
                  Monthly Resolved Issues
                </p>
              </div>
              {/*  Stat Card 4  */}
              <div className="bg-surface-container-lowest p-10 rounded-2xl shadow-sm hover:shadow-xl transition-shadow border-t-4 border-primary">
                <span
                  className="material-symbols-outlined text-primary text-4xl mb-4"
                  data-icon="verified_user"
                >
                  verified_user
                </span>
                <h3 className="text-3xl font-headline font-black mb-2">
                  {(landingData.overview?.workerCount || 0) +
                    (landingData.overview?.supervisorCount || 0)}
                </h3>
                <p className="text-on-surface-variant font-medium">
                  Verified Personnel
                </p>
              </div>
              {/*  Stat Card 5  */}
              <div className="bg-surface-container-lowest p-10 rounded-2xl shadow-sm hover:shadow-xl transition-shadow border-t-4 border-primary">
                <span
                  className="material-symbols-outlined text-primary text-4xl mb-4"
                  data-icon="volunteer_activism"
                >
                  volunteer_activism
                </span>
                <h3 className="text-3xl font-headline font-black mb-2">
                  {landingData.overview?.totalIssuesResolved || 0}
                </h3>
                <p className="text-on-surface-variant font-medium">
                  Total Issues Resolved
                </p>
              </div>
              {/*  Stat Card 6  */}
              <div className="bg-surface-container-lowest p-10 rounded-2xl shadow-sm hover:shadow-xl transition-shadow border-t-4 border-primary">
                <span
                  className="material-symbols-outlined text-primary text-4xl mb-4"
                  data-icon="pie_chart"
                >
                  pie_chart
                </span>
                <h3 className="text-3xl font-headline font-black mb-2">
                  {landingData.overview?.monthlyReportedIssues || 0}
                </h3>
                <p className="text-on-surface-variant font-medium">
                  Monthly Reported
                </p>
              </div>
            </div>
          </div>
        </section>
        {/*  Recently Resolved  */}
        <section id="live-issues" className="py-32 px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
              <div>
                <h2 className="text-5xl font-headline font-black text-primary leading-none mb-4">
                  Evidence of Progress
                </h2>
                <p className="text-on-surface-variant text-lg">
                  Real-world impact across our neighborhoods in the last 24
                  hours.
                </p>
              </div>
              <button className="text-primary font-bold flex items-center gap-2 hover:translate-x-2 transition-transform">
                Explore Full Feed{" "}
                <span
                  className="material-symbols-outlined"
                  data-icon="arrow_forward"
                >
                  arrow_forward
                </span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {(Array.isArray(landingData.solvedIssues) ? landingData.solvedIssues : []).map((issue) => (
                <div
                  key={issue.id}
                  className="bg-white rounded-3xl overflow-hidden shadow-lg border border-outline-variant/10 group"
                >
                  <div className="grid grid-cols-2 gap-0 border-b border-outline-variant/10">
                    <div className="p-3 bg-surface-container-low">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-outline mb-2">
                        Previous
                      </p>
                      <div className="aspect-video rounded-xl overflow-hidden bg-surface-container">
                        {resolveImageUrl(
                          issue.previousImageUrl || issue.imageUrl,
                        ) ? (
                          <img
                            src={resolveImageUrl(
                              issue.previousImageUrl || issue.imageUrl,
                            )}
                            alt="Previous state"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-outline text-sm">
                            No image
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="p-3 bg-emerald-50/60">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-700 mb-2">
                        Resolved
                      </p>
                      <div className="aspect-video rounded-xl overflow-hidden bg-surface-container">
                        {resolveImageUrl(
                          issue.resolvedImageUrl || issue.imageUrl,
                        ) ? (
                          <img
                            src={resolveImageUrl(
                              issue.resolvedImageUrl || issue.imageUrl,
                            )}
                            alt="Resolved state"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-outline text-sm">
                            No image
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="p-8 space-y-4">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <div className="text-xs text-primary font-bold mb-2">
                          {issue.location || "LIVE CITY"}
                        </div>
                        <h3 className="text-xl font-bold mb-1">
                          {issue.title}
                        </h3>
                      </div>
                      <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                        RESOLVED
                      </span>
                    </div>
                    <p className="text-sm text-on-surface-variant">
                      {(issue.issueType || "").replaceAll("_", " ")} |{" "}
                      {(issue.criticality || "").replaceAll("_", " ")}
                    </p>
                    <div className="flex justify-between items-center text-sm text-on-surface-variant">
                      <span>
                        Created:{" "}
                        {issue.createdAt
                          ? new Date(issue.createdAt).toLocaleDateString()
                          : "N/A"}
                      </span>
                      <span>
                        Resolved:{" "}
                        {issue.resolvedAt
                          ? new Date(issue.resolvedAt).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {!loading && !landingData.solvedIssues?.length && (
                <p className="text-sm text-outline col-span-full">
                  No solved issues available.
                </p>
              )}
            </div>
          </div>
        </section>
        {/*  Leaders and Leaderboard Section  */}
        <section
          id="leaderboard"
          className="py-32 px-8 bg-surface-container-low"
        >
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20">
            {/*  Top Wards  */}
            <div className="space-y-12">
              <div>
                <h2 className="text-4xl font-headline font-black mb-4">
                  Elite Wards
                </h2>
                <p className="text-on-surface-variant">
                  Top performing administrative zones based on efficiency and
                  responsiveness.
                </p>
              </div>
              <div className="space-y-6">
                {(Array.isArray(landingData.topWards) ? landingData.topWards : []).map((ward, index) => (
                  <div
                    key={ward.wardName}
                    className="bg-surface-container-lowest p-6 rounded-2xl flex items-center gap-6 shadow-sm"
                  >
                    <div
                      className={`w-12 h-12 flex items-center justify-center rounded-xl font-black text-xl ${
                        index === 0
                          ? "bg-tertiary-fixed text-primary"
                          : "bg-surface-container-low text-on-surface-variant"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-grow">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <h4 className="font-bold text-lg">{ward.wardName}</h4>
                          <p className="text-xs text-on-surface-variant">
                            Supervisor: {ward.supervisorName || "N/A"}
                          </p>
                        </div>
                        <span className="text-primary font-bold">
                          {Number(ward.points || 0).toFixed(1)} Points
                        </span>
                      </div>
                      <div className="w-full h-3 bg-surface-container-low rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{
                            width: `${Math.min(Math.max(Number(ward.points || 0), 0), 100)}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                    {index === 0 && (
                      <span
                        className="material-symbols-outlined text-amber-500"
                        data-icon="emoji_events"
                        data-weight="fill"
                      >
                        emoji_events
                      </span>
                    )}
                  </div>
                ))}

                {!loading && !landingData.topWards?.length && (
                  <p className="text-sm text-outline">
                    Top ward data is currently unavailable.
                  </p>
                )}
              </div>
            </div>
            {/*  Citizen Leaderboard  */}
            <div className="space-y-12">
              <div>
                <h2 className="text-4xl font-headline font-black mb-4">
                  Citizen Heroes
                </h2>
                <p className="text-on-surface-variant">
                  Acknowledging the most proactive residents keeping our city
                  running.
                </p>
              </div>
              <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/10">
                <table className="w-full text-left">
                  <thead className="bg-surface-container text-on-surface font-bold text-sm uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-5">Rank</th>
                      <th className="px-8 py-5">Citizen</th>
                      <th className="px-8 py-5 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {(Array.isArray(landingData.leaderboard) ? landingData.leaderboard : [])
                      .slice(0, 8)
                      .map((item, index) => (
                        <tr
                          key={`${item.fullName}-${index}`}
                          className="hover:bg-surface-container-low transition-colors"
                        >
                          <td className="px-8 py-5 font-medium text-on-surface-variant">
                            #{index + 1}
                          </td>
                          <td className="px-8 py-5 font-bold">
                            {item.fullName || "Unknown Citizen"}
                          </td>
                          <td className="px-8 py-5 text-right font-headline font-black text-primary">
                            {item.score ?? 0}
                          </td>
                        </tr>
                      ))}
                    {!loading && !landingData.leaderboard?.length && (
                      <tr>
                        <td className="px-8 py-5 text-outline" colSpan={3}>
                          Leaderboard data is currently unavailable.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
        {/*  Mission Section  */}
        <section className="py-32 px-8">
          <div className="max-w-7xl mx-auto">
            <div className="bg-[#1E3A5F] rounded-[3rem] p-12 md:p-24 flex flex-col lg:flex-row items-center gap-16 relative overflow-hidden">
              <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-primary-container/20 rounded-full blur-[100px]"></div>
              <div className="absolute -left-20 -top-20 w-80 h-80 bg-secondary/10 rounded-full blur-[100px]"></div>
              <div className="w-full lg:w-2/5 border-l-8 border-primary-container pl-12">
                <span
                  className="material-symbols-outlined text-primary-container text-6xl mb-6 opacity-40"
                  data-icon="format_quote"
                  data-weight="fill"
                >
                  format_quote
                </span>
                <blockquote className="text-3xl font-headline font-bold text-white leading-tight italic">
                  Governance is not a service we provide, it's a partnership we
                  build with every street lamp and every sidewalk.
                </blockquote>
                <div className="mt-8 text-white/60 font-bold uppercase tracking-widest text-sm">
                  City Commissioner's Office
                </div>
              </div>
              <div className="w-full lg:w-3/5 space-y-8">
                <h2 className="text-5xl font-headline font-black text-white leading-none">
                  Our Sovereign Mission
                </h2>
                <p className="text-xl text-white/70 leading-relaxed">
                  Nagar Setu was built on the foundation of radical
                  transparency. We believe that a connected city is a
                  functioning city. By leveraging state-of-the-art dispatch
                  algorithms and intuitive citizen interfaces, we are shortening
                  the distance between a problem and its resolution.
                </p>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-white font-black text-lg mb-2">
                      Integrity
                    </h4>
                    <p className="text-white/50 text-sm">
                      Unfalsifiable records of civic action and resource
                      allocation.
                    </p>
                  </div>
                  <div>
                    <h4 className="text-white font-black text-lg mb-2">
                      Agility
                    </h4>
                    <p className="text-white/50 text-sm">
                      Response times measured in hours, not weeks or months.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      {/*  Footer  */}
      <footer className="bg-[#1E3A5F] text-white pt-24 pb-12 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-20">
            <div className="col-span-1 md:col-span-2 space-y-8">
              <div className="text-3xl font-black text-white flex items-center gap-3 font-headline">
                <span
                  className="material-symbols-outlined text-4xl"
                  data-icon="account_balance"
                >
                  account_balance
                </span>
                Nagar Setu
              </div>
              <p className="text-white/60 max-w-sm text-lg leading-relaxed">
                The official digital backbone of municipal governance.
                Empowering citizens through technology and accountability.
              </p>
              <div className="flex gap-4">
                <a
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors"
                  href="javascript:void(0)"
                >
                  <span
                    className="material-symbols-outlined text-xl"
                    data-icon="share"
                  >
                    share
                  </span>
                </a>
                <a
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors"
                  href="javascript:void(0)"
                >
                  <span
                    className="material-symbols-outlined text-xl"
                    data-icon="public"
                  >
                    public
                  </span>
                </a>
              </div>
            </div>
            <div className="space-y-6">
              <h5 className="text-lg font-bold tracking-tight">
                Quick Navigation
              </h5>
              <ul className="space-y-4 text-white/50 font-medium">
                <li>
                  <a
                    className="hover:text-white transition-colors"
                    href="javascript:void(0)"
                  >
                    Live Issue Map
                  </a>
                </li>
                <li>
                  <a
                    className="hover:text-white transition-colors"
                    href="javascript:void(0)"
                  >
                    Performance Reports
                  </a>
                </li>
                <li>
                  <a
                    className="hover:text-white transition-colors"
                    href="javascript:void(0)"
                  >
                    Citizen Leaderboard
                  </a>
                </li>
                <li>
                  <a
                    className="hover:text-white transition-colors"
                    href="javascript:void(0)"
                  >
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>
            <div className="space-y-6">
              <h5 className="text-lg font-bold tracking-tight">
                Citizen Support
              </h5>
              <ul className="space-y-4 text-white/50 font-medium">
                <li>
                  <a
                    className="hover:text-white transition-colors"
                    href="javascript:void(0)"
                  >
                    Help Center
                  </a>
                </li>
                <li>
                  <a
                    className="hover:text-white transition-colors"
                    href="javascript:void(0)"
                  >
                    Report a Bug
                  </a>
                </li>
                <li>
                  <a
                    className="hover:text-white transition-colors"
                    href="javascript:void(0)"
                  >
                    API Documentation
                  </a>
                </li>
                <li>
                  <a
                    className="hover:text-white transition-colors"
                    href="javascript:void(0)"
                  >
                    Grievance Cell
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-12 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6 text-white/30 text-sm font-bold">
            <p>© 2024 Nagar Setu Civic Infrastructure. All Rights Reserved.</p>
            <p>Designed for Universal Accessibility &amp; Transparency.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
