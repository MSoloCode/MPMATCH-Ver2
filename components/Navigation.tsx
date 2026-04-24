'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Menu, X } from 'lucide-react';

interface WorkflowStep {
  number: number;
  title: string;
  description: string;
}

const workflowSteps: WorkflowStep[] = [
  {
    number: 1,
    title: 'Patient Registration',
    description: 'Register pregnant women and track their health status',
  },
  {
    number: 2,
    title: 'Risk Assessment',
    description: 'Identify pregnancy and perinatal complications early',
  },
  {
    number: 3,
    title: 'Community Link',
    description: 'Connect with community health workers for support',
  },
  {
    number: 4,
    title: 'Hospital Referral',
    description: 'Facilitate seamless referral to hospital when needed',
  },
  {
    number: 5,
    title: 'Follow-up Care',
    description: 'Monitor post-natal care and maternal health outcomes',
  },
];

const primaryNavItems = [
  { label: 'Home', href: '/' },
  { label: 'Community', href: '/community' },
  { label: 'Help me find a service', href: '/find-service' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'SMS/USSD/Call', href: '/sms-ussd' },
];

const secondaryNavItems = [
  { label: 'Security', href: '/security' },
  { label: 'Emergency', href: '/emergency' },
  { label: 'Chat with AI', href: '/ai-chat' },
  { label: 'Sign in', href: '/sign-in' },
];

const Navigation: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
    // Close dropdown when toggling mobile menu
    if (!isMobileMenuOpen) {
      setIsMoreDropdownOpen(false);
    }
  };

  const toggleMoreDropdown = () => {
    setIsMoreDropdownOpen(!isMoreDropdownOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const closeDropdown = () => {
    setIsMoreDropdownOpen(false);
  };

  return (
    <nav className="w-full bg-primary border-b border-neutral border-opacity-20">
      {/* Desktop Navigation */}
      <div className="hidden lg:block">
        {/* Primary Row */}
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 border-b border-neutral border-opacity-10">
          <ul className="flex items-center justify-start gap-8">
            {primaryNavItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-neutral text-sm font-medium hover:text-accent transition-colors duration-200 whitespace-nowrap"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            {/* More Dropdown */}
            <li className="relative group">
              <button
                onClick={toggleMoreDropdown}
                className="text-neutral text-sm font-medium hover:text-accent transition-colors duration-200 flex items-center gap-1 group whitespace-nowrap"
              >
                More
                <ChevronDown
                  size={16}
                  className={`transform transition-transform duration-200 ${
                    isMoreDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Panel - More about the system */}
              {isMoreDropdownOpen && (
                <div className="absolute left-0 mt-0 w-full min-w-max bg-primary-light border border-accent border-opacity-30 rounded-lg shadow-lg p-6 z-50">
                  <h3 className="text-accent font-bold text-lg mb-4">
                    More about the system
                  </h3>
                  <div className="grid grid-cols-5 gap-4">
                    {workflowSteps.map((step) => (
                      <div
                        key={step.number}
                        className="bg-primary p-4 rounded-lg border border-accent border-opacity-20 hover:border-opacity-50 transition-all duration-200"
                      >
                        <div className="flex items-center justify-center w-10 h-10 bg-accent text-primary rounded-full font-bold text-lg mb-3">
                          {step.number}
                        </div>
                        <h4 className="text-neutral font-semibold text-sm mb-2">
                          {step.title}
                        </h4>
                        <p className="text-neutral text-opacity-70 text-xs leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </li>
          </ul>
        </div>

        {/* Secondary Row */}
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-3">
          <ul className="flex items-center justify-end gap-8">
            {secondaryNavItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-neutral text-sm font-medium hover:text-accent transition-colors duration-200 whitespace-nowrap"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        {/* Mobile Header */}
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-lg font-bold text-accent">MPMATCH</div>
          <button
            onClick={toggleMobileMenu}
            className="text-neutral hover:text-accent transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="bg-primary-light border-t border-neutral border-opacity-10 max-h-96 overflow-y-auto">
            <div className="px-6 py-4">
              {/* Primary Items */}
              <div className="mb-4">
                {primaryNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobileMenu}
                    className="block text-neutral py-2 font-medium hover:text-accent transition-colors text-sm"
                  >
                    {item.label}
                  </Link>
                ))}

                {/* Mobile More Dropdown */}
                <div className="mt-4 pt-4 border-t border-neutral border-opacity-20">
                  <button
                    onClick={toggleMoreDropdown}
                    className="w-full text-neutral font-medium hover:text-accent transition-colors py-2 flex items-center justify-between"
                  >
                    More
                    <ChevronDown
                      size={16}
                      className={`transform transition-transform duration-200 ${
                        isMoreDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Mobile Workflow Steps */}
                  {isMoreDropdownOpen && (
                    <div className="mt-4 space-y-3">
                      <p className="text-accent font-semibold text-sm mb-3">
                        More about the system
                      </p>
                      {workflowSteps.map((step) => (
                        <div
                          key={step.number}
                          className="bg-primary p-3 rounded-lg border border-accent border-opacity-20"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-8 h-8 bg-accent text-primary rounded-full font-bold text-sm flex-shrink-0">
                              {step.number}
                            </div>
                            <div>
                              <h4 className="text-neutral font-semibold text-xs">
                                {step.title}
                              </h4>
                              <p className="text-neutral text-opacity-70 text-xs mt-1">
                                {step.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Secondary Items */}
              <div className="mt-6 pt-4 border-t border-neutral border-opacity-20 space-y-2">
                {secondaryNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobileMenu}
                    className="block text-neutral py-2 font-medium hover:text-accent transition-colors text-sm"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
