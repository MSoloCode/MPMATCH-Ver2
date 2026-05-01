'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import dynamicImport from 'next/dynamic';
import { useState, useEffect } from 'react';
import { MessageCircle, Hash, Phone, Shield, CheckCircle, Lock, ArrowUp } from 'lucide-react';
import Button from '@/components/Button';
import { FacilityListItem, EmergencyNumbers } from '@/types';

const HeroImage = dynamicImport(() => import('@/components/HeroImage'), { ssr: false });

export default function Home() {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  const [facilities, setFacilities] = useState<FacilityListItem[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [facilityId, setFacilityId] = useState('');
  const [emergencyNumbers, setEmergencyNumbers] = useState<EmergencyNumbers>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  // ============================================================================
  // FETCH FACILITIES ON MOUNT
  // ============================================================================
  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const response = await fetch('/api/facilities');
        const data = await response.json();
        if (data.success) {
          setFacilities(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch facilities:', error);
      }
    };
    fetchFacilities();
  }, []);

  // ============================================================================
  // SHOW MESSAGE WITH AUTO-CLEAR
  // ============================================================================
  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  // ============================================================================
  // LOAD EMERGENCY NUMBERS FOR SELECTED FACILITY
  // ============================================================================
  const handleLoadNumbers = async () => {
    if (!facilityId) {
      showMessage('Please select a facility first', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/facilities/${facilityId}/emergency-numbers`);
      const data = await response.json();

      if (data.success) {
        setEmergencyNumbers(data.data);
        showMessage('Emergency numbers loaded successfully', 'success');
      } else {
        showMessage(data.error || 'Failed to load emergency numbers', 'error');
      }
    } catch (error) {
      console.error('Error loading emergency numbers:', error);
      showMessage('Failed to load emergency numbers', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // GET BROWSER GEOLOCATION
  // ============================================================================
  const getGeolocation = (): Promise<{ latitude: number; longitude: number; accuracy: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn('Geolocation not supported');
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          console.warn('Geolocation error:', error);
          resolve(null);
        }
      );
    });
  };

  // ============================================================================
  // SEND EMERGENCY ALERT
  // ============================================================================
  const handleSendAlert = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneNumber.trim()) {
      showMessage('Please enter a phone number', 'error');
      return;
    }

    setLoading(true);
    try {
      // Get geolocation (optional)
      const geo = await getGeolocation();

      const payload = {
        phoneNumber: phoneNumber.trim(),
        facilityId: facilityId ? parseInt(facilityId, 10) : undefined,
        latitude: geo?.latitude,
        longitude: geo?.longitude,
        accuracy: geo?.accuracy,
      };

      const response = await fetch('/api/emergency-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        showMessage('Emergency alert sent successfully', 'success');
        setPhoneNumber('');
        setEmergencyNumbers({});
      } else {
        showMessage(data.error || 'Failed to send emergency alert', 'error');
      }
    } catch (error) {
      console.error('Error sending emergency alert:', error);
      showMessage('Failed to send emergency alert', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // SCROLL TO TOP
  // ============================================================================
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-primary to-[#16213e] text-neutral">
      {/* Header Section */}
      <header className="w-full py-6 px-6 md:px-12 border-b border-neutral border-opacity-20">
        <div className="max-w-7xl mx-auto">
          {/* Full System Name */}
          <p className="text-xs md:text-sm text-neutral text-opacity-70 leading-relaxed mb-2">
            Maternal and Perinatal Mortality Alleviation Through
            <br className="hidden sm:block" />
            COMMUNITY-TO-HOSPITAL e-LINKS
          </p>

          {/* Full System Name */}
          <div className="flex items-center gap-3">
            {/* Orange Square Icon */}
            <div className="w-6 h-6 bg-accent rounded-sm flex-shrink-0" />

            {/* Full Name */}
            <h1 className="text-2xl md:text-3xl font-bold text-neutral">
              Maternal and Perinatal Mortality Alleviation Through Community-to-Hospital e-Links
            </h1>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="w-full flex-1 py-12 md:py-20 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Content - Left/Top */}
            <div className="flex flex-col justify-center space-y-6">
              {/* Tagline */}
              <h2 className="text-4xl md:text-5xl font-bold leading-tight text-neutral">
                Maternal care that follows the mother, from community to facility.
              </h2>

              {/* Sub-tagline */}
              <p className="text-lg md:text-xl text-neutral text-opacity-85 leading-relaxed">
                Connecting communities, CHWs, clinicians, and hospitals across Africa.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link href="/signup">
                  <Button variant="primary">Get started</Button>
                </Link>
                <Link href="/learn">
                  <Button variant="outline">Learn how it works</Button>
                </Link>
              </div>
            </div>

            {/* Hero Image - Right/Bottom */}
            <div className="w-full h-full flex items-center justify-center">
              <HeroImage />
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================================= */}
      {/* CONNECTIVITY SECTION - FEATURE CARDS */}
      {/* ======================================================================= */}
      <section className="w-full py-16 md:py-20 px-6 md:px-12 bg-primary-light">
        <div className="max-w-7xl mx-auto">
          {/* Section Title */}
          <h2 className="text-3xl md:text-4xl font-bold text-neutral mb-4">
            Connectivity Solutions
          </h2>
          <p className="text-neutral text-opacity-80 text-lg mb-12">
            Multiple channels to keep mothers connected and informed
          </p>

          {/* Feature Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1: SMS Reminders */}
            <div className="bg-primary rounded-lg p-6 border border-neutral border-opacity-10 hover:border-accent hover:border-opacity-30 transition-all duration-200">
              <div className="mb-4 text-accent">
                <MessageCircle size={40} />
              </div>
              <h3 className="text-xl font-bold text-neutral mb-3">SMS Reminders</h3>
              <p className="text-neutral text-opacity-80 text-sm leading-relaxed">
                ANC appointment reminders, missed-visit follow-ups, targeted education messages with delivery tracking.
              </p>
            </div>

            {/* Card 2: USSD Flows */}
            <div className="bg-primary rounded-lg p-6 border border-neutral border-opacity-10 hover:border-accent hover:border-opacity-30 transition-all duration-200">
              <div className="mb-4 text-accent">
                <Hash size={40} />
              </div>
              <h3 className="text-xl font-bold text-neutral mb-3">USSD Flows</h3>
              <p className="text-neutral text-opacity-80 text-sm leading-relaxed">
                Simple menus for confirmations and basic self-reports, designed for feature phones and low-cost access.
              </p>
            </div>

            {/* Card 3: Emergency Calling */}
            <div className="bg-primary rounded-lg p-6 border border-neutral border-opacity-10 hover:border-accent hover:border-opacity-30 transition-all duration-200">
              <div className="mb-4 text-accent">
                <Phone size={40} />
              </div>
              <h3 className="text-xl font-bold text-neutral mb-3">Emergency Calling</h3>
              <p className="text-neutral text-opacity-80 text-sm leading-relaxed">
                One-tap call to facility emergency line. If calling fails, platform sends emergency SMS to on-call staff with location context.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================================= */}
      {/* EMERGENCY ALERT PANEL */}
      {/* ======================================================================= */}
      <section className="w-full py-16 md:py-20 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          {/* Section Title */}
          <h2 className="text-3xl md:text-4xl font-bold text-neutral mb-2">
            Call now + send an emergency alert
          </h2>
          <p className="text-neutral text-opacity-80 text-lg mb-12">
            Fast access to emergency services and on-call staff
          </p>

          {/* Message Display */}
          {message && (
            <div
              className={`mb-6 p-4 rounded-lg border ${
                messageType === 'success'
                  ? 'bg-green-900 bg-opacity-20 border-green-500 border-opacity-30 text-green-200'
                  : 'bg-red-900 bg-opacity-20 border-red-500 border-opacity-30 text-red-200'
              }`}
            >
              {message}
            </div>
          )}

          {/* Two-Column Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* LEFT COLUMN: SEND EMERGENCY ALERT FORM */}
            <div className="bg-primary-light rounded-lg p-6 md:p-8 border border-accent border-opacity-20">
              <h3 className="text-2xl font-bold text-neutral mb-6">Send emergency alert</h3>

              <form onSubmit={handleSendAlert} className="space-y-6">
                {/* Phone Number Input */}
                <div>
                  <label className="block text-neutral text-opacity-90 font-medium mb-2">
                    Mother phone number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g., +256701234567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-primary border border-neutral border-opacity-20 text-neutral placeholder-neutral placeholder-opacity-50 focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                    disabled={loading}
                  />
                  <p className="text-xs text-neutral text-opacity-60 mt-1">
                    Include country code (e.g., +256) or local format (e.g., 0701...)
                  </p>
                </div>

                {/* Facility Dropdown */}
                <div>
                  <label className="block text-neutral text-opacity-90 font-medium mb-2">
                    Facility (optional)
                  </label>
                  <select
                    value={facilityId}
                    onChange={(e) => {
                      setFacilityId(e.target.value);
                      setEmergencyNumbers({}); // Clear emergency numbers when facility changes
                    }}
                    className="w-full px-4 py-3 rounded-lg bg-primary border border-neutral border-opacity-20 text-neutral focus:outline-none focus:ring-2 focus:ring-accent transition-all appearance-none cursor-pointer"
                    disabled={loading}
                  >
                    <option value="">Select facility (optional)</option>
                    {facilities.map((facility) => (
                      <option key={facility.id} value={facility.id}>
                        {facility.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleLoadNumbers}
                    disabled={loading || !facilityId}
                    className={`w-full px-6 py-3 rounded-lg font-medium transition-all ${
                      !facilityId || loading
                        ? 'bg-accent bg-opacity-40 text-neutral text-opacity-50 cursor-not-allowed'
                        : 'bg-accent text-primary hover:bg-opacity-90 active:scale-95'
                    }`}
                  >
                    {loading ? 'Loading...' : 'Load numbers'}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full px-6 py-3 rounded-lg font-medium transition-all ${
                      loading
                        ? 'bg-accent bg-opacity-40 text-neutral text-opacity-50 cursor-not-allowed'
                        : 'bg-accent text-primary hover:bg-opacity-90 active:scale-95'
                    }`}
                  >
                    {loading ? 'Sending...' : 'Send alert'}
                  </button>
                </div>
              </form>
            </div>

            {/* RIGHT COLUMN: EMERGENCY NUMBERS PANEL */}
            <div className="bg-primary-light rounded-lg p-6 md:p-8 border border-accent border-opacity-20">
              <h3 className="text-2xl font-bold text-neutral mb-6">Call emergency numbers</h3>

              {facilityId ? (
                <div className="space-y-4">
                  {/* Emergency Line */}
                  <div className="flex items-center justify-between p-4 bg-primary rounded-lg border border-neutral border-opacity-10">
                    <div className="flex-1">
                      <p className="text-neutral text-opacity-70 text-sm font-medium">Emergency Line</p>
                      <p className="text-neutral font-bold text-lg mt-1">
                        {emergencyNumbers.emergencyLine || '---'}
                      </p>
                    </div>
                    {emergencyNumbers.emergencyLine && (
                      <a
                        href={`tel:${emergencyNumbers.emergencyLine}`}
                        className="ml-4 px-4 py-2 bg-accent text-primary rounded-lg font-medium hover:bg-opacity-90 transition-all text-sm"
                      >
                        Call
                      </a>
                    )}
                  </div>

                  {/* Ambulance */}
                  <div className="flex items-center justify-between p-4 bg-primary rounded-lg border border-neutral border-opacity-10">
                    <div className="flex-1">
                      <p className="text-neutral text-opacity-70 text-sm font-medium">Ambulance</p>
                      <p className="text-neutral font-bold text-lg mt-1">
                        {emergencyNumbers.ambulance || '---'}
                      </p>
                    </div>
                    {emergencyNumbers.ambulance && (
                      <a
                        href={`tel:${emergencyNumbers.ambulance}`}
                        className="ml-4 px-4 py-2 bg-accent text-primary rounded-lg font-medium hover:bg-opacity-90 transition-all text-sm"
                      >
                        Call
                      </a>
                    )}
                  </div>

                  {/* On-call */}
                  <div className="flex items-center justify-between p-4 bg-primary rounded-lg border border-neutral border-opacity-10">
                    <div className="flex-1">
                      <p className="text-neutral text-opacity-70 text-sm font-medium">On-call</p>
                      <p className="text-neutral font-bold text-lg mt-1">
                        {emergencyNumbers.onCall || '---'}
                      </p>
                    </div>
                    {emergencyNumbers.onCall && (
                      <a
                        href={`tel:${emergencyNumbers.onCall}`}
                        className="ml-4 px-4 py-2 bg-accent text-primary rounded-lg font-medium hover:bg-opacity-90 transition-all text-sm"
                      >
                        Call
                      </a>
                    )}
                  </div>

                  {/* Backup */}
                  <div className="flex items-center justify-between p-4 bg-primary rounded-lg border border-neutral border-opacity-10">
                    <div className="flex-1">
                      <p className="text-neutral text-opacity-70 text-sm font-medium">Backup</p>
                      <p className="text-neutral font-bold text-lg mt-1">
                        {emergencyNumbers.backup || '---'}
                      </p>
                    </div>
                    {emergencyNumbers.backup && (
                      <a
                        href={`tel:${emergencyNumbers.backup}`}
                        className="ml-4 px-4 py-2 bg-accent text-primary rounded-lg font-medium hover:bg-opacity-90 transition-all text-sm"
                      >
                        Call
                      </a>
                    )}
                  </div>

                  {Object.keys(emergencyNumbers).length === 0 && (
                    <p className="text-neutral text-opacity-60 text-center py-4">
                      Click "Load numbers" to display emergency contacts
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <p className="text-neutral text-opacity-60">
                    Select a facility and click "Load numbers" to see emergency contacts
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================================= */}
      {/* SAFETY & PRIVACY SECTION */}
      {/* ======================================================================= */}
      <section className="w-full py-16 md:py-20 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          {/* Section Title */}
          <h2 className="text-3xl md:text-4xl font-bold text-neutral mb-2">
            Safety & Privacy — Built with clinical accountability in mind
          </h2>
          <p className="text-neutral text-opacity-80 text-lg mb-12">
            Enterprise-grade security and compliance for maternal health data
          </p>

          {/* Security Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1: Access Controls */}
            <div className="bg-primary-light rounded-lg p-6 border border-neutral border-opacity-10 hover:border-accent hover:border-opacity-30 transition-all duration-200">
              <div className="mb-4 text-accent">
                <Shield size={40} />
              </div>
              <h3 className="text-xl font-bold text-neutral mb-3">Access controls</h3>
              <p className="text-neutral text-opacity-80 text-sm leading-relaxed">
                RBAC with hospital and country scoping enforced server-side. Field-level permissions ensure users only access data they're authorized to see.
              </p>
            </div>

            {/* Card 2: Audit Trails */}
            <div className="bg-primary-light rounded-lg p-6 border border-neutral border-opacity-10 hover:border-accent hover:border-opacity-30 transition-all duration-200">
              <div className="mb-4 text-accent">
                <CheckCircle size={40} />
              </div>
              <h3 className="text-xl font-bold text-neutral mb-3">Audit trails</h3>
              <p className="text-neutral text-opacity-80 text-sm leading-relaxed">
                Every create/update/read action on clinical records is logged with actor, timestamp, and change details for full accountability.
              </p>
            </div>

            {/* Card 3: Consent Management */}
            <div className="bg-primary-light rounded-lg p-6 border border-neutral border-opacity-10 hover:border-accent hover:border-opacity-30 transition-all duration-200">
              <div className="mb-4 text-accent">
                <Lock size={40} />
              </div>
              <h3 className="text-xl font-bold text-neutral mb-3">Consent management</h3>
              <p className="text-neutral text-opacity-80 text-sm leading-relaxed">
                Explicit consent captured for SMS communication, data processing, and referrals. Mothers control their data sharing preferences.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================================= */}
      {/* FOOTER */}
      {/* ======================================================================= */}
      <footer className="w-full bg-[#0f1419] text-neutral py-16 md:py-20 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          {/* Brand & Tagline Section */}
          <div className="mb-12 pb-12 border-b border-neutral border-opacity-10">
            <div className="flex items-center gap-3 mb-4">
              {/* Orange Square Icon */}
              <div className="w-6 h-6 bg-accent rounded-sm flex-shrink-0" />

              {/* Brand Name */}
              <h2 className="text-2xl md:text-3xl font-bold text-neutral">
                MPMATCH LINKS AFRICA
              </h2>
            </div>

            {/* Tagline */}
            <p className="text-neutral text-opacity-80 text-sm md:text-base mb-6">
              Connecting communities, CHWs, clinicians, and hospitals across Africa. Maternal care that follows the mother.
            </p>

            {/* Colored Dots */}
            <div className="flex items-center gap-4">
              {/* Uganda Theme Dot - Black */}
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[#1a1a1a] rounded-full border-2 border-neutral border-opacity-20" />
                <span className="text-xs text-neutral text-opacity-70">Uganda theme</span>
              </div>

              {/* SMS/USSD/Call Dot - Yellow */}
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-warning rounded-full border-2 border-neutral border-opacity-20" />
                <span className="text-xs text-neutral text-opacity-70">SMS/USSD/Call ready</span>
              </div>

              {/* Emergency Escalation Dot - Red */}
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-danger rounded-full border-2 border-neutral border-opacity-20" />
                <span className="text-xs text-neutral text-opacity-70">Emergency escalation</span>
              </div>
            </div>
          </div>

          {/* Footer Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            {/* Product Column */}
            <div>
              <h3 className="text-lg font-bold text-neutral mb-4">Product</h3>
              <ul className="space-y-3">
                <li>
                  <a href="#features" className="text-neutral text-opacity-70 hover:text-neutral hover:text-opacity-100 transition-all text-sm">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#workflow" className="text-neutral text-opacity-70 hover:text-neutral hover:text-opacity-100 transition-all text-sm">
                    Workflow
                  </a>
                </li>
                <li>
                  <a href="#security" className="text-neutral text-opacity-70 hover:text-neutral hover:text-opacity-100 transition-all text-sm">
                    Security
                  </a>
                </li>
              </ul>
            </div>

            {/* Access Column */}
            <div>
              <h3 className="text-lg font-bold text-neutral mb-4">Access</h3>
              <ul className="space-y-3">
                <li>
                  <a href="/login" className="text-neutral text-opacity-70 hover:text-neutral hover:text-opacity-100 transition-all text-sm">
                    Login
                  </a>
                </li>
                <li>
                  <a href="/admin" className="text-neutral text-opacity-70 hover:text-neutral hover:text-opacity-100 transition-all text-sm">
                    Admin login
                  </a>
                </li>
                <li>
                  <button
                    onClick={scrollToTop}
                    className="text-neutral text-opacity-70 hover:text-neutral hover:text-opacity-100 transition-all text-sm flex items-center gap-1"
                  >
                    Back to top <ArrowUp size={14} />
                  </button>
                </li>
              </ul>
            </div>

            {/* Contact Column */}
            <div>
              <h3 className="text-lg font-bold text-neutral mb-4">Contact</h3>
              <ul className="space-y-3">
                <li>
                  <a href="mailto:partnerships@mpmatch.org" className="text-neutral text-opacity-70 hover:text-neutral hover:text-opacity-100 transition-all text-sm">
                    Partnerships
                  </a>
                </li>
                <li>
                  <a href="mailto:integrations@mpmatch.org" className="text-neutral text-opacity-70 hover:text-neutral hover:text-opacity-100 transition-all text-sm">
                    Integrations
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="text-center border-t border-neutral border-opacity-10 pt-8">
            <p className="text-neutral text-opacity-60 text-sm">
              © 2026 MPMATCH LINKS AFRICA. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
