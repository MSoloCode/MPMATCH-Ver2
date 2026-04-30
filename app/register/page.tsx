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
  userType: string;
  fullName: string;
  phone: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
  districtId: string;
  village: string;
  useUsernameAuth?: boolean;
}

interface Errors {
  userType?: string;
  fullName?: string;
  phone?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
  districtId?: string;
  village?: string;
  consent?: string;
  general?: string;
}

const USER_TYPES = [
  { value: 'mother', label: 'Mother' },
  { value: 'chw', label: 'Community Health Worker (CHW)' },
  { value: 'healthcare_worker', label: 'Healthcare Worker' },
];

export default function UnifiedRegisterPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, login } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    userType: '',
    fullName: '',
    phone: '',
    username: '',
    password: '',
    confirmPassword: '',
    districtId: '',
    village: '',
    useUsernameAuth: false,
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
    const phoneRegex = /^0[0-9]{9}$/;
    return phoneRegex.test(phone.trim());
  };

  const validateUsername = (username: string): boolean => {
    return username.length >= 3 && username.length <= 50 && /^[a-zA-Z0-9_-]+$/.test(username);
  };

  const validatePassword = (password: string): boolean => {
    return password.length >= 6 && password.length <= 128;
  };

  const validateStep1 = (): boolean => {
    const newErrors: Errors = {};

    if (!formData.userType) {
      newErrors.userType = 'Please select your user type';
    }

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters';
    }

    // Check authentication method
    if (formData.useUsernameAuth) {
      // Username/Password validation
      if (!formData.username?.trim()) {
        newErrors.username = 'Username is required';
      } else if (!validateUsername(formData.username.trim())) {
        newErrors.username = 'Username must be 3-50 characters, alphanumeric with _ or - allowed';
      }

      if (!formData.password?.trim()) {
        newErrors.password = 'Password is required';
      } else if (!validatePassword(formData.password)) {
        newErrors.password = 'Password must be 6-128 characters';
      }

      if (!formData.confirmPassword?.trim()) {
        newErrors.confirmPassword = 'Confirm password is required';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    } else {
      // Phone-based validation
      if (!formData.phone.trim()) {
        newErrors.phone = 'Phone number is required';
      } else if (!validatePhone(formData.phone)) {
        newErrors.phone = 'Invalid phone format. Use 07XXXXXX or +256XXXXXXXXX';
      }
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
      const payload: any = {
        userType: formData.userType,
        fullName: formData.fullName.trim(),
        districtId: parseInt(formData.districtId, 10),
        village: formData.village.trim() || null,
      };

      if (formData.useUsernameAuth) {
        // Username/Password registration
        payload.username = formData.username?.trim();
        payload.password = formData.password;
      } else {
        // Phone-based registration
        payload.phone = formData.phone.trim();
      }

      console.log('=== REGISTRATION PAYLOAD ===', JSON.stringify(payload, null, 2));

      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log('=== REGISTRATION RESPONSE ===', result);

      if (result.success) {
        // Auto-login with returned token
        const isMother = formData.userType === 'mother';
        const role = isMother ? 'COMMUNITY_USER' : (formData.userType === 'chw' ? 'CHW' : 'DOCTOR');
        
        if (isMother) {
          // Mothers don't have userId
          login(
            result.data.token,
            0, // No userId for mothers
            result.data.fullName,
            null, // email
            result.data.phone,
            role,
            result.data.motherId // motherId
          );
        } else {
          // CHWs and healthcare workers have userId
          login(
            result.data.token,
            result.data.userId,
            result.data.fullName,
            null, // email
            result.data.phone,
            role
          );
        }
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
  // STEP 1: USER TYPE & PERSONAL DETAILS
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
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Register with MPMATCH</h2>
            <p className="text-neutral-600 mb-6">Tell us about yourself</p>

            {/* General Error */}
            {errors.general && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{errors.general}</p>
              </div>
            )}

            {/* Form Fields */}
            <form className="space-y-5">
              <SelectDropdown
                label="I am registering as..."
                placeholder="Select your user type..."
                options={USER_TYPES}
                value={formData.userType}
                onChange={(e) => {
                  setFormData({ ...formData, userType: e.target.value });
                  if (errors.userType) setErrors({ ...errors, userType: undefined });
                }}
                error={errors.userType}
                required
              />

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

              {/* Authentication Method Toggle */}
              <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.useUsernameAuth}
                    onChange={(e) => {
                      setFormData({ ...formData, useUsernameAuth: e.target.checked });
                      setErrors({});
                    }}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-sm font-medium text-neutral-900">
                    Create account with username & password
                  </span>
                </label>
                <p className="text-xs text-neutral-600 mt-2 ml-8">
                  {formData.useUsernameAuth
                    ? 'You can sign in anytime with your username and password'
                    : 'Or use phone number and we\'ll send you login details'}
                </p>
              </div>

              {/* Conditional Fields */}
              {formData.useUsernameAuth ? (
                <>
                  <TextInput
                    label="Username"
                    placeholder="Choose your username"
                    value={formData.username || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, username: e.target.value });
                      if (errors.username) setErrors({ ...errors, username: undefined });
                    }}
                    error={errors.username}
                    helperText="3-50 characters, letters, numbers, underscore and hyphen only"
                    required
                  />

                  <TextInput
                    label="Password"
                    type="password"
                    placeholder="Create a strong password"
                    value={formData.password || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value });
                      if (errors.password) setErrors({ ...errors, password: undefined });
                    }}
                    error={errors.password}
                    helperText="At least 6 characters"
                    required
                  />

                  <TextInput
                    label="Confirm Password"
                    type="password"
                    placeholder="Re-enter your password"
                    value={formData.confirmPassword || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, confirmPassword: e.target.value });
                      if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined });
                    }}
                    error={errors.confirmPassword}
                    required
                  />
                </>
              ) : (
                <PhoneInput
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value });
                    if (errors.phone) setErrors({ ...errors, phone: undefined });
                  }}
                  error={errors.phone}
                  required
                />
              )}

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
                onClick={() => router.push('/')}
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
    const userTypeLabel = USER_TYPES.find((ut) => ut.value === formData.userType)?.label || formData.userType;
    const authMethod = formData.useUsernameAuth 
      ? `Username: ${formData.username}` 
      : `Phone: ${formData.phone}`;

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
          <div className="bg-white rounded-xl shadow-lg p-8 border border-neutral-200">
            <div className="mb-6 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
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

              <h2 className="text-3xl font-bold text-neutral-900 mb-2">Welcome to MPMATCH!</h2>
              <p className="text-lg text-primary-600 font-semibold mb-3">Registration Successful</p>
              <p className="text-neutral-600">
                Your account has been created and you're now logged in. Ready to get started?
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-900 font-semibold mb-3">Your Account:</p>
              <ul className="text-sm text-green-800 space-y-2">
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span><strong>Name:</strong> {formData.fullName}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span><strong>Type:</strong> {userTypeLabel}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span><strong>District:</strong> {districts.find(d => d.id === parseInt(formData.districtId, 10))?.name || 'Selected'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span><strong>Login Method:</strong> {authMethod}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="font-semibold">You're logged in!</span>
                </li>
              </ul>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Next steps:</span> Click the button below to access your dashboard and start using MPMATCH.
              </p>
            </div>

            {/* Main CTA Button */}
            <button
              onClick={() => router.push('/community/dashboard')}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition mb-3 flex items-center justify-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
              Go to Your Dashboard
            </button>

            <p className="text-xs text-neutral-500 text-center">
              Automatically redirecting in 2 seconds if you don't click above...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
