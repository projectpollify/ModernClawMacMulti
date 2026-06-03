use crate::services::database::Database;
use crate::types::{Message, MessageAttachment, MessageFeedbackSummary};
use chrono::{DateTime, NaiveDateTime, Utc};

pub struct MessageRepository<'a> {
    db: &'a Database,
}

impl<'a> MessageRepository<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    pub fn create(&self, message: &Message) -> Result<(), String> {
        let attachments_json = serde_json::to_string(&message.attachments)
            .map_err(|error| format!("Failed to serialize message attachments: {}", error))?;

        self.db.execute(
            r#"
            INSERT INTO messages (id, conversation_id, role, content, attachments, tokens_used, feedback, feedback_note, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            "#,
            &[
                &message.id,
                &message.conversation_id,
                &message.role,
                &message.content,
                &attachments_json,
                &message.tokens_used,
                &message.feedback,
                &message.feedback_note,
                &message.created_at.to_rfc3339(),
            ],
        )?;

        Ok(())
    }

    pub fn get_for_conversation(&self, conversation_id: &str) -> Result<Vec<Message>, String> {
        self.db.query_all(
            r#"
            SELECT id, conversation_id, role, content, attachments, tokens_used, feedback, feedback_note, created_at
            FROM messages
            WHERE conversation_id = ?1
            ORDER BY created_at ASC
            "#,
            &[&conversation_id],
            |row| {
                let attachments: Vec<MessageAttachment> =
                    serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or_default();

                Ok(Message {
                    id: row.get(0)?,
                    conversation_id: row.get(1)?,
                    role: row.get(2)?,
                    content: row.get(3)?,
                    attachments,
                    tokens_used: row.get(5)?,
                    feedback: row.get(6)?,
                    feedback_note: row.get(7)?,
                    created_at: parse_rfc3339(row.get(8)?)?,
                })
            },
        )
    }

    pub fn update_feedback(
        &self,
        id: &str,
        feedback: Option<&str>,
        feedback_note: Option<&str>,
    ) -> Result<(), String> {
        self.db.execute(
            "UPDATE messages SET feedback = ?2, feedback_note = ?3 WHERE id = ?1",
            &[&id, &feedback, &feedback_note],
        )?;
        Ok(())
    }

    pub fn feedback_summary_for_agent(&self, agent_id: &str) -> Result<MessageFeedbackSummary, String> {
        self.db
            .query_one(
                r#"
                SELECT
                    COUNT(CASE WHEN m.role = 'assistant' THEN 1 END) AS assistant_message_count,
                    COUNT(CASE WHEN m.role = 'assistant' AND m.feedback IS NOT NULL THEN 1 END) AS rated_count,
                    COUNT(CASE WHEN m.role = 'assistant' AND m.feedback = 'up' THEN 1 END) AS helpful_count,
                    COUNT(CASE WHEN m.role = 'assistant' AND m.feedback = 'down' THEN 1 END) AS not_useful_count
                FROM messages m
                INNER JOIN conversations c ON c.id = m.conversation_id
                WHERE c.agent_id = ?1
                "#,
                &[&agent_id],
                |row| {
                    Ok(MessageFeedbackSummary {
                        assistant_message_count: row.get(0)?,
                        rated_count: row.get(1)?,
                        helpful_count: row.get(2)?,
                        not_useful_count: row.get(3)?,
                    })
                },
            )
            .map(|summary| {
                summary.unwrap_or(MessageFeedbackSummary {
                    assistant_message_count: 0,
                    rated_count: 0,
                    helpful_count: 0,
                    not_useful_count: 0,
                })
            })
    }

    pub fn delete(&self, id: &str) -> Result<(), String> {
        self.db.execute("DELETE FROM messages WHERE id = ?1", &[&id])?;
        Ok(())
    }

    pub fn count(&self, conversation_id: &str) -> Result<i32, String> {
        self.db
            .query_one(
                "SELECT COUNT(*) FROM messages WHERE conversation_id = ?1",
                &[&conversation_id],
                |row| row.get(0),
            )
            .map(|count| count.unwrap_or(0))
    }
}

fn parse_rfc3339(value: String) -> rusqlite::Result<DateTime<Utc>> {
    Ok(parse_timestamp(&value))
}

/// Tolerantly parse a stored timestamp into UTC. See `agent_repo::parse_timestamp`
/// for the full rationale: a single malformed value must never fail the whole
/// query, so unrecognized formats fall back to the Unix epoch.
fn parse_timestamp(value: &str) -> DateTime<Utc> {
    if let Ok(parsed) = DateTime::parse_from_rfc3339(value) {
        return parsed.with_timezone(&Utc);
    }

    const NAIVE_FORMATS: &[&str] = &[
        "%Y-%m-%dT%H:%M:%S%.f",
        "%Y-%m-%d %H:%M:%S%.f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
    ];
    for format in NAIVE_FORMATS {
        if let Ok(naive) = NaiveDateTime::parse_from_str(value, format) {
            return naive.and_utc();
        }
    }

    DateTime::<Utc>::from_timestamp(0, 0).unwrap_or_else(Utc::now)
}
