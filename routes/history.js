import { query } from '../db.js';

export async function getHistory(user) {
  const stats = await query(`
    SELECT
      game_type,
      COUNT(*) AS total_games,
      SUM(correct_answers) AS total_correct,
      SUM(total_questions) AS total_questions,
      ROUND(SUM(correct_answers) / SUM(total_questions) * 100, 1) AS accuracy
    FROM game_sessions
    WHERE user_id = ? AND is_finished = TRUE
    GROUP BY game_type
  `, [user.id]);

  const recent = await query(`
    SELECT
      gs.id AS session_id,
      gs.game_type,
      gs.correct_answers,
      gs.total_questions,
      gs.started_at,
      gs.finished_at
    FROM game_sessions gs
    WHERE gs.user_id = ? AND gs.is_finished = TRUE
    ORDER BY gs.finished_at DESC
    LIMIT 10
  `, [user.id]);

  const summary = {};
  for (const row of stats) {
    summary[row.game_type] = {
      total_games: row.total_games,
      total_correct: Number(row.total_correct),
      total_questions: Number(row.total_questions),
      accuracy: `${row.accuracy}%`,
    };
  }

  return {
    status: 200,
    data: {
      user: user.username,
      summary,
      recent_games: recent.map((r) => ({
        session_id: r.session_id,
        game_type: r.game_type,
        score: `${r.correct_answers}/${r.total_questions}`,
        started_at: r.started_at,
        finished_at: r.finished_at,
      })),
    },
  };
}
