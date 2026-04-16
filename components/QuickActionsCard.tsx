'use client';

import Link from 'next/link';
import { MapPin, AlertCircle, Users, Building2 } from 'lucide-react';

export const QuickActionsCard = () => {
  const actions = [
    {
      label: 'View Uganda map',
      href: '/map',
      icon: MapPin,
      color: 'text-blue-600',
    },
    {
      label: 'Review alerts',
      href: '/alerts',
      icon: AlertCircle,
      color: 'text-red-600',
    },
    {
      label: 'Manage users',
      href: '/admin/users',
      icon: Users,
      color: 'text-green-600',
    },
    {
      label: 'Manage facilities',
      href: '/admin/facilities',
      icon: Building2,
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-6">Quick actions</h3>
      <div className="grid grid-cols-2 gap-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href}>
              <button
                className="w-full h-24 flex flex-col items-center justify-center gap-2 px-4 py-3 
                  rounded-lg border-2 border-gray-300 text-gray-700 font-medium
                  hover:border-gray-400 hover:bg-gray-50 transition-all
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Icon className={`w-6 h-6 ${action.color}`} />
                <span className="text-xs text-center leading-tight">{action.label}</span>
              </button>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
