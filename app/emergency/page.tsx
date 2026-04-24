'use client';

import Link from 'next/link';
import { AlertTriangle, Phone, Clock, MapPin, Heart, CheckCircle, ArrowRight } from 'lucide-react';
import Button from '@/components/Button';

export default function EmergencyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-primary to-primary-light">
      {/* Critical Alert Banner */}
      <section className="bg-red-600 text-white py-4">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center gap-3">
          <AlertTriangle size={24} className="flex-shrink-0" />
          <p className="text-sm md:text-base font-semibold">
            For life-threatening emergencies, call emergency services (911/999/112) immediately. MPMATCH supplements but does not replace emergency services.
          </p>
        </div>
      </section>

      {/* Header */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-neutral mb-4">
            Emergency Procedures & Escalation
          </h1>
          <p className="text-lg text-neutral text-opacity-80 max-w-3xl mx-auto">
            MPMATCH provides 24/7 emergency response for pregnancy complications. Learn when and how to trigger emergency alerts.
          </p>
        </div>
      </section>

      {/* Danger Signs */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <h2 className="text-3xl font-bold text-neutral mb-8 text-center">When to Use Emergency Alert</h2>
        
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-red-600" size={32} />
              <h3 className="text-2xl font-bold text-red-700">Danger Signs (USE EMERGENCY ALERT)</h3>
            </div>
            <p className="text-neutral text-opacity-70 mb-6">
              Trigger an emergency alert immediately if you experience any of these symptoms:
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="text-red-600 flex-shrink-0 mt-1" size={20} />
                <span className="text-neutral font-semibold">🩸 Severe vaginal bleeding</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-red-600 flex-shrink-0 mt-1" size={20} />
                <span className="text-neutral font-semibold">😵 Severe headache or blurred vision</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-red-600 flex-shrink-0 mt-1" size={20} />
                <span className="text-neutral font-semibold">🤢 Severe abdominal or chest pain</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-red-600 flex-shrink-0 mt-1" size={20} />
                <span className="text-neutral font-semibold">🔥 High fever ({'>'}38.5°C)</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-red-600 flex-shrink-0 mt-1" size={20} />
                <span className="text-neutral font-semibold">💧 Sudden loss of fluid or leaking</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-red-600 flex-shrink-0 mt-1" size={20} />
                <span className="text-neutral font-semibold">🤕 Loss of consciousness or seizures</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-red-600 flex-shrink-0 mt-1" size={20} />
                <span className="text-neutral font-semibold">😤 Severe difficulty breathing</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-red-600 flex-shrink-0 mt-1" size={20} />
                <span className="text-neutral font-semibold">❌ Baby not moving</span>
              </li>
            </ul>
          </div>

          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-yellow-600" size={32} />
              <h3 className="text-2xl font-bold text-yellow-700">Warning Signs (ALERT CHW)</h3>
            </div>
            <p className="text-neutral text-opacity-70 mb-6">
              Contact your CHW or healthcare facility for evaluation if you experience:
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="text-yellow-600 flex-shrink-0 mt-1" size={20} />
                <span className="text-neutral">Mild vaginal bleeding or spotting</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-yellow-600 flex-shrink-0 mt-1" size={20} />
                <span className="text-neutral">Mild headache or dizziness</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-yellow-600 flex-shrink-0 mt-1" size={20} />
                <span className="text-neutral">Mild abdominal discomfort</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-yellow-600 flex-shrink-0 mt-1" size={20} />
                <span className="text-neutral">Persistent nausea or vomiting</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-yellow-600 flex-shrink-0 mt-1" size={20} />
                <span className="text-neutral">Low-grade fever (37.5-38.5°C)</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-yellow-600 flex-shrink-0 mt-1" size={20} />
                <span className="text-neutral">Reduced fetal movement</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-yellow-600 flex-shrink-0 mt-1" size={20} />
                <span className="text-neutral">Unusual discharge</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-yellow-600 flex-shrink-0 mt-1" size={20} />
                <span className="text-neutral">Swelling of face or limbs</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* How to Trigger Emergency Alert */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12 bg-white rounded-lg">
        <h2 className="text-3xl font-bold text-primary mb-8 text-center">How to Trigger Emergency Alert</h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          {/* Via App */}
          <div className="p-6 border-t-4 border-accent rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <Phone className="text-accent" size={28} />
              <h3 className="text-xl font-bold text-primary">Via Web/Mobile App</h3>
            </div>
            <ol className="space-y-3 text-neutral text-opacity-70 text-sm">
              <li><span className="font-semibold text-primary">1.</span> Go to Emergency section</li>
              <li><span className="font-semibold text-primary">2.</span> Tap "Emergency Alert" button</li>
              <li><span className="font-semibold text-primary">3.</span> Select your danger sign(s)</li>
              <li><span className="font-semibold text-primary">4.</span> Confirm your location</li>
              <li><span className="font-semibold text-primary">5.</span> Submit alert</li>
              <li className="pt-2 border-t font-semibold text-primary">✅ Notifications sent within seconds</li>
            </ol>
          </div>

          {/* Via SMS */}
          <div className="p-6 border-t-4 border-secondary rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <Phone className="text-secondary" size={28} />
              <h3 className="text-xl font-bold text-primary">Via SMS</h3>
            </div>
            <div className="space-y-3 text-neutral text-opacity-70 text-sm">
              <div className="bg-secondary bg-opacity-10 p-3 rounded">
                <p className="text-primary font-semibold mb-2">Send to: 15555</p>
                <p className="font-mono text-primary">SOS</p>
                <p className="text-xs mt-1">or describe your emergency</p>
              </div>
              <div className="space-y-2">
                <p><span className="font-semibold text-primary">Examples:</span></p>
                <p>• SOS BLEEDING</p>
                <p>• SOS FEVER</p>
                <p>• SOS SEVERE PAIN</p>
              </div>
              <p className="pt-2 border-t font-semibold text-primary">✅ Response in 5-10 min</p>
            </div>
          </div>

          {/* Via USSD/Call */}
          <div className="p-6 border-t-4 border-accent rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <Phone className="text-accent" size={28} />
              <h3 className="text-xl font-bold text-primary">Via USSD/Call</h3>
            </div>
            <div className="space-y-3 text-neutral text-opacity-70 text-sm">
              <div className="bg-accent bg-opacity-10 p-3 rounded">
                <p className="text-primary font-semibold mb-2">Dial: *155*55#</p>
                <p>Press 3 in USSD menu</p>
                <p>OR call and tell operator it's an emergency</p>
              </div>
              <div className="space-y-2">
                <p><span className="font-semibold text-primary">Then:</span></p>
                <p>• Describe your symptoms</p>
                <p>• Share your location if possible</p>
                <p>• Provide contact info</p>
              </div>
              <p className="pt-2 border-t font-semibold text-primary">✅ Response in 5 min</p>
            </div>
          </div>
        </div>
      </section>

      {/* Response Timeline */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <h2 className="text-3xl font-bold text-neutral mb-8 text-center">Emergency Response Timeline</h2>
        
        <div className="space-y-6">
          <div className="flex items-start gap-6">
            <div className="flex items-center justify-center w-16 h-16 bg-accent text-white rounded-full font-bold text-2xl flex-shrink-0">
              <Clock size={28} />
            </div>
            <div className="flex-1 bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-xl font-bold text-primary mb-2">Seconds 0-30: Alert Received</h3>
              <p className="text-neutral text-opacity-70">
                Your emergency alert is received and validated. Automated notifications are sent to assigned healthcare facility, CHW, and ambulance services.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-6">
            <div className="flex items-center justify-center w-16 h-16 bg-secondary text-white rounded-full font-bold text-2xl flex-shrink-0">
              <Phone size={28} />
            </div>
            <div className="flex-1 bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-xl font-bold text-primary mb-2">Minutes 1-5: Initial Contact</h3>
              <p className="text-neutral text-opacity-70">
                A healthcare worker or CHW calls you to confirm emergency status and get additional details about your condition and location.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-6">
            <div className="flex items-center justify-center w-16 h-16 bg-accent text-white rounded-full font-bold text-2xl flex-shrink-0">
              <MapPin size={28} />
            </div>
            <div className="flex-1 bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-xl font-bold text-primary mb-2">Minutes 5-30: Dispatch & Transport</h3>
              <p className="text-neutral text-opacity-70">
                Ambulance or transport is dispatched if needed. CHW may visit if nearby. Healthcare facility is notified to prepare for your arrival.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-6">
            <div className="flex items-center justify-center w-16 h-16 bg-secondary text-white rounded-full font-bold text-2xl flex-shrink-0">
              <Heart size={28} />
            </div>
            <div className="flex-1 bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-xl font-bold text-primary mb-2">Minutes 30-60: Facility Care</h3>
              <p className="text-neutral text-opacity-70">
                You arrive at healthcare facility for emergency treatment. Your complete MPMATCH health record is immediately available to clinical staff.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-6">
            <div className="flex items-center justify-center w-16 h-16 bg-accent text-white rounded-full font-bold text-2xl flex-shrink-0">
              <CheckCircle size={28} />
            </div>
            <div className="flex-1 bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-xl font-bold text-primary mb-2">Ongoing: Treatment & Follow-up</h3>
              <p className="text-neutral text-opacity-70">
                Emergency treatment begins immediately. After stabilization, facility staff updates your MPMATCH record with treatment details and follow-up plans.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 p-6 bg-accent bg-opacity-10 rounded-lg border-l-4 border-accent">
          <p className="text-primary font-semibold mb-2">⏱️ Service Level Agreement (SLA):</p>
          <p className="text-neutral">
            We commit to facility awareness and initial contact within <strong>1-2 hours</strong> of your emergency alert. For life-threatening situations requiring immediate care, always call 911/999/112 directly.
          </p>
        </div>
      </section>

      {/* Misuse Policy */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12 bg-white rounded-lg">
        <h2 className="text-2xl font-bold text-primary mb-6 text-center">Important: Emergency Alert Misuse Policy</h2>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div className="p-6 bg-green-50 border border-green-300 rounded-lg">
            <h3 className="text-lg font-bold text-primary mb-4">✅ Appropriate Uses</h3>
            <ul className="space-y-2 text-sm text-neutral">
              <li>• Genuine pregnancy emergencies</li>
              <li>• Severe complications or danger signs</li>
              <li>• Need for urgent medical evaluation</li>
              <li>• Unexpected severe symptoms</li>
              <li>• Situations requiring immediate facility care</li>
            </ul>
          </div>

          <div className="p-6 bg-red-50 border border-red-300 rounded-lg">
            <h3 className="text-lg font-bold text-primary mb-4">❌ Misuse (Prohibited)</h3>
            <ul className="space-y-2 text-sm text-neutral">
              <li>• False alerts without genuine emergency</li>
              <li>• Prank or testing the system</li>
              <li>• General information requests</li>
              <li>• Appointment scheduling (use regular channels)</li>
              <li>• Testing response times</li>
            </ul>
            <p className="text-xs text-red-600 font-semibold mt-4">
              Repeated false alerts may result in account suspension or legal action.
            </p>
          </div>
        </div>
      </section>

      {/* Post-Emergency Care */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <h2 className="text-2xl font-bold text-primary mb-6 text-center">After an Emergency</h2>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h3 className="text-lg font-bold text-primary mb-3">📋 Medical Record Update</h3>
            <p className="text-neutral text-opacity-70 text-sm">
              Your emergency details are added to your MPMATCH health record. Facility treatment information is documented for continuity of care.
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-md">
            <h3 className="text-lg font-bold text-primary mb-3">📞 Follow-up Contact</h3>
            <p className="text-neutral text-opacity-70 text-sm">
              Your CHW or healthcare provider will follow up within 24 hours to check your status, provide instructions, and schedule any needed follow-up care.
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-md">
            <h3 className="text-lg font-bold text-primary mb-3">🏥 Referral & Care Plan</h3>
            <p className="text-neutral text-opacity-70 text-sm">
              A care plan is created with next steps, medications, appointments, and monitoring instructions. You'll receive SMS reminders for follow-ups.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <h2 className="text-2xl font-bold text-primary mb-6 text-center">Frequently Asked Questions</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <FAQItem
            question="What's the difference between emergency alert and calling 911?"
            answer="MPMATCH emergency alerts notify your healthcare facility and CHW for coordinated response. For life-threatening situations (can't breathe, unconscious, etc.), always call emergency services (911/999/112) first. Use both if needed."
          />
          <FAQItem
            question="Will I be charged for emergency alerts?"
            answer="No. Emergency alerts are free on the MPMATCH platform. If using SMS or USSD, standard network charges may apply, but facility response is always free."
          />
          <FAQItem
            question="What if I accidentally trigger an emergency alert?"
            answer="Contact the facility immediately to cancel. False alerts waste critical resources, so be careful. Repeated false alerts may result in account restrictions."
          />
          <FAQItem
            question="Can I trigger emergency for someone else?"
            answer="Only for your own emergency. For family members, they should register on MPMATCH themselves. CHWs can assist mothers in sending their own alerts."
          />
          <FAQItem
            question="What happens if there's no signal when I need emergency?"
            answer="Try all available methods (web, SMS, USSD, call). If you can't reach MPMATCH, call emergency services directly (911/999/112) or ask someone to help you get to a facility."
          />
          <FAQItem
            question="Are emergency alerts confidential?"
            answer="Yes. Only authorized healthcare staff and emergency responders see your alert details. Your information is protected and used only for your care."
          />
        </div>
      </section>

      {/* Emergency Contacts */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12 bg-red-50 rounded-lg">
        <h2 className="text-2xl font-bold text-primary mb-6 text-center">Quick Emergency Contacts</h2>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <p className="text-2xl font-bold text-red-600 mb-2">911 / 999 / 112</p>
            <p className="text-neutral text-opacity-70 font-semibold mb-2">Emergency Services</p>
            <p className="text-sm text-neutral text-opacity-70">For life-threatening emergencies - call immediately</p>
          </div>

          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <p className="text-2xl font-bold text-accent mb-2">15555</p>
            <p className="text-neutral text-opacity-70 font-semibold mb-2">MPMATCH SMS</p>
            <p className="text-sm text-neutral text-opacity-70">Text SOS for emergency alert</p>
          </div>

          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <p className="text-2xl font-bold text-secondary mb-2">*155*55#</p>
            <p className="text-neutral text-opacity-70 font-semibold mb-2">MPMATCH USSD</p>
            <p className="text-sm text-neutral text-opacity-70">Dial for emergency menu</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12 text-center">
        <h2 className="text-3xl font-bold text-neutral mb-4">Have Questions About Emergency Response?</h2>
        <p className="text-lg text-neutral text-opacity-80 mb-8">
          Learn more about how MPMATCH keeps you safe or get started today.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/how-it-works">
            <Button variant="outline">How MPMATCH Works</Button>
          </Link>
          <Link href="/security">
            <Button variant="outline">Privacy & Security</Button>
          </Link>
          <Link href="/register/mother">
            <Button>Register Now</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-md">
      <h3 className="font-semibold text-primary mb-2">{question}</h3>
      <p className="text-neutral text-opacity-70 text-sm">{answer}</p>
    </div>
  );
}
