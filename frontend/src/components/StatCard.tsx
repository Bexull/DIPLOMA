import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: { value: string; positive: boolean };
  accent?: 'blue' | 'green' | 'red' | 'amber';
}

const accents = {
  blue:  { icon: 'text-blue-400 bg-blue-500/10',   border: 'border-blue-500/10' },
  green: { icon: 'text-emerald-400 bg-emerald-500/10',        border: 'border-emerald-500/10' },
  red:   { icon: 'text-red-400 bg-red-500/10',     border: 'border-red-500/10' },
  amber: { icon: 'text-amber-400 bg-amber-500/10',        border: 'border-amber-500/10' },
};

export default function StatCard({ label, value, icon, trend, accent = 'blue' }: Props) {
  const a = accents[accent];

  return (
    <div className={`bg-[#0a0f1e] border border-white/[0.06] rounded-xl px-5 py-4 ${a.border}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</div>
          <div className="text-[26px] font-bold mt-1 tabular leading-none">{value}</div>
          {trend && (
            <div className={`text-xs mt-2 font-medium ${trend.positive ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend.value}
            </div>
          )}
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${a.icon}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
