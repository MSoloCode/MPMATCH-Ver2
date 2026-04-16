'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getDashboardForRole } from '@/lib/role-routes';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { TextInput } from '@/components/FormInputs';
import Button from '@/components/Button';

interface SignInFormData {
  username: string;
  password: string;
}

interface Errors {
  username?: string;
  password?: string;
  general?: string;
}

export default function SignInPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, login } = useAuth();

  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================
  const [formData, setFormData] = useState<SignInFormData>({
    username: '',
    password: '',
  });

  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ========================================================================
  // AUTHENTICATION CHECK - Redirect if already signed in
  // ========================================================================
  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      // Get role from localStorage and route accordingly
      const role = localStorage.getItem('role');
      const dashboard = role ? getDashboardForRole(role) : '/community/dashboard';
      router.push(dashboard || '/community/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  // ========================================================================
  // FORM VALIDATION
  // ========================================================================
  const validateForm = (): boolean => {
    const newErrors: Errors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ========================================================================
  // HANDLE FORM INPUT CHANGES
  // ========================================================================
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));

      // Clear error for this field when user starts typing
      if (errors[name as keyof Errors]) {
        setErrors((prev) => ({
          ...prev,
          [name]: undefined,
        }));
      }
    },
    [errors]
  );

  // ========================================================================
  // HANDLE SIGN IN SUBMISSION
  // ========================================================================
  const handleSignIn = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      // Validate form
      if (!validateForm()) {
        return;
      }

      setIsSubmitting(true);
      setErrors({});

      try {
        // Call sign-in API
        const response = await fetch('/api/sign-in', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: formData.username.trim(),
            password: formData.password,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          setErrors({
            general: data.error || 'Sign in failed. Please try again.',
          });
          setIsSubmitting(false);
          return;
        }

        // Extract user data from response
        const { token, user } = data.data;
        const { userId, username, email, phone, role } = user;

        // Store auth in hook (which saves to localStorage)
        login(token, userId, username, email, phone, role);

        // Route to appropriate dashboard based on user role
        const dashboard = getDashboardForRole(role) || '/community/dashboard';
        router.push(dashboard);
      } catch (error) {
        console.error('Sign in error:', error);
        setErrors({
          general: 'An error occurred. Please try again.',
        });
        setIsSubmitting(false);
      }
    },
    [formData, login, router]
  );

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-cover bg-center"
      style={{
        backgroundImage:
          'url("https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Uganda_location_map.svg/1200px-Uganda_location_map.svg.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#f5f5f5',
      }}
    >
      {/* Dark overlay to improve text contrast */}
      <div className="absolute inset-0 bg-black/40"></div>

      {/* Home Button - Top Right */}
      <div className="absolute top-6 right-6 z-10">
        <Link href="/">
          <button className="px-4 py-2 bg-white text-gray-900 font-semibold rounded-lg border-2 border-gray-300 hover:bg-gray-100 transition-colors">
            Home
          </button>
        </Link>
      </div>

      {/* Main Sign-In Card */}
      <div className="relative z-10 w-full max-w-md px-6 py-8">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo Section */}
          <div className="flex flex-col items-center gap-4 mb-8">
            {/* Orange Square Icon */}
            <div className="w-16 h-16 bg-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-3xl font-bold">M</span>
            </div>

            {/* Logo Text */}
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">MPMATCH LINKS AFRICA</h1>
              <p className="text-sm text-gray-600 mt-1">Electronic Antenatal Care System (E-ANC)</p>
            </div>
          </div>

          {/* Sign In Title & Subtitle */}
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Sign in</h2>
            <p className="text-sm text-gray-600">
              Access depends on your role (Doctors, Midwives, Nurses, CHWs, Admin).
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignIn} className="space-y-6">
            {/* General Error Message */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600">{errors.general}</p>
              </div>
            )}

            {/* Username Input */}
            <div>
              <TextInput
                label="Username"
                name="username"
                type="text"
                placeholder="Enter your username"
                value={formData.username}
                onChange={handleInputChange}
                error={errors.username}
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Password Input with Show/Hide Toggle */}
            <div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-neutral-900">
                  Password <span className="text-red-600 ml-1">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    className={`
                      w-full px-3 py-2 pr-10 bg-white rounded-lg
                      border border-neutral-300
                      text-neutral-900 text-sm
                      placeholder-neutral-500
                      focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                      disabled:bg-neutral-100 disabled:text-neutral-500 disabled:cursor-not-allowed
                      transition-colors
                      ${errors.password ? 'border-red-600 focus:ring-red-600' : ''}
                    `}
                  />
                  {/* Show/Hide Password Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700 disabled:cursor-not-allowed"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff size={20} />
                    ) : (
                      <Eye size={20} />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <span className="text-sm text-red-600">{errors.password}</span>
                )}
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`
                w-full px-6 py-3 rounded-lg font-semibold transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-offset-2
                text-white
                ${
                  isSubmitting
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-900 hover:bg-blue-800 active:opacity-90 focus:ring-blue-500'
                }
              `}
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Yellow Dot Note */}
          <div className="mt-6 flex gap-3 items-start bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex-shrink-0 w-2 h-2 rounded-full bg-yellow-500 mt-1.5"></div>
            <p className="text-xs text-gray-700">
              If you cannot log in, contact your Hospital Admin.
            </p>
          </div>

          {/* Red Dot Note */}
          <div className="mt-4 flex gap-3 items-start bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500 mt-1.5"></div>
            <p className="text-xs text-gray-700">
              Emergency workflows are available after login (Call + SMS escalation).
            </p>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200 text-center text-xs text-gray-600">
            <p>© 2026 MPMATCH LINKS AFRICA</p>
            <p className="mt-1">Designed for Africa • Uganda theme</p>
          </div>
        </div>
      </div>
    </div>
  );
}
