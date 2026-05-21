use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WatchFolder {
    pub path: PathBuf,
    pub recursive: bool,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub watch_folders: Vec<WatchFolder>,
    pub auto_watch_enabled: bool,
    pub launch_at_login: bool,
    pub stabilization_wait_ms: u64,
    pub default_recursive: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            watch_folders: Vec::new(),
            auto_watch_enabled: false,
            launch_at_login: false,
            stabilization_wait_ms: 3_000,
            default_recursive: true,
        }
    }
}

impl AppSettings {
    pub fn normalized(mut self) -> Self {
        self.watch_folders = normalize_watch_folders(self.watch_folders);
        self.stabilization_wait_ms = self.stabilization_wait_ms.clamp(1_000, 10_000);
        self
    }
}

pub fn load_settings_from_file(settings_file_path: &Path) -> Result<AppSettings, String> {
    if !settings_file_path.exists() {
        return Ok(AppSettings::default());
    }

    let content = fs::read_to_string(settings_file_path).map_err(|error| {
        format!(
            "failed to read settings {}: {error}",
            settings_file_path.display()
        )
    })?;

    let settings = serde_json::from_str::<AppSettings>(&content).map_err(|error| {
        format!(
            "failed to parse settings {}: {error}",
            settings_file_path.display()
        )
    })?;

    Ok(settings.normalized())
}

pub fn save_settings_to_file(
    settings_file_path: &Path,
    settings: &AppSettings,
) -> Result<(), String> {
    let normalized = settings.clone().normalized();

    if let Some(parent) = settings_file_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "failed to create settings directory {}: {error}",
                parent.display()
            )
        })?;
    }

    let content = serde_json::to_string_pretty(&normalized)
        .map_err(|error| format!("failed to serialize settings: {error}"))?;
    fs::write(settings_file_path, format!("{content}\n")).map_err(|error| {
        format!(
            "failed to write settings {}: {error}",
            settings_file_path.display()
        )
    })
}

fn normalize_watch_folders(folders: Vec<WatchFolder>) -> Vec<WatchFolder> {
    let mut normalized = Vec::new();

    for folder in folders {
        if folder.path.as_os_str().is_empty() {
            continue;
        }

        if normalized
            .iter()
            .any(|existing: &WatchFolder| existing.path == folder.path)
        {
            continue;
        }

        normalized.push(folder);
    }

    normalized
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::*;

    #[test]
    fn returns_default_settings_when_file_is_missing() {
        let directory = tempdir().unwrap();
        let settings = load_settings_from_file(&directory.path().join("settings.json")).unwrap();

        assert_eq!(settings, AppSettings::default());
    }

    #[test]
    fn saves_and_loads_settings() {
        let directory = tempdir().unwrap();
        let settings_file = directory.path().join("settings.json");
        let settings = AppSettings {
            watch_folders: vec![WatchFolder {
                path: PathBuf::from("/tmp/test"),
                recursive: true,
                enabled: true,
            }],
            auto_watch_enabled: true,
            launch_at_login: false,
            stabilization_wait_ms: 5_000,
            default_recursive: true,
        };

        save_settings_to_file(&settings_file, &settings).unwrap();
        let loaded = load_settings_from_file(&settings_file).unwrap();

        assert_eq!(loaded, settings);
    }

    #[test]
    fn clamps_wait_time_and_deduplicates_folders() {
        let directory = tempdir().unwrap();
        let settings_file = directory.path().join("settings.json");
        let settings = AppSettings {
            watch_folders: vec![
                WatchFolder {
                    path: PathBuf::from("/tmp/test"),
                    recursive: true,
                    enabled: true,
                },
                WatchFolder {
                    path: PathBuf::from("/tmp/test"),
                    recursive: false,
                    enabled: false,
                },
            ],
            auto_watch_enabled: false,
            launch_at_login: false,
            stabilization_wait_ms: 50,
            default_recursive: true,
        };

        save_settings_to_file(&settings_file, &settings).unwrap();
        let loaded = load_settings_from_file(&settings_file).unwrap();

        assert_eq!(loaded.watch_folders.len(), 1);
        assert_eq!(loaded.stabilization_wait_ms, 1_000);
    }
}
