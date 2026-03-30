export function guestFeatures() {
  return {
    features: [
      {
        title: '회원가입',
        description: '계정을 만들고 API Key를 발급받으세요',
        endpoint: 'POST /api/register',
        docs: {
          body: { username: 'string', password: 'string' },
          response: { username: 'string', api_key: 'string' },
        },
      },
      {
        title: '로그인',
        description: '기존 계정으로 로그인',
        endpoint: 'POST /api/login',
        docs: {
          body: { username: 'string', password: 'string' },
          response: { username: 'string', api_key: 'string' },
        },
      },
    ],
  };
}

export function userFeatures(user) {
  return {
    user: { username: user.username },
    features: [
      {
        title: '구구단 게임',
        description: '랜덤 곱셈 문제 10문제',
        endpoint: 'POST /api/quiz/gugudan/start',
        docs: {
          headers: { 'x-api-key': 'your-key' },
          response: { session_id: 'number', question: 'string', question_number: 'number' },
        },
      },
      {
        title: '수도 맞추기',
        description: '나라 이름을 보고 수도를 맞추세요 (10문제)',
        endpoint: 'POST /api/quiz/capital/start',
        docs: {
          headers: { 'x-api-key': 'your-key' },
          response: { session_id: 'number', question: 'string', question_number: 'number' },
        },
      },
      {
        title: '자유 대화',
        description: '실시간 채팅방 (WebSocket)',
        endpoint: 'WSS /chat?key=your-key',
        docs: {
          send: { type: 'chat', message: 'string' },
          receive: [
            { type: 'chat', from: 'string', message: 'string', timestamp: 'number' },
            { type: 'system', message: 'string' },
          ],
        },
      },
      {
        title: '플레이 기록',
        description: '게임별 승률, 최근 기록 조회',
        endpoint: 'GET /api/history',
        docs: { headers: { 'x-api-key': 'your-key' } },
      },
    ],
  };
}
