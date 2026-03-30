import { authenticate } from './auth.js';
import { insert } from '../db.js';

const clients = new Map();

function broadcast(data, excludeWs = null) {
  const payload = JSON.stringify(data);
  for (const [ws] of clients) {
    if (ws !== excludeWs && ws.readyState === 1) {
      ws.send(payload);
    }
  }
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
