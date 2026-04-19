import { LogOut, Bell, Settings } from "lucide-react";
import { useLocation } from "react-router-dom";

const pageNames = {
  "/admin/dashboard": "Dashboard",
  "/admin/workforce": "Workforce",
  "/admin/wards": "Wards",
  "/admin/wards-map": "Wards Map",
  "/admin/issues": "Issues",
  "/admin/analytics": "Analytics",
  "/admin/ml-predictions": "ML Predictions",
  "/admin/geojson-editor": "Ward Editor",
  "/admin/profile": "Profile",
  "/supervisor/dashboard": "Dashboard",
  "/supervisor/ward-map": "Ward Map",
  "/supervisor/matrix": "Matrix",
  "/supervisor/issues": "Issues",
  "/supervisor/workers": "Workers",
  "/public": "Public",
  "/login": "Login",
};

function getPageName(pathname) {
  if (pathname.startsWith("/admin/workforce")) return "Workforce";
  if (pathname.startsWith("/admin/issues")) return "Issue Details";
  if (pathname.startsWith("/admin/workforce/supervisor"))
    return "Supervisor Details";
  if (pathname.startsWith("/admin/workforce/worker")) return "Worker Details";
  if (pathname.startsWith("/supervisor/issues")) return "Issue Details";
  return pageNames[pathname] || "Dashboard";
}

export default function Header({ onLogout }) {
  const location = useLocation();
  const pageName = getPageName(location.pathname);
  const user = JSON.parse(
    localStorage.getItem("user") || '{"fullName":"Admin"}',
  );

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-avenue-outline/10 shadow-sm">
      <div className="px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-headline-large font-public-sans text-avenue-on-surface">
            {pageName}
          </h1>
        </div>

        <div className="flex items-center gap-6">
          {/* Notification Bell */}
          <button className="p-2 hover:bg-avenue-surface rounded-lg transition-colors relative">
            <Bell size={20} className="text-avenue-on-surface-variant" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-avenue-error rounded-full"></span>
          </button>

          {/* Settings */}
          <button className="p-2 hover:bg-avenue-surface rounded-lg transition-colors">
            <Settings size={20} className="text-avenue-on-surface-variant" />
          </button>

          {/* Divider */}
          <div className="h-6 w-px bg-avenue-outline/20"></div>

          {/* User Profile */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-avenue-on-surface">
                {user.fullName}
              </p>
              <p className="text-xs text-avenue-on-surface-variant">
                Administrator
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-bold">
              {user.fullName?.[0]?.toUpperCase() || "A"}
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="p-2 hover:bg-avenue-error/10 rounded-lg transition-colors text-avenue-error"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
