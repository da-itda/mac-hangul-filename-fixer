// Chrome 웹 스토어의 한글본드 확장을 Chrome 외부 확장으로 등록한다.
// 등록 파일을 두면 Chrome이 다음 실행 때 사용자에게 사용 설정을 묻는다. 몰래 켜지는 않는다.
// macOS 27부터는 다른 앱의 데이터 폴더 접근이 막혀 등록할 수 없을 수 있다. 그때는 웹 스토어에서 설치하게 한다.
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

pub const EXTENSION_ID: &str = "hmgopkkefgfppfedloeponobiamikomf";
pub const STORE_URL: &str =
    "https://chromewebstore.google.com/detail/hmgopkkefgfppfedloeponobiamikomf";
const UPDATE_URL: &str = "https://clients2.google.com/service/update2/crx";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ExtensionState {
    NoChrome,
    Installed,
    Registered,
    NotPublished,
    NotRegistered,
    StoreInstall,
}

pub fn status(home: &Path, check_store: bool) -> ExtensionState {
    if !chrome_installed(home) {
        return ExtensionState::NoChrome;
    }
    match installed_in_profile(home) {
        Ok(true) => return ExtensionState::Installed,
        Ok(false) => {}
        Err(_) => {
            if check_store && !published() {
                return ExtensionState::NotPublished;
            }
            return ExtensionState::StoreInstall;
        }
    }
    if registration_file(home).exists() {
        return ExtensionState::Registered;
    }
    if check_store && !published() {
        return ExtensionState::NotPublished;
    }
    ExtensionState::NotRegistered
}

// 이미 설치·등록되어 있거나 아직 공개 전이면 아무것도 하지 않는다.
// 사용자가 Chrome에서 확장을 지운 경우에는 등록 파일이 남아 있으므로 다시 묻지 않는다.
pub fn register(home: &Path) -> Result<ExtensionState, String> {
    register_with(home, true)
}

fn register_with(home: &Path, check_store: bool) -> Result<ExtensionState, String> {
    let state = status(home, check_store);
    if state != ExtensionState::NotRegistered {
        return Ok(state);
    }
    let file = registration_file(home);
    let written = file
        .parent()
        .map_or(Ok(()), fs::create_dir_all)
        .and_then(|()| {
            fs::write(
                &file,
                format!("{{\n  \"external_update_url\": \"{UPDATE_URL}\"\n}}\n"),
            )
        });
    match written {
        Ok(()) => Ok(ExtensionState::Registered),
        Err(error) if error.kind() == ErrorKind::PermissionDenied => Ok(ExtensionState::StoreInstall),
        Err(error) => Err(format!("failed to write {}: {error}", file.display())),
    }
}

// 기본 브라우저가 Safari여도 Chrome에서 열어야 확장을 추가할 수 있다.
pub fn open_store() -> Result<(), String> {
    let opened = Command::new("/usr/bin/open")
        .args(["-a", "Google Chrome", STORE_URL])
        .status()
        .map(|status| status.success())
        .unwrap_or(false);
    if opened {
        return Ok(());
    }
    Command::new("/usr/bin/open")
        .arg(STORE_URL)
        .status()
        .map_err(|error| format!("failed to open {STORE_URL}: {error}"))
        .map(|_| ())
}

fn chrome_installed(home: &Path) -> bool {
    Path::new("/Applications/Google Chrome.app").exists()
        || home.join("Applications/Google Chrome.app").exists()
}

fn chrome_data_dir(home: &Path) -> PathBuf {
    home.join("Library/Application Support/Google/Chrome")
}

fn registration_file(home: &Path) -> PathBuf {
    chrome_data_dir(home)
        .join("External Extensions")
        .join(format!("{EXTENSION_ID}.json"))
}

// Chrome 데이터 폴더를 읽을 수 없으면 오류를 돌려준다. 아직 Chrome을 한 번도 열지 않았으면 미설치로 본다.
fn installed_in_profile(home: &Path) -> std::io::Result<bool> {
    let entries = match fs::read_dir(chrome_data_dir(home)) {
        Ok(entries) => entries,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(error),
    };
    Ok(entries
        .flatten()
        .any(|entry| entry.path().join("Extensions").join(EXTENSION_ID).is_dir()))
}

// 웹 스토어에 공개된 확장만 업데이트 서버가 302로 내려받기 주소를 준다.
fn published() -> bool {
    let url = format!(
        "{UPDATE_URL}?response=redirect&prodversion=130.0&acceptformat=crx3&x=id%3D{EXTENSION_ID}%26uc"
    );
    Command::new("/usr/bin/curl")
        .args(["-s", "-o", "/dev/null", "--max-time", "10", "-w", "%{http_code}", &url])
        .output()
        .map(|output| output.stdout == b"302")
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_home(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("hangulbond-ext-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("Applications/Google Chrome.app")).unwrap();
        dir
    }

    #[test]
    fn detects_extension_installed_in_any_profile() {
        let home = temp_home("installed");
        fs::create_dir_all(chrome_data_dir(&home).join("Profile 2/Extensions").join(EXTENSION_ID))
            .unwrap();
        assert_eq!(status(&home, false), ExtensionState::Installed);
        assert_eq!(register(&home).unwrap(), ExtensionState::Installed);
        assert!(!registration_file(&home).exists());
        fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn falls_back_to_store_when_chrome_data_is_not_readable() {
        use std::os::unix::fs::PermissionsExt;
        let home = temp_home("denied");
        let data = chrome_data_dir(&home);
        fs::create_dir_all(&data).unwrap();
        fs::set_permissions(&data, fs::Permissions::from_mode(0o000)).unwrap();
        let unreadable = status(&home, false);
        // 읽을 수는 있지만 쓸 수 없는 경우
        fs::set_permissions(&data, fs::Permissions::from_mode(0o555)).unwrap();
        let unwritable = register_with(&home, false);
        fs::set_permissions(&data, fs::Permissions::from_mode(0o755)).unwrap();
        assert_eq!(unreadable, ExtensionState::StoreInstall);
        assert_eq!(unwritable, Ok(ExtensionState::StoreInstall));
        assert!(!registration_file(&home).exists());
        fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn keeps_existing_registration() {
        let home = temp_home("registered");
        fs::create_dir_all(registration_file(&home).parent().unwrap()).unwrap();
        fs::write(registration_file(&home), "{}").unwrap();
        assert_eq!(register(&home).unwrap(), ExtensionState::Registered);
        assert_eq!(fs::read_to_string(registration_file(&home)).unwrap(), "{}");
        fs::remove_dir_all(home).unwrap();
    }
}
