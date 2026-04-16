'use client';

interface RiskFactorsSectionProps {
  riskFactors: string[];
}

export function RiskFactorsSection({ riskFactors }: RiskFactorsSectionProps) {
  // Map risk factors to severity colors
  const getRiskSeverity = (factor: string) => {
    const criticalFactors = ['HIV+', 'HIV Positive'];
    const severeFactors = ['Hypertension', 'Diabetes', 'Anaemia', 'Previous C-section'];
    const moderateFactors = ['Other'];

    if (criticalFactors.some(f => factor.toLowerCase().includes(f.toLowerCase()))) {
      return { color: 'bg-red-100 text-red-800', severity: 'Critical' };
    }
    if (severeFactors.some(f => factor.toLowerCase().includes(f.toLowerCase()))) {
      return { color: 'bg-amber-100 text-amber-800', severity: 'Moderate' };
    }
    return { color: 'bg-green-100 text-green-800', severity: 'Low' };
  };

  if (!riskFactors || riskFactors.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Risk Factors</h2>
        <p className="text-gray-600">No risk factors identified.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Risk Factors</h2>
      <div className="space-y-3">
        {riskFactors.map((factor, index) => {
          const { color, severity } = getRiskSeverity(factor);
          return (
            <div
              key={index}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${color}`}
            >
              <div className="flex-1">
                <p className="font-medium">{factor}</p>
                <p className="text-xs opacity-75">{severity} Risk</p>
              </div>
              <div className="w-3 h-3 rounded-full" style={{
                backgroundColor: color.includes('red') ? '#dc2626' : color.includes('amber') ? '#f59e0b' : '#10b981',
              }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
