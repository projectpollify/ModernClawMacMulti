use crate::services::database::Database;
use crate::types::Conversation;
use chrono::{DateTime, NaiveDateTime, Utc};

pub struct ConversationRepository<'a> {
    db: &'a Database,
}

impl<'a> ConversationRepository<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    pub fn create(&self, conversation: &Conversation) -> Result<(), String> {
        self.db.execute(
            r#"
            INSERT INTO conversations (id, agent_id, title, model, message_count, preview, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#,
            &[
                &conversation.id,
                &conversation.agent_id,
                &conversation.title,
                &conversation.model,
                &conversation.message_count,
                &conversation.preview,
                &conversation.created_at.to_rfc3339(),
                &conversation.updated_at.to_rfc3339(),
            ],
        )?;

        Ok(())
    }

    pub fn get(&self, id: &str) -> Result<Option<Conversation>, String> {
        self.db.query_one(
            "SELECT id, agent_id, title, model, message_count, preview, created_at, updated_at FROM conversations WHERE id = ?1",
            &[&id],
            |row| {
                Ok(Conversation {
                    id: row.get(0)?,
                    agent_id: row.get(1)?,
                    title: row.get(2)?,
                    model: row.get(3)?,
                    message_count: row.get(4)?,
                    preview: row.get(5)?,
                    created_at: parse_rfc3339(row.get(6)?)?,
                    updated_at: parse_rfc3339(row.get(7)?)?,
                })
            },
        )
    }

    pub fn list_for_agent(&self, agent_id: &str, limit: Option<i32>) -> Result<Vec<Conversation>, String> {
        let limit = limit.unwrap_or(100);

        self.db.query_all(
            r#"
            SELECT id, agent_id, title, model, message_count, preview, created_at, updated_at
            FROM conversations
            WHERE agent_id = ?1
            ORDER BY updated_at DESC
            LIMIT ?2
            "#,
            &[&agent_id, &limit],
            |row| {
                Ok(Conversation {
                    id: row.get(0)?,
                    agent_id: row.get(1)?,
                    title: row.get(2)?,
                    model: row.get(3)?,
                    message_count: row.get(4)?,
                    preview: row.get(5)?,
                    created_at: parse_rfc3339(row.get(6)?)?,
                    updated_at: parse_rfc3339(row.get(7)?)?,
                })
            },
        )
    }

    pub fn update(
        &self,
        id: &str,
        title: Option<&str>,
        preview: Option<&str>,
        message_count: Option<i32>,
    ) -> Result<(), String> {
        let now = Utc::now().to_rfc3339();

        if let Some(title) = title {
            self.db.execute(
                "UPDATE conversations SET title = ?1, updated_at = ?2 WHERE id = ?3",
                &[&title, &now, &id],
            )?;
        }

        if let Some(preview) = preview {
            self.db.execute(
                "UPDATE conversations SET preview = ?1, updated_at = ?2 WHERE id = ?3",
                &[&preview, &now, &id],
            )?;
        }

        if let Some(message_count) = message_count {
            self.db.execute(
                "UPDATE conversations SET message_count = ?1, updated_at = ?2 WHERE id = ?3",
                &[&message_count, &now, &id],
            )?;
        }

        Ok(())
    }

    pub fn delete(&self, id: &str) -> Result<(), String> {
        self.db
            .execute("DELETE FROM conversations WHERE id = ?1", &[&id])?;
        Ok(())
    }

    pub fn delete_for_agent(&self, agent_id: &str) -> Result<(), String> {
        self.db
            .execute("DELETE FROM conversations WHERE agent_id = ?1", &[&agent_id])?;
        Ok(())
    }

    pub fn search_for_agent(&self, agent_id: &str, query: &str, limit: Option<i32>) -> Result<Vec<Conversation>, String> {
        let limit = limit.unwrap_or(20);
        let pattern = format!("%{}%", query);

        self.db.query_all(
            r#"
            SELECT id, agent_id, title, model, message_count, preview, created_at, updated_at
            FROM conversations
            WHERE agent_id = ?1 AND (title LIKE ?2 OR preview LIKE ?2)
            ORDER BY updated_at DESC
            LIMIT ?3
            "#,
            &[&agent_id, &pattern, &limit],
            |row| {
                Ok(Conversation {
                    id: row.get(0)?,
                    agent_id: row.get(1)?,
                    title: row.get(2)?,
                    model: row.get(3)?,
                    message_count: row.get(4)?,
                    preview: row.get(5)?,
                    created_at: parse_rfc3339(row.get(6)?)?,
                    updated_at: parse_rfc3339(row.get(7)?)?,
                })
            },
        )
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
