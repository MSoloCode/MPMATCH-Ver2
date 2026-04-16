'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

/**
 * UnregisteredPrompt Component
 * Displays a message to unregistered visitors who try to access restricted pages
 * Shows registration and back buttons to navigate the user
 */
export default function UnregisteredPrompt() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-neutral-50 py-12 px-4 flex items-center justify-center">
      <div className="max-w-lg mx-auto">
        {/* Prompt Card */}
        <div className="bg-white rounded-xl shadow-lg p-8 border border-neutral-200 text-center">
          {/* Icon */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full">
              <svg
                className="w-10 h-10 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-neutral-900 mb-4">
            Registration Required
          </h2>

          {/* Message */}
          <p className="text-neutral-700 mb-6 leading-relaxed">
            Register to access full features. Without registration you can only generate an alert through a CHW.
          </p>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-blue-900 font-semibold mb-2">Features available after registration:</p>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>✓ Track your pregnancy and ANC visits</li>
              <li>✓ Create emergency alerts directly</li>
              <li>✓ Communicate with healthcare providers</li>
              <li>✓ Receive personalized health updates</li>
              <li>✓ Access your health records</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="primary"
              onClick={() => router.push('/register')}
              className="w-full py-3 text-base font-semibold"
            >
              Register Now
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="w-full py-3 text-base font-semibold"
            >
              Go Back
            </Button>
          </div>

          {/* Footer Note */}
          <div className="mt-8 pt-6 border-t border-neutral-200 text-center">
            <p className="text-sm text-neutral-700">
              By registering, you accept our{' '}
              <a href="/terms" className="text-primary-600 font-semibold hover:text-primary-700">
                Terms and Conditions
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
