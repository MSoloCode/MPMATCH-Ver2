/**
 * UserProfileDropdown Component
 * Displays user profile in top-right corner with dropdown menu
 * Shows user information and account actions
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, LogOut, Settings, User } from 'lucide-react';

interface UserInfo {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  avatar?: string;
}

interface UserProfileDropdownProps {
  userInfo?: UserInfo;
  displayName?: string;
  role?: string;
  onLogout?: () => void;
}

export default function UserProfileDropdown({
  userInfo,
  displayName,
  role,
  onLogout,
}: UserProfileDropdownProps) {
  const router = useRouter();
  const { logout, username, phone, email, token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch profile picture on mount
  useEffect(() => {
    const fetchProfilePicture = async () => {
      if (!token) return;

      try {
        const response = await fetch('/api/users/profile', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.data?.user?.profilePictureUrl) {
            setProfilePictureUrl(result.data.user.profilePictureUrl);
          }
        }
      } catch (error) {
        console.error('Error fetching profile picture:', error);
      }
    };

    fetchProfilePicture();
  }, [token]);

  // Use provided info or fall back to auth hook
  const name = displayName || username || 'User';
  const userRole = role || 'N/A';
  const userPhone = userInfo?.phone || phone || 'N/A';
  const userEmail = userInfo?.email || email || 'N/A';

  // Get user initials for avatar
  const getInitials = (fullName: string): string => {
    return fullName
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get role-specific color
  const getRoleColor = (userRole: string): string => {
    switch (userRole.toUpperCase()) {
      case 'COMMUNITY_USER':
        return 'bg-pink-100 text-pink-800';
      case 'CHW':
        return 'bg-green-100 text-green-800';
      case 'DOCTOR':
        return 'bg-blue-100 text-blue-800';
      case 'NURSE':
        return 'bg-purple-100 text-purple-800';
      case 'MIDWIFE':
        return 'bg-indigo-100 text-indigo-800';
      case 'DHO':
        return 'bg-orange-100 text-orange-800';
      case 'HOSPITAL_ADMIN':
        return 'bg-red-100 text-red-800';
      case 'SYSTEM_ADMIN':
        return 'bg-gray-800 text-white';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get role-specific display name
  const getRoleDisplayName = (userRole: string): string => {
    const roleMap: Record<string, string> = {
      COMMUNITY_USER: 'Pregnant Mother',
      CHW: 'Community Health Worker',
      DOCTOR: 'Doctor',
      NURSE: 'Nurse',
      MIDWIFE: 'Midwife',
      DHO: 'District Health Officer',
      ORG_ADMIN: 'Organization Admin',
      HOSPITAL_ADMIN: 'Hospital Admin',
      SYSTEM_ADMIN: 'System Administrator',
      AMBULANCE_MANAGER: 'Ambulance Manager',
    };
    return roleMap[userRole.toUpperCase()] || userRole;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setIsOpen(false);
    onLogout ? onLogout() : logout();
    router.push('/sign-in');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        {/* Avatar Circle */}
        {profilePictureUrl ? (
          <img
            src={profilePictureUrl}
            alt={name}
            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
          />
        ) : (
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${getRoleColor(
              userRole
            )}`}
          >
            {getInitials(name)}
          </div>
        )}

        {/* Name and Role (hidden on mobile) */}
        <div className="hidden sm:block text-left">
          <p className="text-sm font-semibold text-gray-900 line-clamp-1">
            {name}
          </p>
          <p className="text-xs text-gray-500">{getRoleDisplayName(userRole)}</p>
        </div>

        {/* Chevron */}
        <ChevronDown
          className={`w-4 h-4 text-gray-600 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              {profilePictureUrl ? (
                <img
                  src={profilePictureUrl}
                  alt={name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${getRoleColor(
                    userRole
                  )}`}
                >
                  {getInitials(name)}
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{name}</p>
                <p className={`text-xs font-medium ${getRoleColor(userRole)}`}>
                  {getRoleDisplayName(userRole)}
                </p>
              </div>
            </div>
          </div>

          {/* User Information */}
          <div className="p-4 space-y-3 border-b border-gray-100">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                📧 Email
              </label>
              <p className="text-sm text-gray-900 mt-1">
                {userEmail !== 'N/A' ? userEmail : 'Not provided'}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                📱 Phone
              </label>
              <p className="text-sm text-gray-900 mt-1">
                {userPhone !== 'N/A' ? userPhone : 'Not provided'}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                👤 Role
              </label>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleColor(
                    userRole
                  )}`}
                >
                  {getRoleDisplayName(userRole)}
                </span>
              </div>
            </div>

            {userInfo?.name && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  📋 Full Name
                </label>
                <p className="text-sm text-gray-900 mt-1">{userInfo.name}</p>
              </div>
            )}
          </div>

          {/* Menu Actions */}
          <div className="p-2 space-y-1">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/profile');
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              <User className="w-4 h-4" />
              View Profile
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/profile/edit');
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              <Settings className="w-4 h-4" />
              Edit Profile
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>

          {/* Footer Info */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              ✓ Signed in to MPMATCH
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
