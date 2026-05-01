/**
 * DashboardHeader Component
 * Displays dashboard title, subtitle, and user profile in header
 * Reusable across all dashboard pages
 */

'use client';

import UserProfileDropdown from './UserProfileDropdown';

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  userName?: string;
  userRole?: string;
  userPhone?: string;
  userEmail?: string;
  facilityName?: string;
  onLogout?: () => void;
}

export default function DashboardHeader({
  title,
  subtitle,
  userName,
  userRole = 'User',
  userPhone,
  userEmail,
  facilityName,
  onLogout,
}: DashboardHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex justify-between items-start">
          {/* Left Section - Title */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
            {subtitle && (
              <p className="text-gray-600 mt-1">{subtitle}</p>
            )}
            {facilityName && (
              <p className="text-sm text-gray-500 mt-2">
                📍 {facilityName}
              </p>
            )}
          </div>

          {/* Right Section - User Profile */}
          <div className="ml-4">
            <UserProfileDropdown
              displayName={userName}
              role={userRole}
              userInfo={{
                name: userName,
                phone: userPhone,
                email: userEmail,
              }}
              onLogout={onLogout}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
