'use client';

import Link from 'next/link';
import { Users, Heart, Shield, Phone, MapPin, ArrowRight } from 'lucide-react';
import Button from '@/components/Button';

export default function CommunityPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-primary to-primary-light">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-neutral mb-4">
            Community Maternal Health Network
          </h1>
          <p className="text-lg text-neutral text-opacity-80 max-w-2xl mx-auto">
            MPMATCH connects pregnant women, community health workers, and healthcare facilities to ensure safe pregnancies and healthy outcomes for mothers and babies.
          </p>
        </div>
      </section>

      {/* Two Main Roles Section */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Pregnant Mothers */}
          <div className="bg-white rounded-xl shadow-lg p-8 border-t-4 border-accent">
            <div className="flex items-center gap-3 mb-4">
              <Heart className="text-accent" size={32} />
              <h2 className="text-2xl font-bold text-primary">Pregnant Mothers</h2>
            </div>
            <p className="text-black mb-6">
              Track your pregnancy, access health information, connect with healthcare providers, and get emergency support when needed.
            </p>
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-black">Schedule and track antenatal care (ANC) visits</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-black">Communicate with Community Health Workers</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-black">Emergency alerts for complications</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-black">SMS reminders and health tips</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-black">Find nearby healthcare facilities</span>
              </div>
            </div>
            <Link href="/register/mother">
              <Button className="w-full">Register as a Mother</Button>
            </Link>
          </div>

          {/* Community Health Workers */}
          <div className="bg-white rounded-xl shadow-lg p-8 border-t-4 border-secondary">
            <div className="flex items-center gap-3 mb-4">
              <Users className="text-secondary" size={32} />
              <h2 className="text-2xl font-bold text-primary">Community Health Workers</h2>
            </div>
            <p className="text-black mb-6">
              Support pregnant women in your community with better coordination, timely referrals, and follow-up care.
            </p>
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-black">Manage assigned pregnant women</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-black">Identify and respond to complications early</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-black">Coordinate with healthcare facilities</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-black">Track follow-up care</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-black">Access training and resources</span>
              </div>
            </div>
            <Link href="/register/chw">
              <Button className="w-full">Register as CHW</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12 bg-white rounded-xl my-12">
        <h2 className="text-3xl font-bold text-primary mb-8 text-center">How MPMATCH Works</h2>
        <div className="grid md:grid-cols-5 gap-4">
          {[
            { num: 1, title: 'Register', desc: 'Create your account in minutes' },
            { num: 2, title: 'Assess Risk', desc: 'Identify complications early' },
            { num: 3, title: 'Community Link', desc: 'Connect with health workers' },
            { num: 4, title: 'Get Help', desc: 'Access facilities when needed' },
            { num: 5, title: 'Follow Up', desc: 'Continuous post-natal care' },
          ].map((step) => (
            <div key={step.num} className="text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-accent text-white rounded-full font-bold text-lg mx-auto mb-3">
                {step.num}
              </div>
              <h3 className="font-semibold text-primary mb-2">{step.title}</h3>
              <p className="text-sm text-neutral text-opacity-70">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Links */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <h2 className="text-3xl font-bold text-neutral mb-8">Explore More</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Link href="/how-it-works" className="group">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-black">How It Works</h3>
                <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
              </div>
              <p className="text-black">Learn about the 5-step maternal health workflow and system features.</p>
            </div>
          </Link>

          <Link href="/find-service" className="group">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-black">Find Services</h3>
                <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
              </div>
              <p className="text-black">Locate healthcare facilities, maternity services, and emergency care near you.</p>
            </div>
          </Link>

          <Link href="/sms-ussd" className="group">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-black">SMS/USSD Access</h3>
                <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
              </div>
              <p className="text-black">Access MPMATCH via SMS or USSD calls without internet for basic features.</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Trust & Safety */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div className="bg-accent bg-opacity-10 rounded-xl p-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <Shield className="text-accent mx-auto mb-4" size={40} />
              <h3 className="text-lg font-semibold text-primary mb-2">Your Data is Safe</h3>
              <p className="text-neutral text-opacity-70">All personal and health information is encrypted and securely protected.</p>
            </div>
            <div className="text-center">
              <Phone className="text-accent mx-auto mb-4" size={40} />
              <h3 className="text-lg font-semibold text-primary mb-2">24/7 Support</h3>
              <p className="text-neutral text-opacity-70">Emergency alerts are monitored around the clock for quick response.</p>
            </div>
            <div className="text-center">
              <MapPin className="text-accent mx-auto mb-4" size={40} />
              <h3 className="text-lg font-semibold text-primary mb-2">Local & Accessible</h3>
              <p className="text-neutral text-opacity-70">Connect to healthcare facilities and workers in your area.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 text-center">
        <h2 className="text-3xl font-bold text-neutral mb-4">Ready to Get Started?</h2>
        <p className="text-lg text-neutral text-opacity-80 mb-8">
          Join thousands of mothers and health workers already using MPMATCH.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/register/mother">
            <Button>Register as Mother</Button>
          </Link>
          <Link href="/register/chw">
            <Button variant="outline">Register as CHW</Button>
          </Link>
          <Link href="/sign-in">
            <Button variant="outline">Sign In</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}
