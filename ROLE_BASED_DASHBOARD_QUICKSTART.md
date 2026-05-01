# Quick Start: Role-Based Dashboards

## What Changed?

**Before:** Users signed in and saw generic dashboards with all data
**After:** Users see personalized dashboards with only data relevant to their role

## For Developers

### Step 1: Update a Dashboard Page

Replace the existing dashboard page with this pattern:

```tsx
'use client';

import DashboardLayout, { DashboardData } from '@/components/DashboardLayout';

interface DashboardPageProps {
  dashboardData: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

function YourDashboardContent({
  dashboardData,
  isLoading,
  error,
}: DashboardPageProps) {
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!dashboardData) return null;

  const { stats, user, recentAlerts, visibility } = dashboardData;

  return (
    <div>
      {/* Your dashboard UI here */}
      <h1>Welcome, {user.displayName}</h1>
      <p>Active Pregnancies: {stats.activePregnancies}</p>
      {visibility.canSeeGlobalStats && <p>Global Stats Section</p>}
    </div>
  );
}

export default function YourDashboard() {
  return (
    <DashboardLayout requiredRole="YOUR_ROLE">
      <YourDashboardContent />
    </DashboardLayout>
  );
}
```

### Step 2: Use Dashboard Data

`dashboardData` contains:

```typescript
{
  // User information
  user: {
    userId: number;
    motherId: number | null;
    role: string;
    displayName: string;
    facilityInfo: { name: string; id: number } | null;
  };

  // Statistics (filtered by role)
  stats: {
    totalMothers: number;
    activePregnancies: number;
    highRiskPregnancies: number;
    openAlerts: number;
    upcomingAppointments: number;
  };

  // Recent alerts (filtered by role scope)
  recentAlerts: Array<{
    id: number;
    type: string;
    status: string;
    motherName: string;
    createdAt: Date;
  }>;

  // Upcoming appointments (filtered by role scope)
  upcomingAppointments: Array<{
    id: number;
    appointmentDateTime: Date;
    status: string;
    motherName: string;
  }>;

  // High-risk pregnancies (filtered by role scope)
  highRiskMothers: Array<{
    pregnancyId: number;
    motherName: string;
    riskFactors: string[];
    antenatalStatus: string;
  }>;

  // What this role can see
  visibility: {
    canSeeMothers: 'own' | 'hospital' | 'district' | 'all';
    canSeeAppointments: 'own' | 'hospital' | 'district' | 'all';
    canSeeAlerts: 'own' | 'hospital' | 'district' | 'all';
    canSeeGlobalStats: boolean;
    canSeeStaff: boolean;
    canSeeReports: boolean;
  };
}
```

### Step 3: Conditional Rendering

Only show sections visible to this role:

```tsx
{visibility.canSeeGlobalStats && (
  <GlobalStatisticsSection stats={stats} />
)}

{visibility.canSeeStaff && (
  <StaffManagementSection />
)}

{visibility.canSeeReports && (
  <ReportsSection />
)}
```

## For QA/Testing

### Test a Role's Dashboard

1. **Sign in as Mother**
   - ✓ See only your own pregnancy
   - ✓ See your own appointments
   - ✗ Cannot see other mothers
   - ✗ Cannot see global statistics

2. **Sign in as CHW**
   - ✓ See all mothers in your district
   - ✓ See district alerts and appointments
   - ✗ Cannot see mothers from other districts
   - ✗ Cannot see global statistics

3. **Sign in as Doctor**
   - ✓ See all hospital patients
   - ✓ See hospital clinical data
   - ✗ Cannot see patients from other hospitals
   - ✗ Cannot see district-wide data

4. **Sign in as DHO**
   - ✓ See all district data
   - ✓ See district statistics
   - ✗ Cannot see other districts
   - ✓ Can see global district stats

5. **Sign in as Admin**
   - ✓ See everything globally
   - ✓ See all statistics
   - ✓ See user management

## For Product Managers

### What Users See

| Role | Dashboard Shows |
|------|-----------------|
| **Mother** | My pregnancy, my appointments, my vitals, nearest CHWs |
| **CHW** | District mothers, alerts, high-risk cases, performance |
| **Doctor** | Hospital patients, alerts, clinical data, reports |
| **Nurse/Midwife** | Same as Doctor (hospital scoped) |
| **DHO** | District overview, facilities, statistics, alerts |
| **Hospital Admin** | Hospital KPIs, staff, patient stats, analytics |
| **System Admin** | Everything globally |

### What They DON'T See

- Mothers in other districts (CHW, DHO)
- Patients from other hospitals (Doctor, Nurse, Midwife)
- Global statistics (Community users)
- Data from unauthorized roles

## API Endpoint

### GET /api/dashboard/overview

**Authentication:** Required (JWT Bearer token)

**Example Call:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://your-domain.com/api/dashboard/overview
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {...},
    "stats": {...},
    "recentAlerts": [...],
    "visibility": {...}
  },
  "timestamp": "2026-05-01T10:30:00Z"
}
```

## Troubleshooting

### Problem: Dashboard shows wrong data
**Solution:** Check that JWT token has correct `role`, `hospitalId`, or `districtId`

### Problem: "Unauthorized" redirect
**Solution:** Verify token is valid and user has assigned scope (hospital/district)

### Problem: Empty stats
**Solution:** Verify user has data in their scope. Check database.

### Problem: API returns 401
**Solution:** Token may have expired. Log in again.

## Files to Review

1. **Implementation Reference**
   - `app/chw/dashboard/page.tsx` - Working example

2. **Helper Functions**
   - `lib/dashboard-helpers.ts` - Role filtering logic

3. **API Endpoint**
   - `app/api/dashboard/overview/route.ts` - Data fetching

4. **Component**
   - `components/DashboardLayout.tsx` - Dashboard wrapper

5. **Documentation**
   - `ROLE_BASED_DASHBOARD_GUIDE.md` - Detailed guide
   - `ROLE_BASED_DASHBOARD_IMPLEMENTATION_SUMMARY.md` - Summary

## Next Actions

- [ ] Review CHW dashboard example implementation
- [ ] Update one more dashboard (Doctor or Hospital Admin)
- [ ] Test data filtering for all roles
- [ ] Deploy to staging
- [ ] Run QA tests
- [ ] Get user feedback
- [ ] Deploy to production

## Questions

Check `ROLE_BASED_DASHBOARD_GUIDE.md` for detailed Q&A section.
