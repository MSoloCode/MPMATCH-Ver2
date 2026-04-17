/**
 * Test script for pregnancy endpoints
 * Tests: POST (create), GET (list), GET (detail), PATCH (status)
 */

const BASE_URL = 'http://localhost:3000/api';

// Sample test data
const testData = {
  // You need a real JWT token from auth/login or use a test token
  authToken: 'YOUR_JWT_TOKEN_HERE',

  // Get a real mother ID from your database
  motherId: 1,

  // Test pregnancy creation
  newPregnancy: {
    motherId: 1,
    lmpDate: '2026-01-15',
    gravida: 2,
    parity: 1,
    multiplePregnancy: 'NONE',
    riskFactors: ['Hypertension', 'Diabetes'],
    antenatalStatus: 'ACTIVE',
    obstetricHistory: [
      {
        year: 2024,
        outcome: 'LIVE_BIRTH',
        deliveryMode: 'SVD',
        complications: ['Episiotomy'],
      },
    ],
  },

  // Delivery data for PATCH
  delivery: {
    status: 'DELIVERED',
    deliveryDate: '2026-04-17',
    deliveryOutcome: 'LIVE_BIRTH',
    deliveryMode: 'C_SECTION',
    babyWeightKg: 3.2,
    complications: ['Post-delivery hemorrhage'],
  },
};

async function makeRequest(
  method: string,
  endpoint: string,
  body?: any
): Promise<any> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${testData.authToken}`,
  };

  const options: RequestInit = {
    method,
    headers,
    ...(body && { body: JSON.stringify(body) }),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await response.json();

  return {
    status: response.status,
    data,
  };
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('PREGNANCY ENDPOINTS TEST SUITE');
  console.log('='.repeat(70));

  try {
    // ====================================================================
    // TEST 1: POST /api/pregnancies (Create)
    // ====================================================================
    console.log('\n[TEST 1] POST /api/pregnancies - Create new pregnancy');
    console.log('-'.repeat(70));
    const createResponse = await makeRequest(
      'POST',
      '/pregnancies',
      testData.newPregnancy
    );
    console.log(`Status: ${createResponse.status}`);
    console.log(`Response:`, JSON.stringify(createResponse.data, null, 2));

    if (createResponse.status !== 201) {
      console.error('❌ FAILED: Expected status 201, got', createResponse.status);
      return;
    }

    if (!createResponse.data.data?.pregnancyId) {
      console.error('❌ FAILED: Response missing pregnancyId');
      return;
    }

    const pregnancyId = createResponse.data.data.pregnancyId;
    console.log(`✓ PASSED: Pregnancy created with ID ${pregnancyId}`);

    // ====================================================================
    // TEST 2: GET /api/pregnancies (List)
    // ====================================================================
    console.log('\n[TEST 2] GET /api/pregnancies - List pregnancies');
    console.log('-'.repeat(70));
    const listResponse = await makeRequest(
      'GET',
      `/pregnancies?status=ACTIVE&skip=0&take=10`
    );
    console.log(`Status: ${listResponse.status}`);
    console.log(`Response:`, JSON.stringify(listResponse.data, null, 2));

    if (listResponse.status !== 200) {
      console.error('❌ FAILED: Expected status 200, got', listResponse.status);
      return;
    }

    if (!Array.isArray(listResponse.data.data)) {
      console.error('❌ FAILED: Response data is not an array');
      return;
    }

    console.log(`✓ PASSED: Listed ${listResponse.data.data.length} pregnancies`);

    // ====================================================================
    // TEST 3: GET /api/pregnancies/:id (Detail)
    // ====================================================================
    console.log('\n[TEST 3] GET /api/pregnancies/:id - Get pregnancy detail');
    console.log('-'.repeat(70));
    const detailResponse = await makeRequest('GET', `/pregnancies/${pregnancyId}`);
    console.log(`Status: ${detailResponse.status}`);
    console.log(
      `Response:`,
      JSON.stringify(
        {
          ...detailResponse.data,
          data: {
            ...detailResponse.data.data,
            ancVisits: `[${detailResponse.data.data?.ancVisits?.length || 0} visits]`,
            clinicalArchives: `[${detailResponse.data.data?.clinicalArchives?.length || 0} archives]`,
          },
        },
        null,
        2
      )
    );

    if (detailResponse.status !== 200) {
      console.error(
        '❌ FAILED: Expected status 200, got',
        detailResponse.status
      );
      return;
    }

    if (detailResponse.data.data?.id !== pregnancyId) {
      console.error('❌ FAILED: Retrieved pregnancy ID does not match');
      return;
    }

    const isHighRisk = detailResponse.data.data?.isHighRisk;
    if (!isHighRisk) {
      console.warn(
        '⚠ WARNING: isHighRisk should be true (has risk factors: Hypertension, Diabetes)'
      );
    }

    console.log(`✓ PASSED: Retrieved pregnancy detail with isHighRisk=${isHighRisk}`);

    // ====================================================================
    // TEST 4: PATCH /api/pregnancies/:id/status (Deliver)
    // ====================================================================
    console.log('\n[TEST 4] PATCH /api/pregnancies/:id/status - Deliver pregnancy');
    console.log('-'.repeat(70));
    const deliverResponse = await makeRequest(
      'PATCH',
      `/pregnancies/${pregnancyId}/status`,
      testData.delivery
    );
    console.log(`Status: ${deliverResponse.status}`);
    console.log(`Response:`, JSON.stringify(deliverResponse.data, null, 2));

    if (deliverResponse.status !== 200) {
      console.error(
        '❌ FAILED: Expected status 200, got',
        deliverResponse.status
      );
      return;
    }

    if (deliverResponse.data.data?.status !== 'DELIVERED') {
      console.error('❌ FAILED: Pregnancy status not updated to DELIVERED');
      return;
    }

    if (!deliverResponse.data.data?.followUpAppointmentId) {
      console.error('❌ FAILED: Postnatal follow-up appointment not created');
      return;
    }

    console.log(
      `✓ PASSED: Pregnancy delivered with follow-up appointment ID ${deliverResponse.data.data.followUpAppointmentId}`
    );

    // ====================================================================
    // TEST 5: PATCH /api/pregnancies/:id/status (Close)
    // ====================================================================
    console.log('\n[TEST 5] PATCH /api/pregnancies/:id/status - Close pregnancy');
    console.log('-'.repeat(70));
    const closeResponse = await makeRequest(
      'PATCH',
      `/pregnancies/${pregnancyId}/status`,
      { status: 'CLOSED' }
    );
    console.log(`Status: ${closeResponse.status}`);
    console.log(`Response:`, JSON.stringify(closeResponse.data, null, 2));

    if (closeResponse.status !== 200) {
      console.error('❌ FAILED: Expected status 200, got', closeResponse.status);
      return;
    }

    if (closeResponse.data.data?.status !== 'CLOSED') {
      console.error('❌ FAILED: Pregnancy status not updated to CLOSED');
      return;
    }

    console.log(`✓ PASSED: Pregnancy closed successfully`);

    // ====================================================================
    // SUMMARY
    // ====================================================================
    console.log('\n' + '='.repeat(70));
    console.log('✓ ALL TESTS PASSED');
    console.log('='.repeat(70));
  } catch (error) {
    console.error('\n❌ TEST ERROR:', error);
  }
}

// Run tests
runTests();
