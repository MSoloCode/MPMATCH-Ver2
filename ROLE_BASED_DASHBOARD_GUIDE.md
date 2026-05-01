# Role-Based Dashboard Implementation Guide

## Overview

This guide explains how to implement role-specific dashboards so that when users sign in, they see only information relevant to their role and assigned scope.

## New Utilities Created

### 1. `lib/dashboard-helpers.ts`
Provides helper functions for role-specific data filtering:

- `extractDashboardContext()` - Normalize user payload into dashboard context
- `getDataVisibilityRules()` - Get what data types a role can access
- `getMothersFilter()` - Prisma WHERE clause for filtering mothers
- `getAppointmentsFilter()` - Prisma WHERE clause for filtering appointments
- `getAlertsFilter()` - Prisma WHERE clause for filtering alerts
- `getDashboardTitle()` - Role-specific dashboard title
- `getRoleDescription()` - Role-specific description text

### 2. `app/api/dashboard/overview` (NEW)
Unified dashboard data API endpoint that:

- Authenticates via JWT token
- Automatically filters all data based on user's role and scope
- Returns role-appropriate statistics
- Includes recent alerts, upcoming appointments, high-risk pregnancies
- No query parameters needed - all filtering server-side

**Example Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "role": "DOCTOR",
      "displayName": "Dr. John",
      "facilityInfo": { "id": 1, "name": "City Hospital" }
    },
    "stats": {
      "totalMothers": 45,
      "activePregnancies": 38,
      "highRiskPregnancies": 5,
      "openAlerts": 3,
      "upcomingAppointments": 12
    },
    "recentAlerts": [...],
    "upcomingAppointments": [...],
    "highRiskMothers": [...],
    "visibility": { "canSeeMothers": "hospital", "canSeeAlerts": "hospital", ... }
  }
}
```

### 3. `components/DashboardLayout.tsx`
Reusable wrapper component for dashboard pages:

- Verifies authentication and role
- Fetches role-specific data from `/api/dashboard/overview`
- Handles loading/error states
- Auto-refreshes every 60 seconds
- Passes data to child component via props

## Usage Example

### Basic Dashboard Page

**Before:**
```tsx
// app/doctor/dashboard/page.tsx
export default function DoctorDashboard() {
  // Manual data fetching, no role verification
  return <div>...</div>;
}
```

**After:**
```tsx
'use client';

import DashboardLayout, { DashboardData } from '@/components/DashboardLayout';

interface DashboardPageProps {
  dashboardData: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

function DoctorDashboardContent({
  dashboardData,
  isLoading,
  error,
  refreshData,
}: DashboardPageProps) {
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!dashboardData) return <div>No data</div>;

  const { stats, user, recentAlerts, visibility } = dashboardData;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-2">Welcome, {user.displayName}</h1>
      <p className="text-gray-600 mb-6">{user.facilityInfo?.name}</p>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard title="Active Pregnancies" count={stats.activePregnancies} />
        <StatCard title="High Risk" count={stats.highRiskPregnancies} />
        <StatCard title="Open Alerts" count={stats.openAlerts} />
      </div>

      {/* Recent Alerts - Only visible if role can see alerts */}
      {visibility.canSeeAlerts && (
        <div className="bg-white rounded shadow p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Recent Alerts</h2>
          {recentAlerts.length > 0 ? (
            <ul>
              {recentAlerts.map((alert) => (
                <li key={alert.id} className="mb-4">
                  <div className="font-semibold">{alert.motherName}</div>
                  <div className="text-sm text-gray-600">{alert.type}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No recent alerts</p>
          )}
        </div>
      )}

      {/* Other content... */}
    </div>
  );
}

export default function DoctorDashboard() {
  return (
    <DashboardLayout requiredRole="DOCTOR">
      <DoctorDashboardContent />
    </DashboardLayout>
  );
}
```

## How Data Filtering Works by Role

### COMMUNITY_USER (Mother)
- **Can see:** Only their own mother record and related data
- **Cannot see:** Other mothers, global statistics, staff info
- **Filters applied:** `{ id: motherId }`

```tsx
// Mother sees their own appointments only
{
  "stats": {
    "activePregnancies": 1,
    "upcomingAppointments": 2
  },
  "visibility": {
    "canSeeMothers": "own",
    "canSeeAppointments": "own",
    "canSeeGlobalStats": false
  }
}
```

### CHW (Community Health Worker)
- **Can see:** Mothers in assigned district
- **Cannot see:** Other districts, hospital staff data
- **Filters applied:** `{ facility: { district: { id: districtId } } }`

### DOCTOR/NURSE/MIDWIFE
- **Can see:** Mothers and data in assigned hospital
- **Cannot see:** Other hospitals, district-wide data
- **Filters applied:** `{ facility: { hospitals: { some: { id: hospitalId } } } }`

### DHO (District Health Officer)
- **Can see:** All mothers and statistics for assigned district
- **Can see:** Global stats for their district
- **Filters applied:** `{ facility: { district: { id: districtId } } }`

### HOSPITAL_ADMIN
- **Can see:** All data within hospital + staff management
- **Can see:** Global stats for their hospital
- **Filters applied:** `{ facility: { hospitals: { some: { id: hospitalId } } } }`

### SYSTEM_ADMIN
- **Can see:** Everything globally
- **Filters applied:** None (empty WHERE clause)

## Implementation Steps

### Step 1: Update Existing Dashboard Pages
Open each dashboard page and wrap with `DashboardLayout`:

```tsx
// Examples to update:
// - app/community/dashboard/page.tsx
// - app/chw/dashboard/page.tsx
// - app/clinical/doctor/page.tsx
// - app/dho/dashboard/page.tsx
// - etc.
```

### Step 2: Use Dashboard Data in Components

Replace manual API calls:

**Before:**
```tsx
useEffect(() => {
  fetch('/api/mothers', {
    headers: { Authorization: `Bearer ${token}` }
  })
  .then(r => r.json())
  .then(data => setMothers(data));
}, []);
```

**After:**
```tsx
// Data automatically filtered by DashboardLayout
const { stats, dashboardData } = props;
const mothers = dashboardData?.stats.totalMothers || 0;
```

### Step 3: Conditional Rendering Based on Visibility

```tsx
{visibility.canSeeGlobalStats && (
  <GlobalStatsSection stats={stats} />
)}

{visibility.canSeeStaff && (
  <StaffManagementSection />
)}

{visibility.canSeeReports && (
  <ReportsSection />
)}
```

## Role-Specific Dashboard Sections

### COMMUNITY_USER Dashboard
- My Pregnancy Status
- My Appointments
- My Vitals
- My Symptoms & Danger Signs
- My ANC Visits
- Nearest CHWs/Facilities

### CHW Dashboard
- District Overview
  - Total mothers
  - Active pregnancies
- My Mothers
- Recent Alerts (district-wide)
- High-Risk Cases
- Performance Stats

### DOCTOR/NURSE/MIDWIFE Dashboard
- Hospital Dashboard
  - Total patients
  - Active pregnancies
- My Patients
- Open Alerts
- High-Risk Pregnancies
- Upcoming Appointments
- Staff Schedule

### DHO Dashboard
- District Overview
  - All facilities
  - All mothers
- Statistics & Analytics
- Facility Performance
- High-Risk Cases
- Alert Trends
- Staff Directory

### HOSPITAL_ADMIN Dashboard
- Hospital KPIs
- Staff Management
- Patient Statistics
- Department Overview
- Alert Management
- Facility Analytics

### SYSTEM_ADMIN Dashboard
- Global Statistics
- All Countries/Facilities
- User Management
- System Health
- Audit Logs
- All Alerts/Cases

## Testing Role-Based Visibility

### Test Cases to Verify

1. **Mother Sign-In**
   - ✓ Can access `/community/dashboard`
   - ✗ Cannot access `/clinical/doctor`
   - ✓ Dashboard shows only their own data
   - ✗ Cannot see other mothers' information

2. **CHW Sign-In**
   - ✓ Can access `/chw/dashboard`
   - ✓ Dashboard shows mothers from their district only
   - ✗ Cannot see mothers from other districts
   - ✓ Can see high-risk cases in their district

3. **Doctor Sign-In**
   - ✓ Can access `/clinical/doctor`
   - ✓ Dashboard shows hospital patients only
   - ✗ Cannot see patients from other hospitals
   - ✓ Can see clinical details for their patients

4. **DHO Sign-In**
   - ✓ Can access `/dho/dashboard`
   - ✓ Dashboard shows all facilities and mothers in district
   - ✓ Can see district-wide statistics
   - ✗ Cannot see other districts' data

5. **Admin Sign-In**
   - ✓ Can access `/admin/dashboard`
   - ✓ Dashboard shows all global data
   - ✓ Can see user management

## API Endpoint Reference

### GET /api/dashboard/overview

**Authentication:** Required (JWT Bearer token)

**Query Parameters:** None (all filtering server-side)

**Response:**
- 200: Success with role-filtered dashboard data
- 401: Missing/invalid token
- 500: Server error

**Example Usage:**
```javascript
// From a dashboard page
const response = await fetch('/api/dashboard/overview', {
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const { data } = await response.json();
// data.stats.totalMothers only includes mothers visible to this user's role
// data.visibility shows what features are available
```

## Database Queries Optimized

The dashboard endpoint uses optimized Prisma queries:

- **Count queries** for statistics (fast aggregate)
- **Indexed lookups** for hospitalId, districtId, motherId
- **Relation filtering** for tenant scoping
- **Limits** on detail data (top 5 alerts, 5 appointments, etc.)

All queries include automatic tenant scoping via filters.

## Migration from Old System

If existing dashboards have hardcoded API calls, gradually migrate:

1. Keep old API endpoints working
2. Add new `/api/dashboard/overview` endpoint
3. Update dashboard pages one-by-one to use `DashboardLayout`
4. Remove old API calls once all dashboards migrated
5. Deprecate old endpoints after testing

## Error Handling

The `DashboardLayout` component handles:

- **401 Unauthorized:** Redirects to `/sign-in`
- **403 Forbidden:** Redirects to `/unauthorised` (role mismatch)
- **Network errors:** Shows error state with "Try Again" button
- **Missing data:** Shows empty state instead of crashing

## Performance Considerations

- Dashboard data cached for 60 seconds (auto-refresh)
- Counts use efficient `count()` queries
- Detail data limited to top 5 records
- Parallel database queries where possible
- No N+1 query problems (using proper Prisma includes)

## Next Steps

1. ✅ Created helper functions for role-based filtering
2. ✅ Created unified dashboard API endpoint
3. ✅ Created DashboardLayout wrapper component
4. ⏳ Update each dashboard page to use the new system
5. ⏳ Test each role's dashboard visibility
6. ⏳ Deploy and monitor for issues

## Questions & Troubleshooting

**Q: Dashboard shows data from wrong role?**
A: Check that `DashboardLayout` has correct `requiredRole` prop and that JWT token contains correct `role` field.

**Q: Filtered data is empty?**
A: Verify user has correct `hospitalId`/`districtId`/`motherId` in JWT token. Check database has data for that scope.

**Q: Performance issues?**
A: Check database indexes on `hospitalId`, `districtId`, `motherId` fields. Consider pagination for large datasets.
