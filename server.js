import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const PORT = process.env.PORT || 8080;

const PROTOCOL_INFO = {
  server: 'socket-test',
  websocket: 'ws(s)://<host>',
  endpoints: {
    'GET /api/protocol': '이 프로토콜 문서를 반환',
    'POST /api/send': '접속 중인 모든 클라이언트에게 메시지 전송 (body: 임의 JSON)',
    'GET /api/clients': '현재 접속자 수 조회',
  },
  websocketProtocol: {
    clientToServer: [
      { type: 'chat', fields: { message: 'string' }, description: '채팅 메시지 (브로드캐스트)' },
      { type: 'challenge', fields: {}, description: '두 자리 곱셈 문제 요청' },
      { type: 'answer', fields: { answer: 'number' }, description: '챌린지 정답 제출' },
      { type: 'ping', fields: {}, description: '서버 응답 확인' },
      { type: '기타', fields: '자유', description: '에코로 반환' },
    ],
    serverToClient: [
      { type: 'welcome', fields: ['clientId', 'message'], description: '연결 시 수신' },
      { type: 'chat', fields: ['from', 'message', 'timestamp'], description: '채팅 메시지' },
      { type: 'system', fields: ['message'], description: '입장/퇴장 알림' },
      { type: 'challenge', fields: ['question', 'a', 'b'], description: '곱셈 문제' },
      { type: 'ok', fields: ['message'], description: '정답' },
      { type: 'fail', fields: ['message'], description: '오답 또는 문제 없음' },
      { type: 'pong', fields: ['timestamp'], description: 'ping 응답' },
      { type: 'echo', fields: ['original', 'timestamp'], description: '에코' },
    ],
  },
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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

  if (req.method === 'GET' && url.pathname === '/api/protocol') {
    sendJson(res, 200, PROTOCOL_INFO);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/clients') {
    const list = [...clients.keys()];
    sendJson(res, 200, { count: list.length, clientIds: list });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/send') {
    try {
      const body = await readBody(req);
      broadcast(body);
      console.log(`[HTTP 전송] 접속자 ${clients.size}명에게 전송:`, body);
      sendJson(res, 200, { success: true, sentTo: clients.size, data: body });
    } catch (e) {
      sendJson(res, 400, { error: e.message });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

const wss = new WebSocketServer({ server: httpServer });

const clients = new Map();
const challenges = new Map();
let clientIdCounter = 0;

function randTwoDigit() {
  return Math.floor(Math.random() * 90) + 10;
}

wss.on('connection', (ws, req) => {
  const clientId = ++clientIdCounter;
  const clientIp = req.socket.remoteAddress;
  clients.set(clientId, ws);

  console.log(`[연결] 클라이언트 #${clientId} (${clientIp}) - 현재 접속: ${clients.size}명`);

  ws.send(JSON.stringify({
    type: 'welcome',
    clientId,
    message: `서버에 연결되었습니다. (ID: ${clientId})`,
  }));

  broadcast({
    type: 'system',
    message: `클라이언트 #${clientId} 입장`,
  }, clientId);

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      data = { type: 'text', message: raw.toString() };
    }

    console.log(`[수신] #${clientId}:`, data);

    switch (data.type) {
      case 'chat':
        broadcast({
          type: 'chat',
          from: clientId,
          message: data.message,
          timestamp: Date.now(),
        });
        break;

      case 'challenge': {
        const a = randTwoDigit();
        const b = randTwoDigit();
        challenges.set(clientId, a * b);
        console.log(`[챌린지] #${clientId}: ${a} × ${b} = ${a * b}`);
        ws.send(JSON.stringify({
          type: 'challenge',
          question: `${a} × ${b} = ?`,
          a,
          b,
        }));
        break;
      }

      case 'answer': {
        const expected = challenges.get(clientId);
        if (expected === undefined) {
          ws.send(JSON.stringify({ type: 'fail', message: '출제된 문제가 없습니다. challenge를 먼저 보내세요.' }));
          break;
        }
        const userAnswer = Number(data.answer);
        if (userAnswer === expected) {
          console.log(`[정답] #${clientId}: ${userAnswer} ✓`);
          ws.send(JSON.stringify({ type: 'ok', message: `정답! ${userAnswer}` }));
        } else {
          console.log(`[오답] #${clientId}: ${userAnswer} ✗ (정답: ${expected})`);
          ws.send(JSON.stringify({ type: 'fail', message: `오답! 정답은 ${expected}` }));
        }
        challenges.delete(clientId);
        break;
      }

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      default:
        ws.send(JSON.stringify({
          type: 'echo',
          original: data,
          timestamp: Date.now(),
        }));
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    challenges.delete(clientId);
    console.log(`[해제] 클라이언트 #${clientId} - 현재 접속: ${clients.size}명`);

    broadcast({
      type: 'system',
      message: `클라이언트 #${clientId} 퇴장`,
    });
  });

  ws.on('error', (err) => {
    console.error(`[에러] #${clientId}:`, err.message);
  });
});

function broadcast(data, excludeId = null) {
  const payload = JSON.stringify(data);
  for (const [id, client] of clients) {
    if (id !== excludeId && client.readyState === 1) {
      client.send(payload);
    }
  }
}

httpServer.listen(PORT, () => {
  console.log(`서버 시작 - http://localhost:${PORT}`);
  console.log(`  WebSocket: ws://localhost:${PORT}`);
  console.log(`  프로토콜: http://localhost:${PORT}/api/protocol`);
  console.log(`  메시지 전송: POST http://localhost:${PORT}/api/send`);
  console.log(`  접속자 조회: http://localhost:${PORT}/api/clients`);
});
