'use client';

import { LucideIcon } from 'lucide-react';
import { KPICard as SharedKPICard } from '@/components/ui/KPICard';

interface KPICardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isUp?: boolean;
    label?: string;
  };
  accentColor?: string;
  isLoading?: boolean;
}

export default function KPICard({
  label,
  value,
  subValue,
  icon: Icon,
  trend,
  accentColor,
  isLoading = false,
}: KPICardProps) {
  const parsedTrend = trend?.value ? Number.parseFloat(trend.value.replace('%', '')) : undefined;

  return (
    <SharedKPICard
      title={label}
      value={value}
      icon={Icon}
      subtitle={subValue}
      loading={isLoading}
      accentColor={accentColor}
      trend={trend && parsedTrend !== undefined && !Number.isNaN(parsedTrend)
        ? {
            value: trend.isUp === false ? -Math.abs(parsedTrend) : Math.abs(parsedTrend),
            label: trend.label || 'vs last shift',
          }
        : undefined}
    />
  );
}
