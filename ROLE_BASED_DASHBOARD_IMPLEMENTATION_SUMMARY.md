# Role-Based Dashboard Implementation - Summary

## Problem Solved
Users signing in now see personalized dashboards with **only the data relevant to their role**:
- A **Mother** sees only their own pregnancy data
- A **CHW** sees mothers from their assigned district only
- A **Doctor** sees patients from their assigned hospital only
- A **DHO** sees district-wide data and statistics
- An **Admin** sees global data based on their scope

## What Was Created

### 1. **Dashboard Helper Library** (`lib/dashboard-helpers.ts`)
Utility functions for role-based data filtering:
- `extractDashboardContext()` - Normalize user info
- `getDataVisibilityRules()` - What each role can see
- `getMothersFilter()` - Filter mothers by role/scope
- `getAppointmentsFilter()` - Filter appointments by role/scope
- `getAlertsFilter()` - Filter alerts by role/scope
- `getDashboardTitle()` & `getRoleDescription()` - Role-specific text

### 2. **Unified Dashboard API** (`app/api/dashboard/overview/route.ts`)
Single endpoint that returns role-specific data:
- Authenticates user via JWT
- Applies role-based filtering automatically
- Returns: stats, alerts, appointments, high-risk cases, visibility rules
- Response tailored to user's role and facility/district scope

**Example Response for CHW:**
```json
{
  "success": true,
  "data": {
    "user": {
      "role": "CHW",
      "displayName": "John",
      "facilityInfo": { "name": "Kampala District", "id": 1 }
    },
    "stats": {
      "totalMothers": 45,
      "activePregnancies": 38,
      "highRiskPregnancies": 5,
      "openAlerts": 3,
      "upcomingAppointments": 12
    },
    "recentAlerts": [...],
    "visibility": {
      "canSeeMothers": "district",
      "canSeeAlerts": "district",
      "canSeeGlobalStats": false
    }
  }
}
```

### 3. **DashboardLayout Component** (`components/DashboardLayout.tsx`)
Reusable wrapper for all dashboard pages:
- Verifies authentication and role
- Fetches role-specific data from `/api/dashboard/overview`
- Handles loading/error states
- Auto-refreshes every 60 seconds
- Passes data to child components

**Usage:**
```tsx
export default function MyDashboard() {
  return (
    <DashboardLayout requiredRole="CHW">
      <DashboardContent />
    </DashboardLayout>
  );
}
```

### 4. **Updated CHW Dashboard** (Demonstration)
Updated `/app/chw/dashboard/page.tsx` to show the pattern:
- Uses `DashboardLayout` for role protection
- Displays role-specific KPI cards
- Shows only data visible to CHWs (district scope)
- Includes recent alerts, high-risk cases, upcoming appointments
- Automatic data filtering based on user's scope

## Data Filtering by Role

### COMMUNITY_USER (Mother)
```
Can see: Only their own data
Filter: WHERE id = motherId
Example: Only their pregnancies, appointments, vitals
```

### CHW
```
Can see: Mothers in assigned district
Filter: WHERE facility.district.id = districtId
Example: All mothers in Kampala district, their alerts, appointments
```

### DOCTOR/NURSE/MIDWIFE
```
Can see: Patients in assigned hospital
Filter: WHERE facility.hospitals.id = hospitalId
Example: Hospital patients, hospital-scoped alerts
```

### DHO (District Health Officer)
```
Can see: All data in district + statistics
Filter: WHERE facility.district.id = districtId
Includes: Global stats for their district
```

### HOSPITAL_ADMIN
```
Can see: All hospital data + staff + statistics
Filter: WHERE facility.hospitals.id = hospitalId
Includes: Global stats for their hospital
```

### SYSTEM_ADMIN
```
Can see: Everything globally
Filter: None (no restrictions)
Includes: All global statistics, user management
```

## How It Works

1. **User Signs In**
   - System validates credentials
   - JWT token created with role + scope (hospitalId/districtId)

2. **User Visits Dashboard**
   - `DashboardLayout` verifies token + role
   - If unauthorized → redirect to `/sign-in` or `/unauthorised`

3. **Dashboard Fetches Data**
   - Calls `/api/dashboard/overview` with JWT token
   - API automatically applies role-based filters
   - Returns only visible data

4. **Dashboard Renders**
   - Components use filtered data
   - Only shows UI sections relevant to user's role
   - Example: Only admins see "User Management"

5. **Data Auto-Refreshes**
   - Every 60 seconds, dashboard re-fetches data
   - User always sees current information

## Implementation Steps to Migrate Existing Dashboards

### For Each Dashboard Page:

1. **Import Required Components**
```tsx
import DashboardLayout, { DashboardData } from '@/components/DashboardLayout';
```

2. **Create Content Component**
```tsx
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
  // Use dashboardData.stats, dashboardData.recentAlerts, etc.
}
```

3. **Wrap with DashboardLayout**
```tsx
export default function DoctorDashboard() {
  return (
    <DashboardLayout requiredRole="DOCTOR">
      <DoctorDashboardContent />
    </DashboardLayout>
  );
}
```

4. **Use Dashboard Data in JSX**
```tsx
{dashboardData?.stats.activePregnancies} // Shows only hospital patients
{dashboardData?.visibility.canSeeGlobalStats && <GlobalStats />}
```

## Example Dashboards to Update

Priority order:
1. ✅ **CHW Dashboard** - DONE (reference implementation)
2. ⏳ **Doctor Dashboard** - Similar pattern, hospital-scoped
3. ⏳ **Midwife/Nurse Dashboard** - Similar to doctor
4. ⏳ **DHO Dashboard** - District-scoped
5. ⏳ **Hospital Admin Dashboard** - Hospital + staff management
6. ⏳ **System Admin Dashboard** - Global scope
7. ⏳ **Community Dashboard** - Mother-specific (most complex)
8. ⏳ **Ambulance Manager Dashboard** - District-scoped

## Key Benefits

✅ **Security**: Users can't see data from other roles/facilities
✅ **Simplicity**: No manual permission checks needed
✅ **Consistency**: All dashboards use same data structure
✅ **Performance**: Optimized queries with filtering at database level
✅ **Maintainability**: Single source of truth for role rules
✅ **Scalability**: Easy to add new roles with new visibility rules
✅ **Testing**: Can test each role's data visibility separately

## Testing Checklist

### Test Each Role:

- [ ] **Mother** - Can only see their own pregnancy/appointments
- [ ] **Mother** - Cannot see other mothers' data
- [ ] **CHW** - Can only see mothers from their district
- [ ] **CHW** - Cannot see mothers from other districts
- [ ] **Doctor** - Can only see hospital patients
- [ ] **Doctor** - Cannot see patients from other hospitals
- [ ] **DHO** - Can see all district data
- [ ] **DHO** - Cannot see other districts' data
- [ ] **Admin** - Can see all data globally
- [ ] **Redirect** - Unauthorized role redirects to /unauthorised
- [ ] **Token** - Expired token redirects to /sign-in
- [ ] **Stats** - Stats only show visible data counts
- [ ] **Alerts** - Alerts filtered by role scope
- [ ] **Appointments** - Appointments filtered by role scope
- [ ] **High-Risk** - High-risk cases filtered by scope

## Files Created/Modified

### Created:
- `lib/dashboard-helpers.ts` - Role-based filtering utilities
- `app/api/dashboard/overview/route.ts` - Unified dashboard API
- `components/DashboardLayout.tsx` - Dashboard wrapper component
- `ROLE_BASED_DASHBOARD_GUIDE.md` - Detailed implementation guide

### Modified:
- `app/chw/dashboard/page.tsx` - Reference implementation

### To Be Updated:
- `app/clinical/doctor/page.tsx`
- `app/clinical/nurse/page.tsx`
- `app/clinical/midwife/page.tsx`
- `app/dho/dashboard/page.tsx`
- `app/hospital/dashboard/page.tsx`
- `app/admin/dashboard/page.tsx`
- `app/community/dashboard/page.tsx`
- `app/ambulance/dashboard/page.tsx`

## Database Queries Optimized

All queries use:
- ✅ Index lookups (hospitalId, districtId, motherId)
- ✅ Efficient COUNT for statistics
- ✅ Proper Prisma includes (no N+1 queries)
- ✅ Pagination for list data (top 5 records)
- ✅ 60-second cache on client

Performance impact: **Minimal** (same queries as before, with filters)

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Missing JWT token | Redirects to `/sign-in` |
| Expired JWT token | Redirects to `/sign-in` |
| Wrong role | Redirects to `/unauthorised` |
| API error | Shows error message with "Try Again" |
| Network error | Shows error message with "Try Again" |
| Empty data | Shows empty state (e.g., "No alerts") |

## Next Steps

1. **Update All Dashboards** - Apply same pattern to remaining dashboard pages
2. **Test Each Role** - Verify data filtering for all 10 roles
3. **Monitor Performance** - Track API response times
4. **Gather Feedback** - Get user feedback on visible data
5. **Iterate** - Adjust visibility rules based on feedback

## Questions?

### Q: Can I customize what each role sees?
**A:** Yes! Edit `getDataVisibilityRules()` in `lib/dashboard-helpers.ts`

### Q: How do I add a new role?
**A:** Add it to the switch statement in all helper functions

### Q: Will this work with existing API endpoints?
**A:** Yes! The dashboard API uses the same data as existing endpoints

### Q: Can I cache the dashboard data?
**A:** Yes! Currently set to 60-second auto-refresh, can customize

### Q: What if a user changes their hospital/district?
**A:** Update JWT token in next login, data automatically updates
