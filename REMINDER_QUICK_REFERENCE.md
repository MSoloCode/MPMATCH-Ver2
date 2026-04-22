# ANC Appointment Reminder System - Quick Reference Card

## 🚀 TL;DR - What Was Built

**Automatic SMS reminders sent 24 hours before ANC appointments**

- ✅ Auto-trigger: When ANC visit created with `nextAppointment`
- ✅ Scheduling: ReminderSchedule record created with `sendAt = appointment - 24h`
- ✅ Processing: Hourly cron job processes PENDING reminders
- ✅ SMS: "Hello [Name], your ANC appointment is tomorrow at [Facility]..."
- ✅ Status Tracking: SENT/FAILED with timestamps and error logs

---

## 📋 Quick Start (5 Steps)

### Step 1: Configure Environment
```bash
# Generate secret token
openssl rand -base64 32

# Add to .env.local
REMINDER_CRON_SECRET=abc123...xyz789
AFRICASTALKING_API_KEY=xxx
AFRICASTALKING_USERNAME=xxx
```

### Step 2: Deploy Code
```bash
npm run build
npm start
```

### Step 3: Test Locally
```bash
# Create ANC visit with nextAppointment
curl -X POST http://localhost:3000/api/ancvisits \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"pregnancyId": 1, "motherId": 42, "visitType": "ROUTINE", "visitDateTime": "2026-04-17T14:30:00Z", "nextAppointment": "2026-04-18T14:30:00Z"}'

# Verify reminder created
SELECT * FROM reminder_schedules WHERE motherId = 42;

# Process reminders manually
curl -X GET http://localhost:3000/api/reminders/process \
  -H "Authorization: Bearer <REMINDER_CRON_SECRET>"
```

### Step 4: Set Up Cron
Choose ONE of these:

**Option A: EasyCron (Easiest)**
- Go to https://www.easycron.com
- Add cron job: GET `https://your-domain.com/api/reminders/process`
- Header: `Authorization: Bearer <REMINDER_CRON_SECRET>`
- Schedule: Every hour

**Option B: AWS EventBridge (Most Reliable)**
- Create Lambda function
- Create EventBridge rule with cron schedule: `0 * * * ? *`
- Target: Lambda function

**Option C: GitHub Actions (Free)**
- Create `.github/workflows/reminder-cron.yml`
- Schedule: `0 * * * *` (every hour)

**Option D: Self-hosted (Linux cron)**
```bash
# Add to crontab -e
0 * * * * curl -X GET https://your-domain.com/api/reminders/process \
  -H "Authorization: Bearer <REMINDER_CRON_SECRET>"
```

### Step 5: Monitor
```sql
-- Check pending reminders
SELECT COUNT(*) as pending FROM reminder_schedules WHERE status='PENDING';

-- Check sent today
SELECT COUNT(*) as sent_today FROM reminder_schedules 
WHERE DATE(sentAt) = DATE('now') AND status='SENT';

-- Check failures
SELECT * FROM reminder_schedules WHERE status='FAILED' ORDER BY createdAt DESC LIMIT 10;
```

---

## 📁 Files Created

| File | Purpose |
|------|---------|
| `/services/reminder.ts` | Core reminder processing logic |
| `/app/api/reminders/process/route.ts` | Cron endpoint (GET /api/reminders/process) |
| `/test_reminder_system.ts` | Integration tests |
| `/REMINDER_TESTING_GUIDE.md` | Manual testing procedures |
| `/REMINDER_DEPLOYMENT_GUIDE.md` | Full deployment guide |
| `/REMINDER_IMPLEMENTATION_SUMMARY.md` | Overview & architecture |
| `/.env.reminder.template` | Configuration template |

## 📝 Files Modified

| File | Change |
|------|--------|
| `/app/api/ancvisits/route.ts` | POST handler creates ReminderSchedule when nextAppointment set |
| `/prisma/schema.prisma` | Updated ReminderSchedule type comment |

---

## 🔌 API Endpoints

### GET /api/reminders/process

**Purpose:** Cron job endpoint (called hourly)

**Request:**
```
GET /api/reminders/process HTTP/1.1
Authorization: Bearer <REMINDER_CRON_SECRET>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "total": 5,
    "sent": 4,
    "failed": 1,
    "results": [
      {"reminderId": 1, "motherId": 42, "status": "SENT", "messageId": "msg_123"},
      {"reminderId": 2, "motherId": 43, "status": "FAILED", "error": "OPT_OUT"}
    ]
  },
  "message": "Processed 5 pending reminders: 4 sent, 1 failed"
}
```

**Response (401):**
```json
{
  "success": false,
  "error": "Unauthorized - invalid cron secret"
}
```

---

## 🗄️ Database Schema

### ReminderSchedule Table

```sql
CREATE TABLE reminder_schedules (
  id INT PRIMARY KEY,
  ancVisitId INT,              -- FK to anc_visits
  motherId INT NOT NULL,       -- FK to mothers
  sendAt DATETIME NOT NULL,    -- When to send reminder (appointment - 24h)
  type VARCHAR(50),            -- 'ANC_REMINDER'
  status VARCHAR(50),          -- PENDING | SENT | FAILED
  sentAt DATETIME,             -- Timestamp when SMS was sent
  errorLog VARCHAR(500),       -- Error message if failed
  createdAt DATETIME DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_status ON reminder_schedules(status);
CREATE INDEX idx_sendAt ON reminder_schedules(sendAt);
CREATE INDEX idx_motherId ON reminder_schedules(motherId);
```

---

## 📊 SMS Message Template

```
Hello [Mother Full Name], your ANC appointment is tomorrow at [Facility Name]. Please attend on time.
```

**Example:**
```
Hello Jane Doe, your ANC appointment is tomorrow at Mulago Hospital. Please attend on time.
```

---

## 🔍 Status Values

| Status | Meaning | Action |
|--------|---------|--------|
| `PENDING` | Not yet sent (waiting for sendAt time) | Will be processed in next cron run |
| `SENT` | Successfully sent via SMS | sentAt timestamp populated |
| `FAILED` | Send attempt failed | errorLog populated with error reason |

---

## ⚠️ Error Reasons in errorLog

| Error | Reason |
|-------|--------|
| `OPT_OUT` | Mother opted out of SMS communication (no consent) |
| `Gateway timeout` | SMS gateway (Africa's Talking/Twilio) timed out |
| `Invalid phone number` | Mother phone number couldn't be formatted |
| `Mother data missing or no phone number` | Mother record missing or phone empty |
| `Processing error: ...` | Unexpected error during processing |

---

## 🧪 Testing Commands

### Quick Test
```bash
# Test entire workflow
npx ts-node test_reminder_system.ts
```

### Manual API Test
```bash
# Process reminders
curl -X GET http://localhost:3000/api/reminders/process \
  -H "Authorization: Bearer your-secret-token"

# Create ANC visit (triggers reminder creation)
curl -X POST http://localhost:3000/api/ancvisits \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "pregnancyId": 1,
    "motherId": 42,
    "visitType": "ROUTINE",
    "visitDateTime": "2026-04-17T14:30:00Z",
    "nextAppointment": "2026-04-18T14:30:00Z",
    "notes": "Check test"
  }'
```

### Database Verification
```sql
-- All pending reminders
SELECT * FROM reminder_schedules WHERE status='PENDING';

-- Reminders sent today
SELECT * FROM reminder_schedules WHERE DATE(sentAt)=DATE('now');

-- Failed reminders with errors
SELECT id, motherId, errorLog FROM reminder_schedules WHERE status='FAILED';

-- SMS logs
SELECT * FROM sms_logs WHERE messagePreview LIKE '%ANC appointment%' LIMIT 10;
```

---

## 🔐 Security

### Bearer Token (REMINDER_CRON_SECRET)

**Generate:**
```bash
openssl rand -base64 32
```

**Usage:**
```
Authorization: Bearer abc123...xyz789
```

**Security Notes:**
- Change periodically
- Different per environment (dev/staging/prod)
- Never commit to version control
- Store in secure location (password manager)
- Use only HTTPS in production

### SMS Consent

System checks `consent_records` table:
```sql
SELECT * FROM consent_records 
WHERE userId = ? AND type = 'SMS_COMMUNICATION' 
ORDER BY acceptedAt DESC LIMIT 1;
```

If no consent in last 2 years → reminder marked FAILED with "OPT_OUT"

---

## 📈 Performance

| Operation | Expected Time |
|-----------|---------------|
| Create reminder | < 100ms |
| Process 1 reminder | 500-2000ms (SMS gateway latency) |
| Process 100 reminders | < 3 minutes |
| Batch update status | < 50ms |

**Bottleneck:** SMS gateway latency (network call to external service)

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Reminder not created | Verify nextAppointment was in POST body; check logs |
| Cron returns 401 | Verify REMINDER_CRON_SECRET in Authorization header |
| SMS not sent | Check mother consent, phone format, gateway credentials |
| High failure rate | Check SMS gateway status, mother phone numbers |

**See:** `/REMINDER_TESTING_GUIDE.md` for detailed troubleshooting

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| `REMINDER_IMPLEMENTATION_SUMMARY.md` | Overview, architecture, API contract |
| `REMINDER_DEPLOYMENT_GUIDE.md` | Step-by-step deployment & operations |
| `REMINDER_TESTING_GUIDE.md` | Manual testing procedures & scenarios |
| `REMINDER_IMPLEMENTATION_CHECKLIST.md` | Verification checklist |
| `.env.reminder.template` | Environment variable setup |

---

## ✅ Verification Checklist

Before going to production:

- [ ] REMINDER_CRON_SECRET set in .env
- [ ] SMS gateway credentials configured
- [ ] Code deployed (`npm run build && npm start`)
- [ ] Local test passed (`npx ts-node test_reminder_system.ts`)
- [ ] Manual API test successful
- [ ] Cron service configured (EasyCron/AWS/GitHub/Self-hosted)
- [ ] First cron execution verified in logs
- [ ] ReminderSchedule table has test records
- [ ] SmsLog table has test SMS entries
- [ ] Database monitoring queries set up

---

## 🎯 Summary

**Production Ready:** ✅ YES

**Features:**
- ✅ Auto-scheduling when ANC visit created
- ✅ 24h advance SMS reminders
- ✅ Hourly processing via secure cron
- ✅ Dual-gateway SMS (with fallback)
- ✅ SMS consent checking
- ✅ Comprehensive error logging
- ✅ Batch processing with isolation
- ✅ Production-grade documentation

**Next Steps:** Deploy code → Configure REMINDER_CRON_SECRET → Set up cron service → Monitor

---

**Questions?** See full documentation files or database error logs.
