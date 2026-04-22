'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_TO_DASHBOARD } from '@/lib/role-routes';

interface NavItem {
  label: string;
  href: string;
  roles?: string[];
}

const OVERVIEW_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: 'DYNAMIC', roles: undefined },
  { label: 'My Records', href: '/my-records', roles: ['COMMUNITY_USER'] },
  { label: 'AI Chat', href: '/ai-chat' },
  { label: 'Map', href: '/map' },
];

const CLINICAL_ITEMS: NavItem[] = [
  { label: 'Mothers', href: '/clinical/{role}/mothers', roles: ['DOCTOR', 'NURSE', 'MIDWIFE'] },
  { label: 'Pregnancies', href: '/clinical/{role}/pregnancies', roles: ['DOCTOR', 'NURSE', 'MIDWIFE'] },
  { label: 'ANC Visits', href: '/clinical/{role}/anc-visits', roles: ['DOCTOR', 'NURSE', 'MIDWIFE'] },
  { label: 'Vitals', href: '/clinical/{role}/vitals', roles: ['DOCTOR', 'NURSE', 'MIDWIFE'] },
  { label: 'Symptoms', href: '/clinical/{role}/symptoms', roles: ['DOCTOR', 'NURSE', 'MIDWIFE'] },
  { label: 'Appointments', href: '/clinical/{role}/appointments', roles: ['DOCTOR', 'NURSE', 'MIDWIFE'] },
  { label: 'Reports', href: '/clinical/{role}/reports', roles: ['DOCTOR', 'NURSE', 'MIDWIFE'] },
  { label: 'Referrals', href: '/clinical/{role}/referrals', roles: ['DOCTOR', 'NURSE', 'MIDWIFE'] },
];

export default function Sidebar() {
  const { username, role, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  if (!isAuthenticated || !role) {
    return null;
  }

  const isClinicalRole = ['DOCTOR', 'NURSE', 'MIDWIFE'].includes(role);
  const dashboardUrl = ROLE_TO_DASHBOARD[role as keyof typeof ROLE_TO_DASHBOARD] || '/';

  const isPathActive = (href: string) => {
    if (href === 'DYNAMIC') return false;
    const expandedHref = href.replace('{role}', role.toLowerCase());
    return pathname.startsWith(expandedHref);
  };

  const isDashboardActive = pathname === dashboardUrl;

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      logout();
      router.push('/sign-in');
    }
  };

  const handleNavClick = (href: string) => {
    if (href === 'DYNAMIC') {
      router.push(dashboardUrl);
    } else {
      const expandedHref = href.replace('{role}', role.toLowerCase());
      router.push(expandedHref);
    }
    setIsOpen(false);
  };

  const MobileMenuButton = () => (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
    >
      {isOpen ? (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      )}
    </button>
  );

  return (
    <>
      <MobileMenuButton />

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 z-40 lg:relative lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-blue-600">MPMATCH</h1>
          <p className="text-sm text-gray-600 mt-2">
            {username} • <span className="font-semibold">{role}</span>
          </p>
        </div>

        {/* Navigation - Scrollable */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-8">
          {/* OVERVIEW Section */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Overview
            </h3>
            <div className="space-y-1">
              {OVERVIEW_ITEMS.map((item) => {
                const shouldShow = !item.roles || item.roles.includes(role);
                if (!shouldShow) return null;

                return (
                  <button
                    key={item.label}
                    onClick={() => handleNavClick(item.href)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${
                      (item.href === 'DYNAMIC' ? isDashboardActive : isPathActive(item.href))
                        ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CLINICAL Section */}
          {isClinicalRole && (
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Clinical
              </h3>
              <div className="space-y-1">
                {CLINICAL_ITEMS.map((item) => {
                  const shouldShow = !item.roles || item.roles.includes(role);
                  if (!shouldShow) return null;

                  return (
                    <button
                      key={item.label}
                      onClick={() => handleNavClick(item.href)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${
                        isPathActive(item.href)
                          ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
