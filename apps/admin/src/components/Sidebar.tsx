import { Link, useNavigate } from '@tanstack/react-router';
import { BarChart3, LogOut, Menu, Settings, ShieldAlert, Users, Wrench, X } from 'lucide-react';
import { useState } from 'react';

import { CeolxLogo } from '@/components/CeolxLogo';
import { authClient } from '@/lib/auth-client';

const navItems = [
  { name: 'Dashboard', to: '/dashboard', icon: BarChart3 },
  { name: 'Users', to: '/users', icon: Users },
  { name: 'Event Moderation', to: '/events/moderation', icon: ShieldAlert },
  { name: 'Maintenance', to: '/maintenance', icon: Wrench },
  { name: 'Account', to: '/account', icon: Settings },
] as const;

function SidebarFooter() {
  const navigate = useNavigate();
  const session = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);
  const email = session.data?.user.email ?? 'Admin';

  async function handleLogout() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      await navigate({ to: '/login' });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="px-4 py-4 border-t border-sidebar-border">
      <div className="flex items-center gap-2.5 px-3 py-2">
        <div className="size-7 rounded-full bg-sidebar-foreground/10 flex items-center justify-center text-xs font-semibold text-sidebar-foreground/80 shrink-0">
          {email.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] text-sidebar-foreground/50">Signed in as</div>
          <div className="text-sm text-sidebar-foreground truncate">{email}</div>
        </div>
      </div>
      <button
        onClick={handleLogout}
        disabled={signingOut}
        className="mt-1 flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground transition-colors disabled:opacity-50"
      >
        <LogOut size={16} />
        <span>{signingOut ? 'Signing out…' : 'Logout'}</span>
      </button>
    </div>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = (
    <nav className="flex-1 px-4 space-y-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground transition-colors"
            activeProps={{
              className:
                'bg-[#7C6FFF] hover:!bg-[#7C6FFF] text-primary-foreground hover:!text-primary-foreground font-semibold',
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
        className="md:hidden fixed top-4 left-4 z-30 p-2 rounded-lg bg-sidebar border border-sidebar-border text-sidebar-foreground shadow-sm"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-surface-dark/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-30 w-60 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transform transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="relative flex flex-col px-7 pt-6 pb-4">
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="absolute top-3 right-3 text-sidebar-foreground"
          >
            <X size={20} />
          </button>
          <CeolxLogo fontSize={26} />
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-sidebar-foreground/40 mt-3">
            Admin Dashboard
          </p>
        </div>
        {nav}
        <SidebarFooter />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border shrink-0">
        <div className="flex flex-col px-7 pt-8 pb-6">
          <CeolxLogo fontSize={28} />
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-sidebar-foreground/40 mt-3">
            Admin Dashboard
          </p>
        </div>
        {nav}
        <SidebarFooter />
      </aside>
    </>
  );
}
