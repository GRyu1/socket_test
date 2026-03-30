import { readFileSync } from 'fs';
import { authenticate } from './auth.js';
import { insert } from '../db.js';

const capitals = JSON.parse(readFileSync(new URL('../data/capitals.json', import.meta.url), 'utf-8'));

const clients = new Map();
const chatCooldowns = new Map();
const CHAT_COOLDOWN_MS = 10_000;
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
  const isString = typeof resolvedAnswer === 'string';
  activeQuiz = { question: resolvedQuestion, answer: resolvedAnswer, isString, startedAt: Date.now() };
  broadcast({ type: 'quiz', question: resolvedQuestion });
  console.log(`[퀴즈 출제] ${resolvedQuestion} (정답: ${resolvedAnswer})`);
  return { status: 200, data: { success: true, question: resolvedQuestion, sentTo: clients.size } };
}

export function startCapitalQuiz() {
  if (activeQuiz) {
    return { status: 409, data: { error: '이미 진행 중인 퀴즈가 있습니다', quiz: activeQuiz.question } };
  }
  const pick = capitals[Math.floor(Math.random() * capitals.length)];
  return startBroadcastQuiz({ question: `${pick.country}의 수도는?`, answer: pick.capital });
}

export function startGugudanQuiz() {
  if (activeQuiz) {
    return { status: 409, data: { error: '이미 진행 중인 퀴즈가 있습니다', quiz: activeQuiz.question } };
  }
  const a = Math.floor(Math.random() * 8) + 2;
  const b = Math.floor(Math.random() * 8) + 2;
  return startBroadcastQuiz({ a, b });
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
        const raw = String(data.answer).trim();
        const correct = activeQuiz.isString
          ? raw === activeQuiz.answer
          : Number(raw) === activeQuiz.answer;
        if (!correct) {
          console.log(`[퀴즈 오답] ${user.username}: ${raw}`);
          ws.send(JSON.stringify({ type: 'fail', message: '오답! 다시 시도하세요.' }));
          return;
        }
        const elapsed = Date.now() - activeQuiz.startedAt;
        console.log(`[퀴즈 정답] ${user.username} (${elapsed}ms)`);
        broadcast({
          type: 'quiz_result',
          message: `이번 퀴즈 승자 : "${user.username}"`,
          winner: user.username,
          question: activeQuiz.question,
          answer: activeQuiz.answer,
          elapsed,
        });
        activeQuiz = null;
        return;
      }

      if (data.type === 'chat' && data.message) {
        const now = Date.now();
        const lastChat = chatCooldowns.get(ws) || 0;
        const remaining = CHAT_COOLDOWN_MS - (now - lastChat);
        if (remaining > 0) {
          ws.send(JSON.stringify({ type: 'error', message: `채팅 쿨타임 ${Math.ceil(remaining / 1000)}초 남음` }));
          return;
        }
        chatCooldowns.set(ws, now);

        const message = String(data.message).slice(0, 500);
        console.log(`[채팅] ${user.username}: ${message}`);

        await insert(
          'INSERT INTO chat_messages (user_id, message) VALUES (?, ?)',
          [user.id, message],
        );

        broadcast({
          type: 'chat',
          from: user.username,
          message,
          timestamp: now,
        });
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      chatCooldowns.delete(ws);
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
