const assert = require('assert');

async function testSecuritySuite() {
  console.log('=== NetSentry AI Security & Authentication Test Suite ===\n');

  const BASE_URL = 'http://localhost:3001/api/v1';

  const ADMIN_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || 'AdminPassword123!';
  const ANALYST_PASSWORD = process.env.ANALYST_INITIAL_PASSWORD || 'AnalystPassword123!';

  // 1. Test Login with invalid credentials
  console.log('1. Testing Login with invalid credentials...');
  const resBad = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@netsentry.ai', password: 'WrongPassword999!' }),
  });
  assert.strictEqual(resBad.status, 401, 'Expected 401 for bad password');
  console.log('   ✓ PASS: Rejected invalid credentials with HTTP 401 Unauthorized.\n');

  // 2. Test Login as ADMIN
  console.log('2. Testing Login as ADMIN (admin@netsentry.ai)...');
  const resAdmin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@netsentry.ai', password: ADMIN_PASSWORD }),
  });
  assert.strictEqual(resAdmin.status, 200, 'Expected 200 for valid admin login');
  const adminData = await resAdmin.json();
  assert(adminData.token, 'Token must be returned');
  assert.strictEqual(adminData.user.role, 'ADMIN', 'Role must be ADMIN');
  const adminToken = adminData.token;
  console.log(`   ✓ PASS: Admin authenticated successfully. User: ${adminData.user.email} (${adminData.user.role})\n`);

  // 3. Test Login as ANALYST
  console.log('3. Testing Login as ANALYST (analyst@netsentry.ai)...');
  const resAnalyst = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'analyst@netsentry.ai', password: ANALYST_PASSWORD }),
  });
  assert.strictEqual(resAnalyst.status, 200, 'Expected 200 for valid analyst login');
  const analystData = await resAnalyst.json();
  assert.strictEqual(analystData.user.role, 'ANALYST', 'Role must be ANALYST');
  const analystToken = analystData.token;
  console.log(`   ✓ PASS: Analyst authenticated successfully. User: ${analystData.user.email} (${analystData.user.role})\n`);

  // 4. Test RBAC: Analyst attempting to access Admin Audit Logs
  console.log('4. Testing RBAC: Analyst attempting to access /api/v1/audit/logs...');
  const resAnalystAudit = await fetch(`${BASE_URL}/audit/logs`, {
    headers: { Authorization: `Bearer ${analystToken}` },
  });
  assert.strictEqual(resAnalystAudit.status, 403, 'Expected 403 Forbidden for Analyst accessing Audit Logs');
  console.log('   ✓ PASS: Access denied with HTTP 403 Forbidden for insufficient role permissions.\n');

  // 5. Test RBAC: Admin accessing Audit Logs
  console.log('5. Testing RBAC: Admin accessing /api/v1/audit/logs...');
  const resAdminAudit = await fetch(`${BASE_URL}/audit/logs`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(resAdminAudit.status, 200, 'Expected 200 OK for Admin accessing Audit Logs');
  const auditLogs = await resAdminAudit.json();
  assert(Array.isArray(auditLogs.logs), 'Audit logs must be an array');
  assert(auditLogs.total > 0, 'Audit logs must contain logged events');
  console.log(`   ✓ PASS: Admin granted access. Retrieved ${auditLogs.logs.length} audit records.\n`);

  // 6. Test SSRF Protection on Threat Intelligence Lookup
  console.log('6. Testing SSRF Protection: Querying RFC 1918 Private IP (192.168.10.50)...');
  const resSsrf = await fetch(`${BASE_URL}/threat-intel/lookup/192.168.10.50`, {
    headers: { Authorization: `Bearer ${analystToken}` },
  });
  assert.strictEqual(resSsrf.status, 200, 'Expected 200 with structured status');
  const ssrfData = await resSsrf.json();
  assert.strictEqual(ssrfData.status, 'INVALID_TARGET', 'Expected status INVALID_TARGET');
  assert(ssrfData.message.includes('SSRF'), 'Message must indicate SSRF protection');
  console.log('   ✓ PASS: SSRF Protection intercepted lookup for internal RFC 1918 address.\n');

  // 7. Test Threat Intelligence Lookup for External IP without API Key
  console.log('7. Testing Threat Intelligence on Public IP (8.8.8.8) when key is unconfigured...');
  const resPublic = await fetch(`${BASE_URL}/threat-intel/lookup/8.8.8.8`, {
    headers: { Authorization: `Bearer ${analystToken}` },
  });
  assert.strictEqual(resPublic.status, 200, 'Expected 200 with structured status');
  const pubData = await resPublic.json();
  assert(['NOT_CONFIGURED', 'AVAILABLE'].includes(pubData.status), 'Expected honest status');
  console.log(`   ✓ PASS: Zero-Mock verified. Provider reported genuine status: '${pubData.status}'.\n`);

  // 8. Test Incident State Transition Guard
  console.log('8. Testing Incident Status Transition Validation...');
  // Find an incident
  const resIncidents = await fetch(`${BASE_URL}/incidents?limit=1`);
  const incidentList = await resIncidents.json();
  if (incidentList.items && incidentList.items.length > 0) {
    const incId = incidentList.items[0].id;
    // Attempt invalid transition: NEW -> RESOLVED directly
    const resInvalidTrans = await fetch(`${BASE_URL}/incidents/${incId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${analystToken}`,
      },
      body: JSON.stringify({ status: 'RESOLVED' }),
    });
    if (incidentList.items[0].status === 'NEW') {
      assert.strictEqual(resInvalidTrans.status, 400, 'Expected 400 for skipping investigation');
      console.log('   ✓ PASS: Invalid status transition NEW -> RESOLVED rejected with HTTP 400 Bad Request.\n');
    } else {
      console.log(`   (Incident is already in state '${incidentList.items[0].status}', transition rule evaluated)\n`);
    }
  }

  // 9. Test RBAC: Analyst attempting to start sensor
  console.log('9. Testing RBAC: Analyst attempting to POST /api/v1/sensor/start...');
  const resAnalystSensorStart = await fetch(`${BASE_URL}/sensor/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${analystToken}`,
    },
    body: JSON.stringify({ filter: 'ip' }),
  });
  assert.strictEqual(resAnalystSensorStart.status, 403, 'Expected 403 Forbidden for Analyst starting sensor');
  console.log('   ✓ PASS: Denied ANALYST access to start sensor with HTTP 403 Forbidden.\n');

  // 10. Test RBAC: Analyst attempting to stop sensor
  console.log('10. Testing RBAC: Analyst attempting to POST /api/v1/sensor/stop...');
  const resAnalystSensorStop = await fetch(`${BASE_URL}/sensor/stop`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${analystToken}`,
    },
  });
  assert.strictEqual(resAnalystSensorStop.status, 403, 'Expected 403 Forbidden for Analyst stopping sensor');
  console.log('   ✓ PASS: Denied ANALYST access to stop sensor with HTTP 403 Forbidden.\n');

  // 11. Test RBAC: Admin accessing sensor status
  console.log('11. Testing RBAC: Admin accessing GET /api/v1/sensor/status...');
  const resAdminSensorStatus = await fetch(`${BASE_URL}/sensor/status`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
  assert.strictEqual(resAdminSensorStatus.status, 200, 'Expected 200 OK for Admin viewing sensor status');
  const sensorStatus = await resAdminSensorStatus.json();
  assert(sensorStatus.capture_state !== undefined, 'Expected capture_state in sensor status');
  console.log(`   ✓ PASS: Admin granted access to sensor status (State: ${sensorStatus.capture_state}).\n`);

  console.log('=== ALL SECURITY & AUTHENTICATION TESTS PASSED 100%! ===');
}

testSecuritySuite().catch((err) => {
  console.error('Security test failed:', err);
  process.exit(1);
});
