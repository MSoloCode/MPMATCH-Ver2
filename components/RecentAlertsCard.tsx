'use client';

import { formatDistanceToNow } from 'date-fns';

interface RecentAlert {
  id: number;
  type: string;
  status: string;
  createdAt: string;
  mother?: {
    id: number;
    fullName: string;
  };
  pregnancy?: {
    id: number;
    isHighRisk: boolean;
  };
}

interface RecentAlertsCardProps {
  data: RecentAlert[];
  isLoading?: boolean;
}

const ALERT_TYPE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  MANUAL_EMERGENCY: { bg: 'bg-red-100', text: 'text-red-700' },
  EMERGENCY: { bg: 'bg-red-100', text: 'text-red-700' },
  HIGH_RISK_BP: { bg: 'bg-amber-100', text: 'text-amber-700' },
  DANGER_SIGN: { bg: 'bg-amber-100', text: 'text-amber-700' },
  HIGH_RISK: { bg: 'bg-amber-100', text: 'text-amber-700' },
  COMMUNITY_REQUEST: { bg: 'bg-blue-100', text: 'text-blue-700' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: 'bg-red-100', text: 'text-red-700' },
  ACKNOWLEDGED: { bg: 'bg-amber-100', text: 'text-amber-700' },
  CLOSED: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

const getAlertTypeBadgeColors = (type: string) => {
  return ALERT_TYPE_BADGE_COLORS[type] || { bg: 'bg-gray-100', text: 'text-gray-700' };
};

const getStatusColors = (status: string) => {
  return STATUS_COLORS[status] || { bg: 'bg-gray-100', text: 'text-gray-700' };
};

const formatAlertType = (type: string): string => {
  return type
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
};

export const RecentAlertsCard = ({ data, isLoading }: RecentAlertsCardProps) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent alerts</h3>
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin">
            <div className="w-6 h-6 border-3 border-gray-200 border-t-blue-600 rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent alerts</h3>
      {data && data.length > 0 ? (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {data.map((alert) => {
            const typeBadgeColors = getAlertTypeBadgeColors(alert.type);
            const statusColors = getStatusColors(alert.status);
            const relativeTime = formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true });

            return (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {/* Type Badge */}
                <div className={`flex-shrink-0 px-2 py-1 rounded-full ${typeBadgeColors.bg} ${typeBadgeColors.text} text-xs font-semibold`}>
                  {alert.type === 'MANUAL_EMERGENCY' || alert.type === 'EMERGENCY' ? '🚨' : alert.type.includes('HIGH_RISK') ? '⚠️' : '📢'}
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {alert.mother?.fullName || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-600 flex-shrink-0">
                      {formatAlertType(alert.type)}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {relativeTime}
                  </p>
                </div>

                {/* Status Pill */}
                <div className={`flex-shrink-0 px-2 py-1 rounded-full ${statusColors.bg} ${statusColors.text} text-xs font-semibold`}>
                  {alert.status}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex justify-center items-center py-8 text-gray-500 text-sm">
          No alerts
        </div>
      )}
    </div>
  );
};
