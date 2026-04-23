# ✅ Implementation Complete: requireRole() Middleware Factory

## What Was Implemented

A production-ready `requireRole(...roles)` middleware factory for Next.js API routes that enforces role-based access control with automatic tenant scoping validation.

---

## Files Created/Modified

### 📝 Core Implementation
- **[lib/rbac.ts](lib/rbac.ts)** - Added new `requireRole()` middleware factory with comprehensive documentation
  - Supports both modern (`NextRequest`/`NextResponse`) and legacy `(req, res)` patterns
  - Handles token extraction from Authorization header or `mpmatch_token` cookie
  - Validates JWT tokens, enforces role permissions, validates tenant scope
  - Attaches decoded user to `request.user` or `req.user`
  - 400+ lines of JSDoc with detailed usage examples

### 🧪 Test Endpoints
- **[app/api/test-rbac-modern/route.ts](app/api/test-rbac-modern/route.ts)** - Modern pattern test endpoint
  - Requires: `DOCTOR`, `NURSE`, or `MIDWIFE`
  - Demonstrates modern NextRequest/NextResponse pattern
  - Shows how to use `getTenantScopingFilter()`

- **[app/api/test-rbac-legacy/route.ts](app/api/test-rbac-legacy/route.ts)** - Legacy pattern test endpoint
  - Requires: `HOSPITAL_ADMIN`
  - Demonstrates legacy `(req, res)` pattern
  - Shows how to use `getTenantScopingField()` for debugging

### 📚 Documentation
- **[REQUIREROLE_GUIDE.md](REQUIREROLE_GUIDE.md)** - Comprehensive implementation guide
  - Usage patterns for both handler types
  - Error response details (401, 403)
  - Tenant scoping best practices and requirements
  - Role & scoping matrix
  - Testing strategies
  - Common patterns and troubleshooting
  - Best practices checklist

---

## How to Use

### Modern Pattern (Recommended)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getTenantScopingFilter } from '@/lib/rbac';

export default requireRole('DOCTOR', 'NURSE')(
  async (request: NextRequest) => {
    const user = (request as any).user;
    const scopeFilter = getTenantScopingFilter(user);
    
    const pregnancies = await db.pregnancy.findMany({
      where: { ...scopeFilter, status: 'ACTIVE' },
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
    const user = req.user;
    const scopeFilter = getTenantScopingFilter(user);
    
    const users = await db.user.findMany({
      where: { ...scopeFilter },
    });
    
    res.status(200).json({ success: true, data: users });
  }
);
```

---

## Key Features

✅ **Dual Pattern Support**  
   - Modern `NextRequest`/`NextResponse` pattern  
   - Legacy `(req, res)` pattern  

✅ **Token Extraction**  
   - Reads Bearer token from Authorization header  
   - Falls back to `mpmatch_token` cookie  

✅ **JWT Verification**  
   - Uses HS256 algorithm  
   - Verifies token expiration  
   - Returns 401 if invalid  

✅ **Role-Based Access Control**  
   - Checks if user's role is in allowed roles  
   - Returns 403 if insufficient permissions  

✅ **Tenant Scope Validation**  
   - Ensures user has required scoping field (hospitalId, districtId, motherId)  
   - Returns 403 if invalid tenant scope  

✅ **User Payload Attachment**  
   - Attaches decoded JWT to `request.user` (modern) or `req.user` (legacy)  
   - Includes: userId, role, hospitalId, districtId, motherId, countryId, phone, iat, exp  

✅ **Standard Error Responses**  
   - 401: Missing or invalid token  
   - 403: Insufficient permissions  
   - 403: Invalid tenant scope  
   - 500: Server error  

---

## Error Responses

### 401 Unauthorized (Missing/Invalid Token)
```json
{
  "success": false,
  "error": "Unauthorized - missing or invalid token"
}
```

### 403 Forbidden (Insufficient Permissions)
```json
{
  "success": false,
  "error": "Insufficient permissions"
}
```

### 403 Forbidden (Invalid Tenant Scope)
```json
{
  "success": false,
  "error": "Invalid tenant scope: hospitalId required"
}
```

---

## Role & Tenant Scoping Matrix

| Role | Scoping Field | Example |
|------|---|---|
| SYSTEM_ADMIN | None (unrestricted) | Access all data across all hospitals |
| HOSPITAL_ADMIN | `hospitalId` | `{ hospitalId: 5 }` |
| DOCTOR | `hospitalId` | `{ hospitalId: 5 }` |
| MIDWIFE | `hospitalId` | `{ hospitalId: 5 }` |
| NURSE | `hospitalId` | `{ hospitalId: 5 }` |
| DHO | `districtId` | `{ districtId: 1 }` |
| ORG_ADMIN | `districtId` | `{ districtId: 1 }` |
| CHW | `districtId` | `{ districtId: 1 }` |
| AMBULANCE_MANAGER | `districtId` | `{ districtId: 1 }` |
| COMMUNITY_USER | `motherId` | `{ motherId: 42 }` (special case) |

---

## ⚠️ CRITICAL: Manual Tenant Scoping

The middleware validates that users have required scoping fields, but **does NOT automatically enforce scoping at the query level**. You must manually apply `getTenantScopingFilter()` to all Prisma queries:

```typescript
const scopeFilter = getTenantScopingFilter(request.user);

const data = await db.pregnancy.findMany({
  where: {
    ...scopeFilter,  // ← REQUIRED! Without this, data leaks across tenants
    status: 'ACTIVE',
  },
});
```

**If you forget this step, users can see data from other tenants (data breach!).**

---

## Testing the Middleware

### Test Modern Pattern Endpoint

```bash
# With valid DOCTOR token (should return 200)
curl -H "Authorization: Bearer <valid_doctor_token>" \
  http://localhost:3000/api/test-rbac-modern

# With invalid token (should return 401)
curl -H "Authorization: Bearer invalid_token" \
  http://localhost:3000/api/test-rbac-modern

# With wrong role (should return 403)
curl -H "Authorization: Bearer <nurse_token>" \
  http://localhost:3000/api/test-rbac-modern

# Without token (should return 401)
curl http://localhost:3000/api/test-rbac-modern
```

### Test Legacy Pattern Endpoint

```bash
# With valid HOSPITAL_ADMIN token (should return 200)
curl -H "Authorization: Bearer <valid_admin_token>" \
  http://localhost:3000/api/test-rbac-legacy

# With wrong role (should return 403)
curl -H "Authorization: Bearer <doctor_token>" \
  http://localhost:3000/api/test-rbac-legacy
```

---

## Implementation Checklist

When using `requireRole()` in your API routes:

- [ ] Import `requireRole` and `getTenantScopingFilter` from `/lib/rbac`
- [ ] Wrap handler with `requireRole(...allowedRoles)`
- [ ] Access user via `request.user` (modern) or `req.user` (legacy)
- [ ] Call `getTenantScopingFilter(user)` to get scope rules
- [ ] Apply scope filter to **ALL** Prisma queries: `where: { ...scopeFilter, ... }`
- [ ] Handle COMMUNITY_USER as special case (filter by motherId)
- [ ] Test with tokens for each allowed role
- [ ] Test with tokens for disallowed roles (should return 403)
- [ ] Test without token (should return 401)
- [ ] Verify data doesn't leak across tenants

---

## TypeScript Support

The middleware has full TypeScript support. To access `user` with proper typing:

```typescript
import { ScopedUserPayload } from '@/lib/rbac';

const user = (request as any).user as ScopedUserPayload;
// Now you have full autocomplete for: userId, role, hospitalId, districtId, etc.
```

---

## Next Steps

1. **Test the endpoints** using the test routes in `/api/test-rbac-*`
2. **Refactor existing routes** to use `requireRole()` instead of manual auth checks
3. **Review the REQUIREROLE_GUIDE.md** for detailed implementation patterns
4. **Apply to critical routes** starting with pregnancies, mothers, and appointments

---

## Summary

The `requireRole()` middleware factory provides a clean, reusable way to secure API routes with role-based access control and automatic tenant scoping validation. It eliminates boilerplate authentication code and ensures consistent security practices across your API.

**Key takeaway**: Always apply `getTenantScopingFilter()` to your Prisma queries!
