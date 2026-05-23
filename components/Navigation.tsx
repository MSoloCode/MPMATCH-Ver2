'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import UserProfileDropdown from '@/components/UserProfileDropdown';

const primaryNavItems = [
  { label: 'Home', href: '/' },
  { label: 'Community', href: '/community' },
  { label: 'Find Service', href: '/find-service' },
  { label: 'How it Works', href: '/how-it-works' },
  { label: 'SMS/USSD/Call', href: '/sms-ussd' },
];

const secondaryNavItems = [
  { label: 'Security', href: '/security' },
  { label: 'Emergency', href: '/emergency' },
];

const Navigation: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-primary-dark border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-4">
        <div className="flex items-center justify-between">
          {/* Logo Section */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-6 h-6 bg-accent rounded-md flex-shrink-0"></div>
            <span className="text-lg font-bold text-neutral hidden sm:inline-block whitespace-nowrap">
              MPMATCH LINKS AFRICA
            </span>
            <span className="text-lg font-bold text-neutral sm:hidden">
              MPMATCH
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-12 flex-1 ml-12">
            <ul className="flex items-center gap-8">
              {primaryNavItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-neutral text-sm font-medium hover:text-accent hover:border-b-2 hover:border-accent transition-all duration-200 pb-1"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Desktop Right Section */}
          <div className="hidden lg:flex items-center gap-4">
            <Link
              href="/ai-chat"
              className="px-6 py-2 bg-accent text-primary font-medium rounded-md hover:bg-orange-600 transition-all duration-200 hover:shadow-lg focus-ring"
            >
              Chat with AI
            </Link>
            
            {/* Conditionally render Sign In or User Profile */}
            {mounted && !isLoading && (
              isAuthenticated ? (
                <UserProfileDropdown />
              ) : (
                <Link
                  href="/sign-in"
                  className="px-6 py-2 bg-accent text-primary font-medium rounded-md hover:bg-orange-600 transition-all duration-200 hover:shadow-lg focus-ring"
                >
                  Sign in
                </Link>
              )
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className="lg:hidden text-neutral hover:text-accent transition-colors focus-ring p-2"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden mt-4 pt-4 border-t border-gray-700">
            {/* Primary Navigation Items */}
            <div className="space-y-2 mb-4">
              {primaryNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className="block text-neutral py-2 px-2 font-medium hover:text-accent hover:bg-primary-light rounded transition-colors text-sm"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-700 my-4"></div>

            {/* Secondary Navigation Items */}
            <div className="space-y-2 mb-4">
              {secondaryNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className="block text-neutral py-2 px-2 font-medium hover:text-accent hover:bg-primary-light rounded transition-colors text-sm"
                >
                  {item.label}
                </Link>
              ))}
              
              {/* Conditionally render Sign In or User Profile in Mobile Menu */}
              {mounted && !isLoading && !isAuthenticated && (
                <Link
                  href="/sign-in"
                  onClick={closeMobileMenu}
                  className="block text-neutral py-2 px-2 font-medium hover:text-accent hover:bg-primary-light rounded transition-colors text-sm"
                >
                  Sign in
                </Link>
              )}
            </div>

            {/* Chat CTA Button */}
            <div className="pt-4 border-t border-gray-700">
              <Link
                href="/ai-chat"
                onClick={closeMobileMenu}
                className="block w-full px-4 py-3 bg-accent text-primary font-medium rounded-md hover:bg-orange-600 transition-all duration-200 text-center focus-ring"
              >
                Chat with AI
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
