import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@CeolX/ui/components/card';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  trend?: ReactNode;
}

export function KpiCard({ label, value, trend }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{value}</div>
        {trend && <div className="mt-1 text-sm text-muted-foreground">{trend}</div>}
      </CardContent>
    </Card>
  );
}
