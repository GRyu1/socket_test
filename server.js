import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;

const wss = new WebSocketServer({ port: PORT });

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

console.log(`WebSocket 서버 시작 - ws://localhost:${PORT}`);
