/**
 * User Profile Card Component
 * Displays user information with action buttons
 * Shows role, contact info, and profile links
 */

'use client';

import { useRouter } from 'next/navigation';
import { Edit, Mail, Phone, MapPin, Badge, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface UserProfileCardProps {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  joinDate?: string;
  location?: string;
  profilePictureUrl?: string;
  onEditClick?: () => void;
  showEditButton?: boolean;
}

const ROLE_DETAILS: Record<string, { color: string; displayName: string; description: string }> = {
  COMMUNITY_USER: {
    color: 'bg-pink-100 text-pink-800',
    displayName: 'Pregnant Mother',
    description: 'Community member accessing maternal health services',
  },
  CHW: {
    color: 'bg-green-100 text-green-800',
    displayName: 'Community Health Worker',
    description: 'Providing community-level healthcare and support',
  },
  DOCTOR: {
    color: 'bg-blue-100 text-blue-800',
    displayName: 'Doctor',
    description: 'Clinical physician managing pregnancies and patients',
  },
  NURSE: {
    color: 'bg-purple-100 text-purple-800',
    displayName: 'Nurse',
    description: 'Nursing professional supporting clinical care',
  },
  MIDWIFE: {
    color: 'bg-indigo-100 text-indigo-800',
    displayName: 'Midwife',
    description: 'Specialized midwifery professional',
  },
  DHO: {
    color: 'bg-orange-100 text-orange-800',
    displayName: 'District Health Officer',
    description: 'District-level health administration',
  },
  ORG_ADMIN: {
    color: 'bg-cyan-100 text-cyan-800',
    displayName: 'Organization Admin',
    description: 'Organization administration and management',
  },
  HOSPITAL_ADMIN: {
    color: 'bg-red-100 text-red-800',
    displayName: 'Hospital Admin',
    description: 'Hospital administration and management',
  },
  SYSTEM_ADMIN: {
    color: 'bg-gray-800 text-white',
    displayName: 'System Administrator',
    description: 'Full system administration and control',
  },
  AMBULANCE_MANAGER: {
    color: 'bg-yellow-100 text-yellow-800',
    displayName: 'Ambulance Manager',
    description: 'Managing ambulance services',
  },
};

export default function UserProfileCard({
  name,
  email,
  phone,
  role,
  joinDate,
  location,
  profilePictureUrl,
  onEditClick,
  showEditButton = true,
}: UserProfileCardProps) {
  const router = useRouter();
  const auth = useAuth();

  const displayName = name || auth.username || 'User';
  const displayPhone = phone || auth.phone;
  const displayEmail = email || auth.email;
  const displayRole = role || auth.role || '';
  const displayProfilePictureUrl = profilePictureUrl;

  // Get initials for fallback avatar
  const getInitials = (fullName: string): string => {
    return fullName
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get role-specific color for avatar background
  const getRoleColor = (userRole: string): string => {
    const roleColorMap: Record<string, string> = {
      COMMUNITY_USER: 'bg-pink-500',
      CHW: 'bg-green-500',
      DOCTOR: 'bg-blue-500',
      NURSE: 'bg-purple-500',
      MIDWIFE: 'bg-indigo-500',
      DHO: 'bg-orange-500',
      HOSPITAL_ADMIN: 'bg-red-500',
      SYSTEM_ADMIN: 'bg-gray-800',
      AMBULANCE_MANAGER: 'bg-yellow-500',
    };
    return roleColorMap[userRole] || 'bg-gray-500';
  };

  const roleInfo = ROLE_DETAILS[displayRole] || {
    color: 'bg-gray-100 text-gray-800',
    displayName: displayRole,
    description: 'System user',
  };

  const handleEditClick = () => {
    if (onEditClick) {
      onEditClick();
    } else {
      router.push('/profile/edit');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      {/* Header with role badge */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4 flex-1">
          {/* Profile Picture / Avatar */}
          <div className="flex-shrink-0">
            {displayProfilePictureUrl ? (
              <img
                src={displayProfilePictureUrl}
                alt={displayName}
                className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg ${getRoleColor(
                  displayRole
                )}`}
              >
                {getInitials(displayName)}
              </div>
            )}
          </div>

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{displayName}</h2>
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${roleInfo.color}`}
            >
              <Badge className="w-4 h-4" />
              {roleInfo.displayName}
            </div>
            <p className="text-xs text-gray-600 mt-2">{roleInfo.description}</p>
          </div>
        </div>

        {showEditButton && (
          <button
            onClick={handleEditClick}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ml-4 flex-shrink-0"
          >
            <Edit className="w-4 h-4" />
            <span className="text-sm">Edit Profile</span>
          </button>
        )}
      </div>

      {/* Contact Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-200">
        {displayPhone && (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Phone className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-600">Phone</p>
              <p className="text-sm font-medium text-gray-900 truncate">{displayPhone}</p>
            </div>
          </div>
        )}

        {displayEmail && (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-600">Email</p>
              <p className="text-sm font-medium text-gray-900 truncate">{displayEmail}</p>
            </div>
          </div>
        )}

        {location && (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-orange-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-600">Location</p>
              <p className="text-sm font-medium text-gray-900 truncate">{location}</p>
            </div>
          </div>
        )}

        {joinDate && (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-600">Joined</p>
              <p className="text-sm font-medium text-gray-900">{joinDate}</p>
            </div>
          </div>
        )}
      </div>

      {/* Role Description Box */}
      <div className={`p-4 rounded-lg ${roleInfo.color} bg-opacity-20 border border-opacity-30`}>
        <p className="text-sm text-gray-700">
          You are logged in as a <strong>{roleInfo.displayName}</strong>. Access your role-specific
          features and data through the Feature Menu below.
        </p>
      </div>
    </div>
  );
}
