'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/Button';
import { TextInput, PhoneInput, SelectDropdown, Checkbox } from '@/components/FormInputs';
import { TERMS_AND_CONDITIONS } from '@/app/terms';

interface District {
  id: number;
  name: string;
  facilities: Array<{ id: number; name: string; type: string }>;
}

interface FormData {
  fullName: string;
  phone: string;
  districtId: string;
  village: string;
}

interface Errors {
  fullName?: string;
  phone?: string;
  districtId?: string;
  village?: string;
  consent?: string;
  general?: string;
}

export default function MotherRegisterPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, login } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    phone: '',
    districtId: '',
    village: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtsLoading, setDistrictsLoading] = useState(true);
  const [consentScrolled, setConsentScrolled] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const termsBoxRef = useRef<HTMLDivElement>(null);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/community/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  // Fetch districts on mount
  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const response = await fetch('/api/districts');
        const result = await response.json();
        if (result.success) {
          setDistricts(result.data);
        }
      } catch (error) {
        console.error('Error fetching districts:', error);
        setErrors({ general: 'Failed to load districts. Please try again.' });
      } finally {
        setDistrictsLoading(false);
      }
    };

    fetchDistricts();
  }, []);

  // ========================================================================
  // FORM VALIDATION HELPERS
  // ========================================================================
  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^(07\d{6}|\+256[0-9]{9})$/;
    return phoneRegex.test(phone.trim());
  };

  const validateStep1 = (): boolean => {
    const newErrors: Errors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Invalid phone format. Use 07XXXXXX or +256XXXXXXXXX';
    }

    if (!formData.districtId) {
      newErrors.districtId = 'District is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ========================================================================
  // SCROLL DETECTION FOR T&C
  // ========================================================================
  const handleTermsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const hasScrolledToBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < 10;

    if (hasScrolledToBottom && !consentScrolled) {
      setConsentScrolled(true);
    }
  };

  // ========================================================================
  // STEP NAVIGATION
  // ========================================================================
  const handleNext = async () => {
    if (currentStep === 1) {
      if (validateStep1()) {
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      if (!consentAccepted) {
        setErrors({ consent: 'You must accept the terms and conditions' });
        return;
      }
      setCurrentStep(3);
      await handleRegistration();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  // ========================================================================
  // REGISTRATION SUBMISSION
  // ========================================================================
  const handleRegistration = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/mothers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          phone: formData.phone.trim(),
          districtId: parseInt(formData.districtId, 10),
          village: formData.village.trim() || null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Auto-login with returned token
        login(result.data.token, result.data.motherId);
        setCurrentStep(3);
      } else {
        setErrors({
          general: result.error || 'Registration failed. Please try again.',
        });
        setCurrentStep(2);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Registration error:', error);
      setErrors({ general: 'An error occurred. Please try again.' });
      setCurrentStep(2);
      setIsSubmitting(false);
    }
  };

  // Auto-redirect after success
  useEffect(() => {
    if (currentStep === 3) {
      const timeout = setTimeout(() => {
        router.push('/community/dashboard');
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [currentStep, router]);

  if (isLoading || districtsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // ========================================================================
  // STEP 1: PERSONAL DETAILS
  // ========================================================================
  if (currentStep === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-neutral-50 py-12 px-4">
        <div className="max-w-lg mx-auto">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex gap-2 mb-4">
              <div className="flex-1 h-2 bg-primary-500 rounded-full"></div>
              <div className="flex-1 h-2 bg-neutral-300 rounded-full"></div>
              <div className="flex-1 h-2 bg-neutral-300 rounded-full"></div>
            </div>
            <p className="text-sm text-neutral-600 text-center">Step 1 of 3: Personal Details</p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-xl shadow-lg p-8 border border-neutral-200">
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Personal Information</h2>
            <p className="text-neutral-600 mb-6">Tell us about yourself</p>

            {/* General Error */}
            {errors.general && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{errors.general}</p>
              </div>
            )}

            {/* Form Fields */}
            <form className="space-y-5">
              <TextInput
                label="Full Name"
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={(e) => {
                  setFormData({ ...formData, fullName: e.target.value });
                  if (errors.fullName) setErrors({ ...errors, fullName: undefined });
                }}
                error={errors.fullName}
                required
              />

              <PhoneInput
                value={formData.phone}
                onChange={(e) => {
                  setFormData({ ...formData, phone: e.target.value });
                  if (errors.phone) setErrors({ ...errors, phone: undefined });
                }}
                error={errors.phone}
                required
              />

              <SelectDropdown
                label="District"
                placeholder="Select your district..."
                options={districts.map((d) => ({
                  value: d.id,
                  label: d.name,
                }))}
                value={formData.districtId}
                onChange={(e) => {
                  setFormData({ ...formData, districtId: e.target.value });
                  if (errors.districtId) setErrors({ ...errors, districtId: undefined });
                }}
                error={errors.districtId}
                required
              />

              <TextInput
                label="Village (Optional)"
                placeholder="Enter your village name"
                value={formData.village}
                onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                helperText="This helps us provide more localized care"
              />
            </form>

            {/* Navigation Buttons */}
            <div className="flex gap-4 mt-8">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/register')}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleNext}
                className="flex-1"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========================================================================
  // STEP 2: TERMS & CONDITIONS
  // ========================================================================
  if (currentStep === 2) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-neutral-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex gap-2 mb-4">
              <div className="flex-1 h-2 bg-primary-500 rounded-full"></div>
              <div className="flex-1 h-2 bg-primary-500 rounded-full"></div>
              <div className="flex-1 h-2 bg-neutral-300 rounded-full"></div>
            </div>
            <p className="text-sm text-neutral-600 text-center">Step 2 of 3: Terms & Conditions</p>
          </div>

          {/* Terms Card */}
          <div className="bg-white rounded-xl shadow-lg p-8 border border-neutral-200">
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Terms and Conditions</h2>
            <p className="text-neutral-600 mb-6">
              Please read and accept our terms to continue
            </p>

            {/* Terms Scrollable Box */}
            <div
              ref={termsBoxRef}
              onScroll={handleTermsScroll}
              className="bg-neutral-50 border border-neutral-300 rounded-lg p-6 mb-6 h-80 overflow-y-auto text-sm text-neutral-700 leading-relaxed"
            >
              <div className="whitespace-pre-wrap">{TERMS_AND_CONDITIONS}</div>
            </div>

            {/* Scroll Indicator */}
            {!consentScrolled && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                ⬇️ Please scroll down to read the full terms and conditions
              </div>
            )}

            {/* Consent Checkbox */}
            <div className="mb-6">
              <Checkbox
                id="consent"
                label="I have read and accept the Terms and Conditions"
                checked={consentAccepted}
                onChange={(e) => {
                  setConsentAccepted(e.target.checked);
                  if (errors.consent) setErrors({ ...errors, consent: undefined });
                }}
                disabled={!consentScrolled}
                error={errors.consent}
              />
              {!consentScrolled && (
                <p className="text-xs text-neutral-600 mt-2">
                  (Checkbox will be enabled once you scroll to the end)
                </p>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-4 mt-8">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleNext}
                disabled={!consentAccepted || isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Creating Account...' : 'Accept & Continue'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========================================================================
  // STEP 3: SUCCESS CONFIRMATION
  // ========================================================================
  if (currentStep === 3) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-neutral-50 py-12 px-4 flex items-center justify-center">
        <div className="max-w-lg mx-auto">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex gap-2 mb-4">
              <div className="flex-1 h-2 bg-primary-500 rounded-full"></div>
              <div className="flex-1 h-2 bg-primary-500 rounded-full"></div>
              <div className="flex-1 h-2 bg-primary-500 rounded-full"></div>
            </div>
            <p className="text-sm text-neutral-600 text-center">Step 3 of 3: Confirmation</p>
          </div>

          {/* Success Card */}
          <div className="bg-white rounded-xl shadow-lg p-8 border border-neutral-200 text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full">
                <svg
                  className="w-10 h-10 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Registration Successful!</h2>
            <p className="text-neutral-600 mb-6">
              Welcome to MPMATCH, {formData.fullName.split(' ')[0]}! Your account has been created successfully.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-blue-900 font-semibold mb-2">What's next:</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✓ You're now logged in</li>
                <li>✓ Redirecting to your dashboard in 2 seconds...</li>
                <li>✓ You can now create emergency alerts and track your pregnancy</li>
              </ul>
            </div>

            <p className="text-xs text-neutral-600">
              Redirecting to dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
