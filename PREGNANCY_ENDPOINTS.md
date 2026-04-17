# Pregnancy Endpoints Implementation Complete

## Overview
All pregnancy management endpoints have been implemented with full support for creating, listing, retrieving, and managing pregnancy status transitions including delivery with automatic postnatal follow-up scheduling.

## Implemented Endpoints

### 1. POST /api/pregnancies
**Opens a new pregnancy episode**

#### Authorization
- Required roles: `DOCTOR`, `NURSE`, `MIDWIFE`, `HOSPITAL_ADMIN`, `SYSTEM_ADMIN`
- Authentication: Bearer token in Authorization header

#### Request Body
```json
{
  "motherId": 42,
  "lmpDate": "2026-01-15",
  "edd": "2026-10-22",
  "gravida": 2,
  "parity": 1,
  "multiplePregnancy": "NONE",
  "riskFactors": ["Hypertension", "Diabetes"],
  "antenatalStatus": "ACTIVE",
  "obstetricHistory": [
    {
      "year": 2024,
      "outcome": "LIVE_BIRTH",
      "deliveryMode": "SVD",
      "complications": ["Episiotomy"]
    }
  ]
}
```

#### Auto-Calculations
- **EDD** (Estimated Due Date): If not provided, automatically calculated as `lmpDate + 280 days`
- **isHighRisk**: Automatically set to `true` if `riskFactors` array is non-empty
- **gravida**: Auto-calculated from obstetric history count (can be overridden)
- **parity**: Auto-calculated as count of LIVE_BIRTH outcomes (can be overridden)

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Pregnancy created successfully",
  "data": {
    "pregnancyId": 1
  }
}
```

#### Validation
- `motherId` required and must exist in database
- `lmpDate` required (ISO date format, must be in past, max 42 weeks ago)
- `multiplePregnancy` must be: `NONE`, `TWINS`, or `TRIPLETS_PLUS`
- `antenatalStatus` must be: `YET_TO_START`, `ACTIVE`, or `COMPLETED`
- `riskFactors` must be array
- `obstetricHistory` records must have valid `outcome` and optional `deliveryMode`

#### Audit Logging
- Action: `CREATE`
- Resource: `pregnancy`
- Logs: motherId, lmpDate, isHighRisk, riskFactors, obstetricHistoryCount

---

### 2. GET /api/pregnancies
**Retrieve paginated list of pregnancies with filtering**

#### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `ACTIVE`, `CLOSED`, `DELIVERED` |
| `isHighRisk` | boolean | Filter by high-risk flag: `true` or `false` |
| `motherId` | number | Filter by specific mother |
| `skip` | number | Pagination offset (default: 0) |
| `take` | number | Records per page (default: 20, max: 100) |

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "motherId": 42,
      "lmpDate": "2026-01-15T00:00:00Z",
      "edd": "2026-10-22T00:00:00Z",
      "gravida": 2,
      "parity": 1,
      "multiplePregnancy": "NONE",
      "status": "ACTIVE",
      "isHighRisk": true,
      "antenatalStatus": "ACTIVE",
      "mother": {
        "id": 42,
        "fullName": "Jane Doe",
        "phone": "+256701234567",
        "facility": {
          "id": 5,
          "name": "Mulago Hospital",
          "districtId": 1
        }
      }
    }
  ],
  "pagination": {
    "total": 47,
    "returned": 20,
    "skip": 0,
    "take": 20
  }
}
```

#### Authorization
- Same as POST (clinical + admin roles)

---

### 3. GET /api/pregnancies/:id
**Retrieve full pregnancy detail with nested relations**

#### Path Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Pregnancy ID |

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": 1,
    "motherId": 42,
    "lmpDate": "2026-01-15T00:00:00Z",
    "edd": "2026-10-22T00:00:00Z",
    "gravida": 2,
    "parity": 1,
    "multiplePregnancy": "NONE",
    "riskFactors": ["Hypertension", "Diabetes"],
    "isHighRisk": true,
    "antenatalStatus": "ACTIVE",
    "status": "ACTIVE",
    "deliveryDate": null,
    "deliveryOutcome": null,
    "deliveryMode": null,
    "babyWeightKg": null,
    "complications": null,
    "ancCardUrl": null,
    "createdAt": "2026-04-16T10:30:00Z",
    "updatedAt": "2026-04-16T10:30:00Z",
    "mother": {
      "id": 42,
      "fullName": "Jane Doe",
      "phone": "+256701234567",
      "village": "Kampala",
      "facility": {
        "id": 5,
        "name": "Mulago Hospital",
        "districtId": 1
      }
    },
    "ancVisits": [
      {
        "id": 15,
        "visitNumber": 1,
        "visitType": "ROUTINE",
        "visitDateTime": "2026-03-20T10:00:00Z",
        "nextAppointment": "2026-04-17T10:00:00Z",
        "notes": "Routine 28-week checkup",
        "vitals": [
          {
            "id": 50,
            "systolicBP": 120,
            "diastolicBP": 80,
            "temperatureC": 37.2,
            "weightKg": 72.5,
            "createdAt": "2026-03-20T10:00:00Z"
          }
        ],
        "symptoms": [
          {
            "id": 25,
            "bleeding": false,
            "severeHeadache": false,
            "blurredVision": false,
            "reducedFetalMovement": false,
            "other": "Mild leg swelling",
            "createdAt": "2026-03-20T10:00:00Z"
          }
        ]
      }
    ],
    "obstetricHistory": [
      {
        "id": 10,
        "year": 2024,
        "outcome": "LIVE_BIRTH",
        "deliveryMode": "SVD",
        "complications": ["Episiotomy"],
        "createdAt": "2026-04-16T10:30:00Z"
      }
    ],
    "clinicalArchives": [
      {
        "id": 5,
        "type": "IMAGING",
        "title": "20-week ultrasound",
        "datePerformed": "2026-03-15T00:00:00Z",
        "notes": "Normal fetal development",
        "fileUrl": "https://example.com/uploads/ultrasound.pdf",
        "uploadedBy": {
          "id": 10,
          "name": "Dr. Smith"
        }
      }
    ]
  }
}
```

#### Authorization
- Same as POST (clinical + admin roles)

---

### 4. PUT /api/pregnancies/:id
**Update pregnancy fields (general updates)**

#### Request Body (all fields optional)
```json
{
  "isHighRisk": true,
  "status": "ACTIVE",
  "antenatalStatus": "COMPLETED",
  "deliveryDate": "2026-04-17",
  "deliveryOutcome": "LIVE_BIRTH",
  "deliveryMode": "C_SECTION",
  "babyWeightKg": 3.2,
  "complications": ["Post-delivery hemorrhage"]
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Pregnancy updated successfully",
  "data": {
    "id": 1,
    "status": "DELIVERED",
    "isHighRisk": true,
    "antenatalStatus": "COMPLETED"
  }
}
```

#### Authorization
- Same as POST (clinical + admin roles)

---

### 5. PATCH /api/pregnancies/:id/status
**Close or deliver a pregnancy (status-specific endpoint)**

#### Authorization
- Same as POST (clinical + admin roles)

#### Request Body
```json
{
  "status": "DELIVERED",
  "deliveryDate": "2026-04-17",
  "deliveryOutcome": "LIVE_BIRTH",
  "deliveryMode": "C_SECTION",
  "babyWeightKg": 3.2,
  "complications": ["Post-delivery hemorrhage"]
}
```

#### Validation Rules
| Scenario | Requirements |
|----------|--------------|
| `status: "CLOSED"` | Only `status` field required; can transition from ACTIVE, DELIVERED |
| `status: "DELIVERED"` | Requires: `deliveryDate`, `deliveryOutcome`, `deliveryMode` |
| `deliveryOutcome` | Must be one of: `LIVE_BIRTH`, `MISCARRIAGE`, `STILLBIRTH`, `ABORTION` |
| `deliveryMode` | Must be one of: `SVD`, `C_SECTION`, `ASSISTED` |

#### Response (200 OK) - DELIVERED
```json
{
  "success": true,
  "message": "Pregnancy delivered - postnatal follow-up scheduled",
  "data": {
    "pregnancyId": 1,
    "status": "DELIVERED",
    "closedAt": "2026-04-17T10:30:00Z",
    "deliveryDate": "2026-04-17T00:00:00Z",
    "deliveryOutcome": "LIVE_BIRTH",
    "deliveryMode": "C_SECTION",
    "babyWeightKg": 3.2,
    "complications": ["Post-delivery hemorrhage"],
    "followUpAppointmentId": 42
  }
}
```

#### Response (200 OK) - CLOSED
```json
{
  "success": true,
  "message": "Pregnancy closed successfully",
  "data": {
    "pregnancyId": 1,
    "status": "CLOSED",
    "closedAt": "2026-04-17T10:30:00Z"
  }
}
```

#### Auto-Actions on DELIVERED
- **Postnatal Follow-up Created**: When `status: "DELIVERED"`, the endpoint automatically creates an appointment:
  - Scheduled for 4 days post-delivery (within the postnatal assessment window)
  - Status: `SCHEDULED`
  - Purpose: `OTHER` with notes "Postnatal assessment and baby checkup"
  - Returned in response as `followUpAppointmentId`

#### Status Transition Rules
| From \ To | CLOSED | DELIVERED | ACTIVE |
|-----------|--------|-----------|--------|
| ACTIVE | ✓ | ✓ | ✗ |
| CLOSED | ✗ | ✓ | ✗ |
| DELIVERED | ✓ | ✗ | ✗ |

#### Audit Logging
- Action: `UPDATE`
- Logs: statusChange (from/to), deliveryOutcome, followUpAppointmentId

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Invalid pregnancy ID"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized - no token provided"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Insufficient permissions to create pregnancies"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Pregnancy not found"
}
```

### 422 Unprocessable Entity (Validation Error)
```json
{
  "success": false,
  "error": "lmpDate must be a valid ISO date string (e.g., 2025-10-15)"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## Request Examples Using cURL

### Create Pregnancy
```bash
curl -X POST http://localhost:3000/api/pregnancies \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "motherId": 42,
    "lmpDate": "2026-01-15",
    "gravida": 2,
    "parity": 1,
    "multiplePregnancy": "NONE",
    "riskFactors": ["Hypertension"],
    "antenatalStatus": "ACTIVE"
  }'
```

### List Pregnancies
```bash
curl -X GET "http://localhost:3000/api/pregnancies?status=ACTIVE&isHighRisk=true&skip=0&take=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Pregnancy Detail
```bash
curl -X GET http://localhost:3000/api/pregnancies/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Deliver Pregnancy
```bash
curl -X PATCH http://localhost:3000/api/pregnancies/1/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "DELIVERED",
    "deliveryDate": "2026-04-17",
    "deliveryOutcome": "LIVE_BIRTH",
    "deliveryMode": "C_SECTION",
    "babyWeightKg": 3.2
  }'
```

### Close Pregnancy
```bash
curl -X PATCH http://localhost:3000/api/pregnancies/1/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "CLOSED"
  }'
```

---

## Key Implementation Details

### File Structure
```
app/api/pregnancies/
├── route.ts                    (POST, GET list)
└── [id]/
    ├── route.ts                (GET detail, PUT update)
    └── status/
        └── route.ts            (PATCH status changes)
```

### Database Models Used
- **Pregnancy**: Core model with all fields
- **Mother**: Related mother record (for validation)
- **Appointment**: Auto-created on delivery for postnatal follow-up
- **AuditLog**: All mutations logged for compliance

### Security & Validation
- ✓ JWT authentication required
- ✓ Role-based authorization (DOCTOR, NURSE, MIDWIFE, HOSPITAL_ADMIN, SYSTEM_ADMIN)
- ✓ Comprehensive input validation
- ✓ Tenant scoping (future: facility/district isolation)
- ✓ All mutations audit-logged
- ✓ Status transition validation

### Data Handling
- **JSON Fields**: `riskFactors`, `complications`, `obstetricHistory.complications` stored as JSON strings
- **Date Fields**: All dates normalized to ISO 8601 format
- **Calculations**: EDD, gravida, parity, isHighRisk calculated automatically

---

## Testing Checklist

- [ ] POST: Create pregnancy with EDD auto-calculation
- [ ] POST: Verify isHighRisk set when riskFactors provided
- [ ] POST: Verify returns 201 with { pregnancyId }
- [ ] GET list: Filter by status, isHighRisk, motherId
- [ ] GET list: Pagination works (skip, take)
- [ ] GET detail: Returns nested ancVisits with vitals/symptoms
- [ ] PUT: Update individual fields
- [ ] PATCH /status: Deliver with auto-created postnatal appointment
- [ ] PATCH /status: Close pregnancy
- [ ] PATCH /status: Verify status transition rules enforced
- [ ] Audit logs: All CREATE/UPDATE actions logged
- [ ] Authorization: 403 for unauthorized roles
- [ ] Error handling: Proper validation errors returned

---

## Database Schema Reference

### Pregnancy Model Fields
```typescript
id: Int (PK)
motherId: Int (FK)
lmpDate: DateTime?
edd: DateTime?
gravida: Int?
parity: Int?
multiplePregnancy: String? (NONE|TWINS|TRIPLETS_PLUS)
riskFactors: String? (JSON array)
isHighRisk: Boolean
antenatalStatus: String? (YET_TO_START|ACTIVE|COMPLETED)
status: String (ACTIVE|CLOSED|DELIVERED)
deliveryDate: DateTime?
deliveryOutcome: String? (LIVE_BIRTH|MISCARRIAGE|STILLBIRTH|ABORTION)
deliveryMode: String? (SVD|C_SECTION|ASSISTED)
babyWeightKg: Float?
complications: String? (JSON array)
ancCardUrl: String?
openedById: Int (FK to User)
closedAt: DateTime?
createdAt: DateTime
updatedAt: DateTime
```

### Relations
- Pregnancy → Mother (many-to-one)
- Pregnancy → User (openedBy)
- Pregnancy → AncVisit (one-to-many)
- Pregnancy → Vitals (one-to-many)
- Pregnancy → Symptoms (one-to-many)
- Pregnancy → Appointment (one-to-many)
- Pregnancy → ObstetricHistory (one-to-many)
- Pregnancy → ClinicalArchive (one-to-many)

---

## Next Steps / Future Enhancements

1. **Tenant Scoping**: Apply facility/district filtering per user scope
2. **Permission System**: Integrate with database permission checks
3. **Postnatal Records**: Consider separate PostnatalRecord model if more data tracking needed
4. **Notifications**: Send SMS/email alerts on delivery status changes
5. **Soft Deletes**: Consider adding deletedAt field for audit trail
6. **Bulk Operations**: Add bulk update/close endpoints for batch processing
7. **Analytics**: Add endpoints for pregnancy trend reports and metrics
