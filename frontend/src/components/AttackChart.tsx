import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: Record<string, number>;
}

const COLORS = ['#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316'];

export default function AttackChart({ data }: Props) {
  const entries = Object.entries(data).map(([name, value]) => ({ name, value }));

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-56 text-gray-500">
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-700 flex items-center justify-center mb-3">
          <span className="text-gray-600 text-xl">?</span>
        </div>
        <span className="text-sm">Нет данных об атаках</span>
      </div>
    );
  }

  const total = entries.reduce((s, e) => s + e.value, 0);

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={entries}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
          >
            {entries.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: '#172033',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              color: '#e2e8f0',
              fontSize: '12px',
              padding: '8px 12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
            formatter={(value) => {
              const numeric = typeof value === 'number' ? value : Number(value ?? 0);
              return [`${numeric} (${((numeric / total) * 100).toFixed(1)}%)`, ''];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 justify-center">
        {entries.map((d, i) => (
          <span key={d.name} className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            {d.name}
          </span>
        ))}
      </div>
    </div>
  );
}
