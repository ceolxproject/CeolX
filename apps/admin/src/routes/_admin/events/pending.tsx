import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_admin/events/pending')({
  component: PendingEventsPage,
});

type Column = { key: string; label: string };

const columns: Column[] = [
  { key: 'title', label: 'Title' },
  { key: 'creator', label: 'Creator' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'actions', label: 'Actions' },
];

function PendingEventsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Pending Events</h1>
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
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                No pending events — data wired in M9
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
