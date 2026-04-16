'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';

interface Vital {
  systolicBP?: number;
  diastolicBP?: number;
  bpNotTaken?: boolean;
  temperatureC?: number;
  weightKg?: number;
  pulseBpm?: number;
  respRate?: number;
  oxygenSatPct?: number;
}

interface AncVisitWithVitals {
  id: number;
  visitNumber: number;
  visitDateTime: string;
  vitals: Vital[];
}

interface VitalsTimelineChartProps {
  visits: AncVisitWithVitals[];
}

export function VitalsTimelineChart({ visits }: VitalsTimelineChartProps) {
  // Transform data for Recharts
  const chartData = visits
    .filter(visit => visit.vitals && visit.vitals.length > 0)
    .map(visit => {
      const vital = visit.vitals[0]; // Get the first vital record for this visit
      const visitDate = new Date(visit.visitDateTime);

      return {
        visitNumber: visit.visitNumber,
        date: visitDate.toLocaleDateString('en-UG', {
          month: 'short',
          day: 'numeric',
        }),
        systolicBP: vital.systolicBP || null,
        diastolicBP: vital.diastolicBP || null,
        temperatureC: vital.temperatureC || null,
        weightKg: vital.weightKg || null,
        timestamp: visit.visitDateTime,
      };
    });

  if (!chartData || chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Vitals Timeline</h2>
        <p className="text-gray-600">No vital signs recorded yet.</p>
      </div>
    );
  }

  // Check if we have any data for each vital
  const hasSystolic = chartData.some(d => d.systolicBP !== null);
  const hasDiastolic = chartData.some(d => d.diastolicBP !== null);
  const hasTemperature = chartData.some(d => d.temperatureC !== null);
  const hasWeight = chartData.some(d => d.weightKg !== null);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload) return null;

    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-semibold text-gray-900 mb-2">Visit {payload[0]?.payload?.visitNumber}</p>
        {payload.map((entry: any, idx: number) => (
          <p key={idx} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {entry.value !== null ? entry.value.toFixed(1) : '—'}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-6">Vitals Timeline</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Blood Pressure and Temperature Chart */}
        {(hasSystolic || hasDiastolic || hasTemperature) && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Blood Pressure & Temperature</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  label={{ value: 'BP (mmHg) / Temp (°C)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                {hasSystolic && <Line yAxisId="left" type="monotone" dataKey="systolicBP" stroke="#ef4444" strokeWidth={2} name="Systolic BP" connectNulls />}
                {hasDiastolic && <Line yAxisId="left" type="monotone" dataKey="diastolicBP" stroke="#f97316" strokeWidth={2} name="Diastolic BP" connectNulls />}
                {hasTemperature && <Line yAxisId="left" type="monotone" dataKey="temperatureC" stroke="#8b5cf6" strokeWidth={2} name="Temperature (°C)" connectNulls />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Weight Chart */}
        {hasWeight && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Weight Progress</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  label={{ value: 'Weight (kg)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line
                  type="monotone"
                  dataKey="weightKg"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Weight (kg)"
                  connectNulls
                  dot={{ fill: '#3b82f6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Data Summary */}
      {chartData.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-4">
          {hasSystolic && (
            <div className="text-center">
              <p className="text-xs font-medium text-gray-600 uppercase">Latest Systolic BP</p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {chartData[chartData.length - 1]?.systolicBP || '—'} mmHg
              </p>
            </div>
          )}
          {hasDiastolic && (
            <div className="text-center">
              <p className="text-xs font-medium text-gray-600 uppercase">Latest Diastolic BP</p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {chartData[chartData.length - 1]?.diastolicBP || '—'} mmHg
              </p>
            </div>
          )}
          {hasTemperature && (
            <div className="text-center">
              <p className="text-xs font-medium text-gray-600 uppercase">Latest Temperature</p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {chartData[chartData.length - 1]?.temperatureC || '—'}°C
              </p>
            </div>
          )}
          {hasWeight && (
            <div className="text-center">
              <p className="text-xs font-medium text-gray-600 uppercase">Latest Weight</p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {chartData[chartData.length - 1]?.weightKg || '—'} kg
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
