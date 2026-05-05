# MPMATCH Dashboard System - Visual Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER REGISTRATION/LOGIN                     │
│  (/register, /sign-in) → JWT Token with Role                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │   ROLE-BASED DASHBOARD REDIRECT      │
        │  (dashboard URL based on role)       │
        └──────────┬───────────────────────────┘
                   │
        ┌──────────┴──────────────────────────────────────────────┐
        │                                                          │
   ┌────▼────────┐   ┌────────────┐   ┌─────────────┐   ┌────────▼─┐
   │ COMMUNITY   │   │ CLINICAL   │   │ DISTRICT    │   │  ADMIN   │
   │ /community/ │   │ /clinical/ │   │ /dho        │   │ /admin   │
   │ dashboard   │   │ {role}     │   │ -dashboard  │   │ -dashdash│
   └────┬────────┘   └────┬───────┘   └──────┬──────┘   └────┬─────┘
        │                 │                  │              │
        │ ┌───────────────┼──────────────────┼──────────────┘
        │ │               │                  │
        ▼ ▼               ▼                  ▼

   ┌─────────────────────────────────────────────────────────────┐
   │                   DASHBOARD COMPONENTS                       │
   ├─────────────────────────────────────────────────────────────┤
   │                                                              │
   │  ┌────────────────────────────────────────────────────────┐ │
   │  │ [Hero Header with Title & Description]                │ │
   │  └────────────────────────────────────────────────────────┘ │
   │                                                              │
   │  ┌────────────────────────────────────────────────────────┐ │
   │  │ [Stats Cards] [Stats Cards] [Stats Cards] [Stats Card] │ │
   │  └────────────────────────────────────────────────────────┘ │
   │                                                              │
   │  ┌────────────────────────────────────────────────────────┐ │
   │  │                 USER PROFILE CARD                      │ │
   │  │  ┌─────┐  Name  │ Edit Profile Button                 │ │
   │  │  │ 👤  │  Role  │                                      │ │
   │  │  └─────┘  Phone │                                      │ │
   │  │  Email    Location                                     │ │
   │  └────────────────────────────────────────────────────────┘ │
   │                                                              │
   │  ┌────────────────────────────────────────────────────────┐ │
   │  │           FEATURE MENU (Grid or List)                  │ │
   │  │                                                        │ │
   │  │  [Feature 1]  [Feature 2]  [Feature 3]                │ │
   │  │  [Feature 4]  [Feature 5]  [Feature 6]                │ │
   │  │  [Feature 7]  [Feature 8]  [Feature 9]                │ │
   │  │  [Feature 10] [Feature 11] [Feature 12]               │ │
   │  │                                                        │ │
   │  └────────────────────────────────────────────────────────┘ │
   │                                                              │
   └─────────────────────────────────────────────────────────────┘
```

## Feature Menu Configuration

```
COMMUNITY_USER (Mother)
├─ My Profile → /profile
├─ My Medical Records → /my-records
├─ Appointments → /my-records/appointments
├─ Nearby CHWs → /community/dashboard#nearby
├─ AI Health Assistant → /ai-chat
└─ Emergency Alert → /community/dashboard#emergency

CHW (Community Health Worker)
├─ Dashboard → /chw-dashboard
├─ My Profile → /profile
├─ Assigned Mothers → /chw-dashboard/mothers
├─ My Tasks → /chw-dashboard/tasks
├─ Health Alerts → /chw-dashboard/alerts
├─ Appointments → /chw-dashboard/appointments
└─ Reports → /chw-dashboard/reports

DOCTOR
├─ Dashboard → /clinical/doctor
├─ My Profile → /profile
├─ Mothers → /clinical/doctor/mothers
├─ Pregnancies → /clinical/doctor/pregnancies
├─ ANC Visits → /clinical/doctor/anc-visits
├─ Vital Signs → /clinical/doctor/vitals
├─ Symptoms → /clinical/doctor/symptoms
├─ Health Alerts → /clinical/doctor/alerts
├─ Appointments → /clinical/doctor/appointments
├─ Referrals → /clinical/doctor/referrals
└─ Reports → /clinical/doctor/reports

NURSE (Similar to Doctor, read-only focus)
├─ Dashboard → /clinical/nurse
├─ My Profile → /profile
├─ Mothers → /clinical/nurse/mothers
├─ Pregnancies → /clinical/nurse/pregnancies
├─ Vital Signs → /clinical/nurse/vitals
├─ Symptoms → /clinical/nurse/symptoms
├─ ANC Visits → /clinical/nurse/anc-visits
├─ Health Alerts → /clinical/nurse/alerts
└─ Appointments → /clinical/nurse/appointments

MIDWIFE (Pregnancy focused)
├─ Dashboard → /clinical/midwife
├─ My Profile → /profile
├─ Pregnancies → /clinical/midwife/pregnancies
├─ Mothers → /clinical/midwife/mothers
├─ ANC Visits → /clinical/midwife/anc-visits
├─ Vital Signs → /clinical/midwife/vitals
├─ Symptoms → /clinical/midwife/symptoms
├─ Health Alerts → /clinical/midwife/alerts
├─ Appointments → /clinical/midwife/appointments
└─ Referrals → /clinical/midwife/referrals

DHO (District Level)
├─ Dashboard → /dho-dashboard
├─ My Profile → /profile
├─ Facilities → /dho-dashboard/facilities
├─ Statistics → /dho-dashboard/statistics
└─ Reports → /dho-dashboard/reports

HOSPITAL_ADMIN
├─ Dashboard → /admin-dashboard
├─ My Profile → /profile
├─ Staff Management → /admin-dashboard/staff
├─ Mother Records → /admin-dashboard/mothers
├─ Statistics → /admin-dashboard/statistics
└─ Reports → /admin-dashboard/reports

SYSTEM_ADMIN
├─ System Dashboard → /admin-dashboard
├─ My Profile → /profile
├─ User Management → /admin-dashboard/users
├─ Facilities → /admin-dashboard/facilities
└─ Audit Logs → /admin-dashboard/audit
```

## API Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     USER REQUEST                              │
│              (With JWT Token in header)                       │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│                 AUTHENTICATION CHECK                          │
│           (extractUser() verifies JWT token)                 │
│         (Throws UnauthorizedError if invalid)                │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│              AUTHORIZATION CHECK                             │
│         (Check user role against allowedRoles)              │
│        (Throws ForbiddenError if insufficient)              │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│          TENANT SCOPE VALIDATION                             │
│  (assertValidTenantScope checks facility/district/hospital)  │
│        (Throws ForbiddenError if scope invalid)             │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│              BUSINESS LOGIC EXECUTION                         │
│          (Fetch, validate, update data)                      │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│              AUDIT LOGGING (Async)                           │
│  (writeAuditLog with actor, action, resource, changes)      │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│              RESPONSE RETURNED                               │
│  { success: true, data: {...}, message: "..." }             │
│  or                                                           │
│  { success: false, error: "..." }                            │
└──────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
App Layout
├─ Navigation/Header
│  └─ UserProfileDropdown
│     ├─ Edit Profile Button → /profile/edit
│     ├─ View Profile Button → /profile
│     └─ Logout Button
│
└─ Page Router
   │
   ├─ /profile
   │  └─ EnhancedDashboard
   │     ├─ UserProfileCard (read-only)
   │     ├─ Additional Information Section
   │     └─ FeatureMenu (grid view)
   │
   ├─ /profile/edit
   │  └─ PersonalInfoForm
   │     ├─ Name input
   │     ├─ Phone input
   │     ├─ Conditional fields (for COMMUNITY_USER)
   │     └─ Submit/Cancel buttons
   │
   ├─ /community/dashboard
   │  └─ UserProfileCard + FeatureMenu (custom layout)
   │
   ├─ /clinical/doctor (and other clinical roles)
   │  └─ EnhancedDashboard
   │     ├─ Stats cards
   │     ├─ UserProfileCard (optional)
   │     ├─ Custom content (charts, tables)
   │     └─ FeatureMenu
   │
   ├─ /dho-dashboard
   │  └─ EnhancedDashboard (DHO configuration)
   │
   ├─ /admin-dashboard
   │  └─ EnhancedDashboard (Admin configuration)
   │
   └─ Other pages...
```

## Data Flow: Profile Update

```
┌──────────────────┐
│  Edit Profile    │
│     Page         │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ PersonalInfoForm Component           │
│ - Loads current data from API        │
│ - Validates user input               │
│ - Submits form                       │
└────────┬───────────────────────────┬─┘
         │                           │
         ▼                           ▼
   ┌─────────────┐           ┌──────────────┐
   │ Update User │           │ Update Mother│
   │ Profile API │           │  Profile API │
   │ PATCH /api/ │           │ PATCH /api/  │
   │ users/      │           │ mothers/me   │
   │ profile     │           │              │
   └────────┬────┘           └──────┬───────┘
            │                       │
            ▼                       ▼
    ┌─────────────────────────────────────┐
    │ Database Updates                    │
    │ - User table                        │
    │ - Mother table (if applicable)      │
    └────────┬────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────┐
    │ Audit Logging (Async)               │
    │ - Actor ID & Role                   │
    │ - Action: UPDATE                    │
    │ - Resource: User/Mother             │
    │ - Changes Summary                   │
    │ - IP Address & User Agent           │
    └────────┬────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────┐
    │ Success Response                    │
    │ - Updated user/mother data          │
    │ - Success message                   │
    │ - Auto-redirect to /profile         │
    └─────────────────────────────────────┘
```

## Color Coding System

```
Features organized by category with consistent colors:

🔵 Administration/Dashboard Features → Blue (#3B82F6)
   - Dashboard, My Profile

💜 User/Profile Features → Light Blue (#93C5FD)
   - Personal Information, Settings

🟣 Community/People Features → Purple (#A78BFA)
   - Mothers, CHWs, Staff

💗 Pregnancy/Women's Health → Pink (#F472B6)
   - Pregnancies, Mother Records

🟢 Clinical/ANC Features → Green (#34D399)
   - ANC Visits, Clinical Care

🟠 Vital Signs/Health Data → Orange (#FB923C)
   - Vitals, Measurements, Health Data

🔴 Alerts/Emergency Features → Red (#F87171)
   - Health Alerts, Emergencies

🟡 Reports/Analytics → Yellow (#FBBF24)
   - Reports, Statistics

🔷 Maps/Locations → Cyan (#06B6D4)
   - Map Features, Location Data
```

## Security Layers

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: JWT Authentication                             │
│ - Token extraction from Authorization header            │
│ - Token validation and signature verification           │
│ - Expiration checking (8h for clinical, 24h for others) │
└─────────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Role-Based Authorization                       │
│ - Check user role against allowedRoles array            │
│ - Return 403 Forbidden for insufficient permissions     │
└─────────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Tenant Scope Validation                        │
│ - Verify hospitalId/districtId/facilityId are present   │
│ - Ensure user has proper tenant association             │
└─────────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 4: Field-Level Protection                         │
│ - Immutable field checks in PATCH requests              │
│ - Prevent modification of role, email, phone            │
│ - Return 422 Unprocessable Entity if violation          │
└─────────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 5: Input Validation                               │
│ - Type checking, length validation, format validation   │
│ - Sanitization of user input                            │
│ - Return 422 for validation errors                      │
└─────────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 6: Audit Logging                                  │
│ - Log all state-changing operations                     │
│ - Capture actor, action, resource, changes              │
│ - Non-blocking (async) to prevent DoS                   │
└─────────────────────────────────────────────────────────┘
```

## Complete Workflow Example

```
1. NEW USER REGISTRATION
   ↓
   └─→ POST /api/register (phone or username/password)
       └─→ Create Mother or User record
           └─→ Generate JWT token
               └─→ Return token + redirect hint

2. AUTO LOGIN AFTER REGISTRATION
   ↓
   └─→ Frontend stores JWT in localStorage
       └─→ Auto-redirects to dashboard based on role

3. USER SEES DASHBOARD
   ↓
   └─→ Dashboard component loads:
       1. Calls GET /api/users/profile with JWT
       2. Receives user + mother data
       3. Renders UserProfileCard
       4. Renders FeatureMenu with 6-12 features
       5. Each feature shows as clickable card

4. USER CLICKS "EDIT PROFILE"
   ↓
   └─→ Navigates to /profile/edit
       └─→ PersonalInfoForm loads current data
           └─→ Calls GET /api/users/profile
               └─→ Form pre-populates fields
                   └─→ User edits fields
                       └─→ Form validates input
                           └─→ Submits PATCH /api/users/profile
                               └─→ API updates database
                                   └─→ Audit log created
                                       └─→ Success message shown
                                           └─→ Redirects to /profile

5. USER CLICKS A FEATURE
   ↓
   └─→ Navigation to feature page
       └─→ Feature page loads role-specific data
           └─→ User can perform their role's functions
               └─→ All data filtered by tenant scope
                   └─→ All actions logged to audit trail
```

## Statistics & Metrics

```
System Capabilities:
├─ 8 supported user roles
├─ 50+ total features available
├─ 6-12 features per role (avg 7)
├─ 4 main components created
├─ 2 new API endpoints
├─ 2 new pages
├─ 6 layers of security
├─ 100% responsive design
└─ Full audit logging

Coverage:
├─ Community Users: ✅ Covered
├─ Healthcare Workers: ✅ Covered
├─ Clinical Staff: ✅ Covered (Doctor, Nurse, Midwife)
├─ District Admins: ✅ Covered
├─ Hospital Admins: ✅ Covered
├─ System Admins: ✅ Covered
└─ Device Types: ✅ Mobile, Tablet, Desktop
```

This completes the MPMATCH Dashboard Improvement System! 🎉
