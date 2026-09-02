const http = require('http');
const app = require('../src/app');
const store = require('../src/store');

const PORT = 4001;
const BASE = `http://localhost:${PORT}`;

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    }, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function dateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const server = app.listen(PORT);
  const results = [];

  // ---- Test 1: Crowd prediction with sufficient (7-day) history ----
  store.resetStore();
  // Seed 5 days of HIGH traffic (48-55 check-ins/day) for the 12:30 slot -> avg should exceed 80% of 60 capacity
  const heavyDays = [6, 5, 4, 3, 2];
  const countsPerDay = [50, 52, 48, 55, 51];
  heavyDays.forEach((daysAgo, idx) => {
    const date = dateNDaysAgo(daysAgo);
    for (let i = 0; i < countsPerDay[idx]; i++) {
      store.addCheckin({ slot: '12:30', date, timestamp: new Date().toISOString() });
    }
  });
  let res1 = await request('GET', '/api/canteen/prediction');
  let slot1230 = res1.body.find(p => p.slot === '12:30');
  results.push({
    test: 'Crowd prediction with sufficient history (7-day, heavy traffic)',
    expected: 'level = High, wait ~15 min',
    observedStatus: res1.status,
    observedBody: slot1230,
    pass: res1.status === 200 && slot1230.level === 'High' && slot1230.expectedWaitMins === 15
  });

  // ---- Test 2: Crowd prediction with insufficient history (fallback path) ----
  store.resetStore();
  store.addCheckin({ slot: '12:30', date: dateNDaysAgo(1), timestamp: new Date().toISOString() });
  let res2 = await request('GET', '/api/canteen/prediction');
  let slot1230b = res2.body.find(p => p.slot === '12:30');
  results.push({
    test: 'Crowd prediction with insufficient history (1 day of data)',
    expected: 'falls back to Medium default',
    observedStatus: res2.status,
    observedBody: slot1230b,
    pass: res2.status === 200 && slot1230b.level === 'Medium' && !!slot1230b.note
  });

  // ---- Test 3: Token issuance when slot is already at capacity ----
  store.resetStore();
  for (let i = 0; i < 60; i++) {
    store.createToken({ studentId: `S${i}`, slot: '12:30', position: i + 1 });
  }
  let res3 = await request('POST', '/api/canteen/token',
    { studentId: 'S999', slot: '12:30' },
    { Authorization: 'Bearer testtoken123' });
  results.push({
    test: 'Token request when slot is already at capacity (60/60)',
    expected: '409 SLOT_FULL',
    observedStatus: res3.status,
    observedBody: res3.body,
    pass: res3.status === 409 && res3.body.error === 'SLOT_FULL'
  });

  // ---- Test 4: Unauthorized token request (no Authorization header) ----
  store.resetStore();
  let res4 = await request('POST', '/api/canteen/token', { studentId: 'S001', slot: '11:30' });
  results.push({
    test: 'Unauthorized token request (missing Authorization header)',
    expected: '401',
    observedStatus: res4.status,
    observedBody: res4.body,
    pass: res4.status === 401
  });

  console.log('\n=== CSA15 Canteen Module — Test Run ===');
  console.log('Run at:', new Date().toString());
  console.log('========================================\n');
  results.forEach((r, i) => {
    console.log(`Test ${i + 1}: ${r.test}`);
    console.log(`  Expected: ${r.expected}`);
    console.log(`  Observed status: ${r.observedStatus}`);
    console.log(`  Observed body: ${JSON.stringify(r.observedBody)}`);
    console.log(`  Result: ${r.pass ? 'PASS' : 'FAIL'}`);
    console.log('');
  });
  const passCount = results.filter(r => r.pass).length;
  console.log(`${passCount}/${results.length} tests passed.`);

  server.close();
}

main();
