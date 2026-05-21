use std::collections::HashSet;
use std::path::Path;

use unicode_normalization::UnicodeNormalization;

const TEMPORARY_EXTENSIONS: &[&str] = &[
    ".tmp",
    ".temp",
    ".crdownload",
    ".part",
    ".download",
    ".swp",
    ".lock",
];

const IGNORED_EXACT_NAMES: &[&str] = &[".DS_Store", "Thumbs.db", "desktop.ini"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AnalysisReason {
    Ignored,
    AlreadyNfc,
    NeedsNormalization,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NameAnalysis {
    pub original_name: String,
    pub normalized_name: String,
    pub should_rename: bool,
    pub reason: AnalysisReason,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenamePlan {
    pub analysis: NameAnalysis,
    pub final_name: String,
    pub collision: bool,
}

pub fn normalize_name_to_nfc(name: &str) -> String {
    name.nfc().collect()
}

pub fn is_name_nfc(name: &str) -> bool {
    name == normalize_name_to_nfc(name)
}

pub fn is_temporary_or_ignored_name(name: &str) -> bool {
    if IGNORED_EXACT_NAMES.contains(&name) {
        return true;
    }

    if name.starts_with("~$") || name.starts_with('.') {
        return true;
    }

    let lower_name = name.to_lowercase();
    TEMPORARY_EXTENSIONS
        .iter()
        .any(|extension| lower_name.ends_with(extension))
}

pub fn analyze_name(name: &str) -> NameAnalysis {
    if is_temporary_or_ignored_name(name) {
        return NameAnalysis {
            original_name: name.to_string(),
            normalized_name: name.to_string(),
            should_rename: false,
            reason: AnalysisReason::Ignored,
        };
    }

    let normalized_name = normalize_name_to_nfc(name);

    if is_name_nfc(name) {
        return NameAnalysis {
            original_name: name.to_string(),
            normalized_name,
            should_rename: false,
            reason: AnalysisReason::AlreadyNfc,
        };
    }

    NameAnalysis {
        original_name: name.to_string(),
        normalized_name,
        should_rename: true,
        reason: AnalysisReason::NeedsNormalization,
    }
}

pub fn create_rename_plan(name: &str, existing_names: &HashSet<String>) -> RenamePlan {
    let analysis = analyze_name(name);

    if !analysis.should_rename {
        return RenamePlan {
            final_name: name.to_string(),
            collision: false,
            analysis,
        };
    }

    let final_name = build_collision_safe_name(&analysis.normalized_name, existing_names);
    let collision = final_name != analysis.normalized_name;

    RenamePlan {
        analysis,
        final_name,
        collision,
    }
}

pub fn build_collision_safe_name(target_name: &str, existing_names: &HashSet<String>) -> String {
    if !existing_names.contains(target_name) {
        return target_name.to_string();
    }

    let path = Path::new(target_name);
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| format!(".{value}"))
        .unwrap_or_default();
    let base_name = if extension.is_empty() {
        target_name.to_string()
    } else {
        target_name
            .strip_suffix(&extension)
            .unwrap_or(target_name)
            .to_string()
    };

    let mut index = 1;
    loop {
        let candidate = format!("{base_name}_{index}{extension}");
        if !existing_names.contains(&candidate) {
            return candidate;
        }
        index += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_nfd_korean_names_to_nfc() {
        let cases = [
            ("한글.txt", "한글.txt"),
            ("가.txt", "가.txt"),
            ("test_한글.docx", "test_한글.docx"),
            ("2026_보고서.xlsx", "2026_보고서.xlsx"),
            ("공백 한글 파일.txt", "공백 한글 파일.txt"),
        ];

        for (input, expected) in cases {
            assert_eq!(normalize_name_to_nfc(input), expected);
        }
    }

    #[test]
    fn detects_already_nfc_names() {
        for name in ["한글.txt", "보고서.pdf", "가나다.xlsx"] {
            let analysis = analyze_name(name);
            assert!(is_name_nfc(name));
            assert!(!analysis.should_rename);
            assert_eq!(analysis.reason, AnalysisReason::AlreadyNfc);
        }
    }

    #[test]
    fn creates_collision_suffix() {
        let existing = HashSet::from([
            "가.txt".to_string(),
            "가_1.txt".to_string(),
            "가_2.txt".to_string(),
        ]);

        assert_eq!(build_collision_safe_name("가.txt", &existing), "가_3.txt");
    }

    #[test]
    fn ignores_temporary_and_system_files() {
        for name in [
            "보고서.tmp",
            "보고서.temp",
            "보고서.crdownload",
            "보고서.part",
            "보고서.download",
            "보고서.swp",
            "보고서.lock",
            "~$보고서.docx",
            ".숨김파일",
            ".DS_Store",
            "Thumbs.db",
            "desktop.ini",
        ] {
            assert!(is_temporary_or_ignored_name(name));
        }
    }
}
