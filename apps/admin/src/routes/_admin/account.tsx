import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { Button } from '@CeolX/ui/components/button';
import { Input } from '@CeolX/ui/components/input';

export const Route = createFileRoute('/_admin/account')({
  component: AccountPage,
});

function AccountPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Password change wired in M9
    // eslint-disable-next-line no-console
    console.log('Password change submitted');
  };

  return (
    <div className="space-y-8 max-w-lg">
      <h1 className="text-3xl font-bold text-foreground">Account</h1>

      {/* Profile */}
      <div className="bg-card text-card-foreground rounded-lg border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Profile</h2>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Email</label>
          <Input type="email" value="admin@ceolx.ie" disabled />
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-card text-card-foreground rounded-lg border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Change Password</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Current Password
            </label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">New Password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Confirm New Password
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit">Update Password</Button>
        </form>
      </div>
    </div>
  );
}
