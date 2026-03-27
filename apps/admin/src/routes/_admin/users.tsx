import { createFileRoute } from '@tanstack/react-router';

import type { UserRole } from '@CeolX/shared';

export const Route = createFileRoute('/_admin/users')({
  component: UsersPage,
});

type Column = { key: string; label: string };

const columns: Column[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
  { key: 'createdAt', label: 'Created At' },
];

// Placeholder shape — data wired in M9
type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

const rows: UserRow[] = [];

function UsersPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Users</h1>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 font-medium text-gray-600">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                  No users yet — data wired in M9
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
