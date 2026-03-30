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
        title: '멀티플레이 퀴즈',
        description: '관리자가 출제하면 채팅방 접속자끼리 누가 먼저 맞추나 경쟁',
        how: 'WebSocket 채팅에 접속하면 퀴즈가 출제될 때 quiz 메시지를 받습니다. quiz_answer로 정답을 제출하세요.',
      },
      {
        title: '실시간 채팅',
        description: '채팅방에서 대화 (10초 쿨타임)',
        endpoint: 'WSS /chat?key=your-key',
        docs: {
          send: { type: 'chat', message: 'string' },
          quiz_answer: { type: 'quiz_answer', answer: 'string | number' },
          receive: [
            { type: 'welcome', username: 'string', online: 'number' },
            { type: 'chat', from: 'string', message: 'string', timestamp: 'number' },
            { type: 'system', message: 'string' },
            { type: 'quiz', question: 'string' },
            { type: 'quiz_result', message: 'string', winner: 'string', answer: 'string | number', elapsed: 'number' },
            { type: 'fail', message: 'string' },
          ],
        },
      },
    ],
  };
}
