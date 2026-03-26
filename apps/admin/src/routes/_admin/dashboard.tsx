import { Card } from "@CeolX/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/dashboard")({
  component: DashboardPage,
});

const kpiCards = [
  { label: "Total Users", value: "0" },
  { label: "Total Events", value: "0" },
  { label: "Pending Events", value: "0" },
  { label: "Active Venues", value: "0" },
] as const;

function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <Card key={card.label} className="p-6">
            <h3 className="text-sm font-medium text-gray-500">{card.label}</h3>
            <p className="text-3xl font-bold mt-2">{card.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
