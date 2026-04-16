/**
 * AUTHENTICATION TESTING GUIDE
 * 
 * This guide shows how to test the complete authentication flow
 * with real JWT tokens
 */

// ============================================================================
// TEST 1: REGISTER A MOTHER
// ============================================================================

// 1. Open browser console at http://localhost:3000/register/mother
// 2. Complete the 3-step registration form with:
//    - Full Name: "Jane Test Mother"
//    - Phone: 0701234567
//    - District: Select any from dropdown
//    - Village: (optional)
// 3. Accept terms and complete registration
// 
// Result: You'll be redirected to /community/dashboard and logged in

// ============================================================================
// TEST 2: CHECK TOKEN IN LOCALSTORAGE
// ============================================================================

// In browser console:
localStorage.getItem('token')
// Output: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtb3RoZXJJZC...
// This is your real JWT token - save this value

localStorage.getItem('motherId')
// Output: 123 (your new mother ID)

// ============================================================================
// TEST 3: TEST PROTECTED ENDPOINT - GET MOTHER PROFILE
// ============================================================================

// Get the token from localStorage
const token = localStorage.getItem('token');

// Make authenticated request to /api/mothers/me
const response = await fetch('/api/mothers/me', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

const data = await response.json();
console.log(data);

// Expected output (200 success):
// {
//   "success": true,
//   "data": {
//     "motherId": 123,
//     "fullName": "Jane Test Mother",
//     "phone": "+256701234567",
//     "district": "Kampala",
//     "village": null,
//     "consentAccepted": true,
//     "consentDate": "2026-04-15T10:30:00Z"
//   }
// }

// ============================================================================
// TEST 4: TEST UNAUTHENTICATED REQUEST (Should fail)
// ============================================================================

const failResponse = await fetch('/api/mothers/me', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    // Intentionally NO Authorization header
  },
});

const failData = await failResponse.json();
console.log(failData);

// Expected output (401 unauthorized):
// {
//   "success": false,
//   "error": "Unauthorized - no token provided"
// }

// ============================================================================
// TEST 5: TEST INVALID TOKEN (Should fail)
// ============================================================================

const invalidResponse = await fetch('/api/mothers/me', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer invalid.fake.token',
    'Content-Type': 'application/json',
  },
});

const invalidData = await invalidResponse.json();
console.log(invalidData);

// Expected output (401 unauthorized):
// {
//   "success": false,
//   "error": "Unauthorized - invalid token"
// }

// ============================================================================
// TEST 6: LOGOUT AND VERIFY AUTH CHECK
// ============================================================================

// Clear token from localStorage
localStorage.removeItem('token');
localStorage.removeItem('motherId');

// Try accessing protected route
// Navigate to http://localhost:3000/community/dashboard
// Result: Should redirect to /register (no token = unauthenticated)

// Try authenticated request
const loggedOutResponse = await fetch('/api/mothers/me', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`, // null
    'Content-Type': 'application/json',
  },
});

const loggedOutData = await loggedOutResponse.json();
console.log(loggedOutData);
// Result: 401 Unauthorized

// ============================================================================
// TEST 7: JWT TOKEN ANATOMY
// ============================================================================

// Decode JWT token structure (DO NOT rely on this for security - always verify server-side)
// Format: header.payload.signature

const token = localStorage.getItem('token');
const parts = token.split('.');

const header = JSON.parse(atob(parts[0]));
const payload = JSON.parse(atob(parts[1]));
// signature is parts[2] (cannot decode - server-side verified)

console.log('Header:', header);
// {
//   "alg": "HS256",
//   "typ": "JWT"
// }

console.log('Payload:', payload);
// {
//   "motherId": 123,
//   "phone": "+256701234567",
//   "role": "MOTHER",
//   "iat": 1713174600,  // Issued At
//   "exp": 1713261000   // Expires: now + 24 hours
// }

// Check if token is expired
const now = Math.floor(Date.now() / 1000);
const isExpired = payload.exp < now;
console.log('Token expired?', isExpired); // false (if within 24 hours)

// ============================================================================
// TEST 8: REGISTER A CHW AND TEST CHW ENDPOINT
// ============================================================================

// 1. Open http://localhost:3000/register/chw
// 2. Complete registration with:
//    - Full Name: "John Test CHW"
//    - Phone: 0702345678
//    - District: Select any
//    - Facility: Select (required for CHW)
// 3. Accept terms and complete
//
// Result: Redirected to /community/dashboard with CHW token

const chwToken = localStorage.getItem('token');

// Test CHW protected endpoint
const chwResponse = await fetch('/api/chws/me', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${chwToken}`,
    'Content-Type': 'application/json',
  },
});

const chwData = await chwResponse.json();
console.log(chwData);

// Expected output (200 success):
// {
//   "success": true,
//   "data": {
//     "userId": 456,
//     "fullName": "John Test CHW",
//     "phone": "+256702345678",
//     "role": "CHW",
//     "district": "Kampala",
//     "facility": "Mulago Hospital",
//     "isActive": true
//   }
// }

// ============================================================================
// CURL COMMANDS (for terminal testing)
// ============================================================================

// 1. Test authenticated request with real token
// Replace TOKEN_HERE with actual token from localStorage
/*
curl -X GET http://localhost:3000/api/mothers/me \
  -H "Authorization: Bearer TOKEN_HERE" \
  -H "Content-Type: application/json"

Response (200):
{
  "success": true,
  "data": { ... }
}
*/

// 2. Test unauthenticated request (should fail)
/*
curl -X GET http://localhost:3000/api/mothers/me \
  -H "Content-Type: application/json"

Response (401):
{
  "success": false,
  "error": "Unauthorized - no token provided"
}
*/

// 3. Test invalid token (should fail)
/*
curl -X GET http://localhost:3000/api/mothers/me \
  -H "Authorization: Bearer invalid.fake.token" \
  -H "Content-Type: application/json"

Response (401):
{
  "success": false,
  "error": "Unauthorized - invalid token"
}
*/

// ============================================================================
// POSTMAN TESTING
// ============================================================================

/*
1. Import collection or create new request:
   - Method: GET
   - URL: http://localhost:3000/api/mothers/me
   
2. Add Headers tab:
   - Key: Authorization
   - Value: Bearer {{token}}
   - (where {{token}} is token from localStorage)
   
3. Set up Postman environment variable:
   - Create env var "token" with JWT token value
   - Use {{token}} in Authorization header
   
4. Send request
   - Success (200): See full mother profile
   - Failure (401): See error message
*/

// ============================================================================
// WHAT THIS TESTS
// ============================================================================

// ✅ Real JWT token generation (POST /api/mothers/register returns token)
// ✅ Token parsing and verification (GET /api/mothers/me validates token)
// ✅ Protected endpoint access (401 if no valid token)
// ✅ Database lookup (fetches mother/user record by ID from token)
// ✅ Token expiration (24-hour expiry in token payload)
// ✅ Token storage/retrieval (localStorage persistence)
// ✅ Client-side auth check (/community/layout.tsx redirects if no token)
// ✅ Both Mother and CHW flows work end-to-end

// ============================================================================
// DOCUMENTATION REFERENCES
// ============================================================================

// Token generation: lib/auth.ts → signToken()
// Token verification: lib/auth.ts → verifyToken()
// Mother registration: app/api/mothers/register/route.ts
// CHW registration: app/api/chws/register/route.ts
// Mother profile endpoint: app/api/mothers/me/route.ts
// CHW profile endpoint: app/api/chws/me/route.ts
// Auth hook: hooks/useAuth.ts
// Route protection: app/community/layout.tsx + middleware.ts
