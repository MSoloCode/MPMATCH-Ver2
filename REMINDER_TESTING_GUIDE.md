# ANC Appointment Reminder System - Manual Testing Guide

## Overview
This guide provides step-by-step instructions to manually test the reminder system without requiring the integration test setup.

## Prerequisites
- Running instance of MPMATCH application
- Access to the database
- Postman or curl for API testing
- Valid JWT tokens for clinical users

## Test Scenarios

### Scenario 1: Create ANC Visit with Reminder Trigger

**Step 1.1: Get valid JWT token for clinical user**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "doctor_user",
    "password": "password123"
  }'
```
Expected: Returns `{success: true, token: "eyJ..."}`

**Step 1.2: Create ANC visit with nextAppointment**
```bash
curl -X POST http://localhost:3000/api/ancvisits \
  -H "Authorization: Bearer <TOKEN_FROM_1.1>" \
  -H "Content-Type: application/json" \
  -d '{
    "pregnancyId": 1,
    "motherId": 42,
    "visitType": "ROUTINE",
    "visitDateTime": "2026-04-17T14:30:00Z",
    "nextAppointment": "2026-04-18T14:30:00Z",
    "notes": "Regular checkup"
  }'
```
Expected: Returns 201 with visit data

**Step 1.3: Verify ReminderSchedule created in database**
```sql
SELECT * FROM reminder_schedules 
WHERE motherId = 42 
ORDER BY createdAt DESC 
LIMIT 1;
```
Expected output:
```
id: 123
ancVisitId: <visit_id_from_1.2>
motherId: 42
sendAt: 2026-04-17T14:30:00Z (24 hours before appointment)
type: ANC_REMINDER
status: PENDING
sentAt: NULL
errorLog: NULL
```

---

### Scenario 2: Process Pending Reminders

**Step 2.1: Create an overdue reminder (for testing)**

In database directly:
```sql
INSERT INTO reminder_schedules (motherId, sendAt, type, status, createdAt)
VALUES (42, datetime('now', '-1 hour'), 'ANC_REMINDER', 'PENDING', datetime('now'));
```

**Step 2.2: Call the cron endpoint**
```bash
curl -X GET http://localhost:3000/api/reminders/process \
  -H "Authorization: Bearer <REMINDER_CRON_SECRET>"
```

Expected: Returns 200 with processing summary
```json
{
  "success": true,
  "data": {
    "total": 1,
    "sent": 1,
    "failed": 0,
    "startTime": "2026-04-17T10:00:00Z",
    "endTime": "2026-04-17T10:00:05Z",
    "results": [
      {
        "reminderId": 124,
        "motherId": 42,
        "status": "SENT",
        "messageId": "msg_abc123"
      }
    ]
  },
  "message": "Processed 1 pending reminders: 1 sent, 0 failed"
}
```

**Step 2.3: Verify reminder status updated in database**
```sql
SELECT * FROM reminder_schedules WHERE id = 124;
```
Expected:
```
status: SENT
sentAt: 2026-04-17T10:00:05Z
errorLog: NULL
```

**Step 2.4: Verify SMS logged**
```sql
SELECT * FROM sms_logs 
WHERE toPhone = '+256701234567' 
ORDER BY createdAt DESC 
LIMIT 1;
```
Expected: SMS_COMMUNICATION consent check passed, message sent to gateway

---

### Scenario 3: Handle Failed Reminder (Opt-out)

**Step 3.1: Create mother without SMS consent**
```sql
INSERT INTO mothers (fullName, phone, districtId, facilityId, consentAccepted, createdAt)
VALUES ('Jane No-Consent', '+256702000111', 1, 1, 0, datetime('now'));

-- Note: No row in consent_records for SMS_COMMUNICATION type
```

**Step 3.2: Create pregnancy and ANC visit**
```sql
-- (Create via API as in Scenario 1, using the new motherId)
```

**Step 3.3: Create overdue reminder for this mother**
```sql
INSERT INTO reminder_schedules (motherId, sendAt, type, status, createdAt)
VALUES (<mother_id>, datetime('now', '-1 hour'), 'ANC_REMINDER', 'PENDING', datetime('now'));
```

**Step 3.4: Call cron endpoint**
```bash
curl -X GET http://localhost:3000/api/reminders/process \
  -H "Authorization: Bearer <REMINDER_CRON_SECRET>"
```

Expected: The reminder for this mother should be marked FAILED with error "OPT_OUT"
```sql
SELECT * FROM reminder_schedules WHERE motherId = <mother_id>;
-- status: FAILED
-- errorLog: "OPT_OUT"
```

---

### Scenario 4: Test Cron Security

**Step 4.1: Call endpoint without Authorization header**
```bash
curl -X GET http://localhost:3000/api/reminders/process
```
Expected: 401 Unauthorized - "missing Authorization header"

**Step 4.2: Call endpoint with invalid secret**
```bash
curl -X GET http://localhost:3000/api/reminders/process \
  -H "Authorization: Bearer wrong_secret"
```
Expected: 401 Unauthorized - "invalid cron secret"

**Step 4.3: Call endpoint with correct secret**
```bash
curl -X GET http://localhost:3000/api/reminders/process \
  -H "Authorization: Bearer <CORRECT_REMINDER_CRON_SECRET>"
```
Expected: 200 Success - processes reminders

---

## Database Verification Queries

### View all pending reminders
```sql
SELECT 
  rs.id,
  rs.motherId,
  m.fullName,
  m.phone,
  rs.sendAt,
  rs.status,
  rs.createdAt
FROM reminder_schedules rs
JOIN mothers m ON rs.motherId = m.id
WHERE rs.status = 'PENDING'
ORDER BY rs.sendAt ASC;
```

### View sent reminders with details
```sql
SELECT 
  rs.id,
  rs.motherId,
  m.fullName,
  rs.sendAt,
  rs.sentAt,
  ROUND((CAST(rs.sentAt as REAL) - CAST(rs.sendAt as REAL)) * 1000) as delay_ms
FROM reminder_schedules rs
JOIN mothers m ON rs.motherId = m.id
WHERE rs.status = 'SENT'
ORDER BY rs.sentAt DESC
LIMIT 20;
```

### View failed reminders with error logs
```sql
SELECT 
  rs.id,
  rs.motherId,
  m.fullName,
  rs.sendAt,
  rs.errorLog,
  rs.createdAt
FROM reminder_schedules rs
JOIN mothers m ON rs.motherId = m.id
WHERE rs.status = 'FAILED'
ORDER BY rs.createdAt DESC
LIMIT 20;
```

### SMS logs for reminders
```sql
SELECT 
  sl.id,
  sl.toPhone,
  sl.messagePreview,
  sl.gateway,
  sl.status,
  sl.createdAt
FROM sms_logs sl
WHERE sl.messagePreview LIKE '%ANC appointment%'
ORDER BY sl.createdAt DESC
LIMIT 20;
```

---

## Environment Configuration

### Required Environment Variables

Add to `.env.local`:
```env
# Cron job security
REMINDER_CRON_SECRET=your-secret-token-here

# SMS Gateways (already configured for sms.ts)
AFRICASTALKING_API_KEY=xxx
AFRICASTALKING_USERNAME=xxx
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_FROM_NUMBER=xxx

# Database
DATABASE_URL=file:./prisma/dev.db
```

### Setting Cron Secret
1. Generate a strong random token (e.g., using `openssl rand -base64 32`)
2. Set `REMINDER_CRON_SECRET` in your `.env` or hosting platform environment
3. Use the same value in the Authorization header when calling `/api/reminders/process`

---

## Troubleshooting

### Reminder not created when ANC visit created
- Check browser console for errors during POST /api/ancvisits
- Verify `nextAppointment` field was sent in request
- Check server logs for database errors
- Verify ReminderSchedule table exists and is accessible

### Cron endpoint returns 401
- Verify `REMINDER_CRON_SECRET` is set in environment
- Check that Authorization header format is exactly: `Bearer <secret_value>`
- Ensure no extra whitespace in secret value

### SMS not sent even though reminder processed
- Check `ConsentRecord` for mother - may have opted out
- Verify mother phone number is valid and formatted correctly
- Check SMS gateway credentials (AFRICASTALKING_API_KEY, TWILIO_AUTH_TOKEN)
- Review console logs for specific gateway errors
- Check `sms_logs` table for send attempts and errors

### Database errors
- Verify all migrations applied: `npx prisma migrate deploy`
- Check that motherId and ancVisitId (if present) are valid foreign keys
- Ensure reminder_schedules table has correct schema

---

## Performance Testing

### Load test: Create 100 reminders
```bash
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/ancvisits \
    -H "Authorization: Bearer <TOKEN>" \
    -H "Content-Type: application/json" \
    -d "{
      \"pregnancyId\": 1,
      \"motherId\": 42,
      \"visitType\": \"ROUTINE\",
      \"visitDateTime\": \"2026-04-17T14:30:00Z\",
      \"nextAppointment\": \"2026-04-18T14:30:00Z\",
      \"notes\": \"Visit $i\"
    }"
  echo "Created visit $i"
done
```

### Process all pending reminders and measure time
```bash
time curl -X GET http://localhost:3000/api/reminders/process \
  -H "Authorization: Bearer <REMINDER_CRON_SECRET>"
```

Expected: Should process 100+ reminders in < 5 seconds (depending on SMS gateway latency)

---

## Success Criteria

✅ **All tests pass when:**
1. ANC visits with `nextAppointment` automatically create PENDING ReminderSchedule records
2. ReminderSchedule `sendAt` is exactly 24 hours before the appointment
3. Cron endpoint processes PENDING reminders where `sendAt <= now()`
4. Failed reminders are marked FAILED with error logs
5. Successful reminders are marked SENT with sentAt timestamp
6. SMS is logged to sms_logs table with correct gateway and status
7. Cron endpoint validates `REMINDER_CRON_SECRET` authorization
8. Mothers without SMS consent get FAILED status with "OPT_OUT" error
