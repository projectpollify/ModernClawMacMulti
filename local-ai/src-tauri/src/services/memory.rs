use crate::types::{CuratorPackage, DailyLog, MemoryContext, MemoryFile, MessageAttachment};
use chrono::Local;
use serde::Deserialize;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;

pub struct MemoryService {
    base_path: PathBuf,
}

#[derive(Debug, Deserialize, Default)]
struct CuratorMeta {
    title: Option<String>,
    summary: Option<String>,
    source: Option<String>,
    tags: Option<Vec<String>>,
    request_topic: Option<String>,
    created_at: Option<String>,
}

impl MemoryService {
    pub fn new(base_path: &str) -> Self {
        Self {
            base_path: PathBuf::from(base_path),
        }
    }

    pub fn initialize(&self) -> Result<(), String> {
        fs::create_dir_all(&self.base_path)
            .map_err(|error| format!("Failed to create base directory: {}", error))?;
        fs::create_dir_all(self.base_path.join("memory"))
            .map_err(|error| format!("Failed to create memory directory: {}", error))?;
        fs::create_dir_all(self.base_path.join("knowledge"))
            .map_err(|error| format!("Failed to create knowledge directory: {}", error))?;
        fs::create_dir_all(self.base_path.join("curator"))
            .map_err(|error| format!("Failed to create curator directory: {}", error))?;
        fs::create_dir_all(self.base_path.join("attachments"))
            .map_err(|error| format!("Failed to create attachments directory: {}", error))?;

        for folder in ["requests", "in-progress", "staged", "approved", "rejected", "archive"] {
            fs::create_dir_all(self.base_path.join("curator").join(folder))
                .map_err(|error| format!("Failed to create curator/{folder} directory: {}", error))?;
        }


        for folder in [
            self.base_path.join("tools"),
            self.base_path.join("tools").join("piper"),
            self.base_path.join("tools").join("piper").join("voices"),
            self.base_path.join("tools").join("whisper"),
            self.base_path.join("tools").join("whisper").join("models"),
        ] {
            fs::create_dir_all(&folder)
                .map_err(|error| format!("Failed to create tool directory {}: {}", folder.to_string_lossy(), error))?;
        }
        self.create_default_files()?;
        Ok(())
    }

    fn create_default_files(&self) -> Result<(), String> {
        let defaults = [
            (
                "SOUL.md",
                "# SOUL.md - Who I Am\n\n<!-- Recommended length: 1,200-5,000 characters. Soft limit: 8,000. Keep this focused and high-signal. -->\n\nI am a helpful, knowledgeable AI assistant running locally on your machine.\n\n## Personality\n- Clear and concise in my responses\n- Friendly but professional\n- I explain complex topics in accessible ways\n- I ask clarifying questions when needed\n\n## Behavior\n- I remember our conversations through my memory files\n- I respect your privacy - nothing leaves your device\n- I admit when I don't know something\n- I provide balanced perspectives on complex issues\n\n## Capabilities\n- General knowledge and reasoning\n- Writing and editing assistance\n- Code help and explanation\n- Analysis and problem-solving\n- Creative brainstorming\n\n---\n\nYou can edit this file to customize my personality and behavior.\n",
            ),
            (
                "USER.md",
                "# USER.md - About You\n\n<!-- Recommended length: 600-2,500 characters. Soft limit: 4,000. Keep this focused on stable facts and preferences. -->\n\n<!-- Add information about yourself here so I can better assist you -->\n\n## Name\n<!-- Your name or what you'd like to be called -->\n\n## Context\n<!-- Your profession, interests, or relevant background -->\n\n## Preferences\n<!-- Communication style preferences, topics of interest, etc. -->\n\n---\n\nThis file helps me personalize our conversations. Edit it anytime.\n",
            ),
            (
                "MEMORY.md",
                "# MEMORY.md - What I Remember\n\n<!-- Recommended length: 500-3,000 characters. Soft limit: 4,500. Keep this curated and durable rather than exhaustive. -->\n\n<!-- This file stores important facts, decisions, and context from our conversations -->\n\n## Key Facts\n<!-- Things you've told me that I should remember -->\n\n## Preferences\n<!-- Your stated preferences and how you like things done -->\n\n## Projects\n<!-- Ongoing projects we're working on together -->\n\n## Decisions\n<!-- Important decisions we've made together -->\n\n---\n\nI update this file as I learn about you. You can edit it directly too.\n",
            ),
        ];

        for (name, content) in defaults {
            let path = self.base_path.join(name);
            if !path.exists() {
                fs::write(&path, content)
                    .map_err(|error| format!("Failed to create {}: {}", name, error))?;
            }
        }

        Ok(())
    }

    fn resolve_safe_path(&self, filename: &str) -> Result<PathBuf, String> {
        let relative = Path::new(filename);

        if filename.trim().is_empty() {
            return Err("Empty memory path is not allowed".to_string());
        }

        if relative.is_absolute() {
            return Err("Absolute paths are not allowed".to_string());
        }

        for component in relative.components() {
            match component {
                Component::Normal(_) => {}
                _ => return Err(format!("Invalid memory path: {}", filename)),
            }
        }

        let first_segment = relative
            .components()
            .next()
            .and_then(|component| match component {
                Component::Normal(part) => part.to_str(),
                _ => None,
            })
            .ok_or_else(|| "Empty path not allowed".to_string())?;

        let allowed_top_level = ["SOUL.md", "USER.md", "MEMORY.md"];
        let allowed = allowed_top_level.contains(&filename)
            || first_segment == "memory"
            || first_segment == "knowledge"
            || first_segment == "curator";

        if !allowed {
            return Err(format!(
                "Path is outside allowed memory files: {}",
                filename
            ));
        }

        Ok(self.base_path.join(relative))
    }

    fn ensure_safe_folder_name(&self, folder_name: &str) -> Result<(), String> {
        let relative = Path::new(folder_name);

        if folder_name.trim().is_empty() {
            return Err("Empty curator folder name is not allowed".to_string());
        }

        if relative.is_absolute() {
            return Err("Absolute curator paths are not allowed".to_string());
        }

        let mut count = 0;
        for component in relative.components() {
            match component {
                Component::Normal(_) => count += 1,
                _ => return Err(format!("Invalid curator folder name: {}", folder_name)),
            }
        }

        if count != 1 {
            return Err(format!("Invalid curator folder name: {}", folder_name));
        }

        Ok(())
    }

    fn curator_stage_path(&self, stage: &str) -> PathBuf {
        self.base_path.join("curator").join(stage)
    }

    fn curator_package_path(&self, stage: &str, folder_name: &str) -> Result<PathBuf, String> {
        self.ensure_safe_folder_name(folder_name)?;
        Ok(self.curator_stage_path(stage).join(folder_name))
    }

    fn read_curator_meta(&self, package_path: &Path) -> CuratorMeta {
        let meta_path = package_path.join("meta.json");
        if !meta_path.exists() {
            return CuratorMeta::default();
        }

        fs::read_to_string(meta_path)
            .ok()
            .and_then(|content| serde_json::from_str::<CuratorMeta>(&content).ok())
            .unwrap_or_default()
    }

    fn format_timestamp(path: &Path) -> Option<String> {
        path.metadata()
            .ok()
            .and_then(|metadata| metadata.modified().ok())
            .map(|timestamp| {
                chrono::DateTime::<chrono::Utc>::from(timestamp)
                    .format("%Y-%m-%d %H:%M:%S")
                    .to_string()
            })
    }

    fn humanize_folder_name(folder_name: &str) -> String {
        folder_name
            .split('-')
            .filter(|part| !part.is_empty())
            .map(|part| {
                let mut chars = part.chars();
                match chars.next() {
                    Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str()),
                    None => String::new(),
                }
            })
            .collect::<Vec<_>>()
            .join(" ")
    }

    fn unique_knowledge_filename(&self, title: &str) -> String {
        let base = slugify(title);
        let mut candidate = format!("{}.md", base);
        let mut counter = 2;

        while self.base_path.join("knowledge").join(&candidate).exists() {
            candidate = format!("{}-{}.md", base, counter);
            counter += 1;
        }

        candidate
    }

    fn ensure_safe_conversation_id(&self, conversation_id: &str) -> Result<(), String> {
        let relative = Path::new(conversation_id);

        if conversation_id.trim().is_empty() {
            return Err("Empty conversation id is not allowed".to_string());
        }

        let mut count = 0;
        for component in relative.components() {
            match component {
                Component::Normal(_) => count += 1,
                _ => return Err(format!("Invalid conversation id: {}", conversation_id)),
            }
        }

        if count != 1 {
            return Err(format!("Invalid conversation id: {}", conversation_id));
        }

        Ok(())
    }

    fn attachment_extension(filename: &str, mime_type: Option<&str>) -> String {
        let from_name = Path::new(filename)
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase());

        if let Some(extension) = from_name {
            return extension;
        }

        match mime_type.unwrap_or_default() {
            "image/png" => "png".to_string(),
            "image/jpeg" => "jpg".to_string(),
            "image/webp" => "webp".to_string(),
            "image/gif" => "gif".to_string(),
            "audio/wav" => "wav".to_string(),
            "audio/mpeg" => "mp3".to_string(),
            "audio/mp4" => "m4a".to_string(),
            "audio/webm" => "webm".to_string(),
            "text/plain" => "txt".to_string(),
            "text/markdown" => "md".to_string(),
            "text/csv" => "csv".to_string(),
            "application/json" => "json".to_string(),
            _ => "bin".to_string(),
        }
    }

    fn move_curator_package(&self, from_stage: &str, to_stage: &str, folder_name: &str) -> Result<PathBuf, String> {
        let source = self.curator_package_path(from_stage, folder_name)?;
        if !source.exists() {
            return Err(format!("Curator package not found: {}", folder_name));
        }

        let target_root = self.curator_stage_path(to_stage);
        fs::create_dir_all(&target_root)
            .map_err(|error| format!("Failed to create curator target directory: {}", error))?;

        let mut target = target_root.join(folder_name);
        if target.exists() {
            let suffix = Local::now().format("%Y%m%d%H%M%S").to_string();
            target = target_root.join(format!("{}-{}", folder_name, suffix));
        }

        fs::rename(&source, &target)
            .map_err(|error| format!("Failed to move curator package: {}", error))?;

        Ok(target)
    }

    pub fn read_file(&self, filename: &str) -> Result<MemoryFile, String> {
        let path = self.resolve_safe_path(filename)?;
        let exists = path.exists();

        let content = if exists {
            fs::read_to_string(&path)
                .map_err(|error| format!("Failed to read {}: {}", filename, error))?
        } else {
            String::new()
        };

        let modified_at = if exists {
            Self::format_timestamp(&path)
        } else {
            None
        };

        Ok(MemoryFile {
            name: filename.to_string(),
            path: path.to_string_lossy().to_string(),
            content,
            exists,
            modified_at,
        })
    }

    pub fn write_file(&self, filename: &str, content: &str) -> Result<(), String> {
        let path = self.resolve_safe_path(filename)?;

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Failed to create directory: {}", error))?;
        }

        fs::write(&path, content)
            .map_err(|error| format!("Failed to write {}: {}", filename, error))
    }

    pub fn get_today_log(&self) -> Result<DailyLog, String> {
        let date = Local::now().format("%Y-%m-%d").to_string();
        self.get_daily_log(&date)
    }

    pub fn get_daily_log(&self, date: &str) -> Result<DailyLog, String> {
        let filename = format!("memory/{}.md", date);
        let file = self.read_file(&filename)?;

        Ok(DailyLog {
            date: date.to_string(),
            path: file.path,
            content: file.content,
            exists: file.exists,
        })
    }

    pub fn append_to_today_log(&self, entry: &str) -> Result<(), String> {
        let date = Local::now().format("%Y-%m-%d").to_string();
        let time = Local::now().format("%H:%M").to_string();
        let filename = format!("memory/{}.md", date);
        let path = self.resolve_safe_path(&filename)?;

        let mut content = if path.exists() {
            fs::read_to_string(&path).unwrap_or_default()
        } else {
            format!("# Daily Log - {}\n\n", date)
        };

        content.push_str(&format!("\n## {}\n\n{}\n", time, entry));

        fs::write(&path, content)
            .map_err(|error| format!("Failed to append to daily log: {}", error))
    }

    pub fn list_daily_logs(&self) -> Result<Vec<String>, String> {
        let memory_dir = self.base_path.join("memory");

        if !memory_dir.exists() {
            return Ok(vec![]);
        }

        let mut logs: Vec<String> = fs::read_dir(&memory_dir)
            .map_err(|error| format!("Failed to read memory directory: {}", error))?
            .filter_map(|entry| entry.ok())
            .filter_map(|entry| {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".md") {
                    Some(name.trim_end_matches(".md").to_string())
                } else {
                    None
                }
            })
            .collect();

        logs.sort();
        logs.reverse();
        Ok(logs)
    }

    pub fn list_knowledge_files(&self) -> Result<Vec<String>, String> {
        let knowledge_dir = self.base_path.join("knowledge");

        if !knowledge_dir.exists() {
            return Ok(vec![]);
        }

        let mut files: Vec<String> = fs::read_dir(&knowledge_dir)
            .map_err(|error| format!("Failed to read knowledge directory: {}", error))?
            .filter_map(|entry| entry.ok())
            .filter_map(|entry| {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".md") {
                    Some(name)
                } else {
                    None
                }
            })
            .collect();

        files.sort();
        Ok(files)
    }

    pub fn list_curator_staged_packages(&self) -> Result<Vec<CuratorPackage>, String> {
        let staged_dir = self.curator_stage_path("staged");

        if !staged_dir.exists() {
            return Ok(vec![]);
        }

        let mut packages: Vec<CuratorPackage> = fs::read_dir(&staged_dir)
            .map_err(|error| format!("Failed to read curator staged directory: {}", error))?
            .filter_map(|entry| entry.ok())
            .filter_map(|entry| {
                let path = entry.path();
                if !path.is_dir() {
                    return None;
                }

                let folder_name = entry.file_name().to_string_lossy().to_string();
                let meta = self.read_curator_meta(&path);
                let title = meta
                    .title
                    .clone()
                    .unwrap_or_else(|| Self::humanize_folder_name(&folder_name));

                Some(CuratorPackage {
                    id: folder_name.clone(),
                    folder_name,
                    title,
                    summary: meta.summary,
                    source: meta.source,
                    tags: meta.tags.unwrap_or_default(),
                    request_topic: meta.request_topic,
                    created_at: meta.created_at.or_else(|| Self::format_timestamp(&path)),
                    status: "staged".to_string(),
                    path: path.to_string_lossy().to_string(),
                })
            })
            .collect();

        packages.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(packages)
    }

    pub fn import_curator_package(&self, folder_name: &str) -> Result<String, String> {
        let package_path = self.curator_package_path("staged", folder_name)?;
        if !package_path.exists() {
            return Err(format!("Curator package not found: {}", folder_name));
        }

        let curated_path = package_path.join("curated-knowledge.md");
        if !curated_path.exists() {
            return Err(format!("Curated knowledge file missing for package: {}", folder_name));
        }

        let content = fs::read_to_string(&curated_path)
            .map_err(|error| format!("Failed to read curated knowledge: {}", error))?;
        let meta = self.read_curator_meta(&package_path);
        let title = meta
            .title
            .clone()
            .unwrap_or_else(|| Self::humanize_folder_name(folder_name));
        let filename = self.unique_knowledge_filename(&title);
        let knowledge_path = format!("knowledge/{}", filename);

        self.write_file(&knowledge_path, &content)?;
        self.move_curator_package("staged", "approved", folder_name)?;

        Ok(filename)
    }

    pub fn reject_curator_package(&self, folder_name: &str) -> Result<(), String> {
        self.move_curator_package("staged", "rejected", folder_name)?;
        Ok(())
    }

    pub fn load_context(&self) -> Result<MemoryContext, String> {
        let soul = self.read_file("SOUL.md").ok().map(|file| file.content);
        let user = self.read_file("USER.md").ok().map(|file| file.content);
        let memory = self.read_file("MEMORY.md").ok().map(|file| file.content);
        let today_log = self.get_today_log().ok().map(|log| log.content);

        let knowledge_files = self
            .list_knowledge_files()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|name| {
                self.read_file(&format!("knowledge/{}", name))
                    .ok()
                    .map(|file| file.content)
            })
            .collect();

        Ok(MemoryContext {
            soul,
            user,
            memory,
            today_log,
            knowledge_files,
        })
    }

    pub fn get_base_path(&self) -> String {
        self.base_path.to_string_lossy().to_string()
    }

    pub fn store_chat_attachment(
        &self,
        conversation_id: &str,
        filename: &str,
        kind: &str,
        mime_type: Option<&str>,
        extracted_text: Option<&str>,
        bytes: &[u8],
    ) -> Result<MessageAttachment, String> {
        self.ensure_safe_conversation_id(conversation_id)?;

        if bytes.is_empty() {
            return Err("Attachment is empty".to_string());
        }

        let extension = Self::attachment_extension(filename, mime_type);
        let safe_name = if filename.trim().is_empty() {
            format!("attachment.{}", extension)
        } else {
            filename.to_string()
        };
        let attachment_id = format!("att-{}", Local::now().format("%Y%m%d%H%M%S%3f"));
        let attachments_dir = self.base_path.join("attachments").join(conversation_id);
        fs::create_dir_all(&attachments_dir)
            .map_err(|error| format!("Failed to create attachment directory: {}", error))?;

        let stored_filename = format!("{}.{}", attachment_id, extension);
        let stored_path = attachments_dir.join(stored_filename);
        fs::write(&stored_path, bytes)
            .map_err(|error| format!("Failed to write attachment file: {}", error))?;

        Ok(MessageAttachment {
            id: attachment_id,
            kind: kind.to_string(),
            name: safe_name,
            path: stored_path.to_string_lossy().to_string(),
            mime_type: mime_type.map(|value| value.to_string()),
            size_bytes: Some(bytes.len() as u64),
            extracted_text: extracted_text.map(|value| value.to_string()),
        })
    }

    pub fn open_base_path(&self) -> Result<(), String> {
        #[cfg(target_os = "windows")]
        let mut command = {
            let mut command = Command::new("explorer");
            command.arg(&self.base_path);
            command
        };

        #[cfg(target_os = "macos")]
        let mut command = {
            let mut command = Command::new("open");
            command.arg(&self.base_path);
            command
        };

        #[cfg(all(unix, not(target_os = "macos")))]
        let mut command = {
            let mut command = Command::new("xdg-open");
            command.arg(&self.base_path);
            command
        };

        command
            .spawn()
            .map_err(|error| format!("Failed to open memory folder: {}", error))?;

        Ok(())
    }
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

    slug.trim_matches('-').to_string()
}
