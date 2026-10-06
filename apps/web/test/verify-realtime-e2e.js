const { io } = require('socket.io-client');
const { spawn } = require('child_process');
const path = require('path');

async function runRealtimeE2E() {
  console.log('--- Starting NetSentry Real-time E2E Socket Verification ---');

  const socket = io('http://localhost:3001/events', {
    transports: ['websocket', 'polling'],
    reconnection: true,
  });

  return new Promise((resolve, reject) => {
    let receivedDetection = null;

    const timer = setTimeout(() => {
      socket.disconnect();
      if (receivedDetection) {
        resolve(receivedDetection);
      } else {
        reject(new Error('Timeout: Did not receive real-time detection event within 15s'));
      }
    }, 15000);

    socket.on('connect', () => {
      console.log('✓ Connected to NestJS /events WebSocket gateway. Socket ID:', socket.id);
      socket.emit('subscribe_threat_feed', {});

      // Launch verify_e2e_live.py to replay real flows
      console.log('Triggering authentic flow replay via verify_e2e_live.py...');
      const pyExe = path.resolve(__dirname, '../../ml/.venv/Scripts/python.exe');
      const pyScript = path.resolve(__dirname, '../../ml/scripts/verify_e2e_live.py');

      const proc = spawn(pyExe, [pyScript], {
        cwd: path.resolve(__dirname, '../../ml'),
      });

      proc.stdout.on('data', (d) => {
        const line = d.toString().trim();
        if (line.includes('Flow:')) console.log('  [ML Replay]', line);
      });

      proc.stderr.on('data', (d) => {
        // stderr might have informational logs
      });
    });

    socket.on('detection.created', (data) => {
      console.log('★ Real-time [detection.created] event received over WebSocket:');
      console.log('  - Detection ID:', data.id);
      console.log('  - Attack Category:', data.attackCategory);
      console.log('  - Verdict:', data.verdict);
      console.log('  - Supervised Confidence:', data.supervisedConfidence);
      console.log('  - Anomaly Score:', data.unsupervisedAnomalyScore);
      console.log('  - Severity:', data.severity);
      receivedDetection = data;
      clearTimeout(timer);
      socket.disconnect();
      resolve(data);
    });

    socket.on('threat_alert', (data) => {
      console.log('★ Real-time [threat_alert] event received over WebSocket:', data);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connect_error:', err.message);
    });
  });
}

runRealtimeE2E()
  .then((det) => {
    console.log('✓ SUCCESS: Real-time pipeline verified from Dataset -> Redis -> ML -> NestJS -> WebSocket!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('✗ FAILED:', err.message);
    process.exit(1);
  });
