import { readFile } from 'fs/promises';
import { query, queryOne, insert } from '../db.js';

const QUESTIONS_PER_SESSION = 10;

let capitalsCache = null;
async function getCapitals() {
  if (!capitalsCache) {
    const raw = await readFile(new URL('../data/capitals.json', import.meta.url), 'utf-8');
    capitalsCache = JSON.parse(raw);
  }
  return capitalsCache;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateGugudanQuestion() {
  const a = randInt(2, 19);
  const b = randInt(2, 19);
  return { question: `${a} × ${b} = ?`, answer: String(a * b) };
}

async function generateCapitalQuestion() {
  const capitals = await getCapitals();
  const item = capitals[randInt(0, capitals.length - 1)];
  return { question: `${item.country}의 수도는?`, answer: item.capital };
}

async function generateQuestion(gameType) {
  if (gameType === 'gugudan') return generateGugudanQuestion();
  return generateCapitalQuestion();
}

export async function startQuiz(user, gameType) {
  if (!['gugudan', 'capital'].includes(gameType)) {
    return { status: 400, data: { error: '게임 타입은 gugudan 또는 capital이어야 합니다' } };
  }

  const sessionId = await insert(
    'INSERT INTO game_sessions (user_id, game_type, total_questions) VALUES (?, ?, ?)',
    [user.id, gameType, QUESTIONS_PER_SESSION],
  );

  const { question, answer } = await generateQuestion(gameType);
  await insert(
    'INSERT INTO game_answers (session_id, question, correct_answer) VALUES (?, ?, ?)',
    [sessionId, question, answer],
  );

  return {
    status: 200,
    data: {
      session_id: sessionId,
      question,
      question_number: 1,
      total_questions: QUESTIONS_PER_SESSION,
    },
  };
}

export async function submitAnswer(user, body) {
  const { session_id, answer } = body;
  if (!session_id || answer === undefined || answer === null) {
    return { status: 400, data: { error: 'session_id와 answer를 입력하세요' } };
  }

  const session = await queryOne(
    'SELECT * FROM game_sessions WHERE id = ? AND user_id = ?',
    [session_id, user.id],
  );
  if (!session) {
    return { status: 404, data: { error: '세션을 찾을 수 없습니다' } };
  }
  if (session.is_finished) {
    return { status: 400, data: { error: '이미 종료된 세션입니다' } };
  }

  const pending = await queryOne(
    'SELECT * FROM game_answers WHERE session_id = ? AND user_answer IS NULL ORDER BY id DESC LIMIT 1',
    [session_id],
  );
  if (!pending) {
    return { status: 400, data: { error: '답변할 문제가 없습니다' } };
  }

  const userAnswer = String(answer).trim();
  const isCorrect = userAnswer === pending.correct_answer;

  await query(
    'UPDATE game_answers SET user_answer = ?, is_correct = ?, answered_at = NOW() WHERE id = ?',
    [userAnswer, isCorrect, pending.id],
  );

  if (isCorrect) {
    await query(
      'UPDATE game_sessions SET correct_answers = correct_answers + 1 WHERE id = ?',
      [session_id],
    );
  }

  const answeredCount = (await query(
    'SELECT COUNT(*) as cnt FROM game_answers WHERE session_id = ? AND user_answer IS NOT NULL',
    [session_id],
  ))[0].cnt;

  if (answeredCount >= QUESTIONS_PER_SESSION) {
    await query(
      'UPDATE game_sessions SET is_finished = TRUE, finished_at = NOW() WHERE id = ?',
      [session_id],
    );
    const final = await queryOne('SELECT * FROM game_sessions WHERE id = ?', [session_id]);
    return {
      status: 200,
      data: {
        correct: isCorrect,
        correct_answer: pending.correct_answer,
        finished: true,
        score: `${final.correct_answers}/${final.total_questions}`,
        message: `게임 종료! ${final.correct_answers}/${final.total_questions} 정답`,
      },
    };
  }

  const next = await generateQuestion(session.game_type);
  await insert(
    'INSERT INTO game_answers (session_id, question, correct_answer) VALUES (?, ?, ?)',
    [session_id, next.question, next.answer],
  );

  return {
    status: 200,
    data: {
      correct: isCorrect,
      correct_answer: pending.correct_answer,
      finished: false,
      question: next.question,
      question_number: answeredCount + 1,
      total_questions: QUESTIONS_PER_SESSION,
    },
  };
}
