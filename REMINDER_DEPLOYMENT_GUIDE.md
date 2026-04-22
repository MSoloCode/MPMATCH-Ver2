# ANC Appointment Reminder System - Deployment Guide

## Overview
The ANC Appointment Reminder System runs as a background cron job that automatically sends SMS reminders to mothers 24 hours before their ANC appointments. This guide covers deployment setup and configuration.

## System Architecture

```
1. ANC Visit Created (with nextAppointment)
   ↓
2. ReminderSchedule Record Created (status: PENDING, sendAt = appointment - 24h)
   ↓
3. External Cron Service calls /api/reminders/process every hour
   ↓
4. Remind Service processes all PENDING reminders where sendAt <= now
   ↓
5. SMS sent via Africa's Talking or Twilio (with fallback)
   ↓
6. ReminderSchedule updated: status=SENT/FAILED, timestamps/errors logged
```

## Step 1: Environment Configuration

### Update .env.local / .env

```env
# === REMINDER SYSTEM ===
# Security token for cron job endpoint access
REMINDER_CRON_SECRET=your-super-secret-token-here

# SMS Gateway Credentials (already configured for sms.ts)
AFRICASTALKING_API_KEY=your-api-key
AFRICASTALKING_USERNAME=your-username
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+1234567890
```

### Generate Secure Cron Secret

**On Linux/Mac:**
```bash
openssl rand -base64 32
# Output: abc123...xyz789=
```

**On Windows PowerShell:**
```powershell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((New-Guid).ToString())) | ForEach-Object { $_ -replace '=', '' }
```

**Example value:** `m8fJ2kL9pQ3vH5xN7dRw4sB6tY8zC1aE2fG9hK`

## Step 2: Database Setup

### Verify Migration

The `ReminderSchedule` table should already exist in your schema. Verify:

```bash
npx prisma migrate status
```

If migrations are pending, run:

```bash
npx prisma migrate deploy
```

### Test Database Connection

```bash
npx prisma db execute --stdin
```

Then run:
```sql
SELECT COUNT(*) as reminder_count FROM reminder_schedules;
```

Should return something like: `{reminder_count: 0}` (or your current count)

## Step 3: Deploy Code

### Files Added/Modified

**New Files:**
- `/services/reminder.ts` - Core reminder processing logic
- `/app/api/reminders/process/route.ts` - Cron job endpoint
- `/test_reminder_system.ts` - Integration test file (optional)
- `/REMINDER_TESTING_GUIDE.md` - Testing documentation

**Modified Files:**
- `/app/api/ancvisits/route.ts` - POST handler now creates ReminderSchedule
- `/prisma/schema.prisma` - Updated type comment (no migration needed)

### Build & Deploy

```bash
# Install dependencies (if new packages added - none were)
npm install

# Build application
npm run build

# Start application
npm start
```

## Step 4: Configure External Cron Service

Choose one of the following cron services to call `/api/reminders/process` every hour.

### Option A: EasyCron (Simple, Recommended for Development)

1. Go to https://www.easycron.com
2. Sign up / Log in
3. Click "Add a Cron Job"
4. Configure:
   - **URL**: `https://your-domain.com/api/reminders/process`
   - **Execution**: `Every hour` (recurring)
   - **Custom headers**: Add header
     - Name: `Authorization`
     - Value: `Bearer <REMINDER_CRON_SECRET>`
5. Click **Create**
6. Verify "Last execution" shows success

### Option B: AWS EventBridge + Lambda (Production Recommended)

1. **Create Lambda Function:**

```javascript
// lambda_function.js
exports.handler = async (event) => {
  const https = require('https');
  const url = 'https://your-domain.com/api/reminders/process';
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'your-domain.com',
      path: '/api/reminders/process',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.REMINDER_CRON_SECRET}`
      }
    };
    
    https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        body: data
      }));
    }).on('error', reject).end();
  });
};
```

2. **Create EventBridge Rule:**
   - AWS Console → EventBridge → Rules → Create rule
   - Name: `AncReminderCronJob`
   - Schedule: `cron(0 * * * ? *)` (every hour)
   - Target: Lambda function created above
   - Environment variable: `REMINDER_CRON_SECRET=<your-secret>`

### Option C: GitHub Actions (Free, if hosting on GitHub)

1. Create `.github/workflows/reminder-cron.yml`:

```yaml
name: ANC Reminder Cron

on:
  schedule:
    - cron: '0 * * * *'  # Every hour at minute 0

jobs:
  remind:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger reminder processing
        run: |
          curl -X GET https://your-domain.com/api/reminders/process \
            -H "Authorization: Bearer ${{ secrets.REMINDER_CRON_SECRET }}" \
            -w "\nStatus: %{http_code}\n"
```

2. Add secret to GitHub repository:
   - Repository Settings → Secrets → New secret
   - Name: `REMINDER_CRON_SECRET`
   - Value: `<your-secret>`

### Option D: Self-Hosted Cron (Linux/Docker)

Add to `/etc/crontab` or use `crontab -e`:

```cron
0 * * * * curl -X GET https://your-domain.com/api/reminders/process -H "Authorization: Bearer $(cat /path/to/cron-secret)" >> /var/log/reminder-cron.log 2>&1
```

Store the secret in `/path/to/cron-secret` file (restricted permissions):

```bash
echo "your-secret" > /path/to/cron-secret
chmod 600 /path/to/cron-secret
```

## Step 5: Monitoring & Logging

### Application Logs

The reminder system logs to console/application logs:

```
[Reminder Processing Complete] Total: 5, Sent: 4, Failed: 1 (Duration: 2500ms)
[Reminder 123] Successfully sent to +256701234567 (MessageID: msg_abc123)
[Reminder 124] Failed to send: Gateway timeout
```

### Database Monitoring

**Check reminder queue status:**
```sql
SELECT 
  status,
  COUNT(*) as count,
  MAX(createdAt) as latest
FROM reminder_schedules
GROUP BY status
ORDER BY status;
```

Expected output:
```
status | count | latest
-------|-------|----------
SENT   | 45    | 2026-04-17 10:00:00
FAILED | 2     | 2026-04-17 09:45:00
PENDING| 8     | 2026-04-17 09:30:00
```

**Check recent processing:**
```sql
SELECT 
  COUNT(*) as reminders_sent_today,
  COUNT(CASE WHEN status='FAILED' THEN 1 END) as failures
FROM reminder_schedules
WHERE DATE(sentAt) = DATE('now')
  AND status IN ('SENT', 'FAILED');
```

### SMS Log Verification

```sql
SELECT 
  COUNT(*) as sms_count,
  status,
  MAX(createdAt) as latest
FROM sms_logs
WHERE messagePreview LIKE '%ANC appointment%'
GROUP BY status
ORDER BY latest DESC;
```

### Alert on Failures

Consider setting up alerts if too many reminders fail:

```sql
-- Alert if more than 20% of today's reminders failed
SELECT 
  CASE 
    WHEN CAST(failed AS FLOAT) / total > 0.2 THEN 'ALERT: High failure rate!'
    ELSE 'OK'
  END as status,
  total,
  failed,
  ROUND(CAST(failed AS FLOAT) / total * 100, 1) as failure_rate_percent
FROM (
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN status='FAILED' THEN 1 END) as failed
  FROM reminder_schedules
  WHERE DATE(sentAt) = DATE('now')
);
```

## Step 6: Verification

### Test Cron Execution

**Manual test (after deployment):**
```bash
curl -X GET https://your-domain.com/api/reminders/process \
  -H "Authorization: Bearer <REMINDER_CRON_SECRET>" \
  -H "Content-Type: application/json"
```

Expected response (200 OK):
```json
{
  "success": true,
  "data": {
    "total": 3,
    "sent": 3,
    "failed": 0,
    "startTime": "2026-04-17T10:00:00.000Z",
    "endTime": "2026-04-17T10:00:02.500Z",
    "results": [...]
  },
  "message": "Processed 3 pending reminders: 3 sent, 0 failed"
}
```

### Error Scenarios

**Invalid secret:**
```bash
curl -X GET https://your-domain.com/api/reminders/process \
  -H "Authorization: Bearer wrong_secret"
```
Expected: 401 Unauthorized

**Missing header:**
```bash
curl -X GET https://your-domain.com/api/reminders/process
```
Expected: 401 Unauthorized

## Step 7: Ongoing Maintenance

### Monthly Health Check

```sql
-- Average reminders per day
SELECT 
  DATE(createdAt) as date,
  COUNT(*) as count,
  COUNT(CASE WHEN status='SENT' THEN 1 END) as sent,
  COUNT(CASE WHEN status='FAILED' THEN 1 END) as failed
FROM reminder_schedules
WHERE DATE(createdAt) >= DATE('now', '-30 days')
GROUP BY DATE(createdAt)
ORDER BY date DESC;
```

### Retry Failed Reminders (Manual)

```sql
-- Manually retry failed reminders older than 3 days
UPDATE reminder_schedules
SET status = 'PENDING', errorLog = NULL
WHERE status = 'FAILED'
  AND createdAt < datetime('now', '-3 days')
  AND (SELECT COUNT(*) FROM reminder_schedules WHERE status='PENDING') < 100;
```

Then trigger cron manually or wait for next hourly execution.

### Cleanup Old Records (Optional)

```sql
-- Delete sent/failed reminders older than 90 days
DELETE FROM reminder_schedules
WHERE (status IN ('SENT', 'FAILED'))
  AND sentAt < datetime('now', '-90 days');
```

## Troubleshooting

### Cron Not Triggering

**Check:** Is the cron service running?
- EasyCron: Dashboard → "Last execution" timestamp
- AWS: EventBridge → Rule → "Last execution" and logs in CloudWatch
- GitHub Actions: Actions tab → workflow runs

**Fix:** Verify URL, Authorization header, and cron schedule in service config

### Reminders Not Sending

1. **Check reminders exist:** `SELECT * FROM reminder_schedules WHERE status='PENDING';`
2. **Check SMS credentials:** Are AFRICASTALKING_* / TWILIO_* env vars set correctly?
3. **Check mother consent:** `SELECT * FROM consent_records WHERE type='SMS_COMMUNICATION';`
4. **Check mother phone:** Is phone number valid and formatted with country code?

### High Failure Rate

1. Check SMS gateway status (Africa's Talking / Twilio)
2. Verify mother phone numbers are valid
3. Check error logs: `SELECT DISTINCT errorLog FROM reminder_schedules WHERE status='FAILED';`

## Rollback Plan

If issues occur:

1. **Stop cron service:** Disable/pause the cron job
2. **Pause reminders:** Set all PENDING reminders to status='CANCELLED' manually
3. **Investigate:** Review logs and error_logs
4. **Fix:** Update code/config
5. **Resume:** Re-enable cron with fixed configuration

```sql
-- Emergency stop: Mark all pending as cancelled
UPDATE reminder_schedules
SET status = 'FAILED', errorLog = 'System maintenance - paused'
WHERE status = 'PENDING';
```

## Support

For issues or questions:
1. Check REMINDER_TESTING_GUIDE.md for manual testing
2. Review application logs for error details
3. Query database for ReminderSchedule and SmsLog records
4. Verify SMS gateway credentials and API responses
