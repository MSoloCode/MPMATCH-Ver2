import { notifyMidwife, notifyCHW, notifyFacilityEmergency, NotifyResponse } from '../services/notify';
import { sendSMS } from '../services/sms';
import { db } from '@/lib/db';

// Mock the database and sendSMS
jest.mock('@/lib/db', () => ({
  db: {
    mother: {
      findUnique: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    facility: {
      findUnique: jest.fn(),
    },
    consentRecord: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../services/sms', () => ({
  sendSMS: jest.fn(),
}));

describe('notifyMidwife', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should send SMS to midwife when all conditions are met', async () => {
    const motherId = 1;
    const message = 'High BP alert';

    // Mock mother record
    (db.mother.findUnique as jest.Mock).mockResolvedValue({
      id: motherId,
      phone: '0701234567',
      facilityId: 5,
      districtId: 3,
      facility: { id: 5, districtId: 3 },
    });

    // Mock consent check
    (db.consentRecord.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        motherId: motherId,
        type: 'SMS_COMMUNICATION',
        acceptedAt: new Date('2024-04-22'),
      },
    ]);

    // Mock midwife lookup
    (db.user.findFirst as jest.Mock).mockResolvedValue({
      id: 10,
      name: 'Sarah Midwife',
      phone: '0702345678',
    });

    // Mock sendSMS
    (sendSMS as jest.Mock).mockResolvedValue({
      sent: true,
      messageId: 'at-msg-123',
    });

    const result = await notifyMidwife(motherId, message);

    expect(result.sent).toBe(true);
    expect(result.smsMessageId).toBe('at-msg-123');
    expect(sendSMS).toHaveBeenCalledWith({
      to: '0702345678',
      message: message,
      type: 'MIDWIFE_NOTIFICATION',
      userId: motherId,
    });
  });

  it('should return OPT_OUT error when mother has opted out', async () => {
    const motherId = 1;
    const message = 'High BP alert';

    // Mock mother record
    (db.mother.findUnique as jest.Mock).mockResolvedValue({
      id: motherId,
      phone: '0701234567',
      facilityId: 5,
      districtId: 3,
      facility: { id: 5, districtId: 3 },
    });

    // Mock consent check - no valid consent
    (db.consentRecord.findMany as jest.Mock).mockResolvedValue([]);

    const result = await notifyMidwife(motherId, message);

    expect(result.sent).toBe(false);
    expect(result.error).toBe('OPT_OUT');
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('should return NO_MIDWIFE_AVAILABLE when no midwife found', async () => {
    const motherId = 1;
    const message = 'High BP alert';

    // Mock mother record
    (db.mother.findUnique as jest.Mock).mockResolvedValue({
      id: motherId,
      phone: '0701234567',
      facilityId: 5,
      districtId: 3,
      facility: { id: 5, districtId: 3 },
    });

    // Mock consent check
    (db.consentRecord.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        motherId: motherId,
        type: 'SMS_COMMUNICATION',
        acceptedAt: new Date('2024-04-22'),
      },
    ]);

    // Mock midwife lookup - no midwife found
    (db.user.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await notifyMidwife(motherId, message);

    expect(result.sent).toBe(false);
    expect(result.error).toBe('NO_MIDWIFE_AVAILABLE');
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('should return MOTHER_NOT_FOUND when mother does not exist', async () => {
    const motherId = 999;
    const message = 'High BP alert';

    // Mock mother record - not found
    (db.mother.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await notifyMidwife(motherId, message);

    expect(result.sent).toBe(false);
    expect(result.error).toBe('MOTHER_NOT_FOUND');
  });

  it('should return error when SMS send fails', async () => {
    const motherId = 1;
    const message = 'High BP alert';

    // Mock mother record
    (db.mother.findUnique as jest.Mock).mockResolvedValue({
      id: motherId,
      phone: '0701234567',
      facilityId: 5,
      districtId: 3,
      facility: { id: 5, districtId: 3 },
    });

    // Mock consent check
    (db.consentRecord.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        motherId: motherId,
        type: 'SMS_COMMUNICATION',
        acceptedAt: new Date('2024-04-22'),
      },
    ]);

    // Mock midwife lookup
    (db.user.findFirst as jest.Mock).mockResolvedValue({
      id: 10,
      name: 'Sarah Midwife',
      phone: '0702345678',
    });

    // Mock sendSMS failure
    (sendSMS as jest.Mock).mockResolvedValue({
      sent: false,
      error: 'Gateway timeout',
    });

    const result = await notifyMidwife(motherId, message);

    expect(result.sent).toBe(false);
    expect(result.error).toBe('SMS_SEND_FAILED');
  });
});

describe('notifyCHW', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should send SMS to CHW when all conditions are met', async () => {
    const motherId = 2;
    const message = 'Appointment reminder';

    // Mock mother record with CHW
    (db.mother.findUnique as jest.Mock).mockResolvedValue({
      id: motherId,
      chwId: 20,
      chw: {
        id: 20,
        name: 'John CHW',
        phone: '0703456789',
        isActive: true,
      },
    });

    // Mock consent check
    (db.consentRecord.findMany as jest.Mock).mockResolvedValue([
      {
        id: 2,
        motherId: motherId,
        type: 'SMS_COMMUNICATION',
        acceptedAt: new Date('2024-04-22'),
      },
    ]);

    // Mock sendSMS
    (sendSMS as jest.Mock).mockResolvedValue({
      sent: true,
      messageId: 'at-msg-456',
    });

    const result = await notifyCHW(motherId, message);

    expect(result.sent).toBe(true);
    expect(result.smsMessageId).toBe('at-msg-456');
    expect(sendSMS).toHaveBeenCalledWith({
      to: '0703456789',
      message: message,
      type: 'CHW_NOTIFICATION',
      userId: motherId,
    });
  });

  it('should return NO_CHW_ASSIGNED when no CHW assigned', async () => {
    const motherId = 2;
    const message = 'Appointment reminder';

    // Mock mother record without CHW
    (db.mother.findUnique as jest.Mock).mockResolvedValue({
      id: motherId,
      chwId: null,
      chw: null,
    });

    const result = await notifyCHW(motherId, message);

    expect(result.sent).toBe(false);
    expect(result.error).toBe('NO_CHW_ASSIGNED');
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('should return OPT_OUT when mother has opted out', async () => {
    const motherId = 2;
    const message = 'Appointment reminder';

    // Mock mother record with CHW
    (db.mother.findUnique as jest.Mock).mockResolvedValue({
      id: motherId,
      chwId: 20,
      chw: {
        id: 20,
        name: 'John CHW',
        phone: '0703456789',
        isActive: true,
      },
    });

    // Mock consent check - no consent
    (db.consentRecord.findMany as jest.Mock).mockResolvedValue([]);

    const result = await notifyCHW(motherId, message);

    expect(result.sent).toBe(false);
    expect(result.error).toBe('OPT_OUT');
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('should return CHW_INACTIVE when assigned CHW is inactive', async () => {
    const motherId = 2;
    const message = 'Appointment reminder';

    // Mock mother record with inactive CHW
    (db.mother.findUnique as jest.Mock).mockResolvedValue({
      id: motherId,
      chwId: 20,
      chw: {
        id: 20,
        name: 'John CHW',
        phone: '0703456789',
        isActive: false,
      },
    });

    const result = await notifyCHW(motherId, message);

    expect(result.sent).toBe(false);
    expect(result.error).toBe('CHW_INACTIVE');
    expect(sendSMS).not.toHaveBeenCalled();
  });
});

describe('notifyFacilityEmergency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should send SMS to emergency phone when available', async () => {
    const facilityId = 5;
    const message = 'EMERGENCY: Mother requiring urgent admission';

    // Mock facility record
    (db.facility.findUnique as jest.Mock).mockResolvedValue({
      id: facilityId,
      name: 'Central Hospital',
      emergencyPhone: '+256701234567',
      onCallPhone: null,
      ambulancePhone: null,
      backupPhone: null,
    });

    // Mock sendSMS
    (sendSMS as jest.Mock).mockResolvedValue({
      sent: true,
      messageId: 'at-msg-789',
    });

    const result = await notifyFacilityEmergency(facilityId, message);

    expect(result.sent).toBe(true);
    expect(result.smsMessageId).toBe('at-msg-789');
    expect(sendSMS).toHaveBeenCalledWith({
      to: '+256701234567',
      message: message,
      type: 'FACILITY_EMERGENCY',
    });
    // Verify no userId passed (consent check bypassed)
    expect((sendSMS as jest.Mock).mock.calls[0][0].userId).toBeUndefined();
  });

  it('should fallback to onCallPhone when emergencyPhone unavailable', async () => {
    const facilityId = 5;
    const message = 'EMERGENCY: Mother requiring urgent admission';

    // Mock facility record with fallback phones
    (db.facility.findUnique as jest.Mock).mockResolvedValue({
      id: facilityId,
      name: 'Central Hospital',
      emergencyPhone: null,
      onCallPhone: '+256702234567',
      ambulancePhone: null,
      backupPhone: null,
    });

    // Mock sendSMS
    (sendSMS as jest.Mock).mockResolvedValue({
      sent: true,
      messageId: 'at-msg-789',
    });

    const result = await notifyFacilityEmergency(facilityId, message);

    expect(result.sent).toBe(true);
    expect(sendSMS).toHaveBeenCalledWith({
      to: '+256702234567',
      message: message,
      type: 'FACILITY_EMERGENCY',
    });
  });

  it('should fallback to ambulancePhone when emergencyPhone and onCallPhone unavailable', async () => {
    const facilityId = 5;
    const message = 'EMERGENCY: Ambulance needed';

    // Mock facility record with fallback phones
    (db.facility.findUnique as jest.Mock).mockResolvedValue({
      id: facilityId,
      name: 'Central Hospital',
      emergencyPhone: null,
      onCallPhone: null,
      ambulancePhone: '+256703234567',
      backupPhone: null,
    });

    // Mock sendSMS
    (sendSMS as jest.Mock).mockResolvedValue({
      sent: true,
      messageId: 'at-msg-789',
    });

    const result = await notifyFacilityEmergency(facilityId, message);

    expect(result.sent).toBe(true);
    expect(sendSMS).toHaveBeenCalledWith({
      to: '+256703234567',
      message: message,
      type: 'FACILITY_EMERGENCY',
    });
  });

  it('should fallback to backupPhone as last resort', async () => {
    const facilityId = 5;
    const message = 'EMERGENCY: Backup contact needed';

    // Mock facility record with only backupPhone
    (db.facility.findUnique as jest.Mock).mockResolvedValue({
      id: facilityId,
      name: 'Central Hospital',
      emergencyPhone: null,
      onCallPhone: null,
      ambulancePhone: null,
      backupPhone: '+256704234567',
    });

    // Mock sendSMS
    (sendSMS as jest.Mock).mockResolvedValue({
      sent: true,
      messageId: 'at-msg-789',
    });

    const result = await notifyFacilityEmergency(facilityId, message);

    expect(result.sent).toBe(true);
    expect(sendSMS).toHaveBeenCalledWith({
      to: '+256704234567',
      message: message,
      type: 'FACILITY_EMERGENCY',
    });
  });

  it('should return NO_EMERGENCY_PHONE when no phone available', async () => {
    const facilityId = 5;
    const message = 'EMERGENCY: Mother requiring urgent admission';

    // Mock facility record with no phones
    (db.facility.findUnique as jest.Mock).mockResolvedValue({
      id: facilityId,
      name: 'Central Hospital',
      emergencyPhone: null,
      onCallPhone: null,
      ambulancePhone: null,
      backupPhone: null,
    });

    const result = await notifyFacilityEmergency(facilityId, message);

    expect(result.sent).toBe(false);
    expect(result.error).toBe('NO_EMERGENCY_PHONE');
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('should return FACILITY_NOT_FOUND when facility does not exist', async () => {
    const facilityId = 999;
    const message = 'EMERGENCY: Facility not found';

    // Mock facility record - not found
    (db.facility.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await notifyFacilityEmergency(facilityId, message);

    expect(result.sent).toBe(false);
    expect(result.error).toBe('FACILITY_NOT_FOUND');
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('should bypass consent check (emergency override)', async () => {
    const facilityId = 5;
    const message = 'EMERGENCY: Critical alert';

    // Mock facility record
    (db.facility.findUnique as jest.Mock).mockResolvedValue({
      id: facilityId,
      name: 'Central Hospital',
      emergencyPhone: '+256701234567',
      onCallPhone: null,
      ambulancePhone: null,
      backupPhone: null,
    });

    // Mock sendSMS
    (sendSMS as jest.Mock).mockResolvedValue({
      sent: true,
      messageId: 'at-msg-789',
    });

    const result = await notifyFacilityEmergency(facilityId, message);

    expect(result.sent).toBe(true);
    // Verify consentRecord.findMany was NOT called (no consent check)
    expect(db.consentRecord.findMany).not.toHaveBeenCalled();
  });
});

describe('Input Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return error for invalid motherId in notifyMidwife', async () => {
    const result = await notifyMidwife(0, 'message');
    expect(result.sent).toBe(false);
    expect(result.error).toBe('INVALID_MOTHER_ID');
  });

  it('should return error for empty message in notifyMidwife', async () => {
    const result = await notifyMidwife(1, '');
    expect(result.sent).toBe(false);
    expect(result.error).toBe('INVALID_MESSAGE');
  });

  it('should return error for invalid facilityId in notifyFacilityEmergency', async () => {
    const result = await notifyFacilityEmergency(0, 'message');
    expect(result.sent).toBe(false);
    expect(result.error).toBe('INVALID_FACILITY_ID');
  });

  it('should return error for empty message in notifyFacilityEmergency', async () => {
    const result = await notifyFacilityEmergency(1, '   ');
    expect(result.sent).toBe(false);
    expect(result.error).toBe('INVALID_MESSAGE');
  });
});
