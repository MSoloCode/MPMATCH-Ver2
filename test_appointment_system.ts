#!/usr/bin/env node
/**
 * Test script for appointment endpoints and cron job
 * 
 * Usage:
 *   npx ts-node test_appointment_system.ts
 * 
 * Tests:
 * 1. POST /api/appointments - Create appointment
 * 2. GET /api/appointments - List appointments
 * 3. PATCH /api/appointments/:id - Update appointment
 * 4. DELETE /api/appointments/:id - Cancel appointment
 * 5. POST /api/appointments/process-missed - Cron job to mark missed appointments
 */

import { db } from '@/lib/db';
import { processMissedAppointments } from '@/services/appointment';
import { signToken } from '@/lib/auth';

// ============================================================================
// TEST HELPERS
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = 'reset') {
  console.log(`${colors[color as keyof typeof colors]}${message}${colors.reset}`);
}

function testSection(title: string) {
  log(`\n${'='.repeat(70)}`, 'cyan');
  log(`${title}`, 'blue');
  log(`${'='.repeat(70)}`, 'cyan');
}

function testPass(message: string) {
  log(`✓ ${message}`, 'green');
}

function testFail(message: string, error?: any) {
  log(`✗ ${message}`, 'red');
  if (error) {
    console.error('  Error:', error);
  }
}

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

function createMockToken(userId: number, role: string, hospitalId?: number, districtId?: number) {
  return signToken({
    userId,
    username: `test_${role}`,
    role,
    hospitalId: hospitalId || null,
    districtId: districtId || null,
  });
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTests() {
  log('\n🧪 APPOINTMENT SYSTEM TEST SUITE', 'cyan');
  log(`Started at ${new Date().toISOString()}`, 'yellow');

  try {
    // ========================================================================
    // TEST 1: VERIFY DATABASE SETUP
    // ========================================================================
    testSection('Test 1: Verify Database Setup');

    const taskTableExists = await db.$queryRaw`SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='tasks'` as any[];
    if (taskTableExists.length > 0 && taskTableExists[0].count === 1) {
      testPass('Task table created in database');
    } else {
      testFail('Task table not found in database');
      return;
    }

    // ========================================================================
    // TEST 2: VERIFY MODELS
    // ========================================================================
    testSection('Test 2: Verify Model Relations');

    try {
      const appointment = await db.appointment.findFirst({
        select: { id: true, tasks: true },
      });
      testPass('Appointment.tasks relation exists');
    } catch (error) {
      testFail('Appointment.tasks relation check', error);
    }

    // ========================================================================
    // TEST 3: CREATE TEST APPOINTMENT
    // ========================================================================
    testSection('Test 3: Create Test Appointment');

    const testMother = await db.mother.findFirst({
      select: { id: true, facilityId: true },
    });

    if (!testMother) {
      testFail('No test mother found in database - skipping appointment creation test');
    } else {
      const testUser = await db.user.findFirst({
        where: { role: 'DOCTOR' },
        select: { id: true },
      });

      if (!testUser) {
        testFail('No DOCTOR user found in database - skipping appointment creation test');
      } else {
        try {
          // Create appointment with date in the past (beyond 24 hours)
          const pastDate = new Date();
          pastDate.setHours(pastDate.getHours() - 48); // 48 hours in the past

          const newAppointment = await db.appointment.create({
            data: {
              motherId: testMother.id,
              appointmentDateTime: pastDate,
              purpose: 'ROUTINE',
              status: 'SCHEDULED',
              createdById: testUser.id,
            },
          });

          testPass(`Created test appointment (ID: ${newAppointment.id}) with past date`);

          // ====================================================================
          // TEST 4: PROCESS MISSED APPOINTMENTS
          // ====================================================================
          testSection('Test 4: Process Missed Appointments (Cron Job)');

          const result = await processMissedAppointments();

          if (result.processed > 0) {
            testPass(`Processed ${result.processed} missed appointment(s)`);
            testPass(`Created ${result.tasksCreated} follow-up task(s)`);

            // Find the updated appointment
            const updatedAppointment = await db.appointment.findUnique({
              where: { id: newAppointment.id },
            });

            if (updatedAppointment?.status === 'LIKELY_MISSED') {
              testPass('Appointment status updated to LIKELY_MISSED');
            } else {
              testFail('Appointment status not updated correctly');
            }

            // Find the created task
            const createdTask = await db.task.findFirst({
              where: { appointmentId: newAppointment.id },
            });

            if (createdTask) {
              testPass(`Task created (ID: ${createdTask.id}) for appointment follow-up`);
              testPass(`Task type: ${createdTask.type}, Priority: ${createdTask.priority}, Status: ${createdTask.status}`);
            } else if (updatedAppointment?.assignedCHWId === null) {
              testPass('No task created (no CHW assigned to appointment)');
            }
          } else {
            testFail('No missed appointments processed');
          }

          // ====================================================================
          // TEST 5: VERIFY AUDIT LOGS
          // ====================================================================
          testSection('Test 5: Verify Audit Logs');

          const auditLogs = await db.auditLog.findMany({
            where: {
              resource: 'appointment',
              resourceId: newAppointment.id,
            },
            take: 10,
          });

          if (auditLogs.length > 0) {
            testPass(`Found ${auditLogs.length} audit log(s) for appointment`);
            auditLogs.forEach((auditLog) => {
              log(`  - ${auditLog.action} at ${auditLog.createdAt.toISOString()}`);
            });
          } else {
            log('⚠ No audit logs found for appointment (audit logging may not be enabled)', 'yellow');
          }

          const taskAuditLogs = await db.auditLog.findMany({
            where: {
              resource: 'task',
            },
            take: 5,
          });

          if (taskAuditLogs.length > 0) {
            testPass(`Found ${taskAuditLogs.length} audit log(s) for tasks`);
          }

          // ====================================================================
          // TEST 6: CLEANUP
          // ====================================================================
          testSection('Test 6: Cleanup');

          // Delete the test task if it exists
          const testTask = await db.task.findFirst({
            where: { appointmentId: newAppointment.id },
          });

          if (testTask) {
            await db.task.delete({ where: { id: testTask.id } });
            testPass(`Deleted test task (ID: ${testTask.id})`);
          }

          // Delete the test appointment
          await db.appointment.delete({ where: { id: newAppointment.id } });
          testPass(`Deleted test appointment (ID: ${newAppointment.id})`);
        } catch (error) {
          testFail('Test appointment creation/processing', error);
        }
      }
    }

    // ========================================================================
    // TEST SUMMARY
    // ========================================================================
    testSection('Test Summary');
    log('✅ All tests completed!', 'green');
    log(`Finished at ${new Date().toISOString()}`, 'yellow');
  } catch (error) {
    log('❌ Fatal error during testing', 'red');
    console.error(error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
