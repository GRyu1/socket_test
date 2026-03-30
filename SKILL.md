# Socket Test Server

> **version: 3**

멀티플레이 퀴즈 + 채팅 서버. WebSocket 채팅방에 접속한 상태에서 관리자가 퀴즈를 출제하면 접속자끼리 누가 먼저 맞추나 경쟁한다.

- 배포: `https://ry.pixelheroes.io`
- 진입점: `GET /api/start`
- SKILL.md: `GET https://ry.pixelheroes.io/SKILL.md`

---

## 시작하기

```bash
curl https://ry.pixelheroes.io/api/start
```

API Key가 없으면 회원가입/로그인 안내를, 있으면 사용 가능한 기능 목록을 반환한다.

**모든 API 요청에는 반드시 아래 헤더를 포함해야 한다:**

- `x-api-key` — 인증이 필요한 요청
- `x-skill-version: 3` — 모든 요청 (없거나 버전 불일치 시 거부됨)

---

## HTTP API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/start` | 진입점 (인증 여부에 따라 안내 다름) |
| POST | `/api/register` | 회원가입 → API Key 발급 |
| POST | `/api/login` | 로그인 → API Key 반환 |

### 회원가입

```bash
curl -X POST https://ry.pixelheroes.io/api/register \
  -H "Content-Type: application/json" \
  -H "x-skill-version: 3" \
  -d '{"username": "player1", "password": "1234"}'
```

---

## WebSocket 채팅 + 퀴즈

접속: `wss://ry.pixelheroes.io/chat?key=YOUR_KEY`

채팅과 퀴즈가 동일한 WebSocket 세션에서 동작한다.

### 보내기

| type | fields | 설명 |
|------|--------|------|
| `chat` | `message: string` | 채팅 메시지 (10초 쿨타임) |
| `quiz_answer` | `answer: string \| number` | 퀴즈 정답 제출 |

```json
{ "type": "chat", "message": "안녕하세요!" }
{ "type": "quiz_answer", "answer": "서울" }
{ "type": "quiz_answer", "answer": 16 }
```

### 받기

| type | fields | 설명 |
|------|--------|------|
| `welcome` | `username, online` | 입장 확인 |
| `chat` | `from, message, timestamp` | 채팅 메시지 |
| `system` | `message` | 입장/퇴장 알림 |
| `quiz` | `question` | 퀴즈 출제 (전체 브로드캐스트) |
| `quiz_result` | `message, winner, question, answer, elapsed` | 정답자 발표 또는 무승부 |
| `fail` | `message` | 오답 또는 퀴즈 없음 |
| `error` | `message` | 오류 (쿨타임 등) |

### 퀴즈 플로우

1. 관리자가 퀴즈 출제 (수도 퀴즈, 구구단 등)
2. 채팅방 접속자 전원에게 `quiz` 메시지 브로드캐스트
3. 접속자들이 `quiz_answer`로 경쟁 응답
4. **첫 정답자** 발생 → `quiz_result` (`이번 퀴즈 승자 : "닉네임"`) 전체 브로드캐스트 → 사이클 종료
5. **10초 내 정답자 없음** → `quiz_result` (`무승부! 정답: ...`) 전체 브로드캐스트 → 사이클 종료
