import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearSession, getUser } from "../lib/session";
import { toggleTheme } from "../lib/theme";

export default function SupervisorLayout() {
  const navigate = useNavigate();
  const user = getUser();

  const handleLogout = () => {
    clearSession();
    navigate("/public", { replace: true });
  };

  const getNavLinkClass = ({ isActive }) =>
    isActive
      ? "relative flex items-center gap-4 px-6 py-3 mr-4 rounded-xl bg-white/10 text-white font-['Inter'] text-sm font-medium shadow-sm before:content-[''] before:absolute before:left-3 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-6 before:rounded-full before:bg-secondary"
      : "flex items-center gap-4 px-6 py-3 mr-4 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-['Inter'] text-sm font-medium transition-all";

  return (
    <>
      {/*  Top Navigation Bar  */}
      <nav className="fixed top-0 w-full z-50 bg-[#f6f9ff]/80 dark:bg-[#151c23]/80 backdrop-blur-md border-b border-[#c4c5d5]/15 shadow-sm flex justify-between items-center px-8 py-4">
        <div className="flex items-center gap-8">
          <div
            className="text-2xl font-black text-[#1E40AF] dark:text-white flex items-center gap-2 font-['Public_Sans'] tracking-tight cursor-pointer"
            onClick={() => navigate("/supervisor/dashboard")}
          >
            <span
              className="material-symbols-outlined text-3xl"
              data-icon="account_balance"
            >
              account_balance
            </span>
            Nagar Setu
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="bg-primary-container text-white px-4 py-2 rounded-xl font-bold text-sm shadow-sm hover:opacity-80 transition-all">
            {user?.fullName || "Supervisor Portal"}
          </button>
          <div className="flex items-center gap-3 ml-2 border-l border-outline-variant/30 pl-4">
            <span
              className="material-symbols-outlined text-on-surface-variant cursor-pointer"
              data-icon="notifications"
            >
              notifications
            </span>
            <button
              type="button"
              className="material-symbols-outlined text-on-surface-variant cursor-pointer"
              data-icon="contrast"
              onClick={() => toggleTheme()}
              title="Toggle dark mode"
            >
              contrast
            </button>
            <div className="relative">
              <img
                alt="User profile"
                className="w-10 h-10 rounded-full border-2 border-primary-container"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBAc7iXEyyOsOinbPmkv8gHgG9QTKuBZV3XAFCJqg_hpNxVKT_m_HpuuHwXlh6ZImX9ih0JXTE-CfNpG9oWKpvp0IppVScd5ea79DmRnScOHYFYIM3cQ8g-CmDy17PyjK0MOi7XrK18u8IaVd1mdlTXFZKaYzoitmrpXl9VBUm7ojc3qTYdhkcWqUeARLAqN_wLrOyN4HSJZdRxTWC1Uvk2U3QFvzSt0HhLl4ynrNFU-QIOVURgW2nOqFdDl0vCE-pagtnidsjL8ltC"
              />
              <div className="absolute -bottom-1 -right-1 bg-primary text-[10px] text-white px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                SV
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/*  Side Navigation Bar  */}
      <aside className="h-screen w-64 fixed left-0 top-0 bg-[#1E3A5F] dark:bg-[#0f172a] text-white flex flex-col py-6 z-40">
        <div className="px-6 mb-10 pt-16">
          <h1 className="text-white font-['Public_Sans'] font-bold text-xl tracking-tight">
            Nagar Setu
          </h1>
          <p className="text-slate-300 text-xs font-medium font-['Inter'] uppercase tracking-widest opacity-70">
            Civic Portal
          </p>
        </div>
        <div className="flex-1 space-y-1">
          <NavLink to="/supervisor/dashboard" className={getNavLinkClass}>
            <span className="material-symbols-outlined" data-icon="dashboard">
              dashboard
            </span>
            Dashboard
          </NavLink>
          <NavLink to="/supervisor/ward-map" className={getNavLinkClass}>
            <span className="material-symbols-outlined" data-icon="map">
              map
            </span>
            Ward Map
          </NavLink>
          <NavLink to="/supervisor/matrix" className={getNavLinkClass}>
            <span className="material-symbols-outlined" data-icon="query_stats">
              query_stats
            </span>
            Matrix
          </NavLink>
          <NavLink to="/supervisor/issues" className={getNavLinkClass}>
            <span className="material-symbols-outlined" data-icon="assignment">
              assignment
            </span>
            Issues
          </NavLink>
          <NavLink to="/supervisor/workers" className={getNavLinkClass}>
            <span className="material-symbols-outlined" data-icon="groups">
              groups
            </span>
            Workers
          </NavLink>
        </div>
        <div className="px-6 pt-4 border-t border-white/10">
          <button className="w-full bg-[#1E40AF] hover:bg-primary py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all shadow-lg active:scale-95">
            <span className="material-symbols-outlined text-sm" data-icon="add">
              add
            </span>
            Report New Issue
          </button>
        </div>
        <div className="mt-auto pt-6 space-y-1">
          <button className="w-full flex items-center gap-4 px-6 py-3 text-slate-300 hover:bg-white/5 font-['Inter'] text-sm font-medium transition-all text-left">
            <span className="material-symbols-outlined" data-icon="help">
              help
            </span>
            Support
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-6 py-3 text-slate-300 hover:bg-white/5 font-['Inter'] text-sm font-medium transition-all text-left"
          >
            <span
              className="material-symbols-outlined text-error"
              data-icon="logout"
            >
              logout
            </span>
            Logout
          </button>
        </div>
      </aside>

      {/*  Main Content Canvas  */}
      <main className="ml-64 pt-20 px-8 pb-12 bg-surface min-h-screen">
        <Outlet />
      </main>
    </>
  );
}
