import Link from 'next/link';

/**
 * Unauthorized Access Error Page
 * Shown when a user tries to access a dashboard they don't have permission for
 */
export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-red-600 mb-4">403</h1>
        <p className="text-2xl font-semibold text-gray-800 mb-2">
          Access Denied
        </p>
        <p className="text-gray-600 mb-8 max-w-md">
          You don't have permission to access this dashboard. Please contact
          your administrator if you believe this is an error.
        </p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            Go to Home
          </Link>
          <Link
            href="/sign-in"
            className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
          >
            Sign In with Different Account
          </Link>
        </div>
      </div>
    </div>
  );
}
