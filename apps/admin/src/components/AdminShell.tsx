import { Outlet } from '@tanstack/react-router';

import { Sidebar } from './Sidebar';

export function AdminShell() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
