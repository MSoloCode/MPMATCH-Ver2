# requireRole() Middleware Factory - Implementation Guide

## Overview

The `requireRole(...roles)` middleware factory is a Next.js API route decorator that enforces role-based access control with automatic tenant scoping validation. It handles authentication, authorization, and scope validation in a single function.

## Key Features

✅ **Dual Pattern Support** - Works with both modern `NextRequest`/`NextResponse` and legacy `(req, res)` patterns  
✅ **Automatic Token Extraction** - Reads Bearer token from Authorization header or `mpmatch_token` cookie  
✅ **Role-Based Access Control** - Checks if user's role is in the allowed list  
✅ **Tenant Scope Validation** - Ensures user has required scoping fields (hospitalId, districtId, motherId)  
✅ **User Payload Attachment** - Decodes JWT and attaches to `req.user` or `request.user`  
✅ **Consistent Error Responses** - Returns 401 (unauthorized), 403 (forbidden), or 500 (server error)

## Signature

```typescript
export function requireRole(...allowedRoles: string[]): (handler) => handler;
```

## Usage Patterns

### Modern Pattern (Recommended)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getTenantScopingFilter } from '@/lib/rbac';

export default requireRole('DOCTOR', 'NURSE')(
  async (request: NextRequest) => {
    // request.user is already populated and verified
    const user = (request as any).user;
    
    // Get tenant filter for this user's role
    const scopeFilter = getTenantScopingFilter(user);
    
    // CRITICAL: Apply scope filter to queries
    const pregnancies = await db.pregnancy.findMany({
      where: {
        ...scopeFilter,  // Applies { hospitalId: user.hospitalId } for DOCTOR/NURSE/MIDWIFE
        status: 'ACTIVE',
      },
    });
    
    return NextResponse.json({ success: true, data: pregnancies });
  }
);
```

### Legacy Pattern

```typescript
import { requireRole, getTenantScopingFilter } from '@/lib/rbac';

export default requireRole('HOSPITAL_ADMIN')(
  async (req: any, res: any) => {
    // req.user is already populated and verified
    const user = req.user;
    
    const scopeFilter = getTenantScopingFilter(user);
    
    const users = await db.user.findMany({
      where: { ...scopeFilter },
    });
    
    res.status(200).json({ success: true, data: users });
  }
);
```

## request.user Structure

After middleware validation, the request object contains a `user` property with the decoded JWT payload:

```typescript
interface ScopedUserPayload {
  userId?: number;        // User ID from database
  role: string;           // SYSTEM_ADMIN, HOSPITAL_ADMIN, DOCTOR, NURSE, MIDWIFE, DHO, ORG_ADMIN, CHW, AMBULANCE_MANAGER, COMMUNITY_USER
  hospitalId?: number;    // Required for: HOSPITAL_ADMIN, DOCTOR, NURSE, MIDWIFE
  districtId?: number;    // Required for: ORG_ADMIN, DHO, CHW, AMBULANCE_MANAGER
  motherId?: number;      // Required for: COMMUNITY_USER
  countryId?: number;     // Optional
  phone?: string;         // Optional
  iat?: number;           // Issued at (Unix timestamp)
  exp?: number;           // Expiration (Unix timestamp)
}
```

## Error Responses

### 401 Unauthorized

**When**: Token is missing, invalid, or expired

```json
{
  "success": false,
  "error": "Unauthorized - missing or invalid token"
}
```

**Response Code**: 401

### 403 Forbidden - Insufficient Permissions

**When**: Token is valid, but user's role is not in allowed roles list

```json
{
  "success": false,
  "error": "Insufficient permissions"
}
```

**Response Code**: 403

**Example**: Endpoint requires `DOCTOR` but user has `NURSE` role

### 403 Forbidden - Invalid Tenant Scope

**When**: Token is valid and role is allowed, but user is missing required scoping field

```json
{
  "success": false,
  "error": "Invalid tenant scope: hospitalId required"
}
```

**Response Code**: 403

**Example**: User with `DOCTOR` role is missing `hospitalId` in JWT token (malformed token)

## CRITICAL: Tenant Scoping is Manual

⚠️ **The middleware validates tenant scope but does NOT automatically enforce it at the query level.** You must manually apply `getTenantScopingFilter()` to all Prisma queries.

### How to Apply Scoping

```typescript
import { getTenantScopingFilter } from '@/lib/rbac';

export default requireRole('DOCTOR')(
  async (request: NextRequest) => {
    const user = (request as any).user;
    
    // Get the scoping filter based on user's role
    const scopeFilter = getTenantScopingFilter(user);
    // For DOCTOR: { hospitalId: user.hospitalId }
    // For DHO: { districtId: user.districtId }
    // For SYSTEM_ADMIN: {}
    
    // Apply to queries with spread operator
    const result = await db.pregnancy.findMany({
      where: {
        ...scopeFilter,
        status: 'ACTIVE',
      },
    });
    
    return NextResponse.json({ success: true, data: result });
  }
);
```

### Special Case: COMMUNITY_USER

COMMUNITY_USER cannot be scoped using the normal `getTenantScopingFilter()` because their scoping field (`motherId`) is not a standard tenant field on all resources. Handle them explicitly:

```typescript
const user = (request as any).user;

if (user.role === 'COMMUNITY_USER') {
  // COMMUNITY_USER: Filter by motherId explicitly
  const myData = await db.pregnancy.findFirst({
    where: {
      motherId: user.motherId,
      id: pregnancyId,
    },
  });
} else {
  // Other roles: Use standard tenant scoping
  const scopeFilter = getTenantScopingFilter(user);
  const data = await db.data.findMany({
    where: { ...scopeFilter },
  });
}
```

## Role & Scoping Matrix

| Role | Scoping Field | Allowed Actions |
|------|---------------|-----------------|
| SYSTEM_ADMIN | None (unrestricted) | All resources, all actions |
| HOSPITAL_ADMIN | `hospitalId` | Full CRUD within hospital |
| DOCTOR | `hospitalId` | Create/Read/Update clinical data |
| MIDWIFE | `hospitalId` | Create/Read/Update ANC data |
| NURSE | `hospitalId` | Read/Create vitals and symptoms |
| DHO | `districtId` | Read-only across district |
| ORG_ADMIN | `districtId` | Read-only across district |
| CHW | `districtId` | Read/Update community data |
| AMBULANCE_MANAGER | `districtId` | Manage alerts and responses |
| COMMUNITY_USER | `motherId` | Own pregnancy and records only |

## Testing the Middleware

### Test Routes

Two test endpoints are provided to verify the middleware:

1. **Modern Pattern**: `GET /api/test-rbac-modern`
   - Requires: `DOCTOR`, `NURSE`, or `MIDWIFE`
   - Usage:
     ```bash
     curl -H "Authorization: Bearer <token>" http://localhost:3000/api/test-rbac-modern
     ```

2. **Legacy Pattern**: `GET /api/test-rbac-legacy`
   - Requires: `HOSPITAL_ADMIN`
   - Usage:
     ```bash
     curl -H "Authorization: Bearer <token>" http://localhost:3000/api/test-rbac-legacy
     ```

### Manual Testing

```bash
# Test with valid DOCTOR token (should return 200)
curl -H "Authorization: Bearer <valid_doctor_token>" http://localhost:3000/api/test-rbac-modern

# Test with invalid token (should return 401)
curl -H "Authorization: Bearer invalid_token" http://localhost:3000/api/test-rbac-modern

# Test with wrong role (should return 403)
curl -H "Authorization: Bearer <hospital_admin_token>" http://localhost:3000/api/test-rbac-modern

# Test without token (should return 401)
curl http://localhost:3000/api/test-rbac-modern
```

## Implementation Checklist

When implementing `requireRole()` in your API routes:

- [ ] Import `requireRole` and `getTenantScopingFilter` from `/lib/rbac`
- [ ] Wrap your handler with `requireRole(...allowedRoles)`
- [ ] List all allowed roles for this endpoint
- [ ] Access user via `request.user` (modern) or `req.user` (legacy)
- [ ] Call `getTenantScopingFilter(user)` to get scoping rules
- [ ] Apply scope filter to ALL Prisma queries using spread operator
- [ ] Handle COMMUNITY_USER as special case (filter by motherId)
- [ ] Test with tokens for each allowed role
- [ ] Test with tokens for disallowed roles (should return 403)
- [ ] Test without token (should return 401)

## Common Patterns

### Paginated Query with Scoping

```typescript
export default requireRole('DOCTOR', 'NURSE')(
  async (request: NextRequest) => {
    const user = (request as any).user;
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = 10;
    
    const scopeFilter = getTenantScopingFilter(user);
    
    const [data, total] = await Promise.all([
      db.pregnancy.findMany({
        where: { ...scopeFilter },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.pregnancy.count({
        where: { ...scopeFilter },
      }),
    ]);
    
    return NextResponse.json({
      success: true,
      data,
      pagination: { page, pageSize, total },
    });
  }
);
```

### Complex WHERE Clause with Scoping

When combining scope with OR conditions, use AND explicitly:

```typescript
const scopeFilter = getTenantScopingFilter(user);

const results = await db.pregnancy.findMany({
  where: {
    AND: [
      scopeFilter,  // Scope first
      {
        OR: [
          { status: 'HIGH_RISK' },
          { isComplicated: true },
        ],
      },
    ],
  },
});
```

### Checking Scoping Field

Use `getTenantScopingField()` for debugging and logging:

```typescript
import { getTenantScopingField } from '@/lib/rbac';

const user = (request as any).user;
const scopingField = getTenantScopingField(user);

console.log(`User scoped to ${scopingField}: ${user[scopingField]}`);
```

## Token Format Requirements

Tokens must be signed with `JWT_SECRET` environment variable using `HS256` algorithm. Sign tokens with the appropriate fields:

```typescript
import { signToken, signTokenWithExpiry } from '@/lib/auth';

// For DOCTOR/NURSE/MIDWIFE (8h expiry)
const token = signTokenWithExpiry({
  userId: 42,
  role: 'DOCTOR',
  hospitalId: 5,
  districtId: 1,
  countryId: 1,
  phone: '+254712345678',
}, 'DOCTOR');

// For other roles (24h expiry)
const token = signToken({
  userId: 10,
  role: 'HOSPITAL_ADMIN',
  hospitalId: 5,
  countryId: 1,
});
```

## Troubleshooting

**Problem**: "Invalid tenant scope: hospitalId required"
- **Cause**: Token is missing `hospitalId` field for a DOCTOR/NURSE/MIDWIFE/HOSPITAL_ADMIN role
- **Solution**: Ensure token includes `hospitalId` when signing for these roles

**Problem**: "Insufficient permissions"
- **Cause**: User's role is not in the `allowedRoles` list
- **Solution**: Verify the role in the endpoint's `requireRole()` call matches the user's role

**Problem**: "Unauthorized - missing or invalid token"
- **Cause**: Token is missing, malformed, expired, or signed with wrong secret
- **Solution**: Verify token is in Authorization header as `Bearer <token>` or in `mpmatch_token` cookie, and JWT_SECRET matches

**Problem**: Data leaking across tenants
- **Cause**: Forgot to apply `getTenantScopingFilter()` to a Prisma query
- **Solution**: Add `where: { ...getTenantScopingFilter(user), ... }` to all queries in your handler

## Best Practices

✅ **DO**: Apply `getTenantScopingFilter()` to ALL Prisma queries  
✅ **DO**: Test each endpoint with different roles to verify scoping  
✅ **DO**: Handle COMMUNITY_USER as special case (explicit motherId check)  
✅ **DO**: Use role names from the `ROLE_PERMISSIONS` constant  
✅ **DO**: Log which scoping filter was applied for debugging

❌ **DON'T**: Forget to apply scope filter (data breach risk!)  
❌ **DON'T**: Mix scoped and unscoped queries in same handler  
❌ **DON'T**: Assume COMMUNITY_USER works with normal scoping  
❌ **DON'T**: Catch and ignore ForbiddenError from `assertValidTenantScope()`  
❌ **DON'T**: Create endpoints that should be restricted without `requireRole()`
