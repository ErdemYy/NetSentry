const http = require('http');

const routes = [
  { path: '/', expected: 'SECURITY OPERATIONS' },
  { path: '/threats', expected: 'threats' },
  { path: '/incidents', expected: 'incidents' },
  { path: '/network', expected: 'network' },
  { path: '/analytics', expected: 'analytics' },
  { path: '/models', expected: 'models' },
  { path: '/settings', expected: 'FastAPI' },
];


async function checkRoute(route) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${route.path}`, (res) => {
      res.setEncoding('utf8');
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const matches = data.includes(route.expected);
        resolve({
          path: route.path,
          statusCode: res.statusCode,
          hasExpectedContent: matches,
          dataLength: data.length,
        });
      });
    }).on('error', reject);
  });
}



async function run() {
  console.log('--- VERIFYING FRONTEND ROUTES ON HTTP://LOCALHOST:3000 ---');
  let allPassed = true;
  for (const route of routes) {
    try {
      const res = await checkRoute(route);
      const passed = res.statusCode === 200 && res.hasExpectedContent;
      console.log(
        `[${passed ? 'PASS' : 'FAIL'}] Route: ${res.path.padEnd(12)} | Status: ${res.statusCode} | Match: ${res.hasExpectedContent}`,
      );
      if (!passed) allPassed = false;
    } catch (err) {
      console.error(`[ERROR] Route: ${route.path} -> ${err.message}`);
      allPassed = false;
    }
  }

  // Also check Threat Detail page
  try {
    const detailRes = await checkRoute({ path: '/threats/det-013f0f2cc4b2', expected: 'threats' });
    console.log(
      `[${detailRes.statusCode === 200 ? 'PASS' : 'FAIL'}] Route: /threats/:id | Status: ${detailRes.statusCode} | Match: ${detailRes.hasExpectedContent}`,
    );
  } catch (err) {

    console.error(`[ERROR] Route: /threats/:id -> ${err.message}`);
  }

  if (allPassed) {
    console.log('--- ALL FRONTEND ROUTES VERIFIED WITH STATUS 200 OK! ---');
  } else {
    process.exitCode = 1;
  }
}

run();
