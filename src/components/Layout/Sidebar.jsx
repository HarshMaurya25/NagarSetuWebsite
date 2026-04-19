import { Link, useLocation } from "react-router-dom";
import {
  Menu,
  BarChart3,
  Users,
  UserCheck,
  Zap,
  Map,
  Edit3,
  User,
  ChevronLeft,
} from "lucide-react";
import { useState } from "react";

const menuItems = [
  { icon: BarChart3, label: "Dashboard", path: "/admin/dashboard" },
  { icon: Users, label: "Workers", path: "/admin/workforce" },
  { icon: UserCheck, label: "Supervisors", path: "/admin/workforce" },
  { icon: Zap, label: "Issues", path: "/admin/issues" },
  { icon: Map, label: "Map View", path: "/admin/wards-map" },
  { icon: Edit3, label: "Ward Editor", path: "/admin/geojson-editor" },
  { icon: User, label: "Profile", path: "/admin/profile" },
];

export default function Sidebar({ isOpen, onToggle }) {
  const location = useLocation();

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-white shadow-elevated transition-all duration-300 z-40 ${
        isOpen ? "w-64" : "w-20"
      }`}
    >
      {/* Brand */}
      <div className="flex items-center justify-between p-6 border-b border-avenue-outline/10">
        {isOpen && (
          <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent font-public-sans">
            NagarSetu
          </h1>
        )}
        <button
          onClick={onToggle}
          className="p-2 hover:bg-avenue-surface rounded-lg transition-colors"
        >
          <ChevronLeft
            size={20}
            className={`transition-transform ${!isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="mt-8 space-y-2 px-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.path ||
            location.pathname.startsWith(item.path + "/");

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? "nav-item-active"
                  : "text-avenue-on-surface-variant hover:bg-avenue-surface"
              }`}
            >
              <Icon size={20} />
              {isOpen && <span className="font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-avenue-outline/10">
        <div className="text-center text-xs text-avenue-on-surface-variant">
          {isOpen && <p>Admin Panel v1.0</p>}
        </div>
      </div>
    </aside>
  );
}
