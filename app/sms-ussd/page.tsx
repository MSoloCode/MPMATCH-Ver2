'use client';

import Link from 'next/link';
import { Phone, MessageSquare, Smartphone, Radio, HelpCircle, ArrowRight } from 'lucide-react';
import Button from '@/components/Button';

export default function SmsUssdPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-primary to-primary-light">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-neutral mb-4">
            Access MPMATCH Anywhere
          </h1>
          <p className="text-lg text-neutral text-opacity-80 max-w-3xl mx-auto">
            Don't have internet? Use SMS, USSD calls, or phone-based access to use MPMATCH on any phone.
          </p>
        </div>
      </section>

      {/* Three Access Methods */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* SMS */}
          <div className="bg-white rounded-lg shadow-lg p-8 border-t-4 border-accent">
            <div className="flex items-center gap-3 mb-4">
              <MessageSquare className="text-accent" size={32} />
              <h2 className="text-2xl font-bold text-primary">SMS (Text Messages)</h2>
            </div>
            <p className="text-neutral text-opacity-70 mb-6">
              Send and receive text messages to interact with MPMATCH. Perfect for quick updates, reminders, and alerts.
            </p>
            <div className="space-y-3 mb-6 bg-accent bg-opacity-5 p-4 rounded">
              <div className="font-semibold text-primary mb-3">How it works:</div>
              <div className="space-y-2 text-sm text-neutral">
                <p>• Text your message to <strong>15555</strong></p>
                <p>• Receive SMS alerts and reminders automatically</p>
                <p>• No internet required</p>
                <p>• Works on any basic phone</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-sm">
                <p className="font-semibold text-primary mb-1">📤 Supported SMS Commands:</p>
                <p className="text-neutral text-opacity-70">Register, ANC appointments, emergency alerts, health tips, appointment reminders</p>
              </div>
              <div className="text-sm">
                <p className="font-semibold text-primary mb-1">💬 Message Cost:</p>
                <p className="text-neutral text-opacity-70">Standard SMS rates apply (typically 200-500 UGX per message)</p>
              </div>
            </div>
          </div>

          {/* USSD */}
          <div className="bg-white rounded-lg shadow-lg p-8 border-t-4 border-secondary">
            <div className="flex items-center gap-3 mb-4">
              <Phone className="text-secondary" size={32} />
              <h2 className="text-2xl font-bold text-primary">USSD Calls</h2>
            </div>
            <p className="text-neutral text-opacity-70 mb-6">
              Access MPMATCH with simple phone call menus. No typing required—just follow on-screen prompts.
            </p>
            <div className="space-y-3 mb-6 bg-secondary bg-opacity-5 p-4 rounded">
              <div className="font-semibold text-primary mb-3">How it works:</div>
              <div className="space-y-2 text-sm text-neutral">
                <p>• Dial <strong>*155*55#</strong> from any phone</p>
                <p>• Follow interactive menu prompts</p>
                <p>• Select options using your phone keypad</p>
                <p>• No internet or data required</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-sm">
                <p className="font-semibold text-primary mb-1">🎯 USSD Menu Options:</p>
                <p className="text-neutral text-opacity-70">1. Register account, 2. View appointment status, 3. Report danger signs, 4. Emergency alert, 5. Get facility info</p>
              </div>
              <div className="text-sm">
                <p className="font-semibold text-primary mb-1">⏱️ Session Time:</p>
                <p className="text-neutral text-opacity-70">Each USSD session lasts 5 minutes. Expire if inactive.</p>
              </div>
            </div>
          </div>

          {/* Voice IVR */}
          <div className="bg-white rounded-lg shadow-lg p-8 border-t-4 border-accent">
            <div className="flex items-center gap-3 mb-4">
              <Radio className="text-accent" size={32} />
              <h2 className="text-2xl font-bold text-primary">Voice IVR (IVR Calls)</h2>
            </div>
            <p className="text-neutral text-opacity-70 mb-6">
              Call the MPMATCH hotline to speak with automated voice menus or connect to a health worker.
            </p>
            <div className="space-y-3 mb-6 bg-accent bg-opacity-5 p-4 rounded">
              <div className="font-semibold text-primary mb-3">How it works:</div>
              <div className="space-y-2 text-sm text-neutral">
                <p>• Call <strong>+256-700-15555</strong> (toll-free in Uganda)</p>
                <p>• Listen to automated voice messages</p>
                <p>• Press numbers on your keypad to select options</p>
                <p>• Or press 0 to speak with a health worker</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-sm">
                <p className="font-semibold text-primary mb-1">📞 Available Languages:</p>
                <p className="text-neutral text-opacity-70">English, Luganda, Luo, Acholi, Teso, and others</p>
              </div>
              <div className="text-sm">
                <p className="font-semibold text-primary mb-1">🕐 Support Hours:</p>
                <p className="text-neutral text-opacity-70">24/7 for emergencies, 6am-10pm for general inquiries</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <h2 className="text-3xl font-bold text-neutral mb-8 text-center">Feature Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full bg-white rounded-lg shadow-md">
            <thead>
              <tr className="bg-primary text-white">
                <th className="px-6 py-4 text-left font-semibold">Feature</th>
                <th className="px-6 py-4 text-center font-semibold">📱 SMS</th>
                <th className="px-6 py-4 text-center font-semibold">☎️ USSD</th>
                <th className="px-6 py-4 text-center font-semibold">📞 Voice IVR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 font-semibold text-neutral">Internet Required</td>
                <td className="px-6 py-4 text-center">❌ No</td>
                <td className="px-6 py-4 text-center">❌ No</td>
                <td className="px-6 py-4 text-center">❌ No</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-6 py-4 font-semibold text-neutral">Phone Type</td>
                <td className="px-6 py-4 text-center">Any (Basic)</td>
                <td className="px-6 py-4 text-center">Any (Basic)</td>
                <td className="px-6 py-4 text-center">Any (Basic)</td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-semibold text-neutral">Response Speed</td>
                <td className="px-6 py-4 text-center">🟢 Instant</td>
                <td className="px-6 py-4 text-center">🟢 Instant</td>
                <td className="px-6 py-4 text-center">🟢 Instant</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-6 py-4 font-semibold text-neutral">Language Support</td>
                <td className="px-6 py-4 text-center">Limited</td>
                <td className="px-6 py-4 text-center">Multiple</td>
                <td className="px-6 py-4 text-center">Multiple</td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-semibold text-neutral">Real-time Support</td>
                <td className="px-6 py-4 text-center">❌ No</td>
                <td className="px-6 py-4 text-center">🟡 Limited</td>
                <td className="px-6 py-4 text-center">✅ Yes</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-6 py-4 font-semibold text-neutral">Cost</td>
                <td className="px-6 py-4 text-center">Standard rates</td>
                <td className="px-6 py-4 text-center">Standard rates</td>
                <td className="px-6 py-4 text-center">Toll-free</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Getting Started */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12 bg-white rounded-lg">
        <h2 className="text-3xl font-bold text-primary mb-8 text-center">Get Started via SMS/USSD</h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          {/* For Mothers */}
          <div className="p-6 border border-accent border-opacity-20 rounded-lg">
            <h3 className="text-xl font-bold text-primary mb-4">👶 For Pregnant Mothers</h3>
            <div className="space-y-4 text-sm text-neutral">
              <div>
                <p className="font-semibold text-accent mb-1">Step 1: Register</p>
                <p className="text-opacity-70 text-neutral">Text <strong>REG</strong> to 15555 or dial <strong>*155*55#</strong></p>
              </div>
              <div>
                <p className="font-semibold text-accent mb-1">Step 2: Provide Info</p>
                <p className="text-opacity-70 text-neutral">Answer questions: name, phone, location, pregnancy stage</p>
              </div>
              <div>
                <p className="font-semibold text-accent mb-1">Step 3: Receive Updates</p>
                <p className="text-opacity-70 text-neutral">Get ANC reminders, health tips, and appointment notifications</p>
              </div>
              <div>
                <p className="font-semibold text-accent mb-1">Step 4: Emergency Access</p>
                <p className="text-opacity-70 text-neutral">Text <strong>SOS</strong> or press 3 in USSD for emergency alerts</p>
              </div>
            </div>
          </div>

          {/* For CHWs */}
          <div className="p-6 border border-secondary border-opacity-20 rounded-lg">
            <h3 className="text-xl font-bold text-primary mb-4">👥 For Community Health Workers</h3>
            <div className="space-y-4 text-sm text-neutral">
              <div>
                <p className="font-semibold text-secondary mb-1">Step 1: Register</p>
                <p className="text-opacity-70 text-neutral">Text <strong>CHW</strong> to 15555 or dial <strong>*155*55#</strong></p>
              </div>
              <div>
                <p className="font-semibold text-secondary mb-1">Step 2: Verify Identity</p>
                <p className="text-opacity-70 text-neutral">Provide credentials and health facility affiliation</p>
              </div>
              <div>
                <p className="font-semibold text-secondary mb-1">Step 3: Manage Cases</p>
                <p className="text-opacity-70 text-neutral">Track assigned mothers, log visits, report complications</p>
              </div>
              <div>
                <p className="font-semibold text-secondary mb-1">Step 4: Coordinate Care</p>
                <p className="text-opacity-70 text-neutral">Send referrals, receive alerts, coordinate with facilities</p>
              </div>
            </div>
          </div>

          {/* Common Commands */}
          <div className="p-6 border border-accent border-opacity-20 rounded-lg">
            <h3 className="text-xl font-bold text-primary mb-4">⌨️ Quick SMS Commands</h3>
            <div className="space-y-2 text-sm text-neutral">
              <p><span className="font-semibold">REG</span> - Register as mother</p>
              <p><span className="font-semibold">CHW</span> - Register as health worker</p>
              <p><span className="font-semibold">SOS</span> - Trigger emergency alert</p>
              <p><span className="font-semibold">ANC</span> - ANC appointment status</p>
              <p><span className="font-semibold">TIPS</span> - Health education tips</p>
              <p><span className="font-semibold">FAC</span> - Find nearby facilities</p>
              <p><span className="font-semibold">HELP</span> - Command help menu</p>
              <p><span className="font-semibold">STOP</span> - Opt out of messages</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <h2 className="text-3xl font-bold text-neutral mb-8 text-center">Frequently Asked Questions</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <FAQItem
            question="Will I be charged for using SMS or USSD?"
            answer="SMS and USSD use standard network rates based on your mobile provider. Emergency alerts and critical health messages may be subsidized or free. Check with your provider for exact rates."
          />
          <FAQItem
            question="What if I make a mistake when texting?"
            answer="You can simply send a correction message. The system will process your latest message. For critical updates, consider using USSD for confirmation."
          />
          <FAQItem
            question="Can I use SMS/USSD to register for the first time?"
            answer="Yes! Text REG to 15555 or dial *155*55# to register. Follow the prompts to create your account."
          />
          <FAQItem
            question="How quickly will I receive responses?"
            answer="SMS reminders and confirmations are usually sent within minutes. For emergencies, facility staff are notified immediately and will follow up within 1-2 hours."
          />
          <FAQItem
            question="What if my internet is too slow or unreliable?"
            answer="SMS and USSD work on any network signal. They don't require internet, so they work even with weak 2G/3G signals."
          />
          <FAQItem
            question="Can I switch between web and SMS/USSD access?"
            answer="Yes! Your account is the same across all access methods. Register once and use web, SMS, USSD, or calls as needed."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12 text-center bg-accent bg-opacity-10 rounded-lg">
        <h2 className="text-3xl font-bold text-neutral mb-4">Start Using MPMATCH Today</h2>
        <p className="text-lg text-neutral text-opacity-80 mb-8 max-w-2xl mx-auto">
          Access maternal health services anytime, anywhere—with or without internet.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/register/mother">
            <Button>Register Now</Button>
          </Link>
          <Link href="/how-it-works">
            <Button variant="outline">Learn More</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-md">
      <div className="flex items-start gap-3">
        <HelpCircle className="text-accent flex-shrink-0 mt-1" size={20} />
        <div>
          <h3 className="font-semibold text-primary mb-2">{question}</h3>
          <p className="text-neutral text-opacity-70 text-sm">{answer}</p>
        </div>
      </div>
    </div>
  );
}
