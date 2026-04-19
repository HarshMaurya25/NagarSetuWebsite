import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearSession, getUser } from "../lib/session";
import { toggleTheme } from "../lib/theme";

export default function AdminLayout() {
  const navigate = useNavigate();
  const user = getUser();

  const handleLogout = () => {
    clearSession();
    navigate("/public", { replace: true });
  };

  const getNavLinkClass = ({ isActive }) =>
    isActive
      ? "relative flex items-center gap-3 px-6 py-3 mr-4 rounded-xl bg-white/10 text-white shadow-sm before:content-[''] before:absolute before:left-3 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-6 before:rounded-full before:bg-secondary"
      : "flex items-center gap-3 px-6 py-3 mr-4 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-all";

  return (
    <>
      {/*  SideNavBar  */}
      <aside className="h-screen w-64 fixed left-0 top-0 bg-[#1E3A5F] dark:bg-[#0f172a] text-white flex flex-col py-6 font-['Inter'] text-sm font-medium z-50 overflow-y-auto">
        <div
          className="px-6 mb-10 flex flex-col cursor-pointer"
          onClick={() => navigate("/admin/dashboard")}
        >
          <span className="text-white font-['Public_Sans'] font-bold text-2xl tracking-tight">
            Nagar Setu
          </span>
          <span className="text-slate-400 text-[10px] tracking-widest uppercase mt-1">
            Civic Portal
          </span>
        </div>
        <div className="flex-1 space-y-1">
          <NavLink to="/admin/dashboard" className={getNavLinkClass}>
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: '"FILL" 1' }}
            >
              dashboard
            </span>
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/admin/issues" className={getNavLinkClass}>
            <span className="material-symbols-outlined">report_problem</span>
            <span>Issue Reports</span>
          </NavLink>
          <NavLink to="/admin/workforce" className={getNavLinkClass}>
            <span className="material-symbols-outlined">engineering</span>
            <span>Work Orders</span>
          </NavLink>
          <NavLink to="/admin/wards" className={getNavLinkClass}>
            <span className="material-symbols-outlined">tab_group</span>
            <span>Wards</span>
          </NavLink>
          <NavLink to="/admin/wards-map" className={getNavLinkClass}>
            <span className="material-symbols-outlined">map</span>
            <span>Wards Map</span>
          </NavLink>
          <NavLink to="/admin/analytics" className={getNavLinkClass}>
            <span className="material-symbols-outlined">analytics</span>
            <span>Analytics</span>
          </NavLink>
          <NavLink to="/admin/ml-predictions" className={getNavLinkClass}>
            <span className="material-symbols-outlined">online_prediction</span>
            <span>ML Predictions</span>
          </NavLink>
        </div>
        <div className="px-6 mt-8">
          <button className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center gap-2 transition-all">
            <span className="material-symbols-outlined text-sm">
              add_circle
            </span>
            <span>Report New Issue</span>
          </button>
        </div>
        <div className="mt-auto space-y-1 border-t border-white/10 pt-4">
          <button className="w-full flex items-center gap-3 px-6 py-3 text-slate-300 hover:bg-white/5 transition-all text-left">
            <span className="material-symbols-outlined">help</span>
            <span>Support</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-6 py-3 text-slate-300 hover:bg-white/5 transition-all text-left"
          >
            <span className="material-symbols-outlined text-error">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/*  Main Content Area  */}
      <main className="ml-64 min-h-screen relative bg-surface">
        {/*  TopNavBar  */}
        <header className="fixed top-0 right-0 left-64 bg-[#f6f9ff]/80 dark:bg-[#151c23]/80 backdrop-blur-md z-40 border-b border-[#c4c5d5]/15 flex justify-between items-center px-8 py-4">
          <div className="flex items-center gap-6 flex-1">
            <div className="relative w-full max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">
                search
              </span>
              <input
                className="w-full bg-surface-container-low border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="Search incidents, assets, or personnel..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full"></span>
            </button>
            <button
              type="button"
              className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors"
              onClick={() => toggleTheme()}
              title="Toggle dark mode"
            >
              <span className="material-symbols-outlined">contrast</span>
            </button>
            <div className="h-8 w-[1px] bg-outline-variant/30 mx-2"></div>
            <div className="flex items-center gap-3 bg-surface-container-low pr-4 pl-1 py-1 rounded-full border border-outline-variant/10">
              <img
                alt="Admin user"
                className="w-8 h-8 rounded-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCKAn3QFA_2cYrHt_ixRZxTtFQSMaueDYHd_j2vk2J_enuI96h4lEzsmnjH4cUr-ckBLlK1Z1cqwdCmW9SEbxdpk0VpLY6vteTdQ6EWUonQhaeXxvHxJ8C65wyrJdDwUnr70SZU2NfUcaA0FgjNTeAlz9VnJjPzBtQnXAbWsCPwWfVMKpf_7cDQu-qaowXUSeIlPrh3EtPhjXuzKznshAXmw3yCh8zbVA7m9C1Hr12RqnOrZsLZ63uA0Q0MaD4eyHQ2ymhbZ2hfc4cI"
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold leading-none">
                  {user?.fullName || "Admin User"}
                </span>
                <span className="text-[10px] text-primary font-bold uppercase tracking-tighter">
                  {user?.role || "ADMIN"}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Nested Content */}
        <Outlet />
      </main>
    </>
  );
}
