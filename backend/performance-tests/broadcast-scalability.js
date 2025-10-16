import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

export const options = {
  stages: [
    { duration: '1m', target: 100 }, // ramp up to 100 users over 1 minute
    { duration: '3m', target: 1000 }, // stay at 1000 users for 3 minutes
    { duration: '1m', target: 0 },    // ramp down to 0 users over 1 minute
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% of requests should be below 500ms
    'http_req_failed': ['rate<0.01'],   // http errors should be less than 1%
  },
};

const errors = new Counter('errors');

export default function () {
  const BASE_URL = 'http://localhost:3030'; // Backend API URL

  // Simulate user registration (if needed for token generation)
  // For simplicity, we'll assume a pre-existing user or mock authentication
  const email = `test-user-${__VU}-${__ITER}@example.com`;
  const password = 'SecurePass123!';

  // 1. Register a user (if not already registered)
  let res = http.post(`${BASE_URL}/users`, JSON.stringify({
    email: email,
    password: password,
    confirmPassword: password,
    roles: ['broadcaster'],
    captchaToken: 'mock-captcha-token', // Mock CAPTCHA
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'RegisterUser' },
  });
  check(res, { 'registered successfully': (r) => r.status === 201 || r.status === 409 }); // 409 if user already exists

  // 2. Login to get a JWT token
  res = http.post(`${BASE_URL}/authentication`, JSON.stringify({
    email: email,
    password: password,
    strategy: 'local',
    captcha: 'pixie', // Mock CAPTCHA for authentication
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'LoginUser' },
  });
  const authToken = res.json('accessToken');
  check(res, { 'logged in successfully': (r) => r.status === 200 && authToken !== undefined });

  if (!authToken) {
    errors.add(1);
    console.error(`Failed to get auth token for VU ${__VU}, ITER ${__ITER}`);
    sleep(1);
    return;
  }

  // 3. Create a broadcast session
  res = http.post(`${BASE_URL}/sessions`, JSON.stringify({
    type: 'broadcast',
    title: `Broadcast by VU ${__VU}`,
    description: 'K6 performance test broadcast',
    accessType: 'public',
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    tags: { name: 'CreateBroadcastSession' },
  });
  const sessionId = res.json('id');
  check(res, { 'broadcast session created': (r) => r.status === 201 && sessionId !== undefined });

  if (!sessionId) {
    errors.add(1);
    console.error(`Failed to create session for VU ${__VU}, ITER ${__ITER}`);
    sleep(1);
    return;
  }

  // 4. Simulate viewers joining the broadcast session
  // This part would typically involve LiveKit client-side simulation,
  // but for API-level performance testing, we'll simulate API calls.
  // In a real scenario, you'd use a custom k6 extension for WebRTC or a separate tool.

  // Simulate a viewer joining the session (API call)
  res = http.post(`${BASE_URL}/sessions/${sessionId}/join`, JSON.stringify({
    participantIdentity: `viewer-${__VU}-${__ITER}`,
    displayName: `Viewer ${__VU}`,
    role: 'viewer',
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    tags: { name: 'JoinBroadcastSession' },
  });
  check(res, { 'viewer joined session': (r) => r.status === 200 });

  sleep(1); // Simulate some activity
}
