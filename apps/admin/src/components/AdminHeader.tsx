import { useNavigate } from '@tanstack/react-router';
import { LogOut, User } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@CeolX/ui/components/button';

import { authClient } from '@/lib/auth-client';

export function AdminHeader() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const session = authClient.useSession();
  const email = session.data?.user.email ?? 'Admin';

  async function handleLogout() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      await navigate({ to: '/login' });
    } finally {
      setSigningOut(false);
      setMenuOpen(false);
    }
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
      <div className="flex justify-between items-center">
        <div className="md:hidden w-8" /> {/* spacer for mobile menu button */}
        <div className="hidden md:block" />
        <div className="flex items-center gap-3 relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 text-sm"
            aria-label="Admin menu"
          >
            <User size={18} className="text-gray-600" />
            <span className="font-medium text-gray-700 max-w-[180px] truncate">{email}</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              <Button
                variant="ghost"
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleLogout}
                disabled={signingOut}
              >
                <LogOut size={15} className="mr-2" />
                {signingOut ? 'Signing out…' : 'Logout'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
