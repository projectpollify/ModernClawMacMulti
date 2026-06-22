use chrono::{Local, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;

use crate::services::database::Database;
use crate::services::memory::MemoryService;

const MAX_SEARCH_RESULTS: usize = 10;
const MAX_FILE_BYTES: u64 = 512 * 1024;
const PDF_EXPORT_SCRIPT: &str = "/Users/shawn/.codex/skills/document-exporter/scripts/md_to_pdf.py";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalToolCall {
    pub name: String,
    #[serde(default)]
    pub arguments: Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalToolResult {
    pub name: String,
    pub success: bool,
    pub content: Value,
}

pub struct LocalToolService<'a> {
    db: &'a Database,
    memory_service: MemoryService,
}

impl<'a> LocalToolService<'a> {
    pub fn new(db: &'a Database, memory_service: MemoryService) -> Self {
        Self { db, memory_service }
    }

    pub fn tool_instructions() -> &'static str {
        r##"ModernClaw has a local-only tool layer. Use it only when it helps the user's request.

Available tools:
- memory.write_note: Save a durable note to today's local memory log. Arguments: {"note":"..."}
- memory.search: Search SOUL.md, USER.md, MEMORY.md, and daily memory logs. Arguments: {"query":"...","limit":5}
- knowledge.save_lesson: Save a beginner-friendly lesson as local Markdown. Arguments: {"title":"...","content":"...","tags":["optional"]}
- knowledge.search: Search local knowledge files. Arguments: {"query":"...","limit":5}
- app.get_settings: Inspect saved ModernClaw settings. Arguments: {}
- workspace.list_safe_files: List safe local workspace files under memory and knowledge. Arguments: {"path":"optional-relative-folder","limit":20}
- workspace.write_markdown: Save a Markdown file inside the active workspace. Arguments: {"path":"summaries/example.md","content":"# Title\n\n...","overwrite":false}
- workspace.export_pdf: Export an existing workspace Markdown file to PDF. Arguments: {"sourcePath":"summaries/example.md","outputPath":"summaries/example.pdf"}

When the user asks for a Markdown file, call workspace.write_markdown. When the user asks for a PDF, write the Markdown source first, then call workspace.export_pdf. Only report a file was saved after a successful tool result.

To call a tool, respond with only this JSON, with no prose:
{"modernclaw_tool_call":{"name":"tool.name","arguments":{}}}

After ModernClaw returns a tool result, answer the user normally. Never claim a tool ran unless ModernClaw provides a tool result."##
    }

    pub fn execute(&self, call: LocalToolCall) -> LocalToolResult {
        let name = call.name.trim().to_string();
        let result = match name.as_str() {
            "memory.write_note" => self.memory_write_note(&call.arguments),
            "memory.search" => self.memory_search(&call.arguments),
            "knowledge.save_lesson" => self.knowledge_save_lesson(&call.arguments),
            "knowledge.search" => self.knowledge_search(&call.arguments),
            "app.get_settings" => self.app_get_settings(),
            "workspace.list_safe_files" => self.workspace_list_safe_files(&call.arguments),
            "workspace.write_markdown" => self.workspace_write_markdown(&call.arguments),
            "workspace.export_pdf" => self.workspace_export_pdf(&call.arguments),
            _ => Err(format!("Unknown local tool: {}", name)),
        };

        match result {
            Ok(content) => LocalToolResult {
                name,
                success: true,
                content,
            },
            Err(error) => LocalToolResult {
                name,
                success: false,
                content: json!({ "error": error }),
            },
        }
    }

    fn memory_write_note(&self, arguments: &Value) -> Result<Value, String> {
        let note = required_string(arguments, "note")?;
        self.memory_service.append_to_today_log(&note)?;

        Ok(json!({
            "saved": true,
            "date": Local::now().format("%Y-%m-%d").to_string(),
            "summary": truncate(&note, 240),
        }))
    }

    fn memory_search(&self, arguments: &Value) -> Result<Value, String> {
        let query = required_string(arguments, "query")?;
        let limit = optional_limit(arguments, "limit", 5, MAX_SEARCH_RESULTS);
        let base_path = PathBuf::from(self.memory_service.get_base_path());
        let mut files = vec![
            ("SOUL.md".to_string(), base_path.join("SOUL.md")),
            ("USER.md".to_string(), base_path.join("USER.md")),
            ("MEMORY.md".to_string(), base_path.join("MEMORY.md")),
        ];

        files.extend(list_markdown_files(&base_path.join("memory"), "memory")?);
        let results = search_files(&files, &query, limit)?;

        Ok(json!({
            "query": query,
            "results": results,
        }))
    }

    fn knowledge_save_lesson(&self, arguments: &Value) -> Result<Value, String> {
        let title = required_string(arguments, "title")?;
        let content = required_string(arguments, "content")?;
        let tags = optional_string_array(arguments, "tags");
        let filename = unique_knowledge_filename(&self.memory_service, &title);
        let mut markdown = format!("# {}\n\n", title.trim());

        if !tags.is_empty() {
            markdown.push_str(&format!("Tags: {}\n\n", tags.join(", ")));
        }

        markdown.push_str(content.trim());
        markdown.push_str("\n\n---\nSaved by ModernClaw local tools.\n");
        self.memory_service
            .write_file(&format!("knowledge/{}", filename), &markdown)?;

        Ok(json!({
            "saved": true,
            "title": title,
            "filename": filename,
            "path": format!("knowledge/{}", filename),
            "tags": tags,
        }))
    }

    fn knowledge_search(&self, arguments: &Value) -> Result<Value, String> {
        let query = required_string(arguments, "query")?;
        let limit = optional_limit(arguments, "limit", 5, MAX_SEARCH_RESULTS);
        let base_path = PathBuf::from(self.memory_service.get_base_path());
        let files = list_markdown_files(&base_path.join("knowledge"), "knowledge")?;
        let results = search_files(&files, &query, limit)?;

        Ok(json!({
            "query": query,
            "results": results,
        }))
    }

    fn app_get_settings(&self) -> Result<Value, String> {
        let rows = self.db.list_settings()?;
        let mut settings = Map::new();

        for (key, raw_value) in rows {
            let value =
                serde_json::from_str::<Value>(&raw_value).unwrap_or(Value::String(raw_value));
            settings.insert(key, value);
        }

        Ok(json!({
            "settings": settings,
            "readAt": Utc::now().to_rfc3339(),
        }))
    }

    fn workspace_list_safe_files(&self, arguments: &Value) -> Result<Value, String> {
        let relative_path = optional_string(arguments, "path").unwrap_or_default();
        let limit = optional_limit(arguments, "limit", 20, 100);
        let base_path = PathBuf::from(self.memory_service.get_base_path());
        let target = resolve_safe_workspace_path(&base_path, &relative_path)?;
        let mut files = Vec::new();

        if !target.exists() {
            return Ok(json!({
                "path": relative_path,
                "files": files,
            }));
        }

        for entry in fs::read_dir(&target)
            .map_err(|error| format!("Failed to read workspace folder: {}", error))?
            .flatten()
            .take(limit)
        {
            let path = entry.path();
            let metadata = entry.metadata().ok();
            let relative = path
                .strip_prefix(&base_path)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();

            files.push(json!({
                "path": relative,
                "kind": if path.is_dir() { "folder" } else { "file" },
                "sizeBytes": metadata.as_ref().map(|value| value.len()),
                "modifiedAt": metadata
                    .and_then(|value| value.modified().ok())
                    .map(chrono::DateTime::<Utc>::from)
                    .map(|value| value.to_rfc3339()),
            }));
        }

        Ok(json!({
            "path": relative_path,
            "files": files,
        }))
    }

    fn workspace_write_markdown(&self, arguments: &Value) -> Result<Value, String> {
        let relative_path = required_string(arguments, "path")?;
        let content = required_string(arguments, "content")?;
        let overwrite = optional_bool(arguments, "overwrite").unwrap_or(false);
        let base_path = PathBuf::from(self.memory_service.get_base_path());
        let target = resolve_safe_output_path(&base_path, &relative_path, "md")?;
        let target = if overwrite {
            target
        } else {
            unique_output_path(target)
        };

        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Failed to create output directory: {}", error))?;
        }

        let mut markdown = content.trim().to_string();
        markdown.push('\n');
        fs::write(&target, markdown)
            .map_err(|error| format!("Failed to write Markdown file: {}", error))?;

        Ok(json!({
            "saved": true,
            "kind": "markdown",
            "path": relative_to_workspace(&base_path, &target),
            "absolutePath": target.to_string_lossy().to_string(),
            "sizeBytes": fs::metadata(&target).ok().map(|metadata| metadata.len()),
        }))
    }

    fn workspace_export_pdf(&self, arguments: &Value) -> Result<Value, String> {
        let source_path = required_string(arguments, "sourcePath")?;
        let output_path = optional_string(arguments, "outputPath")
            .unwrap_or_else(|| source_path_with_extension(&source_path, "pdf"));
        let overwrite = optional_bool(arguments, "overwrite").unwrap_or(false);
        let base_path = PathBuf::from(self.memory_service.get_base_path());
        let source = resolve_safe_output_path(&base_path, &source_path, "md")?;

        if !source.exists() {
            return Err(format!("Markdown source does not exist: {}", source_path));
        }

        let output = resolve_safe_output_path(&base_path, &output_path, "pdf")?;
        let output = if overwrite {
            output
        } else {
            unique_output_path(output)
        };

        if let Some(parent) = output.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Failed to create PDF output directory: {}", error))?;
        }

        let python =
            find_python_binary().ok_or_else(|| "PDF export requires python3.".to_string())?;
        let script = Path::new(PDF_EXPORT_SCRIPT);
        if !script.exists() {
            return Err(format!(
                "PDF export script not found: {}",
                PDF_EXPORT_SCRIPT
            ));
        }

        let output_result = Command::new(python)
            .arg(script)
            .arg(&source)
            .arg(&output)
            .output()
            .map_err(|error| format!("Failed to run PDF export: {}", error))?;

        if !output_result.status.success() {
            let stderr = String::from_utf8_lossy(&output_result.stderr)
                .trim()
                .to_string();
            return Err(if stderr.is_empty() {
                "PDF export failed.".to_string()
            } else {
                format!("PDF export failed: {}", stderr)
            });
        }

        let metadata = fs::metadata(&output)
            .map_err(|error| format!("PDF export did not create an output file: {}", error))?;
        if metadata.len() == 0 {
            return Err("PDF export created an empty file.".to_string());
        }

        Ok(json!({
            "saved": true,
            "kind": "pdf",
            "sourcePath": relative_to_workspace(&base_path, &source),
            "path": relative_to_workspace(&base_path, &output),
            "absolutePath": output.to_string_lossy().to_string(),
            "sizeBytes": metadata.len(),
        }))
    }
}

pub fn parse_local_tool_call(content: &str) -> Option<LocalToolCall> {
    let trimmed = content.trim();
    let json_text = extract_json_candidate(trimmed)?;
    let value = serde_json::from_str::<Value>(json_text).ok()?;
    let envelope = value.get("modernclaw_tool_call").unwrap_or(&value);
    let name = envelope
        .get("name")
        .or_else(|| envelope.get("tool"))
        .and_then(Value::as_str)?
        .to_string();
    let arguments = envelope
        .get("arguments")
        .or_else(|| envelope.get("args"))
        .cloned()
        .unwrap_or_else(|| json!({}));

    Some(LocalToolCall { name, arguments })
}

pub fn format_tool_result_for_model(result: &LocalToolResult) -> String {
    format!(
        "ModernClaw local tool result:\n{}\n\nUse this result to answer the user. Do not call the same tool again unless you need different arguments.",
        serde_json::to_string_pretty(result).unwrap_or_else(|_| "{\"success\":false}".to_string())
    )
}

fn extract_json_candidate(content: &str) -> Option<&str> {
    if content.starts_with('{') && content.ends_with('}') {
        return Some(content);
    }

    let fenced = content
        .strip_prefix("```json")
        .or_else(|| content.strip_prefix("```"))?
        .trim();
    let fenced = fenced.strip_suffix("```")?.trim();

    if fenced.starts_with('{') && fenced.ends_with('}') {
        Some(fenced)
    } else {
        None
    }
}

fn required_string(arguments: &Value, key: &str) -> Result<String, String> {
    optional_string(arguments, key)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| format!("Missing required string argument: {}", key))
}

fn optional_string(arguments: &Value, key: &str) -> Option<String> {
    arguments
        .get(key)
        .and_then(Value::as_str)
        .map(|value| value.trim().to_string())
}

fn optional_string_array(arguments: &Value, key: &str) -> Vec<String> {
    arguments
        .get(key)
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

fn optional_bool(arguments: &Value, key: &str) -> Option<bool> {
    arguments.get(key).and_then(Value::as_bool)
}

fn optional_limit(arguments: &Value, key: &str, default_value: usize, max_value: usize) -> usize {
    arguments
        .get(key)
        .and_then(Value::as_u64)
        .and_then(|value| usize::try_from(value).ok())
        .unwrap_or(default_value)
        .clamp(1, max_value)
}

fn list_markdown_files(root: &Path, prefix: &str) -> Result<Vec<(String, PathBuf)>, String> {
    if !root.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    collect_markdown_files(root, prefix, root, &mut files)?;
    Ok(files)
}

fn collect_markdown_files(
    root: &Path,
    prefix: &str,
    current: &Path,
    files: &mut Vec<(String, PathBuf)>,
) -> Result<(), String> {
    for entry in
        fs::read_dir(current).map_err(|error| format!("Failed to read folder: {}", error))?
    {
        let entry = entry.map_err(|error| format!("Failed to read folder entry: {}", error))?;
        let path = entry.path();

        if path.is_dir() {
            collect_markdown_files(root, prefix, &path, files)?;
            continue;
        }

        if path.extension().and_then(|value| value.to_str()) != Some("md") {
            continue;
        }

        let relative = path.strip_prefix(root).unwrap_or(&path).to_string_lossy();
        files.push((format!("{}/{}", prefix, relative), path));
    }

    Ok(())
}

fn search_files(
    files: &[(String, PathBuf)],
    query: &str,
    limit: usize,
) -> Result<Vec<Value>, String> {
    let terms: Vec<String> = query
        .to_ascii_lowercase()
        .split_whitespace()
        .map(|term| term.to_string())
        .collect();

    if terms.is_empty() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();

    for (label, path) in files {
        let metadata = match path.metadata() {
            Ok(metadata) if metadata.len() <= MAX_FILE_BYTES => metadata,
            _ => continue,
        };
        let content = fs::read_to_string(path)
            .map_err(|error| format!("Failed to read {}: {}", label, error))?;
        let lower = content.to_ascii_lowercase();
        let score = terms
            .iter()
            .filter(|term| lower.contains(term.as_str()))
            .count();

        if score == 0 {
            continue;
        }

        results.push(json!({
            "path": label,
            "score": score,
            "excerpt": excerpt_for_query(&content, &terms),
            "modifiedAt": metadata
                .modified()
                .ok()
                .map(chrono::DateTime::<Utc>::from)
                .map(|value| value.to_rfc3339()),
        }));
    }

    results.sort_by(|left, right| {
        right
            .get("score")
            .and_then(Value::as_u64)
            .cmp(&left.get("score").and_then(Value::as_u64))
    });
    results.truncate(limit);

    Ok(results)
}

fn excerpt_for_query(content: &str, terms: &[String]) -> String {
    let lower = content.to_ascii_lowercase();
    let first_match = terms
        .iter()
        .filter_map(|term| lower.find(term))
        .min()
        .unwrap_or(0);
    let start = first_match.saturating_sub(120);
    let excerpt: String = content.chars().skip(start).take(320).collect();
    truncate(excerpt.trim(), 320)
}

fn unique_knowledge_filename(memory_service: &MemoryService, title: &str) -> String {
    let base = slugify(title);
    let mut candidate = format!("{}.md", base);
    let mut counter = 2;

    while memory_service
        .read_file(&format!("knowledge/{}", candidate))
        .map(|file| file.exists)
        .unwrap_or(false)
    {
        candidate = format!("{}-{}.md", base, counter);
        counter += 1;
    }

    candidate
}

fn slugify(value: &str) -> String {
    let mut slug = String::new();
    let mut last_was_dash = false;

    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch.to_ascii_lowercase());
            last_was_dash = false;
        } else if !last_was_dash {
            slug.push('-');
            last_was_dash = true;
        }
    }

    let slug = slug.trim_matches('-');
    if slug.is_empty() {
        "lesson".to_string()
    } else {
        slug.to_string()
    }
}

fn resolve_safe_workspace_path(base_path: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let relative_path = relative_path.trim();
    if relative_path.is_empty() {
        return Ok(base_path.to_path_buf());
    }

    let relative = Path::new(relative_path);
    if relative.is_absolute() {
        return Err("Absolute paths are not allowed".to_string());
    }

    let mut components = relative.components();
    let first = components
        .next()
        .ok_or_else(|| "Empty path is not allowed".to_string())?;
    let Component::Normal(first_segment) = first else {
        return Err("Unsafe path component is not allowed".to_string());
    };
    let first_segment = first_segment
        .to_str()
        .ok_or_else(|| "Invalid path component".to_string())?;

    if first_segment != "memory" && first_segment != "knowledge" {
        return Err("Only memory and knowledge folders can be listed by this tool".to_string());
    }

    for component in relative.components() {
        match component {
            Component::Normal(_) => {}
            _ => return Err("Unsafe path component is not allowed".to_string()),
        }
    }

    Ok(base_path.join(relative))
}

fn resolve_safe_output_path(
    base_path: &Path,
    relative_path: &str,
    required_extension: &str,
) -> Result<PathBuf, String> {
    let relative_path = relative_path.trim();
    if relative_path.is_empty() {
        return Err("Output path is required".to_string());
    }

    let relative = Path::new(relative_path);
    if relative.is_absolute() {
        return Err("Absolute paths are not allowed".to_string());
    }

    let mut has_component = false;
    for component in relative.components() {
        match component {
            Component::Normal(_) => has_component = true,
            _ => return Err("Unsafe path component is not allowed".to_string()),
        }
    }

    if !has_component {
        return Err("Output path is required".to_string());
    }

    let extension = relative
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .ok_or_else(|| format!("Output path must end in .{}", required_extension))?;
    if extension != required_extension {
        return Err(format!("Output path must end in .{}", required_extension));
    }

    Ok(base_path.join(relative))
}

fn unique_output_path(path: PathBuf) -> PathBuf {
    if !path.exists() {
        return path;
    }

    let parent = path.parent().map(Path::to_path_buf).unwrap_or_default();
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("document");
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("");

    for index in 2..1000 {
        let candidate = parent.join(format!("{}-{}.{}", stem, index, extension));
        if !candidate.exists() {
            return candidate;
        }
    }

    parent.join(format!("{}-{}.{}", stem, Utc::now().timestamp(), extension))
}

fn source_path_with_extension(source_path: &str, extension: &str) -> String {
    let mut path = PathBuf::from(source_path);
    path.set_extension(extension);
    path.to_string_lossy().to_string()
}

fn relative_to_workspace(base_path: &Path, path: &Path) -> String {
    path.strip_prefix(base_path)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string()
}

fn find_python_binary() -> Option<&'static str> {
    for candidate in [
        "/opt/homebrew/bin/python3",
        "/usr/local/bin/python3",
        "/usr/bin/python3",
        "python3",
    ] {
        if Command::new(candidate).arg("--version").output().is_ok() {
            return Some(candidate);
        }
    }

    None
}

fn truncate(value: &str, max_chars: usize) -> String {
    let mut output: String = value.chars().take(max_chars).collect();
    if value.chars().count() > max_chars {
        output.push_str("...");
    }
    output
}

#[cfg(test)]
mod tests {
    use super::{parse_local_tool_call, LocalToolCall, LocalToolService};
    use crate::services::database::Database;
    use crate::services::memory::MemoryService;
    use serde_json::json;
    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn parses_modernclaw_tool_envelope() {
        let call = parse_local_tool_call(
            r#"{"modernclaw_tool_call":{"name":"memory.search","arguments":{"query":"privacy","limit":3}}}"#,
        )
        .expect("tool call should parse");

        assert_eq!(call.name, "memory.search");
        assert_eq!(call.arguments["query"], "privacy");
        assert_eq!(call.arguments["limit"], 3);
    }

    #[test]
    fn parses_fenced_tool_envelope() {
        let call = parse_local_tool_call(
            "```json\n{\"modernclaw_tool_call\":{\"name\":\"app.get_settings\",\"arguments\":{}}}\n```",
        )
        .expect("fenced tool call should parse");

        assert_eq!(call.name, "app.get_settings");
    }

    #[test]
    fn ignores_plain_text() {
        assert!(parse_local_tool_call("I can help with that.").is_none());
    }

    #[test]
    fn executes_core_local_tools_against_workspace() {
        let root = unique_temp_path("modernclaw-tools-workspace");
        let db_path = unique_temp_path("modernclaw-tools-db").join("data.db");
        let db = Database::new(&db_path).expect("db should initialize");
        db.set_setting("defaultModel", "\"google/gemma-4-e4b\"")
            .expect("setting should save");

        let memory = MemoryService::new(root.to_str().expect("temp path should be utf8"));
        memory.initialize().expect("memory should initialize");
        let tools = LocalToolService::new(&db, memory);

        let write_result = tools.execute(LocalToolCall {
            name: "memory.write_note".to_string(),
            arguments: json!({ "note": "ModernClaw tool test note about beginner AI safety." }),
        });
        assert!(write_result.success);

        let memory_result = tools.execute(LocalToolCall {
            name: "memory.search".to_string(),
            arguments: json!({ "query": "beginner safety", "limit": 5 }),
        });
        assert!(memory_result.success);
        assert!(!memory_result.content["results"]
            .as_array()
            .unwrap()
            .is_empty());

        let lesson_result = tools.execute(LocalToolCall {
            name: "knowledge.save_lesson".to_string(),
            arguments: json!({
                "title": "Local AI Basics",
                "content": "Local AI keeps prompts and saved lessons on this machine.",
                "tags": ["beginner", "privacy"]
            }),
        });
        assert!(lesson_result.success);

        let knowledge_result = tools.execute(LocalToolCall {
            name: "knowledge.search".to_string(),
            arguments: json!({ "query": "prompts lessons machine", "limit": 5 }),
        });
        assert!(knowledge_result.success);
        assert!(!knowledge_result.content["results"]
            .as_array()
            .unwrap()
            .is_empty());

        let settings_result = tools.execute(LocalToolCall {
            name: "app.get_settings".to_string(),
            arguments: json!({}),
        });
        assert!(settings_result.success);
        assert_eq!(
            settings_result.content["settings"]["defaultModel"],
            "google/gemma-4-e4b"
        );

        let files_result = tools.execute(LocalToolCall {
            name: "workspace.list_safe_files".to_string(),
            arguments: json!({ "path": "knowledge", "limit": 20 }),
        });
        assert!(files_result.success);
        assert!(!files_result.content["files"].as_array().unwrap().is_empty());

        let markdown_result = tools.execute(LocalToolCall {
            name: "workspace.write_markdown".to_string(),
            arguments: json!({
                "path": "summaries/tool-summary.md",
                "content": "# Tool Summary\n\nModernClaw can save Markdown files.",
            }),
        });
        assert!(markdown_result.success);
        assert!(root.join("summaries/tool-summary.md").exists());

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(db_path.parent().unwrap());
    }

    fn unique_temp_path(prefix: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "{}-{}",
            prefix,
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ))
    }
}
