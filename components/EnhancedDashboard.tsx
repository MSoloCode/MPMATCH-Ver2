/**
 * Enhanced Dashboard Component
 * Displays role-specific dashboard with features and quick actions
 * Used across all role dashboards
 */

'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import UserProfileCard from '@/components/UserProfileCard';
import FeatureMenu from '@/components/FeatureMenu';
import { format } from 'date-fns';

interface EnhancedDashboardProps {
  title: string;
  description?: string;
  children?: ReactNode;
  showFeatureMenu?: boolean;
  showUserCard?: boolean;
  stats?: Array<{
    label: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
  }>;
  userInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    joinDate?: string;
    location?: string;
  };
}

export default function EnhancedDashboard({
  title,
  description,
  children,
  showFeatureMenu = true,
  showUserCard = false,
  stats,
  userInfo,
}: EnhancedDashboardProps) {
  const { role } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">{title}</h1>
          {description && <p className="text-blue-100 text-lg">{description}</p>}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats Grid (if provided) */}
        {stats && stats.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, idx) => (
              <div
                key={idx}
                className={`${stat.color} rounded-lg shadow-md p-6 border border-opacity-20`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {stat.value}
                    </p>
                  </div>
                  <div className="text-3xl opacity-20">{stat.icon}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* User Profile Card */}
        {showUserCard && (
          <div className="mb-8">
            <UserProfileCard
              name={userInfo?.name}
              email={userInfo?.email}
              phone={userInfo?.phone}
              role={role ?? undefined}
              joinDate={userInfo?.joinDate}
              location={userInfo?.location}
              showEditButton={true}
            />
          </div>
        )}

        {/* Children Content */}
        {children && <div className="mb-8">{children}</div>}

        {/* Feature Menu */}
        {showFeatureMenu && role && (
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Available Functions
            </h2>
            <p className="text-gray-600 mb-6">
              Quick access to all tools and features for your role:
            </p>
            <FeatureMenu role={role} displayMode="grid" />
          </div>
        )}
      </div>
    </div>
  );
}
