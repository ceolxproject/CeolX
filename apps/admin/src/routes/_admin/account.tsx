import { createFileRoute } from '@tanstack/react-router';

import { Input } from '@CeolX/ui/components/input';

export const Route = createFileRoute('/_admin/account')({
  component: AccountPage,
});

function AccountPage() {
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
    </div>
  );
}
