use std::fs;
use std::path::Path;
use std::thread;
use std::time::{Duration, SystemTime};

use crate::normalizer::is_temporary_or_ignored_name;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StabilityStatus {
    Stable,
    Missing,
    IgnoredTemporary,
    Changing,
    Inaccessible(String),
}

#[derive(Debug, Clone, Copy)]
pub struct StabilityOptions {
    pub initial_wait: Duration,
    pub sample_wait: Duration,
}

impl StabilityOptions {
    pub fn from_millis(initial_wait_ms: u64) -> Self {
        Self {
            initial_wait: Duration::from_millis(initial_wait_ms),
            sample_wait: Duration::from_millis(250),
        }
    }
}

pub fn wait_for_stable_path(path: &Path, options: StabilityOptions) -> StabilityStatus {
    if let Some(name) = path.file_name().and_then(|value| value.to_str()) {
        if is_temporary_or_ignored_name(name) {
            return StabilityStatus::IgnoredTemporary;
        }
    }

    if options.initial_wait > Duration::ZERO {
        thread::sleep(options.initial_wait);
    }

    let first = match fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return StabilityStatus::Missing
        }
        Err(error) => return StabilityStatus::Inaccessible(error.to_string()),
    };

    if first.is_dir() {
        return StabilityStatus::Stable;
    }

    thread::sleep(options.sample_wait);

    let second = match fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return StabilityStatus::Missing
        }
        Err(error) => return StabilityStatus::Inaccessible(error.to_string()),
    };

    if first.len() == second.len() && modified_time(&first) == modified_time(&second) {
        StabilityStatus::Stable
    } else {
        StabilityStatus::Changing
    }
}

fn modified_time(metadata: &fs::Metadata) -> Option<SystemTime> {
    metadata.modified().ok()
}

#[cfg(test)]
mod tests {
    use std::fs::{self, OpenOptions};
    use std::io::Write;

    use tempfile::tempdir;

    use super::*;

    #[test]
    fn reports_stable_file_after_sample() {
        let directory = tempdir().unwrap();
        let path = directory.path().join("한글.txt");
        fs::write(&path, "content").unwrap();

        let status = wait_for_stable_path(
            &path,
            StabilityOptions {
                initial_wait: Duration::ZERO,
                sample_wait: Duration::from_millis(10),
            },
        );

        assert_eq!(status, StabilityStatus::Stable);
    }

    #[test]
    fn reports_missing_file() {
        let directory = tempdir().unwrap();
        let path = directory.path().join("missing.txt");

        let status = wait_for_stable_path(
            &path,
            StabilityOptions {
                initial_wait: Duration::ZERO,
                sample_wait: Duration::from_millis(10),
            },
        );

        assert_eq!(status, StabilityStatus::Missing);
    }

    #[test]
    fn reports_temporary_file_without_waiting() {
        let directory = tempdir().unwrap();
        let path = directory.path().join("보고서.tmp");
        fs::write(&path, "content").unwrap();

        let status = wait_for_stable_path(
            &path,
            StabilityOptions {
                initial_wait: Duration::from_secs(1),
                sample_wait: Duration::from_millis(10),
            },
        );

        assert_eq!(status, StabilityStatus::IgnoredTemporary);
    }

    #[test]
    fn reports_changing_file() {
        let directory = tempdir().unwrap();
        let path = directory.path().join("한글.txt");
        fs::write(&path, "content").unwrap();
        let changing_path = path.clone();

        let handle = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(20));
            let mut file = OpenOptions::new().append(true).open(changing_path).unwrap();
            writeln!(file, "more").unwrap();
        });

        let status = wait_for_stable_path(
            &path,
            StabilityOptions {
                initial_wait: Duration::ZERO,
                sample_wait: Duration::from_millis(80),
            },
        );

        handle.join().unwrap();
        assert_eq!(status, StabilityStatus::Changing);
    }
}
