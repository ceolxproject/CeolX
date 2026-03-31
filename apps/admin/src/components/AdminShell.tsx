import { Outlet } from '@tanstack/react-router';

import { AdminHeader } from './AdminHeader';
import { Sidebar } from './Sidebar';

export function AdminShell() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
