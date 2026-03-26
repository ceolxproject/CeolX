import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AdminHeader } from "@/components/AdminHeader";
import { Sidebar } from "@/components/Sidebar";

export const Route = createFileRoute("/_admin")({
  component: AdminLayout,
});

function AdminLayout() {
  // Auth guard wired in M9 — placeholder for now
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
