import { Link } from "@tanstack/react-router";
import { BarChart3, Clock, Menu, Settings, Users, X } from "lucide-react";
import { useState } from "react";

const navItems = [
  { name: "Dashboard", to: "/dashboard", icon: BarChart3 },
  { name: "Users", to: "/users", icon: Users },
  { name: "Pending Events", to: "/events/pending", icon: Clock },
  { name: "Account", to: "/account", icon: Settings },
] as const;

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = (
    <nav className="px-4 space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            activeProps={{
              className:
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm bg-green-100 text-green-700 font-medium",
            }}
            onClick={() => setMobileOpen(false)}
          >
            <Icon size={18} />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        className="md:hidden fixed top-4 left-4 z-30 p-2 rounded-lg bg-white border border-gray-200 shadow-sm"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-5">
          <h1 className="text-xl font-bold text-green-600">CeolX</h1>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>
        {nav}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 shrink-0">
        <div className="p-5">
          <h1 className="text-xl font-bold text-green-600">CeolX</h1>
          <p className="text-xs text-gray-400 mt-0.5">Admin Dashboard</p>
        </div>
        {nav}
      </aside>
    </>
  );
}
