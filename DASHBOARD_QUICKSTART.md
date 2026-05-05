# Dashboard Implementation Quick Start Guide

**For Developers**: How to integrate the new dashboard system into your pages

---

## Quick Navigation

1. **For Community Users** → Section A
2. **For Clinical Staff** → Section B
3. **For Administrators** → Section C
4. **For Advanced Usage** → Section D

---

## Section A: Community User Dashboard

### Goal
Display an attractive dashboard for pregnant mothers with their profile and available functions.

### Implementation (Copy & Paste)

```typescript
'use client';

import { useAuth } from '@/hooks/useAuth';
import UserProfileCard from '@/components/UserProfileCard';
import FeatureMenu from '@/components/FeatureMenu';

export default function CommunityDashboard() {
  const { isAuthenticated, username, phone, role } = useAuth();

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-pink-600 to-pink-800 text-white py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold">Welcome, {username}! 👋</h1>
          <p className="text-pink-100 mt-2">Your maternal health dashboard</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Profile Card */}
        <UserProfileCard
          name={username}
          phone={phone}
          role={role}
          showEditButton={true}
        />

        {/* Features */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            My Functions
          </h2>
          <p className="text-gray-600 mb-6">
            Quick access to all tools and features you need:
          </p>
          <FeatureMenu role={role} displayMode="grid" />
        </div>
      </div>
    </div>
  );
}
```

### Result
- Profile card at top
- 6 feature buttons in a responsive grid
- Edit profile link
- Mobile-friendly

---

## Section B: Clinical Staff Dashboard (Doctor/Nurse/Midwife)

### Goal
Display clinical dashboard with statistics, profile, and available clinical functions.

### Implementation (Simple)

```typescript
'use client';

import EnhancedDashboard from '@/components/EnhancedDashboard';
import { useAuth } from '@/hooks/useAuth';
import { Users, Heart, AlertCircle, Calendar } from 'lucide-react';

export default function DoctorDashboard() {
  const { role } = useAuth();

  // Your statistics data
  const stats = [
    {
      label: 'Total Mothers',
      value: 156,
      icon: <Users />,
      color: 'bg-blue-50',
    },
    {
      label: 'Active Pregnancies',
      value: 89,
      icon: <Heart />,
      color: 'bg-pink-50',
    },
    {
      label: 'High-Risk Cases',
      value: 12,
      icon: <AlertCircle />,
      color: 'bg-red-50',
    },
    {
      label: 'Upcoming Appointments',
      value: 23,
      icon: <Calendar />,
      color: 'bg-green-50',
    },
  ];

  return (
    <EnhancedDashboard
      title={`${role} Dashboard`}
      description="Manage your patients and clinical operations"
      stats={stats}
      showFeatureMenu={true}
      showUserCard={true}
    >
      {/* Your additional dashboard content here */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold mb-4">Recent Activities</h3>
        {/* Add charts, tables, etc. */}
      </div>
    </EnhancedDashboard>
  );
}
```

### Result
- Beautiful gradient header
- Statistics cards at top
- User profile section
- Feature menu below
- All mobile-responsive

---

## Section C: Administrator Dashboard

### Goal
Display admin dashboard with management functions.

### Implementation (Simple)

```typescript
'use client';

import EnhancedDashboard from '@/components/EnhancedDashboard';
import { useAuth } from '@/hooks/useAuth';
import { Settings, Users, Building2 } from 'lucide-react';

export default function AdminDashboard() {
  const { role } = useAuth();

  const stats = [
    { label: 'Total Users', value: 1203, icon: <Users />, color: 'bg-blue-50' },
    { label: 'Active Facilities', value: 45, icon: <Building2 />, color: 'bg-green-50' },
    { label: 'System Status', value: 'Online', icon: <Settings />, color: 'bg-purple-50' },
  ];

  return (
    <EnhancedDashboard
      title={`${role} - System Administration`}
      description="Manage MPMATCH system configuration and users"
      stats={stats}
      showFeatureMenu={true}
    />
  );
}
```

---

## Section D: Advanced Usage

### A. Using Feature Menu Standalone

```typescript
import FeatureMenu from '@/components/FeatureMenu';

export default function FeaturePage() {
  return (
    <div className="p-6">
      {/* List view instead of grid */}
      <FeatureMenu
        role="DOCTOR"
        displayMode="list"
        onNavigate={(href) => console.log('Navigating to:', href)}
      />
    </div>
  );
}
```

### B. Using User Profile Card with Custom Data

```typescript
import UserProfileCard from '@/components/UserProfileCard';

export default function ProfileSection() {
  const handleCustomEdit = () => {
    console.log('Custom edit logic here');
  };

  return (
    <UserProfileCard
      name="Dr. Jane Smith"
      email="jane@hospital.com"
      phone="+256701234567"
      role="MIDWIFE"
      joinDate="January 15, 2026"
      location="Kampala District"
      onEditClick={handleCustomEdit}
      showEditButton={true}
    />
  );
}
```

### C. Using Personal Info Form

```typescript
'use client';

import PersonalInfoForm from '@/components/PersonalInfoForm';

export default function EditPage() {
  const handleSuccess = () => {
    console.log('Profile updated!');
    // Redirect, show message, etc.
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Edit Your Profile</h1>
        <PersonalInfoForm
          onSuccess={handleSuccess}
          redirectOnSuccess={true}
        />
      </div>
    </div>
  );
}
```

---

## Common Patterns

### Pattern 1: Redirect to Profile on Edit Button Click

```typescript
import { useRouter } from 'next/navigation';
import UserProfileCard from '@/components/UserProfileCard';

export default function MyPage() {
  const router = useRouter();

  return (
    <UserProfileCard
      name="User Name"
      onEditClick={() => router.push('/profile/edit')}
      showEditButton={true}
    />
  );
}
```

### Pattern 2: Show Different Features for Different Roles

```typescript
import FeatureMenu from '@/components/FeatureMenu';
import { useAuth } from '@/hooks/useAuth';

export default function FeaturesPage() {
  const { role } = useAuth();

  return (
    <div>
      {role === 'DOCTOR' && (
        <FeatureMenu role="DOCTOR" displayMode="grid" />
      )}
      {role === 'COMMUNITY_USER' && (
        <FeatureMenu role="COMMUNITY_USER" displayMode="list" />
      )}
    </div>
  );
}
```

### Pattern 3: Stats Dashboard

```typescript
import EnhancedDashboard from '@/components/EnhancedDashboard';
import { BarChart3, TrendingUp } from 'lucide-react';

export default function StatsDashboard() {
  return (
    <EnhancedDashboard
      title="Statistics Dashboard"
      stats={[
        { label: 'Metric 1', value: 100, icon: <BarChart3 />, color: 'bg-blue-50' },
        { label: 'Metric 2', value: 250, icon: <TrendingUp />, color: 'bg-green-50' },
      ]}
      showFeatureMenu={true}
    />
  );
}
```

---

## API Usage Examples

### Get User Profile

```typescript
const response = await fetch('/api/users/profile', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

const result = await response.json();
console.log(result.data.user);  // User info
console.log(result.data.mother); // Mother info (if COMMUNITY_USER)
```

### Update User Profile

```typescript
const response = await fetch('/api/users/profile', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'New Name',
    phone: '+256701234567',
  }),
});

const result = await response.json();
console.log(result.data); // Updated user
```

### Update Mother Profile (COMMUNITY_USER only)

```typescript
const response = await fetch('/api/mothers/me', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    fullName: 'Jane Doe',
    dob: '1995-05-15',
    village: 'Bukoto',
  }),
});

const result = await response.json();
console.log(result.data); // Updated mother
```

---

## Component Props Reference

### FeatureMenu Props
```typescript
{
  role: "DOCTOR" | "NURSE" | "MIDWIFE" | "COMMUNITY_USER" | "CHW" | "DHO" | "HOSPITAL_ADMIN" | "SYSTEM_ADMIN",
  onNavigate?: (href: string) => void,
  displayMode?: "grid" | "list",
}
```

### UserProfileCard Props
```typescript
{
  name?: string,
  email?: string,
  phone?: string,
  role?: string,
  joinDate?: string,
  location?: string,
  onEditClick?: () => void,
  showEditButton?: boolean,
}
```

### PersonalInfoForm Props
```typescript
{
  onSuccess?: () => void,
  redirectOnSuccess?: boolean,
}
```

### EnhancedDashboard Props
```typescript
{
  title: string,
  description?: string,
  children?: ReactNode,
  showFeatureMenu?: boolean,
  showUserCard?: boolean,
  stats?: Array<{
    label: string,
    value: string | number,
    icon: ReactNode,
    color: string,
  }>,
  userInfo?: {
    name?: string,
    email?: string,
    phone?: string,
    joinDate?: string,
    location?: string,
  },
}
```

---

## Styling Customization

### Change Hero Color

```typescript
{/* Change from pink to blue */}
<div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-8">
```

### Adjust Grid Columns

```typescript
{/* Default: 1 mobile, 2 tablet, 3 desktop */}
<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
```

### Custom Button Styling

```typescript
<button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg">
  Custom Button
</button>
```

---

## Troubleshooting

### Issue: Components not rendering
**Solution**: Ensure component files are in `/components/` directory

### Issue: API returns 401
**Solution**: Check that JWT token is being passed in Authorization header

### Issue: Features not showing
**Solution**: Verify role is one of the 8 supported roles

### Issue: Immutable field error
**Solution**: Cannot update role, email, or phone (for clinical staff) - remove from PATCH request

### Issue: Redirect loop
**Solution**: Ensure authentication is complete before accessing protected pages

---

## File Checklist Before Deployment

```
✓ /components/FeatureMenu.tsx exists
✓ /components/UserProfileCard.tsx exists
✓ /components/PersonalInfoForm.tsx exists
✓ /components/EnhancedDashboard.tsx exists
✓ /app/profile/page.tsx exists
✓ /app/profile/edit/page.tsx exists
✓ /app/api/users/profile/route.ts exists
✓ UserProfileDropdown.tsx updated with profile links
✓ All database models have required fields
✓ Prisma migrations applied
✓ Tests passing
✓ Build successful (npm run build)
```

---

## Next Steps

1. Choose your dashboard type (Community/Clinical/Admin)
2. Copy the implementation code from above
3. Customize colors, stats, and layout
4. Test locally
5. Deploy to production

---

## Support Resources

- **Full Documentation**: See `DASHBOARD_IMPROVEMENT_GUIDE.md`
- **Implementation Summary**: See `DASHBOARD_IMPLEMENTATION_SUMMARY.md`
- **Component JSDoc**: Check component files for detailed comments
- **API Tests**: Test endpoints with curl or Postman

---

**Happy Dashboard Building! 🚀**
