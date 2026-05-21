use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::scanner::RenameResult;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub timestamp_ms: u128,
    pub status: String,
    pub kind: String,
    pub original_path: PathBuf,
    pub final_path: Option<PathBuf>,
    pub original_name: String,
    pub final_name: String,
    pub collision: bool,
    pub reason: Option<String>,
}

pub fn append_rename_results(log_file_path: &Path, results: &[RenameResult]) -> Result<(), String> {
    if results.is_empty() {
        return Ok(());
    }

    if let Some(parent) = log_file_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "failed to create log directory {}: {error}",
                parent.display()
            )
        })?;
    }

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_file_path)
        .map_err(|error| {
            format!(
                "failed to open log file {}: {error}",
                log_file_path.display()
            )
        })?;

    for result in results {
        let entry = LogEntry::from(result);
        let line = serde_json::to_string(&entry)
            .map_err(|error| format!("failed to serialize log entry: {error}"))?;
        writeln!(file, "{line}").map_err(|error| format!("failed to write log entry: {error}"))?;
    }

    Ok(())
}

pub fn read_recent_logs(log_file_path: &Path, limit: usize) -> Result<Vec<LogEntry>, String> {
    if limit == 0 || !log_file_path.exists() {
        return Ok(Vec::new());
    }

    let file = OpenOptions::new()
        .read(true)
        .open(log_file_path)
        .map_err(|error| {
            format!(
                "failed to open log file {}: {error}",
                log_file_path.display()
            )
        })?;
    let reader = BufReader::new(file);
    let mut entries = Vec::new();

    for line in reader.lines() {
        let line = line.map_err(|error| format!("failed to read log line: {error}"))?;
        if line.trim().is_empty() {
            continue;
        }

        if let Ok(entry) = serde_json::from_str::<LogEntry>(&line) {
            entries.push(entry);
        }
    }

    let start = entries.len().saturating_sub(limit);
    Ok(entries[start..].iter().rev().cloned().collect())
}

impl From<&RenameResult> for LogEntry {
    fn from(result: &RenameResult) -> Self {
        Self {
            timestamp_ms: current_timestamp_ms(),
            status: result.status.clone(),
            kind: result.kind.clone(),
            original_path: result.original_path.clone(),
            final_path: result.final_path.clone(),
            original_name: result.original_name.clone(),
            final_name: result.final_name.clone(),
            collision: result.collision,
            reason: result.reason.clone(),
        }
    }
}

fn current_timestamp_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::*;

    #[test]
    fn appends_and_reads_recent_logs_newest_first() {
        let directory = tempdir().unwrap();
        let log_file = directory.path().join("activity.jsonl");
        let results = vec![
            RenameResult {
                status: "success".to_string(),
                kind: "file".to_string(),
                original_path: directory.path().join("한글.txt"),
                final_path: Some(directory.path().join("한글.txt")),
                original_name: "한글.txt".to_string(),
                final_name: "한글.txt".to_string(),
                collision: false,
                reason: None,
            },
            RenameResult {
                status: "collision".to_string(),
                kind: "file".to_string(),
                original_path: directory.path().join("가.txt"),
                final_path: Some(directory.path().join("가_1.txt")),
                original_name: "가.txt".to_string(),
                final_name: "가_1.txt".to_string(),
                collision: true,
                reason: None,
            },
        ];

        append_rename_results(&log_file, &results).unwrap();
        let entries = read_recent_logs(&log_file, 10).unwrap();

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].status, "collision");
        assert_eq!(entries[1].status, "success");
    }

    #[test]
    fn skips_corrupt_log_lines_when_reading() {
        let directory = tempdir().unwrap();
        let log_file = directory.path().join("activity.jsonl");
        fs::write(
            &log_file,
            "not-json\n{\"timestampMs\":1,\"status\":\"failed\",\"kind\":\"file\",\"originalPath\":\"/a\",\"finalPath\":null,\"originalName\":\"a\",\"finalName\":\"a\",\"collision\":false,\"reason\":\"권한 없음\"}\n",
        )
        .unwrap();

        let entries = read_recent_logs(&log_file, 10).unwrap();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].status, "failed");
        assert_eq!(entries[0].reason.as_deref(), Some("권한 없음"));
    }

    #[test]
    fn returns_empty_logs_when_file_does_not_exist() {
        let directory = tempdir().unwrap();
        let entries = read_recent_logs(&directory.path().join("missing.jsonl"), 10).unwrap();

        assert!(entries.is_empty());
    }
}
