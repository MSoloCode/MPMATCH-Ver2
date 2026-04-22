# ANC Appointment Reminder System - Implementation Summary

## What Was Built

A complete automated SMS reminder system that sends notifications to mothers 24 hours before their ANC (Antenatal Care) appointments. The system:

✅ **Automatically creates reminders** when an ANC visit is registered with a `nextAppointment` date  
✅ **Processes reminders hourly** via a secure cron endpoint  
✅ **Sends SMS via dual-gateway** (Africa's Talking + Twilio fallback)  
✅ **Tracks all send attempts** with detailed logs and error handling  
✅ **Respects SMS consent** (does not send to mothers who opted out)  
✅ **Handles failures gracefully** (marks failed reminders for manual review)  

---

## Files Created/Modified

### NEW FILES

#### 1. `/services/reminder.ts`
**Purpose:** Core reminder processing logic  
**Main Function:** `processReminders(): Promise<RemindersProcessingSummary>`

**What it does:**
- Queries database for all PENDING reminders where `sendAt <= now`
- Fetches mother and facility details for each reminder
- Builds personalized SMS message: `"Hello [Name], your ANC appointment is tomorrow at [Facility]. Please attend on time."`
- Calls existing `sendSMS()` service to send via SMS gateway
- Updates reminder status to SENT (with timestamp) on success
- Updates reminder status to FAILED (with error log) on failure
- Returns summary with statistics and results

**Key Features:**
- Batch processing (all due reminders in one job)
- Error isolation (one failure doesn't stop batch)
- Comprehensive logging (console output for monitoring)
- Fail-safe SMS sending (reuses proven sms.ts service)

---

#### 2. `/app/api/reminders/process/route.ts`
**Purpose:** HTTP endpoint for cron job execution  
**Endpoint:** `GET /api/reminders/process`

**What it does:**
1. Validates `REMINDER_CRON_SECRET` from Authorization header (Bearer token)
2. Calls `processReminders()` from `/services/reminder.ts`
3. Returns JSON response with processing statistics
4. Provides security via secret token (prevents unauthorized access)

**Response Format:**
```json
{
  "success": true,
  "data": {
    "total": 5,
    "sent": 4,
    "failed": 1,
    "startTime": "2026-04-17T10:00:00Z",
    "endTime": "2026-04-17T10:00:02.5Z",
    "results": [...]
  },
  "message": "Processed 5 pending reminders: 4 sent, 1 failed"
}
```

**Security:**
- Requires `REMINDER_CRON_SECRET` environment variable
- Returns 401 if secret missing or invalid
- Prevents unauthorized reminder processing

---

#### 3. `/test_reminder_system.ts`
**Purpose:** Comprehensive integration test suite  
**Run with:** `npx ts-node test_reminder_system.ts`

**Tests:**
1. Schema verification (ReminderSchedule table exists)
2. Test mother creation
3. Test pregnancy creation  
4. Test ANC visit with nextAppointment
5. Verify ReminderSchedule auto-created
6. Create overdue reminder (for processing)
7. Process reminders via `processReminders()`
8. Verify reminder status updated after processing

**Features:**
- Automatic test data cleanup
- Detailed pass/fail reporting
- Validates entire workflow end-to-end

---

#### 4. `/REMINDER_TESTING_GUIDE.md`
**Purpose:** Manual testing instructions with real scenarios  

**Contents:**
- Scenario 1: Create ANC visit with reminder trigger
- Scenario 2: Process pending reminders
- Scenario 3: Handle failed reminders (opt-out)
- Scenario 4: Test cron security
- Database verification queries
- Troubleshooting guide
- Performance testing commands

---

#### 5. `/REMINDER_DEPLOYMENT_GUIDE.md`
**Purpose:** Production deployment and operations guide  

**Contents:**
- System architecture diagram
- Environment configuration
- Database setup verification
- Code deployment steps
- Cron service setup (4 options: EasyCron, AWS EventBridge, GitHub Actions, Self-hosted)
- Monitoring & alerting setup
- Verification procedures
- Maintenance tasks
- Troubleshooting
- Rollback procedures

---

### MODIFIED FILES

#### 1. `/app/api/ancvisits/route.ts`
**Changes in POST handler:**
- After creating AncVisit record, check if `nextAppointment` is set
- If set, create ReminderSchedule with:
  - `ancVisitId`: ID of newly created visit
  - `motherId`: Mother ID from visit
  - `sendAt`: nextAppointment - 24 hours
  - `type`: "ANC_REMINDER"
  - `status`: "PENDING"
- Error handling: Reminder creation failure doesn't block visit creation (async, non-blocking)
- Audit log includes `nextAppointment` in changesSummary

**Code Location:** Lines 680-697  
**Impact:** Backward compatible - only creates reminder if nextAppointment is provided

---

#### 2. `/prisma/schema.prisma`
**Changes to ReminderSchedule model:**
- Updated `type` field comment from `// SMS|EMAIL|PUSH` to `// ANC_REMINDER (SMS sent 24h before appointment)`
- No schema structure changes (table already exists)
- No migration needed

**Location:** Line 509

---

## Data Flow

### Visit Creation → Reminder Scheduled

```
POST /api/ancvisits
  │
  └─→ Create AncVisit (visitNumber, visitDateTime, nextAppointment, etc.)
  │
  └─→ Check if nextAppointment is set
  │
  ├─→ YES: Create ReminderSchedule
  │         ├─ sendAt = nextAppointment - 24h
  │         ├─ status = "PENDING"
  │         └─ type = "ANC_REMINDER"
  │
  └─→ Return 201 with visit data
```

### Hourly Reminder Processing

```
GET /api/reminders/process (called by cron every hour)
  │
  └─→ Validate REMINDER_CRON_SECRET
  │
  └─→ Call processReminders()
      │
      ├─→ Query: SELECT * FROM reminder_schedules 
      │         WHERE status='PENDING' AND sendAt <= now()
      │
      ├─→ For each reminder:
      │   ├─ Fetch mother data
      │   ├─ Send SMS: "Hello [Name], your ANC appointment is tomorrow at [Facility]..."
      │   ├─ On SUCCESS: Update status='SENT', sentAt=now()
      │   └─ On FAILURE: Update status='FAILED', errorLog=error message
      │
      └─→ Return summary: {total, sent, failed, results}
```

## Integration with Existing Systems

### Reuses SMS Service
The reminder system uses the existing `sendSMS()` from `/services/sms.ts`:
- ✅ Phone number formatting (+256 Uganda format)
- ✅ Dual-gateway support (Africa's Talking → Twilio fallback)
- ✅ SMS consent checking (ConsentRecord verification)
- ✅ Comprehensive error handling
- ✅ SMS logging to SmsLog table

### Compatible with RBAC
- Reminders are automated (no user role required)
- SMS sent from system account (not tied to user)
- Audit logs track reminder processing separately

### Database Schema Alignment
- Uses existing ReminderSchedule model (no schema changes)
- Creates audit logs via standard writeAuditLog() pattern
- Follows existing error handling conventions

---

## Environment Configuration Required

### Add to `.env.local`:

```env
# Cron job security token (generate with: openssl rand -base64 32)
REMINDER_CRON_SECRET=your-secret-token-here

# Already configured for sms.ts (no changes needed)
AFRICASTALKING_API_KEY=xxx
AFRICASTALKING_USERNAME=xxx
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_FROM_NUMBER=+1234567890
```

---

## API Contract

### GET /api/reminders/process

**Request:**
```
GET /api/reminders/process HTTP/1.1
Authorization: Bearer <REMINDER_CRON_SECRET>
```

**Response (200 Success):**
```json
{
  "success": true,
  "data": {
    "total": 5,
    "sent": 4,
    "failed": 1,
    "startTime": "2026-04-17T10:00:00Z",
    "endTime": "2026-04-17T10:00:02.5Z",
    "results": [
      {
        "reminderId": 1,
        "motherId": 42,
        "status": "SENT",
        "messageId": "msg_abc123"
      },
      {
        "reminderId": 2,
        "motherId": 43,
        "status": "FAILED",
        "error": "OPT_OUT"
      }
    ]
  },
  "message": "Processed 5 pending reminders: 4 sent, 1 failed"
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": "Unauthorized - invalid cron secret"
}
```

---

## Quick Start Checklist

- [ ] Add `REMINDER_CRON_SECRET` to `.env.local`
- [ ] Verify SMS gateway credentials are configured
- [ ] Deploy code (no migrations needed)
- [ ] Run build: `npm run build`
- [ ] Test manually: Create ANC visit with nextAppointment, verify ReminderSchedule created
- [ ] Set up external cron service to call `/api/reminders/process` every hour
- [ ] Verify first cron execution in logs
- [ ] Monitor ReminderSchedule and SmsLog tables for activity

---

## Known Limitations & Future Enhancements

### Current (Working as Designed)
- ✅ Reminders sent only 24h before appointment
- ✅ No automatic retry of failed reminders
- ✅ No customizable message templates
- ✅ No email/push notifications (SMS only)
- ✅ One reminder per appointment (no duplicates)

### Future Enhancements (Optional)
1. **Retry mechanism**: Add `retryCount` field to auto-retry FAILED reminders up to 3 times
2. **Dashboard**: Add `/api/reminders` GET endpoint to list/filter reminders by status
3. **SMS templates**: Store customizable message templates in database
4. **Multiple channels**: Extend to support email and push notifications
5. **Configurable timing**: Allow different reminder intervals (6h, 12h, 24h, 48h)
6. **Reminder groups**: Batch similar reminders for bulk processing
7. **Analytics**: Track reminder engagement (open rates, delivery rates)

---

## Testing Instructions

### Integration Test
```bash
npx ts-node test_reminder_system.ts
```

### Manual Test (Curl)
```bash
# Process reminders
curl -X GET http://localhost:3000/api/reminders/process \
  -H "Authorization: Bearer your-secret-token"

# Verify reminder created
curl -X GET http://localhost:3000/api/ancvisits \
  -H "Authorization: Bearer your-clinical-token" | jq '.data[0].nextAppointment'
```

### Database Test
```sql
-- Check pending reminders
SELECT * FROM reminder_schedules WHERE status='PENDING';

-- Check sent reminders
SELECT * FROM reminder_schedules WHERE status='SENT';

-- Check SMS logs
SELECT * FROM sms_logs WHERE messagePreview LIKE '%ANC appointment%';
```

See REMINDER_TESTING_GUIDE.md for comprehensive manual testing scenarios.

---

## Support & Documentation

1. **Testing:** See `/REMINDER_TESTING_GUIDE.md`
2. **Deployment:** See `/REMINDER_DEPLOYMENT_GUIDE.md`
3. **Code:** Inline comments in reminder.ts and process/route.ts
4. **Logs:** Check application console logs and database error_logs
5. **Issues:** Query reminder_schedules/sms_logs for troubleshooting

---

## Summary

The ANC Appointment Reminder System is now **fully implemented, tested, and ready to deploy**. It:

- Automatically schedules reminders when ANC visits are created
- Processes reminders hourly via secure cron endpoint
- Sends personalized SMS messages via proven dual-gateway service
- Logs all operations for monitoring and debugging
- Handles errors gracefully without breaking core workflows
- Integrates seamlessly with existing MPMATCH systems

**Next Steps:** Deploy code, configure REMINDER_CRON_SECRET, set up external cron service, and monitor in production.
