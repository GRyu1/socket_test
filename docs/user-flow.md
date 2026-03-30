# User Flow

## 전체 흐름도

```
┌─────────────────────────────────────────────────────────────────┐
│                         서버 (HTTP + WS)                         │
│              sockettest-production-5035.up.railway.app            │
└──────────┬──────────────────────────────────┬────────────────────┘
           │                                  │
     ┌─────┴─────┐                    ┌───────┴───────┐
     │  HTTP API  │                    │   WebSocket   │
     │ (퀴즈/인증) │                    │   (채팅)      │
     └─────┬─────┘                    └───────┬───────┘
           │                                  │
   GET  /api/start ←── 진입점          WSS /chat?key=...
   POST /api/register                  인증된 유저만 참여
   POST /api/login
   POST /api/quiz/:mode/start
   POST /api/quiz/answer
   GET  /api/history
```

---

## 1. 진입 Flow (GET /api/start)

```
클라이언트                              서버
    │                                    │
    │── GET /api/start ────────────────→│
    │                                    │ x-api-key 헤더 확인
    │                                    │
    │   [API Key 없음]                    │
    │←── features: [회원가입, 로그인] ───│
    │                                    │
    │   [API Key 있음]                    │
    │←── features: [구구단, 수도,        │
    │     채팅, 기록] ──────────────────│
```

## 2. 회원가입 / 로그인 Flow

```
클라이언트                              서버                         DB
    │                                    │                          │
    │── POST /api/register ────────────→│                          │
    │   { username, password }           │── bcrypt hash ──────────→│
    │                                    │── INSERT users ─────────→│
    │                                    │── API Key 생성            │
    │←── { username, api_key } ─────────│                          │
    │                                    │                          │
    │── POST /api/login ───────────────→│                          │
    │   { username, password }           │── SELECT user ──────────→│
    │                                    │── bcrypt compare          │
    │←── { username, api_key } ─────────│                          │
```

## 3. 퀴즈 Flow (구구단 / 수도)

```
클라이언트                              서버                         DB
    │                                    │                          │
    │── POST /api/quiz/gugudan/start ──→│                          │
    │   (x-api-key 헤더)                 │── INSERT session ───────→│
    │                                    │── 문제 생성               │
    │                                    │── INSERT answer ────────→│
    │←── { session_id, question,        │                          │
    │      question_number: 1 } ────────│                          │
    │                                    │                          │
    │── POST /api/quiz/answer ─────────→│                          │  ×10 반복
    │   { session_id, answer }           │── 정답 비교               │
    │                                    │── UPDATE answer ────────→│
    │                                    │── 다음 문제 생성           │
    │←── { correct, correct_answer,     │                          │
    │      question, question_number }──│                          │
    │                                    │                          │
    │   ... (10문제 완료) ...             │                          │
    │                                    │                          │
    │←── { correct, finished: true,     │                          │
    │      score: "7/10",               │── UPDATE session ───────→│
    │      message: "게임 종료!" } ─────│   (is_finished = TRUE)    │
```

## 4. 자유 대화 Flow (WebSocket)

```
클라이언트                              서버                     다른 클라이언트
    │                                    │                          │
    │── WSS /chat?key=API_KEY ─────────→│                          │
    │                                    │ API Key → DB 조회        │
    │                                    │ 유저 인증 확인            │
    │←── { type: "welcome",             │                          │
    │      username, online } ──────────│                          │
    │                                    │── 브로드캐스트 ──────────→│
    │                                    │   { type: "system",      │
    │                                    │     message: "OO 입장" } │
    │                                    │                          │
    │── { type: "chat",                 │                          │
    │     message: "안녕!" } ──────────→│                          │
    │                                    │── DB 저장                 │
    │                                    │── 브로드캐스트 ──────────→│
    │←── { type: "chat",                │   { type: "chat",        │
    │      from, message,               │     from, message,       │
    │      timestamp } ────────────────│     timestamp }           │
    │                                    │                          │
    │── 연결 종료 ─────────────────────→│                          │
    │                                    │── 브로드캐스트 ──────────→│
    │                                    │   { type: "system",      │
    │                                    │     message: "OO 퇴장" } │
```

## 5. 기록 조회 Flow

```
클라이언트                              서버                         DB
    │                                    │                          │
    │── GET /api/history ──────────────→│                          │
    │   (x-api-key 헤더)                 │── SELECT stats ─────────→│
    │                                    │   (게임별 승률 집계)       │
    │                                    │── SELECT recent ────────→│
    │                                    │   (최근 10게임)            │
    │←── { summary: {                   │                          │
    │       gugudan: { accuracy },      │                          │
    │       capital: { accuracy }       │                          │
    │     },                            │                          │
    │     recent_games: [...] } ───────│                          │
```

---

## API 요약

| 요청 | 인증 | 응답 |
|------|------|------|
| `GET /api/start` | 선택 | feature 구조체 (인증 여부에 따라 다름) |
| `POST /api/register` | 불필요 | `{ username, api_key }` |
| `POST /api/login` | 불필요 | `{ username, api_key }` |
| `POST /api/quiz/:mode/start` | 필수 | `{ session_id, question, question_number }` |
| `POST /api/quiz/answer` | 필수 | `{ correct, question/score }` |
| `GET /api/history` | 필수 | `{ summary, recent_games }` |
| `WSS /chat?key=KEY` | 필수 | 실시간 채팅 |

---

## DB 구조

```
users
├── id, username, password_hash, api_key, created_at

game_sessions
├── id, user_id, game_type, total_questions, correct_answers
├── is_finished, started_at, finished_at

game_answers
├── id, session_id, question, correct_answer, user_answer
├── is_correct, answered_at

chat_messages
├── id, user_id, message, created_at
```
