'use client';

import Link from 'next/link';
import { Lock, Shield, Eye, Key, CheckCircle, AlertCircle } from 'lucide-react';
import Button from '@/components/Button';

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-primary to-primary-light">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-neutral mb-4">
            Your Security & Privacy Matter
          </h1>
          <p className="text-lg text-neutral text-opacity-80 max-w-3xl mx-auto">
            MPMATCH uses industry-leading security measures to protect your personal and health data. Your privacy is our top priority.
          </p>
        </div>
      </section>

      {/* Security Pillars */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Data Encryption */}
          <div className="bg-white rounded-lg shadow-lg p-8 border-t-4 border-accent">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="text-accent" size={32} />
              <h2 className="text-2xl font-bold text-primary">End-to-End Encryption</h2>
            </div>
            <p className="text-black mb-6">
              All your personal and health information is encrypted using industry-standard encryption protocols (AES-256 and TLS 1.3).
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="text-accent flex-shrink-0 mt-1" size={18} />
                <span className="text-black">Data encrypted in transit (moving between devices and servers)</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-accent flex-shrink-0 mt-1" size={18} />
                <span className="text-black">Data encrypted at rest (stored on secure servers)</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-accent flex-shrink-0 mt-1" size={18} />
                <span className="text-black">Only authorized personnel can access encrypted data</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-accent flex-shrink-0 mt-1" size={18} />
                <span className="text-black">Regular security audits and vulnerability testing</span>
              </li>
            </ul>
          </div>

          {/* Access Control */}
          <div className="bg-white rounded-lg shadow-lg p-8 border-t-4 border-secondary">
            <div className="flex items-center gap-3 mb-4">
              <Key className="text-secondary" size={32} />
              <h2 className="text-2xl font-bold text-primary">Role-Based Access Control</h2>
            </div>
            <p className="text-black mb-6">
              Different user roles have different permission levels. Your data is only visible to authorized people who need it.
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="text-secondary flex-shrink-0 mt-1" size={18} />
                <span className="text-black">Mothers can only see their own health data</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-secondary flex-shrink-0 mt-1" size={18} />
                <span className="text-black">CHWs see data for mothers they're assigned to</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-secondary flex-shrink-0 mt-1" size={18} />
                <span className="text-black">Healthcare staff see only relevant clinical information</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-secondary flex-shrink-0 mt-1" size={18} />
                <span className="text-black">Administrators have limited access for system management only</span>
              </li>
            </ul>
          </div>

          {/* Data Privacy */}
          <div className="bg-white rounded-lg shadow-lg p-8 border-t-4 border-accent">
            <div className="flex items-center gap-3 mb-4">
              <Eye className="text-accent" size={32} />
              <h2 className="text-2xl font-bold text-primary">Your Data Privacy Rights</h2>
            </div>
            <p className="text-black mb-6">
              You have full control over your personal information and health data on MPMATCH.
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="text-accent flex-shrink-0 mt-1" size={18} />
                <span className="text-black">You can view all your personal and health data anytime</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-accent flex-shrink-0 mt-1" size={18} />
                <span className="text-black">Request corrections or updates to your information</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-accent flex-shrink-0 mt-1" size={18} />
                <span className="text-black">Request deletion of your account and data</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-accent flex-shrink-0 mt-1" size={18} />
                <span className="text-black">Opt out of non-emergency communications</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-accent flex-shrink-0 mt-1" size={18} />
                <span className="text-black">We never sell your data to third parties</span>
              </li>
            </ul>
          </div>

          {/* Secure Servers */}
          <div className="bg-white rounded-lg shadow-lg p-8 border-t-4 border-secondary">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="text-secondary" size={32} />
              <h2 className="text-2xl font-bold text-primary">Secure Infrastructure</h2>
            </div>
            <p className="text-black mb-6">
              MPMATCH infrastructure is hosted on secure, compliant cloud servers with multiple layers of protection.
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="text-secondary flex-shrink-0 mt-1" size={18} />
                <span className="text-black">Servers in geographically distributed locations</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-secondary flex-shrink-0 mt-1" size={18} />
                <span className="text-black">Automated daily backups and disaster recovery</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-secondary flex-shrink-0 mt-1" size={18} />
                <span className="text-black">24/7 monitoring and intrusion detection</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-secondary flex-shrink-0 mt-1" size={18} />
                <span className="text-black">Regular security patches and updates</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-secondary flex-shrink-0 mt-1" size={18} />
                <span className="text-black">Compliance with healthcare data standards</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Data Usage */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12 bg-white rounded-lg">
        <h2 className="text-3xl font-bold text-primary mb-8 text-center">How We Use Your Data</h2>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div className="p-6 border border-accent border-opacity-20 rounded-lg bg-white">
            <h3 className="text-lg font-bold text-primary mb-4">✅ What We Do With Your Data</h3>
            <ul className="space-y-3 text-black text-opacity-70">
              <li className="flex items-start gap-2">
                <CheckCircle className="text-accent flex-shrink-0 mt-0.5" size={16} />
                <span>Provide maternal health services and care coordination</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-accent flex-shrink-0 mt-0.5" size={16} />
                <span>Send appointment reminders and health alerts</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-accent flex-shrink-0 mt-0.5" size={16} />
                <span>Improve system functionality through analysis</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-accent flex-shrink-0 mt-0.5" size={16} />
                <span>Comply with Uganda's health regulations</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-accent flex-shrink-0 mt-0.5" size={16} />
                <span>Report to government health authorities when required</span>
              </li>
            </ul>
          </div>

          <div className="p-6 border border-secondary border-opacity-20 rounded-lg bg-white">
            <h3 className="text-lg font-bold text-primary mb-4">❌ What We Don't Do</h3>
            <ul className="space-y-3 text-black text-opacity-70">
              <li className="flex items-start gap-2">
                <AlertCircle className="text-secondary flex-shrink-0 mt-0.5" size={16} />
                <span>We never sell your personal data</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="text-secondary flex-shrink-0 mt-0.5" size={16} />
                <span>We never share data with advertisers</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="text-secondary flex-shrink-0 mt-0.5" size={16} />
                <span>We never share data without your consent (except legal requirements)</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="text-secondary flex-shrink-0 mt-0.5" size={16} />
                <span>We never track your location without permission</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="text-secondary flex-shrink-0 mt-0.5" size={16} />
                <span>We never retain data longer than necessary</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Data Retention */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div className="bg-accent bg-opacity-10 rounded-lg p-8">
          <h3 className="text-2xl font-bold text-primary mb-6">How Long We Keep Your Data</h3>
          
          <div className="space-y-6">
            <div className="border-l-4 border-accent pl-6">
              <h4 className="font-semibold text-primary mb-2">Active Account Data</h4>
              <p className="text-neutral text-opacity-70">
                While your account is active, we keep all your personal and health records to provide ongoing care coordination and follow-up.
              </p>
            </div>

            <div className="border-l-4 border-accent pl-6">
              <h4 className="font-semibold text-primary mb-2">After Account Deletion</h4>
              <p className="text-neutral text-opacity-70">
                After you request account deletion, we retain anonymized data for 7-10 years as required by Uganda's health data retention standards. Personal identifying information is securely destroyed.
              </p>
            </div>

            <div className="border-l-4 border-accent pl-6">
              <h4 className="font-semibold text-primary mb-2">Legal & Compliance Records</h4>
              <p className="text-neutral text-opacity-70">
                We may retain certain data longer if required by law, court orders, or regulatory compliance requirements.
              </p>
            </div>

            <div className="border-l-4 border-accent pl-6">
              <h4 className="font-semibold text-primary mb-2">Backup & Recovery</h4>
              <p className="text-neutral text-opacity-70">
                System backups may contain your data for up to 90 days for disaster recovery purposes only.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security Best Practices */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <h2 className="text-3xl font-bold text-primary mb-8 text-center">Your Security Responsibilities</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h3 className="text-lg font-bold text-primary mb-4">🔒 Protect Your Account</h3>
            <ul className="space-y-3 text-black text-sm">
              <li>• Use a strong, unique phone number for your account</li>
              <li>• Don't share your phone number with others</li>
              <li>• Keep your phone secure and protected</li>
              <li>• Log out when using shared devices</li>
              <li>• Report any suspicious activity immediately</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-md">
            <h3 className="text-lg font-bold text-primary mb-4">📱 Keep Your Phone Safe</h3>
            <ul className="space-y-3 text-black text-sm">
              <li>• Keep your phone software up to date</li>
              <li>• Use a phone PIN or biometric lock</li>
              <li>• Don't install apps from untrusted sources</li>
              <li>• Be careful with public WiFi networks</li>
              <li>• Report a lost phone to MPMATCH support immediately</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Contact & Support */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12 bg-white rounded-lg">
        <h2 className="text-2xl font-bold text-primary mb-6 text-center">Security Concerns?</h2>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-primary mb-3">📞 Contact Us</h3>
            <p className="text-black mb-4">
              If you have questions about security or your privacy, contact our support team.
            </p>
            <div className="bg-accent bg-opacity-10 p-4 rounded-lg">
              <p className="text-sm font-semibold text-primary">Email:</p>
              <p className="text-black">security@mpmatch.ug</p>
              <p className="text-sm font-semibold text-primary mt-3">Phone:</p>
              <p className="text-black">+256-700-MPMATCH</p>
            </div>
          </div>

          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-primary mb-3">🔐 Report a Security Issue</h3>
            <p className="text-black mb-4">
              Found a security vulnerability? Please report it responsibly and confidentially.
            </p>
            <div className="bg-secondary bg-opacity-10 p-4 rounded-lg">
              <p className="text-sm font-semibold text-primary">Vulnerability Disclosure:</p>
              <p className="text-black text-sm">security-report@mpmatch.ug</p>
              <p className="text-black text-xs mt-2">We follow responsible disclosure practices and reward security researchers.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <h2 className="text-2xl font-bold text-primary mb-8 text-center">Our Commitments</h2>
        
        <div className="grid md:grid-cols-4 gap-6">
          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <Lock className="text-accent mx-auto mb-3" size={40} />
            <h4 className="font-bold text-primary mb-2">Encrypted</h4>
            <p className="text-sm text-black">All data encrypted with industry standards</p>
          </div>
          
          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <Shield className="text-secondary mx-auto mb-3" size={40} />
            <h4 className="font-bold text-primary mb-2">Secure</h4>
            <p className="text-sm text-black">24/7 monitoring and threat detection</p>
          </div>
          
          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <Eye className="text-accent mx-auto mb-3" size={40} />
            <h4 className="font-bold text-primary mb-2">Transparent</h4>
            <p className="text-sm text-black">Clear privacy policies and data usage</p>
          </div>
          
          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <Key className="text-secondary mx-auto mb-3" size={40} />
            <h4 className="font-bold text-primary mb-2">Controlled</h4>
            <p className="text-sm text-black">You control who sees your data</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12 text-center">
        <h2 className="text-3xl font-bold text-neutral mb-4">Ready to Trust MPMATCH?</h2>
        <p className="text-lg text-neutral text-opacity-80 mb-8">
          Join thousands of mothers and health workers who trust MPMATCH with their maternal health.
        </p>
        <Link href="/register/mother">
          <Button>Get Started</Button>
        </Link>
      </section>
    </main>
  );
}
