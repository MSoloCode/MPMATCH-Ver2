/**
 * Feature Menu Component
 * Displays all available functions for the logged-in user based on their role
 * Shows icons, descriptions, and links to key features
 */

'use client';

import { useRouter } from 'next/navigation';
import { 
  Users, Calendar, AlertCircle, BarChart3, FileText, Stethoscope,
  HeartHandshake, MapPin, Settings, LogOut, Edit, MessageSquare,
  Pill, ClipboardList, Ambulance, TrendingUp, MoreHorizontal,
  MessageCircle, Clock, ShieldAlert
} from 'lucide-react';

interface Feature {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  color: string;
  badge?: string;
}

interface FeatureMenuProps {
  role: string;
  onNavigate?: (href: string) => void;
  displayMode?: 'grid' | 'list';
}

// Define features per role
const ROLE_FEATURES: Record<string, Feature[]> = {
  COMMUNITY_USER: [
    {
      id: 'my-profile',
      label: 'My Profile',
      description: 'View and edit your personal information',
      icon: <Edit className="w-5 h-5" />,
      href: '/profile',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
      badge: 'Quick Access'
    },
    {
      id: 'my-records',
      label: 'My Medical Records',
      description: 'View your pregnancy journey and health records',
      icon: <FileText className="w-5 h-5" />,
      href: '/my-records',
      color: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
    },
    {
      id: 'appointments',
      label: 'My Appointments',
      description: 'View and manage your ANC appointments',
      icon: <Calendar className="w-5 h-5" />,
      href: '/my-records/appointments',
      color: 'bg-green-50 hover:bg-green-100 border-green-200',
    },
    {
      id: 'nearby-chw',
      label: 'Nearby CHWs',
      description: 'Find community health workers near you',
      icon: <MapPin className="w-5 h-5" />,
      href: '/community/dashboard#nearby',
      color: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
    },
    {
      id: 'ai-chat',
      label: 'AI Health Assistant',
      description: 'Get answers to health questions anytime',
      icon: <MessageCircle className="w-5 h-5" />,
      href: '/ai-chat',
      color: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
    },
    {
      id: 'emergency-alert',
      label: 'Emergency Alert',
      description: 'Send urgent help request to your facility',
      icon: <AlertCircle className="w-5 h-5" />,
      href: '/community/dashboard#emergency',
      color: 'bg-red-50 hover:bg-red-100 border-red-200',
    },
  ],
  CHW: [
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'View your CHW statistics and tasks',
      icon: <BarChart3 className="w-5 h-5" />,
      href: '/chw-dashboard',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
      badge: 'Main'
    },
    {
      id: 'my-profile',
      label: 'My Profile',
      description: 'View and edit your professional information',
      icon: <Edit className="w-5 h-5" />,
      href: '/profile',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    },
    {
      id: 'mothers-list',
      label: 'Assigned Mothers',
      description: 'Manage mothers in your catchment area',
      icon: <Users className="w-5 h-5" />,
      href: '/chw-dashboard/mothers',
      color: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
    },
    {
      id: 'tasks',
      label: 'My Tasks',
      description: 'View assigned follow-up tasks',
      icon: <ClipboardList className="w-5 h-5" />,
      href: '/chw-dashboard/tasks',
      color: 'bg-green-50 hover:bg-green-100 border-green-200',
    },
    {
      id: 'alerts',
      label: 'Health Alerts',
      description: 'Monitor high-risk cases and alerts',
      icon: <ShieldAlert className="w-5 h-5" />,
      href: '/chw-dashboard/alerts',
      color: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
    },
    {
      id: 'appointments',
      label: 'Appointments',
      description: 'Track community appointments',
      icon: <Calendar className="w-5 h-5" />,
      href: '/chw-dashboard/appointments',
      color: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
    },
    {
      id: 'reports',
      label: 'Reports',
      description: 'Generate performance reports',
      icon: <TrendingUp className="w-5 h-5" />,
      href: '/chw-dashboard/reports',
      color: 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200',
    },
  ],
  DOCTOR: [
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'View clinical overview and statistics',
      icon: <BarChart3 className="w-5 h-5" />,
      href: '/clinical/doctor',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
      badge: 'Main'
    },
    {
      id: 'my-profile',
      label: 'My Profile',
      description: 'View and update your credentials',
      icon: <Edit className="w-5 h-5" />,
      href: '/profile',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    },
    {
      id: 'mothers',
      label: 'Mothers',
      description: 'Manage mother records and details',
      icon: <Users className="w-5 h-5" />,
      href: '/clinical/doctor/mothers',
      color: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
    },
    {
      id: 'pregnancies',
      label: 'Pregnancies',
      description: 'Monitor and manage pregnancy cases',
      icon: <HeartHandshake className="w-5 h-5" />,
      href: '/clinical/doctor/pregnancies',
      color: 'bg-pink-50 hover:bg-pink-100 border-pink-200',
    },
    {
      id: 'anc-visits',
      label: 'ANC Visits',
      description: 'Record and review ANC encounters',
      icon: <Stethoscope className="w-5 h-5" />,
      href: '/clinical/doctor/anc-visits',
      color: 'bg-green-50 hover:bg-green-100 border-green-200',
    },
    {
      id: 'vitals',
      label: 'Vital Signs',
      description: 'Monitor blood pressure, temperature, etc.',
      icon: <TrendingUp className="w-5 h-5" />,
      href: '/clinical/doctor/vitals',
      color: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
    },
    {
      id: 'symptoms',
      label: 'Symptoms',
      description: 'Document and track danger signs',
      icon: <AlertCircle className="w-5 h-5" />,
      href: '/clinical/doctor/symptoms',
      color: 'bg-red-50 hover:bg-red-100 border-red-200',
    },
    {
      id: 'alerts',
      label: 'Health Alerts',
      description: 'Manage and respond to alerts',
      icon: <ShieldAlert className="w-5 h-5" />,
      href: '/clinical/doctor/alerts',
      color: 'bg-red-50 hover:bg-red-100 border-red-200',
    },
    {
      id: 'appointments',
      label: 'Appointments',
      description: 'Schedule and manage appointments',
      icon: <Calendar className="w-5 h-5" />,
      href: '/clinical/doctor/appointments',
      color: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
    },
    {
      id: 'referrals',
      label: 'Referrals',
      description: 'Create and manage patient referrals',
      icon: <HeartHandshake className="w-5 h-5" />,
      href: '/clinical/doctor/referrals',
      color: 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200',
    },
    {
      id: 'reports',
      label: 'Reports',
      description: 'Generate clinical reports and analytics',
      icon: <FileText className="w-5 h-5" />,
      href: '/clinical/doctor/reports',
      color: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200',
    },
  ],
  NURSE: [
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'View nursing statistics and overview',
      icon: <BarChart3 className="w-5 h-5" />,
      href: '/clinical/nurse',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
      badge: 'Main'
    },
    {
      id: 'my-profile',
      label: 'My Profile',
      description: 'View and update your professional profile',
      icon: <Edit className="w-5 h-5" />,
      href: '/profile',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    },
    {
      id: 'mothers',
      label: 'Mothers',
      description: 'Access mother records',
      icon: <Users className="w-5 h-5" />,
      href: '/clinical/nurse/mothers',
      color: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
    },
    {
      id: 'pregnancies',
      label: 'Pregnancies',
      description: 'View pregnancy information',
      icon: <HeartHandshake className="w-5 h-5" />,
      href: '/clinical/nurse/pregnancies',
      color: 'bg-pink-50 hover:bg-pink-100 border-pink-200',
    },
    {
      id: 'vitals',
      label: 'Vital Signs',
      description: 'Record and monitor vital measurements',
      icon: <TrendingUp className="w-5 h-5" />,
      href: '/clinical/nurse/vitals',
      color: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
    },
    {
      id: 'symptoms',
      label: 'Symptoms',
      description: 'Document patient symptoms',
      icon: <AlertCircle className="w-5 h-5" />,
      href: '/clinical/nurse/symptoms',
      color: 'bg-red-50 hover:bg-red-100 border-red-200',
    },
    {
      id: 'anc-visits',
      label: 'ANC Visits',
      description: 'Review ANC visit records',
      icon: <Stethoscope className="w-5 h-5" />,
      href: '/clinical/nurse/anc-visits',
      color: 'bg-green-50 hover:bg-green-100 border-green-200',
    },
    {
      id: 'alerts',
      label: 'Health Alerts',
      description: 'Monitor critical alerts',
      icon: <ShieldAlert className="w-5 h-5" />,
      href: '/clinical/nurse/alerts',
      color: 'bg-red-50 hover:bg-red-100 border-red-200',
    },
    {
      id: 'appointments',
      label: 'Appointments',
      description: 'View appointment schedule',
      icon: <Calendar className="w-5 h-5" />,
      href: '/clinical/nurse/appointments',
      color: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
    },
  ],
  MIDWIFE: [
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'View midwifery statistics and overview',
      icon: <BarChart3 className="w-5 h-5" />,
      href: '/clinical/midwife',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
      badge: 'Main'
    },
    {
      id: 'my-profile',
      label: 'My Profile',
      description: 'View and update your professional profile',
      icon: <Edit className="w-5 h-5" />,
      href: '/profile',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    },
    {
      id: 'pregnancies',
      label: 'Pregnancies',
      description: 'Manage and monitor pregnancies',
      icon: <HeartHandshake className="w-5 h-5" />,
      href: '/clinical/midwife/pregnancies',
      color: 'bg-pink-50 hover:bg-pink-100 border-pink-200',
    },
    {
      id: 'mothers',
      label: 'Mothers',
      description: 'Access mother profiles',
      icon: <Users className="w-5 h-5" />,
      href: '/clinical/midwife/mothers',
      color: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
    },
    {
      id: 'anc-visits',
      label: 'ANC Visits',
      description: 'Conduct and record ANC visits',
      icon: <Stethoscope className="w-5 h-5" />,
      href: '/clinical/midwife/anc-visits',
      color: 'bg-green-50 hover:bg-green-100 border-green-200',
    },
    {
      id: 'vitals',
      label: 'Vital Signs',
      description: 'Monitor and record vital signs',
      icon: <TrendingUp className="w-5 h-5" />,
      href: '/clinical/midwife/vitals',
      color: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
    },
    {
      id: 'symptoms',
      label: 'Symptoms',
      description: 'Track danger signs and symptoms',
      icon: <AlertCircle className="w-5 h-5" />,
      href: '/clinical/midwife/symptoms',
      color: 'bg-red-50 hover:bg-red-100 border-red-200',
    },
    {
      id: 'alerts',
      label: 'Health Alerts',
      description: 'Respond to critical alerts',
      icon: <ShieldAlert className="w-5 h-5" />,
      href: '/clinical/midwife/alerts',
      color: 'bg-red-50 hover:bg-red-100 border-red-200',
    },
    {
      id: 'appointments',
      label: 'Appointments',
      description: 'Schedule appointments',
      icon: <Calendar className="w-5 h-5" />,
      href: '/clinical/midwife/appointments',
      color: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
    },
    {
      id: 'referrals',
      label: 'Referrals',
      description: 'Create and track referrals',
      icon: <HeartHandshake className="w-5 h-5" />,
      href: '/clinical/midwife/referrals',
      color: 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200',
    },
  ],
  DHO: [
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'District-wide health overview',
      icon: <BarChart3 className="w-5 h-5" />,
      href: '/dho-dashboard',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
      badge: 'Main'
    },
    {
      id: 'my-profile',
      label: 'My Profile',
      description: 'View your DHO profile',
      icon: <Edit className="w-5 h-5" />,
      href: '/profile',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    },
    {
      id: 'facilities',
      label: 'Facilities',
      description: 'Manage district facilities',
      icon: <Stethoscope className="w-5 h-5" />,
      href: '/dho-dashboard/facilities',
      color: 'bg-green-50 hover:bg-green-100 border-green-200',
    },
    {
      id: 'statistics',
      label: 'Statistics',
      description: 'View district health statistics',
      icon: <TrendingUp className="w-5 h-5" />,
      href: '/dho-dashboard/statistics',
      color: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
    },
    {
      id: 'reports',
      label: 'Reports',
      description: 'Generate district reports',
      icon: <FileText className="w-5 h-5" />,
      href: '/dho-dashboard/reports',
      color: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200',
    },
  ],
  HOSPITAL_ADMIN: [
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'Hospital management overview',
      icon: <BarChart3 className="w-5 h-5" />,
      href: '/admin-dashboard',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
      badge: 'Main'
    },
    {
      id: 'my-profile',
      label: 'My Profile',
      description: 'View your admin profile',
      icon: <Edit className="w-5 h-5" />,
      href: '/profile',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    },
    {
      id: 'staff',
      label: 'Staff Management',
      description: 'Manage hospital staff',
      icon: <Users className="w-5 h-5" />,
      href: '/admin-dashboard/staff',
      color: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
    },
    {
      id: 'mothers',
      label: 'Mother Records',
      description: 'Access all mother records',
      icon: <Users className="w-5 h-5" />,
      href: '/admin-dashboard/mothers',
      color: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
    },
    {
      id: 'statistics',
      label: 'Statistics',
      description: 'Hospital statistics and analytics',
      icon: <BarChart3 className="w-5 h-5" />,
      href: '/admin-dashboard/statistics',
      color: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
    },
    {
      id: 'reports',
      label: 'Reports',
      description: 'Generate hospital reports',
      icon: <FileText className="w-5 h-5" />,
      href: '/admin-dashboard/reports',
      color: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200',
    },
  ],
  SYSTEM_ADMIN: [
    {
      id: 'dashboard',
      label: 'System Dashboard',
      description: 'System-wide administration',
      icon: <BarChart3 className="w-5 h-5" />,
      href: '/admin-dashboard',
      color: 'bg-gray-50 hover:bg-gray-100 border-gray-200',
      badge: 'Main'
    },
    {
      id: 'my-profile',
      label: 'My Profile',
      description: 'View your system admin profile',
      icon: <Edit className="w-5 h-5" />,
      href: '/profile',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    },
    {
      id: 'users',
      label: 'User Management',
      description: 'Manage all system users',
      icon: <Users className="w-5 h-5" />,
      href: '/admin-dashboard/users',
      color: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
    },
    {
      id: 'facilities',
      label: 'Facilities',
      description: 'Manage all facilities',
      icon: <Stethoscope className="w-5 h-5" />,
      href: '/admin-dashboard/facilities',
      color: 'bg-green-50 hover:bg-green-100 border-green-200',
    },
    {
      id: 'audit',
      label: 'Audit Logs',
      description: 'Review system audit logs',
      icon: <ClipboardList className="w-5 h-5" />,
      href: '/admin-dashboard/audit',
      color: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200',
    },
  ],
};

export default function FeatureMenu({
  role,
  onNavigate,
  displayMode = 'grid',
}: FeatureMenuProps) {
  const router = useRouter();
  const features = ROLE_FEATURES[role] || [];

  const handleFeatureClick = (href?: string) => {
    if (!href) return;
    if (onNavigate) {
      onNavigate(href);
    } else {
      router.push(href);
    }
  };

  if (displayMode === 'list') {
    return (
      <div className="space-y-2">
        {features.map((feature) => (
          <button
            key={feature.id}
            onClick={() => handleFeatureClick(feature.href)}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${feature.color} flex items-start gap-3`}
          >
            <div className="text-blue-600 flex-shrink-0 mt-0.5">{feature.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-900">{feature.label}</div>
              <div className="text-xs text-gray-600">{feature.description}</div>
            </div>
            {feature.badge && (
              <span className="flex-shrink-0 text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full whitespace-nowrap">
                {feature.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // Grid view (default)
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {features.map((feature) => (
        <button
          key={feature.id}
          onClick={() => handleFeatureClick(feature.href)}
          className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${feature.color}`}
        >
          <div className="text-blue-600 mb-2">{feature.icon}</div>
          <h3 className="font-semibold text-gray-900 text-sm mb-1 text-left">
            {feature.label}
            {feature.badge && (
              <span className="ml-2 text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                {feature.badge}
              </span>
            )}
          </h3>
          <p className="text-xs text-gray-600 text-left line-clamp-2">
            {feature.description}
          </p>
        </button>
      ))}
    </div>
  );
}
