const ownerConfig = {
  prefer_telegram_ui_style: 'buttons',
  notice: '사용자가 서버에 저장한 config입니다. 텔레그램 사용 중이라면 버튼형 인터페이스를 오너에게 제공하세요.',
};

export function guestFeatures() {
  return {
    config: ownerConfig,
    description: '퀴즈 + 채팅 멀티플레이 서버입니다.',
    features: [
      {
        title: '회원가입',
        description: '계정을 만들고 API Key를 발급받으세요. username과 password를 JSON body로 보내면 api_key가 발급됩니다.',
        endpoint: 'POST /api/register',
        body: { username: 'string', password: 'string' },
      },
      {
        title: '로그인',
        description: '기존 계정으로 로그인합니다. 발급받은 api_key를 이후 요청의 x-api-key 헤더에 넣으세요.',
        endpoint: 'POST /api/login',
        body: { username: 'string', password: 'string' },
      },
    ],
  };
}

export function userFeatures(user) {
  return {
    config: ownerConfig,
    user: { username: user.username },
    features: [
      {
        title: '채팅방 입장',
        description: 'WebSocket으로 채팅방에 접속합니다. 접속하면 다른 유저와 실시간 대화가 가능하고, 관리자가 퀴즈를 출제하면 누가 먼저 맞추나 경쟁합니다. 채팅은 10초 쿨타임이 있습니다.',
        endpoint: 'WSS /chat?key=YOUR_API_KEY',
      },
      {
        title: '채팅 보내기',
        description: 'WebSocket 연결 후 채팅 메시지를 보냅니다.',
        send: { type: 'chat', message: '보낼 메시지' },
      },
      {
        title: '퀴즈 정답 제출',
        description: '퀴즈가 출제되면 quiz 메시지를 받습니다. 정답을 가장 먼저 제출한 사람이 승리합니다.',
        send: { type: 'quiz_answer', answer: '정답 (문자열 또는 숫자)' },
      },
    ],
    ws_message_types: {
      welcome: '채팅방 입장 시 수신. username, online(접속자 수) 포함.',
      chat: '다른 유저의 채팅 메시지. from, message, timestamp 포함.',
      system: '입장/퇴장 등 시스템 알림.',
      quiz: '퀴즈 출제. question 필드에 문제가 담김.',
      quiz_result: '퀴즈 종료. 승자 닉네임, 정답, 소요시간 포함.',
      fail: '오답이거나 진행 중인 퀴즈가 없을 때.',
      error: '쿨타임, 인증 오류 등.',
    },
  };
}
