'use client';

import Link from 'next/link';
import { CheckCircle, AlertCircle, Users, Hospital, Heart } from 'lucide-react';
import Button from '@/components/Button';

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-primary to-primary-light">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-neutral mb-4">
            How MPMATCH Works
          </h1>
          <p className="text-lg text-neutral text-opacity-80 max-w-3xl mx-auto">
            MPMATCH uses a 5-step workflow to ensure every pregnant mother receives quality care, early complication detection, and emergency support when needed.
          </p>
        </div>
      </section>

      {/* 5-Step Workflow */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div className="space-y-8">
          {/* Step 1 */}
          <div className="bg-white rounded-lg shadow-lg p-8 border-l-4 border-accent">
            <div className="flex items-start gap-6">
              <div className="flex items-center justify-center w-16 h-16 bg-accent text-white rounded-full font-bold text-2xl flex-shrink-0">
                1
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-primary mb-2">Patient Registration</h2>
                <p className="text-black mb-4">
                  Register pregnant women and track their basic health information. This establishes a foundational health profile and creates the entry point to the MPMATCH platform.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-black">
                    <CheckCircle className="text-accent flex-shrink-0" size={18} />
                    <span>Mothers or CHWs register via web, phone (USSD), or in-person</span>
                  </div>
                  <div className="flex items-center gap-2 text-black">
                    <CheckCircle className="text-accent flex-shrink-0" size={18} />
                    <span>Basic info collected: name, phone, location, pregnancy status</span>
                  </div>
                  <div className="flex items-center gap-2 text-black">
                    <CheckCircle className="text-accent flex-shrink-0" size={18} />
                    <span>Assigned to nearest healthcare facility and CHW</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-lg shadow-lg p-8 border-l-4 border-secondary">
            <div className="flex items-start gap-6">
              <div className="flex items-center justify-center w-16 h-16 bg-secondary text-white rounded-full font-bold text-2xl flex-shrink-0">
                2
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-primary mb-2">Risk Assessment</h2>
                <p className="text-black mb-4">
                  Identify pregnancy and perinatal complications early through structured assessment at each contact. Early identification enables timely intervention.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-black">
                    <AlertCircle className="text-secondary flex-shrink-0" size={18} />
                    <span>Danger signs tracked: bleeding, severe pain, high fever, seizures</span>
                  </div>
                  <div className="flex items-center gap-2 text-black">
                    <AlertCircle className="text-secondary flex-shrink-0" size={18} />
                    <span>Risk factors documented: age, medical history, previous complications</span>
                  </div>
                  <div className="flex items-center gap-2 text-black">
                    <AlertCircle className="text-secondary flex-shrink-0" size={18} />
                    <span>Antenatal care (ANC) visits scheduled and monitored</span>
                  </div>
                  <div className="flex items-center gap-2 text-black">
                    <AlertCircle className="text-secondary flex-shrink-0" size={18} />
                    <span>Vitals and health metrics recorded at each visit</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-lg shadow-lg p-8 border-l-4 border-accent">
            <div className="flex items-start gap-6">
              <div className="flex items-center justify-center w-16 h-16 bg-accent text-white rounded-full font-bold text-2xl flex-shrink-0">
                3
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-primary mb-2">Community Link</h2>
                <p className="text-black mb-4">
                  Connect with Community Health Workers for ongoing support, education, and early intervention at the community level.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-black">
                    <Users className="text-accent flex-shrink-0" size={18} />
                    <span>CHWs conduct home visits and community consultations</span>
                  </div>
                  <div className="flex items-center gap-2 text-black">
                    <Users className="text-accent flex-shrink-0" size={18} />
                    <span>Health education on nutrition, hygiene, and birth preparedness</span>
                  </div>
                  <div className="flex items-center gap-2 text-black">
                    <Users className="text-accent flex-shrink-0" size={18} />
                    <span>Communication via SMS, phone calls, or in-person meetings</span>
                  </div>
                  <div className="flex items-center gap-2 text-black">
                    <Users className="text-accent flex-shrink-0" size={18} />
                    <span>Early warning signs monitored and reported</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-white rounded-lg shadow-lg p-8 border-l-4 border-secondary">
            <div className="flex items-start gap-6">
              <div className="flex items-center justify-center w-16 h-16 bg-secondary text-white rounded-full font-bold text-2xl flex-shrink-0">
                4
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-primary mb-2">Hospital Referral</h2>
                <p className="text-black mb-4">
                  Facilitate seamless referral to hospital when complications are detected or emergency care is needed.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-black">
                    <Hospital className="text-secondary flex-shrink-0" size={18} />
                    <span>Automatic alerts to healthcare facilities when danger signs detected</span>
                  </div>
                  <div className="flex items-center gap-2 text-black">
                    <Hospital className="text-secondary flex-shrink-0" size={18} />
                    <span>Emergency hotline access (call, SMS, USSD)</span>
                  </div>
                  <div className="flex items-center gap-2 text-black">
                    <Hospital className="text-secondary flex-shrink-0" size={18} />
                    <span>Facility response within 1-2 hours of emergency alert</span>
                  </div>
                  <div className="flex items-center gap-2 text-black">
                    <Hospital className="text-secondary flex-shrink-0" size={18} />
                    <span>Seamless handover of patient records to receiving hospital</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="bg-white rounded-lg shadow-lg p-8 border-l-4 border-accent">
            <div className="flex items-start gap-6">
              <div className="flex items-center justify-center w-16 h-16 bg-accent text-white rounded-full font-bold text-2xl flex-shrink-0">
                5
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-primary mb-2">Follow-up Care</h2>
                <p className="text-black mb-4">
                  Monitor post-natal care and maternal health outcomes to ensure complete recovery and healthy infant care.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-black">
                    <Heart className="text-accent flex-shrink-0" size={18} />
                    <span>Post-delivery follow-up at 24 hours, 7 days, and 6 weeks</span>
                  </div>
                  <div className="flex items-center gap-2 text-black">
                    <Heart className="text-accent flex-shrink-0" size={18} />
                    <span>Newborn health monitoring and vaccination tracking</span>
                  </div>
                  <div className="flex items-center gap-2 text-black">
                    <Heart className="text-accent flex-shrink-0" size={18} />
                    <span>Family planning and maternal mental health assessment</span>
                  </div>
                  <div className="flex items-center gap-2 text-black">
                    <Heart className="text-accent flex-shrink-0" size={18} />
                    <span>SMS reminders for follow-up appointments</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-16">
        <h2 className="text-3xl font-bold text-neutral mb-8 text-center">Key Features</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h3 className="text-xl font-semibold text-primary mb-3">📱 Multi-Channel Access</h3>
            <p className="text-black">
              Access MPMATCH via web, mobile app, SMS, USSD (phone calls), or in-person at health facilities. Use the method that works best for you.
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h3 className="text-xl font-semibold text-primary mb-3">🚨 Emergency Alerts</h3>
            <p className="text-black">
              Trigger immediate emergency notifications to healthcare providers and local facilities. Response guaranteed within 1-2 hours.
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h3 className="text-xl font-semibold text-primary mb-3">🔒 Data Privacy</h3>
            <p className="text-black">
              All personal and health data is encrypted and securely stored. Your privacy and confidentiality are guaranteed.
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h3 className="text-xl font-semibold text-primary mb-3">📊 Health Tracking</h3>
            <p className="text-black">
              Track ANC visits, vitals, complications, and outcomes. Complete health history available to authorized healthcare providers.
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h3 className="text-xl font-semibold text-primary mb-3">👥 Coordination</h3>
            <p className="text-black">
              Seamless coordination between mothers, CHWs, and healthcare facilities ensures comprehensive care at every level.
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h3 className="text-xl font-semibold text-primary mb-3">📍 Location-Based</h3>
            <p className="text-black">
              Find nearby healthcare facilities, maternity wards, and emergency services. Get directions and contact info instantly.
            </p>
          </div>
        </div>
      </section>

      {/* Next Steps */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12 text-center bg-accent bg-opacity-10 rounded-xl">
        <h2 className="text-3xl font-bold text-neutral mb-4">Ready to Join?</h2>
        <p className="text-lg text-neutral text-opacity-80 mb-8 max-w-2xl mx-auto">
          Whether you're a pregnant mother or a community health worker, MPMATCH is here to support safe pregnancies and healthy outcomes.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/register/mother">
            <Button>Register as Mother</Button>
          </Link>
          <Link href="/register/chw">
            <Button variant="outline">Register as CHW</Button>
          </Link>
        </div>
      </section>

      {/* Questions? */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12 text-center">
        <h3 className="text-2xl font-bold text-neutral mb-4">Have Questions?</h3>
        <p className="text-neutral text-opacity-70 mb-8">
          Explore more about security, emergency procedures, or learn about SMS/USSD access.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link href="/security">
            <Button variant="outline">Security & Privacy</Button>
          </Link>
          <Link href="/emergency">
            <Button variant="outline">Emergency Procedures</Button>
          </Link>
          <Link href="/sms-ussd">
            <Button variant="outline">SMS/USSD Access</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
