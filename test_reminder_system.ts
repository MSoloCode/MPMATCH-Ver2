/**
 * Integration test for ANC Appointment Reminder System
 * Tests the complete flow from ANC visit creation to reminder processing
 * 
 * Run with: npx ts-node test_reminder_system.ts
 * (Requires NODE_ENV=development and DATABASE_URL configured)
 */

import { db } from './lib/db';
import { processReminders } from './services/reminder';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    console.log(`\n📋 Running: ${name}...`);
    await fn();
    results.push({ name, passed: true });
    console.log(`✅ PASSED: ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: message });
    console.log(`❌ FAILED: ${name}`);
    console.log(`   Error: ${message}`);
  }
}

async function runTests() {
  console.log('🚀 ANC Appointment Reminder System - Integration Tests\n');
  console.log('='.repeat(60));

  // ========================================================================
  // TEST 1: Verify ReminderSchedule schema exists
  // ========================================================================
  await test('Schema: ReminderSchedule table exists', async () => {
    const reminder = await db.reminderSchedule.findFirst({
      take: 1,
    });
    // Should not throw - table exists
  });

  // ========================================================================
  // TEST 2: Create test mother
  // ========================================================================
  let testMotherId: number;
  await test('Create test mother for reminders', async () => {
    const mother = await db.mother.create({
      data: {
        fullName: 'Test Mother - Reminders',
        phone: '+256701999888',
        districtId: 1,
        facilityId: 1,
        consentAccepted: true,
      },
    });
    testMotherId = mother.id;
    console.log(`   Created mother ID: ${testMotherId}`);
  });

  // ========================================================================
  // TEST 3: Create test pregnancy
  // ========================================================================
  let testPregnancyId: number;
  await test('Create test pregnancy for reminders', async () => {
    // Find an admin user to open the pregnancy
    const adminUser = await db.user.findFirst({
      where: { role: 'SYSTEM_ADMIN' },
    });
    
    if (!adminUser) {
      throw new Error('No SYSTEM_ADMIN user found - cannot create pregnancy');
    }

    const pregnancy = await db.pregnancy.create({
      data: {
        motherId: testMotherId!,
        status: 'ACTIVE',
        antenatalStatus: 'ACTIVE',
        openedById: adminUser.id,
      },
    });
    testPregnancyId = pregnancy.id;
    console.log(`   Created pregnancy ID: ${testPregnancyId}`);
  });

  // ========================================================================
  // TEST 4: Create ANC visit with nextAppointment
  // ========================================================================
  let testAncVisitId: number;
  let testNextAppointment: Date;
  await test('Create ANC visit with nextAppointment set', async () => {
    // Find a clinical user who can create visits
    const clinicalUser = await db.user.findFirst({
      where: { role: { in: ['DOCTOR', 'NURSE', 'MIDWIFE'] } },
    });

    if (!clinicalUser) {
      throw new Error('No clinical user found - cannot create ANC visit');
    }

    // Set appointment for tomorrow
    testNextAppointment = new Date();
    testNextAppointment.setDate(testNextAppointment.getDate() + 1);
    testNextAppointment.setHours(10, 0, 0, 0);

    const ancVisit = await db.ancVisit.create({
      data: {
        pregnancyId: testPregnancyId!,
        motherId: testMotherId!,
        visitNumber: 1,
        visitType: 'ROUTINE',
        visitDateTime: new Date(),
        nextAppointment: testNextAppointment,
        notes: 'Test ANC visit for reminder system',
        createdById: clinicalUser.id,
      },
    });
    testAncVisitId = ancVisit.id;
    console.log(`   Created ANC visit ID: ${testAncVisitId}`);
    console.log(`   Next appointment: ${testNextAppointment.toISOString()}`);
  });

  // ========================================================================
  // TEST 5: Verify ReminderSchedule was created
  // ========================================================================
  await test('ReminderSchedule created automatically for ANC visit', async () => {
    const reminder = await db.reminderSchedule.findFirst({
      where: {
        ancVisitId: testAncVisitId!,
        motherId: testMotherId!,
      },
    });

    if (!reminder) {
      throw new Error(
        `No reminder found for ANC visit ${testAncVisitId} and mother ${testMotherId}`
      );
    }

    if (reminder.status !== 'PENDING') {
      throw new Error(`Reminder status is "${reminder.status}", expected "PENDING"`);
    }

    if (reminder.type !== 'ANC_REMINDER') {
      throw new Error(`Reminder type is "${reminder.type}", expected "ANC_REMINDER"`);
    }

    // Verify sendAt is 24h before appointment
    const expectedSendAt = new Date(testNextAppointment!.getTime() - 24 * 60 * 60 * 1000);
    const timeDiff = Math.abs(
      reminder.sendAt.getTime() - expectedSendAt.getTime()
    );
    if (timeDiff > 1000) { // Allow 1 second difference for rounding
      throw new Error(
        `sendAt time is incorrect. Expected ${expectedSendAt.toISOString()}, got ${reminder.sendAt.toISOString()}`
      );
    }

    console.log(`   ✓ Reminder ID: ${reminder.id}`);
    console.log(`   ✓ Status: ${reminder.status}`);
    console.log(`   ✓ Type: ${reminder.type}`);
    console.log(`   ✓ Send at (24h before): ${reminder.sendAt.toISOString()}`);
  });

  // ========================================================================
  // TEST 6: Create overdue reminder (sendAt in the past)
  // ========================================================================
  let testOverdueReminderId: number;
  await test('Create overdue reminder for processing test', async () => {
    // Create a reminder that should be sent NOW
    const sendAtTime = new Date();
    sendAtTime.setHours(sendAtTime.getHours() - 1); // 1 hour ago

    const reminder = await db.reminderSchedule.create({
      data: {
        motherId: testMotherId!,
        sendAt: sendAtTime,
        type: 'ANC_REMINDER',
        status: 'PENDING',
      },
    });
    testOverdueReminderId = reminder.id;
    console.log(`   Created overdue reminder ID: ${testOverdueReminderId}`);
    console.log(`   Scheduled to send: ${sendAtTime.toISOString()} (in the past)`);
  });

  // ========================================================================
  // TEST 7: Process reminders
  // ========================================================================
  let processingSummary: any;
  await test('Process pending reminders', async () => {
    processingSummary = await processReminders();

    console.log(`   Total processed: ${processingSummary.total}`);
    console.log(`   Sent: ${processingSummary.sent}`);
    console.log(`   Failed: ${processingSummary.failed}`);
    console.log(`   Duration: ${processingSummary.endTime.getTime() - processingSummary.startTime.getTime()}ms`);

    if (processingSummary.total === 0) {
      console.log(`   ⚠️  Warning: No reminders were processed`);
    }
  });

  // ========================================================================
  // TEST 8: Verify reminder status updated after processing
  // ========================================================================
  await test('Verify overdue reminder marked as SENT or FAILED', async () => {
    const reminder = await db.reminderSchedule.findUnique({
      where: { id: testOverdueReminderId! },
    });

    if (!reminder) {
      throw new Error(`Reminder ${testOverdueReminderId} not found after processing`);
    }

    const validStatuses = ['SENT', 'FAILED'];
    if (!validStatuses.includes(reminder.status)) {
      throw new Error(
        `Reminder status is "${reminder.status}", expected SENT or FAILED`
      );
    }

    if (reminder.status === 'SENT' && !reminder.sentAt) {
      throw new Error('Reminder marked SENT but sentAt timestamp is missing');
    }

    if (reminder.status === 'FAILED' && !reminder.errorLog) {
      throw new Error('Reminder marked FAILED but errorLog is missing');
    }

    console.log(`   ✓ Reminder status: ${reminder.status}`);
    if (reminder.sentAt) {
      console.log(`   ✓ Sent at: ${reminder.sentAt.toISOString()}`);
    }
    if (reminder.errorLog) {
      console.log(`   ✓ Error log: ${reminder.errorLog}`);
    }
  });

  // ========================================================================
  // CLEANUP
  // ========================================================================
  console.log('\n🧹 Cleaning up test data...');
  try {
    // Delete test data in reverse order (respect foreign keys)
    await db.reminderSchedule.deleteMany({
      where: { motherId: testMotherId! },
    });
    await db.ancVisit.deleteMany({
      where: { pregnancyId: testPregnancyId! },
    });
    await db.pregnancy.deleteMany({
      where: { motherId: testMotherId! },
    });
    await db.mother.delete({
      where: { id: testMotherId! },
    });
    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.error('⚠️  Error cleaning up test data:', error);
  }

  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY\n');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  results.forEach((result) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    if (result.error) {
      console.log(`   ${result.error}`);
    }
  });

  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(60));

  if (failed === 0) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
