# User Profile Display Feature Guide

## Overview

A personalized user profile dropdown has been added to all dashboards, displaying:
- **User name** with role-specific avatar
- **Signed-in status** indicator
- **User information** (phone, email, role)
- **Quick actions** (Edit Profile, Settings, Sign Out)
- **Current timestamp** for reference

## Components Created

### 1. `UserProfileDropdown.tsx`
Displays user profile in top-right corner with expandable dropdown menu.

**Features:**
- Shows user initials in colored avatar
- Role-specific avatar colors (Doctor=Blue, CHW=Green, Mother=Pink, etc.)
- Displays full user information on dropdown
- Quick action buttons
- Mobile-responsive design
- Click-outside to close
- Auto-logout on Sign Out button

**Props:**
```tsx
interface UserProfileDropdownProps {
  userInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    avatar?: string;
  };
  displayName?: string;      // User's name
  role?: string;              // User's role
  onLogout?: () => void;      // Custom logout handler
}
```

### 2. `DashboardHeader.tsx`
Reusable header component for all dashboards.

**Features:**
- Dashboard title and subtitle
- Facility/location display
- User profile dropdown on right
- Sticky positioning for easy access
- Responsive layout

**Props:**
```tsx
interface DashboardHeaderProps {
  title: string;              // Dashboard title
  subtitle?: string;          // Optional subtitle
  userName?: string;          // User's display name
  userRole?: string;          // User's role
  userPhone?: string;         // User's phone
  userEmail?: string;         // User's email
  facilityName?: string;      // Facility/location name
  onLogout?: () => void;      // Custom logout handler
}
```

## Implementation

### How to Add to a Dashboard

```tsx
import UserProfileDropdown from '@/components/UserProfileDropdown';

export default function MyDashboard() {
  const { logout, username, phone, email } = useAuth();

  return (
    <div>
      {/* Your header */}
      <div className="flex justify-between items-center">
        <h1>Dashboard Title</h1>
        
        {/* Add User Profile */}
        <UserProfileDropdown
          displayName={username}
          role="DOCTOR"  // Set appropriate role
          userInfo={{
            phone: phone,
            email: email,
            name: username,
          }}
          onLogout={logout}
        />
      </div>
      
      {/* Rest of dashboard */}
    </div>
  );
}
```

### Or Use the Header Component

```tsx
import DashboardHeader from '@/components/DashboardHeader';

export default function MyDashboard() {
  const { logout, username, phone, email } = useAuth();

  return (
    <>
      {/* Complete header with profile dropdown */}
      <DashboardHeader
        title="My Dashboard"
        subtitle="Manage your account"
        userName={username}
        userRole="DOCTOR"
        userPhone={phone}
        userEmail={email}
        facilityName="City Hospital"
        onLogout={logout}
      />
      
      {/* Rest of dashboard */}
    </>
  );
}
```

## Updated Dashboards

The following dashboards have been updated with user profile displays:

### 1. CHW Dashboard
- ✅ Updated with `DashboardHeader` component
- ✅ Shows CHW name, role, and facility
- ✅ Profile dropdown with all user info

**Location:** `app/chw/dashboard/page.tsx`

### 2. Community Dashboard (Mother)
- ✅ Updated with `UserProfileDropdown` component
- ✅ Shows mother's name, phone, facility
- ✅ Profile dropdown with all personal info

**Location:** `app/community/dashboard/page.tsx`

## User Profile Dropdown - What's Shown

### Dropdown Header (Avatar Section)
```
[Avatar] John Smith
         Pregnant Mother
```

### User Information Section
- 📧 Email: john@example.com
- 📱 Phone: +256701234567
- 👤 Role: Pregnant Mother
- 📋 Full Name: John Smith

### Menu Actions
- ✏️ Edit Profile
- ⚙️ Settings
- 🚪 Sign Out

### Footer
- ✓ Signed in to MPMATCH
- Current Date & Time

## Role-Specific Colors

The avatar color changes based on user role:

| Role | Color | Hex |
|------|-------|-----|
| COMMUNITY_USER | Pink | #fce7f3 → #831843 |
| CHW | Green | #dcfce7 → #15803d |
| DOCTOR | Blue | #dbeafe → #1e40af |
| NURSE | Purple | #e9d5ff → #7e22ce |
| MIDWIFE | Indigo | #e0e7ff → #4f46e5 |
| DHO | Orange | #fed7aa → #b45309 |
| HOSPITAL_ADMIN | Red | #fee2e2 → #991b1b |
| SYSTEM_ADMIN | Gray | #f3f4f6 → #1f2937 |

## Features

### ✨ Sticky Header
- Header stays at top when scrolling
- Quick access to user profile anytime

### 📱 Mobile Responsive
- On mobile, avatar + chevron shown (name hidden)
- Full display on desktop
- Touch-friendly dropdown

### 🎨 Theme-Aware
- Role-specific avatar colors
- Consistent with app design
- Clear visual hierarchy

### 🔒 Security
- Shows "Signed in to MPMATCH" indicator
- Timestamp for reference
- One-click logout

### ⌚ Auto-Close
- Dropdown closes when clicking outside
- Closes when selecting action
- Keyboard accessible

## Example Usage Scenarios

### Scenario 1: Mother Signs In
```
User sees:
- Header: "My Pregnancy Dashboard"
- User Profile: Showing their name, phone, facility
- Can click to view/edit info or sign out
```

### Scenario 2: Doctor Signs In
```
User sees:
- Header: "Doctor Dashboard"
- User Profile: Blue avatar, "Dr. Smith", Hospital name
- Can access profile settings or sign out
```

### Scenario 3: CHW Signs In
```
User sees:
- Header: "CHW Dashboard"
- User Profile: Green avatar, CHW name, District name
- Can view/edit profile or sign out
```

## Testing Checklist

- [ ] User profile appears in top-right of each dashboard
- [ ] Avatar shows correct initials
- [ ] Avatar color matches user's role
- [ ] Dropdown opens on click
- [ ] All user information displays correctly
- [ ] Edit Profile button is accessible
- [ ] Settings button is accessible
- [ ] Sign Out button logs user out
- [ ] Dropdown closes when clicking outside
- [ ] Mobile layout is responsive
- [ ] Works on all dashboard pages

## Integration Notes

### With Existing Auth System
```tsx
// The UserProfileDropdown uses useAuth hook internally
// It automatically gets user data from:
- username (from JWT token)
- phone (from JWT token)
- email (from JWT token)
- role (from JWT token)
```

### With DashboardLayout
```tsx
// DashboardLayout provides dashboardData
// Pass user info from dashboardData to header:
<DashboardHeader
  userName={dashboardData.user.displayName}
  userRole={dashboardData.user.role}
  // ... other props
/>
```

### With useAuth Hook
```tsx
// Get user info from auth hook
const { username, phone, email, role, logout } = useAuth();

// Pass to UserProfileDropdown
<UserProfileDropdown
  displayName={username}
  role={role}
  userInfo={{ phone, email }}
  onLogout={logout}
/>
```

## Customization

### Change Avatar Colors
Edit `getRoleColor()` function in `UserProfileDropdown.tsx`:
```tsx
const getRoleColor = (userRole: string): string => {
  switch (userRole.toUpperCase()) {
    case 'CUSTOM_ROLE':
      return 'bg-custom-100 text-custom-800';
    // ...
  }
};
```

### Modify Dropdown Menu
Add/remove menu items in `UserProfileDropdown.tsx` menu actions section:
```tsx
<button
  onClick={() => {/* Navigate to custom page */}}
  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
>
  <YourIcon className="w-4 h-4" />
  Your Menu Item
</button>
```

### Customize Header
Modify `DashboardHeader.tsx` layout or styling:
```tsx
// Change colors, spacing, or add additional sections
```

## Future Enhancements

Potential features to add:
- [ ] Profile picture/avatar image upload
- [ ] Quick status indicator (online/offline)
- [ ] Notification badge count
- [ ] Theme switcher in dropdown
- [ ] Language selector
- [ ] Help/Support link
- [ ] Change password option
- [ ] Activity log link

## Troubleshooting

### Profile dropdown doesn't appear
- Check that `UserProfileDropdown` is imported
- Verify user is authenticated
- Check browser console for errors

### Avatar colors wrong
- Verify `role` prop is passed correctly
- Check role name spelling matches switch statement
- Clear browser cache

### User info shows "N/A"
- Check JWT token contains phone/email
- Verify useAuth hook is providing data
- Inspect browser console for data

### Logout not working
- Verify `logout` function is passed to component
- Check that logout redirects to `/sign-in`
- Test logout manually in browser

## Summary

The user profile feature provides:
- ✅ Personalized dashboard experience
- ✅ Quick access to user information
- ✅ Role-based visual identification
- ✅ One-click logout
- ✅ Mobile-responsive design
- ✅ Professional appearance

Users now see their profile in the top-right corner with all their information readily accessible!
