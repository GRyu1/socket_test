import { authenticate } from './auth.js';
import { insert } from '../db.js';

const clients = new Map();
let activeQuiz = null;

function broadcast(data, excludeWs = null) {
  const payload = JSON.stringify(data);
  for (const [ws] of clients) {
    if (ws !== excludeWs && ws.readyState === 1) {
      ws.send(payload);
    }
  }
}

export function getOnlineCount() {
  return clients.size;
}

export function getQuizStatus() {
  if (!activeQuiz) return { active: false };
  return { active: true, question: activeQuiz.question, elapsed: Date.now() - activeQuiz.startedAt };
}

export function startBroadcastQuiz({ a, b, question, answer }) {
  if (activeQuiz) {
    return { status: 409, data: { error: '이미 진행 중인 퀴즈가 있습니다', quiz: activeQuiz.question } };
  }
  const resolvedAnswer = answer ?? a * b;
  const resolvedQuestion = question ?? `${a} × ${b} = ?`;
  activeQuiz = { question: resolvedQuestion, answer: resolvedAnswer, startedAt: Date.now() };
  broadcast({ type: 'quiz', question: resolvedQuestion });
  console.log(`[퀴즈 출제] ${resolvedQuestion} (정답: ${resolvedAnswer})`);
  return { status: 200, data: { success: true, question: resolvedQuestion, sentTo: clients.size } };
}

export function setupChat(wss) {
  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const apiKey = url.searchParams.get('key');

    const user = await authenticate(apiKey);
    if (!user) {
      ws.send(JSON.stringify({ type: 'error', message: 'API Key가 유효하지 않습니다' }));
      ws.close(4001, 'Unauthorized');
      return;
    }

    clients.set(ws, user);
    console.log(`[채팅 입장] ${user.username} (접속: ${clients.size}명)`);

    ws.send(JSON.stringify({
      type: 'welcome',
      username: user.username,
      online: clients.size,
    }));

    broadcast({
      type: 'system',
      message: `${user.username} 입장 (접속: ${clients.size}명)`,
    }, ws);

    ws.on('message', async (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        return;
      }

      if (data.type === 'quiz_answer') {
        if (!activeQuiz) {
          ws.send(JSON.stringify({ type: 'fail', message: '진행 중인 퀴즈가 없습니다.' }));
          return;
        }
        const userAnswer = Number(data.answer);
        if (userAnswer !== activeQuiz.answer) {
          ws.send(JSON.stringify({ type: 'fail', message: '오답! 다시 시도하세요.' }));
          return;
        }
        const elapsed = Date.now() - activeQuiz.startedAt;
        console.log(`[퀴즈 정답] ${user.username} (${elapsed}ms)`);
        broadcast({
          type: 'quiz_result',
          winner: user.username,
          question: activeQuiz.question,
          answer: activeQuiz.answer,
          elapsed,
        });
        activeQuiz = null;
        return;
      }

      if (data.type === 'chat' && data.message) {
        const message = String(data.message).slice(0, 500);
        const timestamp = Date.now();

        await insert(
          'INSERT INTO chat_messages (user_id, message) VALUES (?, ?)',
          [user.id, message],
        );

        broadcast({
          type: 'chat',
          from: user.username,
          message,
          timestamp,
        });
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[채팅 퇴장] ${user.username} (접속: ${clients.size}명)`);
      broadcast({
        type: 'system',
        message: `${user.username} 퇴장 (접속: ${clients.size}명)`,
      });
    });

    ws.on('error', (err) => {
      console.error(`[채팅 에러] ${user.username}:`, err.message);
    });
  });
}
