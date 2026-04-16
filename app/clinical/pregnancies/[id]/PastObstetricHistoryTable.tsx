'use client';

interface ObstetricHistory {
  id: number;
  year: number;
  outcome: string;
  deliveryMode?: string;
  complications?: string[];
  createdAt: string;
}

interface PastObstetricHistoryTableProps {
  history: ObstetricHistory[];
}

export function PastObstetricHistoryTable({ history }: PastObstetricHistoryTableProps) {
  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'LIVE_BIRTH':
        return 'bg-green-100 text-green-800';
      case 'MISCARRIAGE':
        return 'bg-yellow-100 text-yellow-800';
      case 'STILLBIRTH':
        return 'bg-red-100 text-red-800';
      case 'ABORTION':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getOutcomeLabel = (outcome: string) => {
    switch (outcome) {
      case 'LIVE_BIRTH':
        return 'Live Birth';
      case 'MISCARRIAGE':
        return 'Miscarriage';
      case 'STILLBIRTH':
        return 'Stillbirth';
      case 'ABORTION':
        return 'Abortion';
      default:
        return outcome;
    }
  };

  const getDeliveryModeLabel = (mode?: string) => {
    switch (mode) {
      case 'SVD':
        return 'Spontaneous Vaginal Delivery';
      case 'C_SECTION':
        return 'Cesarean Section';
      case 'ASSISTED':
        return 'Assisted Delivery';
      default:
        return mode || '—';
    }
  };

  if (!history || history.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Past Obstetric History</h2>
        <p className="text-gray-600">No previous pregnancies recorded.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Past Obstetric History</h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Year</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Outcome</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Delivery Mode</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Complications</th>
            </tr>
          </thead>
          <tbody>
            {history.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-3 text-gray-900 font-medium">{entry.year}</td>
                <td className="px-4 py-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getOutcomeColor(entry.outcome)}`}>
                    {getOutcomeLabel(entry.outcome)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">{getDeliveryModeLabel(entry.deliveryMode)}</td>
                <td className="px-4 py-3 text-gray-700">
                  {entry.complications && entry.complications.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {entry.complications.map((comp, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded"
                        >
                          {comp}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
