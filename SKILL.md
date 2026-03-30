# Socket Test Server

퀴즈 + 채팅 서버. 자기서술형 API로 진입점 하나에서 모든 기능을 탐색할 수 있다.

- 배포: `https://ry.pixelheroes.io`
- 진입점: `GET /api/start`

---

## 시작하기

```bash
curl https://ry.pixelheroes.io/api/start
```

API Key가 없으면 회원가입/로그인 안내를, 있으면 사용 가능한 기능 목록을 반환한다.

인증이 필요한 요청에는 `x-api-key` 헤더를 붙인다.

---

## HTTP API

| Method | Endpoint | 인증 | 설명 |
|--------|----------|------|------|
| GET | `/api/start` | 선택 | 기능 목록 반환 (인증 여부에 따라 다름) |
| POST | `/api/register` | 불필요 | 회원가입 → API Key 발급 |
| POST | `/api/login` | 불필요 | 로그인 → API Key 반환 |
| POST | `/api/quiz/gugudan/start` | 필수 | 구구단 퀴즈 시작 (10문제) |
| POST | `/api/quiz/capital/start` | 필수 | 수도 맞추기 퀴즈 시작 (10문제) |
| POST | `/api/quiz/answer` | 필수 | 퀴즈 답변 제출 |
| GET | `/api/history` | 필수 | 플레이 기록 + 승률 조회 |

### 회원가입

```bash
curl -X POST https://ry.pixelheroes.io/api/register \
  -H "Content-Type: application/json" \
  -d '{"username": "player1", "password": "1234"}'
```

### 퀴즈 플레이

```bash
# 1. 구구단 시작
curl -X POST https://ry.pixelheroes.io/api/quiz/gugudan/start \
  -H "x-api-key: YOUR_KEY"

# 2. 답변 제출 (반복)
curl -X POST https://ry.pixelheroes.io/api/quiz/answer \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_KEY" \
  -d '{"session_id": 1, "answer": "72"}'
```

### 기록 조회

```bash
curl https://ry.pixelheroes.io/api/history \
  -H "x-api-key: YOUR_KEY"
```

---

## WebSocket 채팅

접속: `wss://ry.pixelheroes.io/chat?key=YOUR_KEY`

### 보내기

```json
{ "type": "chat", "message": "안녕하세요!" }
```

### 보내기 (퀴즈 응답)

```json
{ "type": "quiz_answer", "answer": 16 }
{ "type": "quiz_answer", "answer": "도쿄" }
```

### 받기

| type | fields | 설명 |
|------|--------|------|
| `welcome` | `username, online` | 입장 확인 |
| `chat` | `from, message, timestamp` | 채팅 메시지 |
| `system` | `message` | 입장/퇴장 알림 |
| `quiz` | `question` | 퀴즈 출제 (전체 브로드캐스트) |
| `quiz_result` | `winner, question, answer, elapsed` | 정답자 발표 |
| `fail` | `message` | 오답 또는 퀴즈 없음 |
| `error` | `message` | 오류 |
