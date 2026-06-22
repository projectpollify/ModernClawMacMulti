use std::env;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::types::{SpeechToTextStatus, VoiceStatus};

fn resolve_optional_path(value: Option<String>) -> Option<PathBuf> {
    value
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .map(PathBuf::from)
}

fn find_binary_in_path(names: &[&str]) -> Option<PathBuf> {
    let path_var = env::var_os("PATH")?;

    for root in env::split_paths(&path_var) {
        for name in names {
            let candidate = root.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    None
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("HOME").map(PathBuf::from)
}

fn resolve_piper_path(explicit: Option<String>) -> Option<PathBuf> {
    let configured = resolve_optional_path(explicit);
    if let Some(path) = configured {
        if path.is_file() {
            return Some(path);
        }
    }

    if let Some(home) = home_dir() {
        let candidate = home.join(".local").join("bin").join("piper");
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    find_binary_in_path(&["piper.exe", "piper"])
}

fn resolve_piper_model_path(explicit: Option<String>) -> Option<PathBuf> {
    let configured = resolve_optional_path(explicit);
    if let Some(path) = configured {
        if path.is_file() {
            return Some(path);
        }
    }

    if let Some(home) = home_dir() {
        let voice_root = home
            .join("Library")
            .join("Application Support")
            .join("LocalAI")
            .join("tools")
            .join("piper")
            .join("voices");

        for filename in ["en_US-amy-medium.onnx", "en_US-joe-medium.onnx"] {
            let candidate = voice_root.join(filename);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    None
}

fn resolve_whisper_path(explicit: Option<String>) -> Option<PathBuf> {
    let configured = resolve_optional_path(explicit);
    if let Some(path) = configured {
        if path.is_file() {
            return Some(path);
        }
    }

    find_binary_in_path(&["whisper-cli.exe", "whisper.exe", "whisper-cli", "whisper"])
}

fn temp_timestamp() -> Result<u128, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Failed to create voice timestamp: {}", error))
        .map(|duration| duration.as_millis())
}

fn normalize_transcript(transcript: &str) -> String {
    let trimmed = transcript.trim();
    let normalized = trimmed
        .chars()
        .map(|ch| match ch {
            '_' | '-' => ' ',
            _ => ch.to_ascii_uppercase(),
        })
        .collect::<String>();

    let normalized = normalized
        .trim_matches(|ch: char| matches!(ch, '[' | ']' | '(' | ')' | '"' | '\''))
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    if normalized == "BLANK AUDIO" {
        String::new()
    } else {
        trimmed.to_string()
    }
}

#[tauri::command]
pub async fn voice_check_status(
    piper_path: Option<String>,
    model_path: Option<String>,
) -> Result<VoiceStatus, String> {
    let executable_path = resolve_piper_path(piper_path);
    let model_path = resolve_piper_model_path(model_path);

    let piper_found = executable_path.is_some();
    let model_found = model_path.is_some();

    let mut notes = Vec::new();

    if !piper_found {
        notes.push("Set a Piper executable path or add Piper to PATH.".to_string());
    }

    if !model_found {
        notes.push("Set a valid Piper voice model path.".to_string());
    }

    if piper_found && model_found {
        notes.push("Piper and the selected voice model are available.".to_string());
    }

    Ok(VoiceStatus {
        available: piper_found && model_found,
        piper_found,
        model_found,
        executable_path: executable_path.map(|path| path.to_string_lossy().to_string()),
        model_path: model_path.map(|path| path.to_string_lossy().to_string()),
        notes,
    })
}

#[tauri::command]
pub async fn voice_check_input_status(
    whisper_path: Option<String>,
    model_path: Option<String>,
) -> Result<SpeechToTextStatus, String> {
    let executable_path = resolve_whisper_path(whisper_path);
    let model_path = resolve_optional_path(model_path);

    let whisper_found = executable_path.is_some();
    let model_found = model_path
        .as_ref()
        .map(|path| path.is_file())
        .unwrap_or(false);

    let mut notes = Vec::new();

    if !whisper_found {
        notes.push("Set a Whisper executable path or add whisper-cli to PATH.".to_string());
    }

    if !model_found {
        notes.push("Set a valid Whisper model path.".to_string());
    }

    if whisper_found && model_found {
        notes.push("Whisper and the selected transcription model are available.".to_string());
    }

    Ok(SpeechToTextStatus {
        available: whisper_found && model_found,
        whisper_found,
        model_found,
        executable_path: executable_path.map(|path| path.to_string_lossy().to_string()),
        model_path: model_path.map(|path| path.to_string_lossy().to_string()),
        notes,
    })
}

#[tauri::command]
pub async fn voice_speak(
    text: String,
    piper_path: Option<String>,
    model_path: Option<String>,
) -> Result<Vec<u8>, String> {
    if text.trim().is_empty() {
        return Err("No text provided for voice playback.".to_string());
    }

    let executable = resolve_piper_path(piper_path).ok_or_else(|| {
        "Piper executable was not found. Configure it in Settings first.".to_string()
    })?;

    let model = resolve_piper_model_path(model_path).ok_or_else(|| {
        "Piper voice model was not found. Configure it in Settings first.".to_string()
    })?;

    let temp_root = env::temp_dir().join("modernclaw-voice");
    fs::create_dir_all(&temp_root)
        .map_err(|error| format!("Failed to prepare voice temp folder: {}", error))?;

    let timestamp = temp_timestamp()?;
    let wav_path = temp_root.join(format!("speech-{}.wav", timestamp));

    let mut piper = Command::new(&executable)
        .arg("--model")
        .arg(&model)
        .arg("--output_file")
        .arg(&wav_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Failed to launch Piper: {}", error))?;

    {
        let stdin = piper
            .stdin
            .as_mut()
            .ok_or_else(|| "Failed to open Piper stdin.".to_string())?;
        stdin
            .write_all(text.as_bytes())
            .map_err(|error| format!("Failed to send text to Piper: {}", error))?;
    }

    let piper_output = piper
        .wait_with_output()
        .map_err(|error| format!("Failed while waiting for Piper: {}", error))?;

    if !piper_output.status.success() {
        let stderr = String::from_utf8_lossy(&piper_output.stderr)
            .trim()
            .to_string();
        let _ = fs::remove_file(&wav_path);
        return Err(if stderr.is_empty() {
            "Piper failed to generate audio.".to_string()
        } else {
            format!("Piper failed: {}", stderr)
        });
    }

    let audio_bytes = fs::read(&wav_path)
        .map_err(|error| format!("Failed to read generated audio: {}", error))?;

    let _ = fs::remove_file(&wav_path);

    Ok(audio_bytes)
}

#[tauri::command]
pub async fn voice_transcribe(
    audio_data: Vec<u8>,
    whisper_path: Option<String>,
    model_path: Option<String>,
    language: Option<String>,
) -> Result<String, String> {
    if audio_data.is_empty() {
        return Err("No audio provided for transcription.".to_string());
    }

    let executable = resolve_whisper_path(whisper_path).ok_or_else(|| {
        "Whisper executable was not found. Configure it in Settings first.".to_string()
    })?;

    let model = resolve_optional_path(model_path)
        .filter(|path| path.is_file())
        .ok_or_else(|| {
            "Whisper model was not found. Configure it in Settings first.".to_string()
        })?;

    let temp_root = env::temp_dir().join("modernclaw-whisper");
    fs::create_dir_all(&temp_root)
        .map_err(|error| format!("Failed to prepare transcription temp folder: {}", error))?;

    let timestamp = temp_timestamp()?;
    let wav_path = temp_root.join(format!("input-{}.wav", timestamp));
    let output_base = temp_root.join(format!("transcript-{}", timestamp));
    let output_path = output_base.with_extension("txt");

    fs::write(&wav_path, audio_data)
        .map_err(|error| format!("Failed to write temporary audio file: {}", error))?;

    let whisper_language = language
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "auto".to_string());

    let output = Command::new(&executable)
        .arg("--model")
        .arg(&model)
        .arg("--file")
        .arg(&wav_path)
        .arg("--language")
        .arg(&whisper_language)
        .arg("--output-txt")
        .arg("--output-file")
        .arg(&output_base)
        .output()
        .map_err(|error| format!("Failed to launch Whisper: {}", error))?;

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if !output.status.success() {
        let _ = fs::remove_file(&wav_path);
        let _ = fs::remove_file(&output_path);
        return Err(if stderr.is_empty() {
            "Whisper failed to transcribe audio.".to_string()
        } else {
            format!("Whisper failed: {}", stderr)
        });
    }

    let transcript = fs::read_to_string(&output_path)
        .map_err(|error| format!("Failed to read Whisper transcript: {}", error))?;

    let _ = fs::remove_file(&wav_path);
    let _ = fs::remove_file(&output_path);

    Ok(normalize_transcript(&transcript))
}
