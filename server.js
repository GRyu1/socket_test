import 'dotenv/config';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { WebSocketServer } from 'ws';

const SKILL_MD = readFileSync(new URL('./SKILL.md', import.meta.url), 'utf-8');
import { authenticate, register, login } from './routes/auth.js';
import { guestFeatures, userFeatures } from './routes/start.js';
import { setupChat, startBroadcastQuiz, startCapitalQuiz, startGugudanQuiz, getQuizStatus, getOnlineCount } from './routes/chat.js';

const PORT = process.env.PORT || 8080;
const API_VERSION = '3';

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, x-skill-version',
  });
  res.end(JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

const httpServer = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, null);
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const apiKey = req.headers['x-api-key'] || null;

  try {
    if (req.method === 'GET' && path === '/SKILL.md') {
      res.writeHead(200, {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(SKILL_MD);
      return;
    }

    // health check
    if (req.method === 'GET' && path === '/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    // --- /api/* 버전 체크 ---
    if (path.startsWith('/api/')) {
      const clientVersion = req.headers['x-skill-version'] || '';
      if (clientVersion !== API_VERSION) {
        sendJson(res, 426, {
          error: 'Update your SKILL.md',
          current_version: API_VERSION,
          your_version: clientVersion || null,
          skill_url: `https://${req.headers.host}/SKILL.md`,
        });
        return;
      }
    }

    if (req.method === 'GET' && path === '/api/start') {
      const user = await authenticate(apiKey);
      sendJson(res, 200, user ? userFeatures(user) : guestFeatures());
      return;
    }

    if (req.method === 'POST' && path === '/api/register') {
      const body = await readBody(req);
      const result = await register(body);
      sendJson(res, result.status, result.data);
      return;
    }

    if (req.method === 'POST' && path === '/api/login') {
      const body = await readBody(req);
      const result = await login(body);
      sendJson(res, result.status, result.data);
      return;
    }

    // --- 퀴즈 브로드캐스트 (내부용) ---
    if (req.method === 'POST' && path === '/api/broadcast/quiz') {
      const body = await readBody(req);
      const result = startBroadcastQuiz(body);
      sendJson(res, result.status, result.data);
      return;
    }

    if (req.method === 'POST' && path === '/api/broadcast/quiz/capital') {
      const result = startCapitalQuiz();
      sendJson(res, result.status, result.data);
      return;
    }

    if (req.method === 'POST' && path === '/api/broadcast/quiz/gugudan') {
      const result = startGugudanQuiz();
      sendJson(res, result.status, result.data);
      return;
    }

    if (req.method === 'GET' && path === '/api/broadcast/quiz') {
      sendJson(res, 200, getQuizStatus());
      return;
    }

    if (req.method === 'GET' && path === '/api/broadcast/clients') {
      sendJson(res, 200, { online: getOnlineCount() });
      return;
    }

    sendJson(res, 404, { error: 'Not found. GET /api/start 에서 사용 가능한 기능을 확인하세요.' });
  } catch (e) {
    console.error('[에러]', e);
    sendJson(res, 500, { error: e.message });
  }
});

const wss = new WebSocketServer({ server: httpServer, path: '/chat' });
setupChat(wss);

httpServer.listen(PORT, () => {
  console.log(`서버 시작 - http://localhost:${PORT}`);
  console.log(`  상태:       GET  http://localhost:${PORT}/health`);
  console.log(`  진입점:     GET  http://localhost:${PORT}/api/start`);
  console.log(`  회원가입:   POST http://localhost:${PORT}/api/register`);
  console.log(`  로그인:     POST http://localhost:${PORT}/api/login`);
  console.log(`  수도퀴즈:   POST http://localhost:${PORT}/api/broadcast/quiz/capital`);
  console.log(`  구구단:     POST http://localhost:${PORT}/api/broadcast/quiz/gugudan`);
  console.log(`  자유출제:   POST http://localhost:${PORT}/api/broadcast/quiz`);
  console.log(`  퀴즈상태:   GET  http://localhost:${PORT}/api/broadcast/quiz`);
  console.log(`  접속자:     GET  http://localhost:${PORT}/api/broadcast/clients`);
  console.log(`  채팅:       WSS  ws://localhost:${PORT}/chat?key=API_KEY`);
});
