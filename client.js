import WebSocket from 'ws';
import { createInterface } from 'readline';

const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:8080';

const ws = new WebSocket(SERVER_URL);
const rl = createInterface({ input: process.stdin, output: process.stdout });

ws.on('open', () => {
  console.log(`서버 연결됨: ${SERVER_URL}`);
  console.log('명령어: name <닉네임> | challenge | answer <숫자> | chat <메시지> | ping | quit');
  console.log('퀴즈가 출제되면 숫자만 입력하면 정답 제출됩니다.');
  prompt();
});

let quizActive = false;

ws.on('message', (raw) => {
  const data = JSON.parse(raw.toString());

  switch (data.type) {
    case 'welcome':
      console.log(`\n[환영] ${data.message}`);
      break;
    case 'name_ok':
      console.log(`\n[닉네임] "${data.name}" 설정 완료`);
      break;
    case 'quiz':
      quizActive = true;
      console.log(`\n========== 퀴즈! ==========`);
      console.log(`  ${data.question}`);
      console.log(`  숫자를 입력하세요!`);
      console.log(`============================`);
      break;
    case 'quiz_result':
      quizActive = false;
      console.log(`\n★★★ 정답자: ${data.winnerName} ★★★`);
      console.log(`  문제: ${data.question} → 정답: ${data.answer} (${data.elapsed}ms)`);
      break;
    case 'chat': {
      const sender = data.fromName || `#${data.from}`;
      console.log(`\n[채팅] ${sender}: ${data.message}`);
      break;
    }
    case 'system':
      console.log(`\n[시스템] ${data.message}`);
      break;
    case 'pong':
      console.log(`\n[pong] 서버 응답 시간: ${Date.now() - data.timestamp}ms`);
      break;
    case 'challenge':
      console.log(`\n[문제] ${data.question}`);
      break;
    case 'ok':
      console.log(`\n[정답] ${data.message}`);
      break;
    case 'fail':
      console.log(`\n[오답] ${data.message}`);
      break;
    case 'echo':
      console.log(`\n[에코]`, data.original);
      break;
    default:
      console.log(`\n[수신]`, data);
  }

  prompt();
});

ws.on('close', () => {
  console.log('서버 연결 종료');
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

    if (trimmed.startsWith('name ')) {
      ws.send(JSON.stringify({ type: 'name', name: trimmed.slice(5) }));
      return;
    }

    if (quizActive && /^\d+$/.test(trimmed)) {
      ws.send(JSON.stringify({ type: 'quiz_answer', answer: Number(trimmed) }));
      return;
    }

    if (trimmed === 'challenge') {
      ws.send(JSON.stringify({ type: 'challenge' }));
      return;
    }

    if (trimmed.startsWith('answer ')) {
      ws.send(JSON.stringify({ type: 'answer', answer: Number(trimmed.slice(7)) }));
      return;
    }

    if (trimmed === 'ping') {
      ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      return;
    }

    if (trimmed.startsWith('chat ')) {
      ws.send(JSON.stringify({ type: 'chat', message: trimmed.slice(5) }));
      return;
    }

    if (trimmed.startsWith('json ')) {
      try {
        const parsed = JSON.parse(trimmed.slice(5));
        ws.send(JSON.stringify(parsed));
      } catch {
        console.log('잘못된 JSON 형식입니다.');
        prompt();
      }
      return;
    }

    ws.send(JSON.stringify({ type: 'chat', message: trimmed }));
  });
}
