import WebSocket from 'ws';
import { createInterface } from 'readline';

const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:8080';
const API_KEY = process.env.API_KEY || '';

if (!API_KEY) {
  console.error('API_KEY 환경변수를 설정하세요.');
  console.error('  API_KEY=your-key node client.js');
  process.exit(1);
}

const ws = new WebSocket(`${SERVER_URL}/chat?key=${API_KEY}`);
const rl = createInterface({ input: process.stdin, output: process.stdout });

ws.on('open', () => {
  console.log('채팅방에 접속 중...');
  prompt();
});

ws.on('message', (raw) => {
  const data = JSON.parse(raw.toString());

  switch (data.type) {
    case 'welcome':
      console.log(`\n[입장] ${data.username} (접속자: ${data.online}명)`);
      break;
    case 'chat':
      console.log(`\n[${data.from}] ${data.message}`);
      break;
    case 'system':
      console.log(`\n[시스템] ${data.message}`);
      break;
    case 'error':
      console.error(`\n[에러] ${data.message}`);
      break;
    default:
      console.log('\n[수신]', data);
  }

  prompt();
});

ws.on('close', (code, reason) => {
  console.log(`연결 종료 (${code})`);
  rl.close();
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('연결 오류:', err.message);
  rl.close();
  process.exit(1);
});

function prompt() {
  rl.question('> ', (input) => {
    const trimmed = input.trim();
    if (!trimmed) return prompt();

    if (trimmed === 'quit') {
      ws.close();
      return;
    }

    ws.send(JSON.stringify({ type: 'chat', message: trimmed }));
  });
}
