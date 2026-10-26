#!/bin/bash
# 한글본드 설치 스크립트 (macOS, Apple silicon)
#
# 설치:  curl -fsSL https://raw.githubusercontent.com/da-itda/mac-nfd-nfc-hangulbond/main/install.sh | bash
# 삭제:  curl -fsSL https://raw.githubusercontent.com/da-itda/mac-nfd-nfc-hangulbond/main/install.sh | bash -s -- --uninstall
#
# 옵션:  --no-extension  Chrome 확장은 등록하지 않고 앱만 설치
#        --uninstall     앱, 자동 실행, 설정·로그·캐시, 개인정보 보호 권한, Chrome 확장 등록을 모두 삭제
#        --keep-settings --uninstall과 함께 쓰면 설정·로그는 남김
#
# 하는 일:
# 1. GitHub 최신 릴리스의 DMG를 내려받아 Developer ID 서명과 Apple 공증을 확인한다.
# 2. 응용 프로그램 폴더에 한글본드를 설치하고 실행한다.
# 3. Chrome이 있으면 웹 스토어의 한글본드 확장을 등록한다. Chrome을 다시 열면 사용 여부를 묻는다.
set -euo pipefail

REPO="da-itda/mac-nfd-nfc-hangulbond"
APP_NAME="한글본드"
BUNDLE_ID="com.hangulbond.desktop"
TEAM_ID="D24UP6KJN2"
EXTENSION_ID="hmgopkkefgfppfedloeponobiamikomf"
INSTALL_DIR="${HANGULBOND_INSTALL_DIR:-/Applications}"
APP_PATH="$INSTALL_DIR/$APP_NAME.app"
CHROME_EXT_FILE="$HOME/Library/Application Support/Google/Chrome/External Extensions/$EXTENSION_ID.json"
STORE_URL="https://chromewebstore.google.com/detail/$EXTENSION_ID"
# 실행 파일 이름. 맥은 실행 중인 앱 경로를 자소 분리형으로 기록하므로 한글 앱 이름 대신 이 이름으로 찾는다.
APP_PROCESS="/Contents/MacOS/hangul-nfc-normalizer"
# 이전 버전이 쓰던 번들 ID와 데이터 폴더 이름까지 함께 지운다.
DATA_IDS=("$BUNDLE_ID" "com.codex.hangul-nfc-normalizer" "com.hangulbond.app" "hangul-nfc-normalizer")

step() { printf '\033[1m==>\033[0m %s\n' "$*"; }
note() { printf '    %s\n' "$*"; }
fail() { printf '\033[31m오류:\033[0m %s\n' "$*" >&2; exit 1; }

# 먼저 현재 권한으로 실행하고, 실패하면 관리자 암호를 묻는다.
# 실행된 적 있는 앱은 macOS 앱 보호 때문에 쓰기 권한 검사(-w)가 실제와 다르게 나오므로 미리 검사하지 않는다.
run_privileged() {
  "$@" 2>/dev/null && return 0
  note "응용 프로그램 폴더를 바꾸려면 Mac 로그인 암호가 필요합니다."
  sudo "$@"
}

quit_app() {
  pgrep -f "$APP_PROCESS" >/dev/null || return 0
  step "실행 중인 한글본드를 종료합니다."
  osascript -e "tell application id \"$BUNDLE_ID\" to quit" >/dev/null 2>&1 || true
  for signal in "" TERM KILL; do
    [ -n "$signal" ] && pkill "-$signal" -f "$APP_PROCESS" 2>/dev/null
    for _ in 1 2 3 4 5 6; do
      pgrep -f "$APP_PROCESS" >/dev/null || return 0
      sleep 0.5
    done
  done
  fail "한글본드를 종료하지 못했습니다. 메뉴 막대에서 '한글본드 종료'를 누른 뒤 다시 실행하세요."
}

remove_path() {
  [ -e "$1" ] || [ -L "$1" ] || return 0
  rm -rf "$1"
  note "삭제: ${1/#$HOME/~}"
}

chrome_installed() {
  [ -d "/Applications/Google Chrome.app" ] || [ -d "$HOME/Applications/Google Chrome.app" ]
}

# 웹 스토어에 공개된 확장만 Chrome이 받을 수 있다. 공개 전에는 업데이트 서버가 302를 주지 않는다.
extension_published() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' \
    "https://clients2.google.com/service/update2/crx?response=redirect&prodversion=130.0&acceptformat=crx3&x=id%3D$EXTENSION_ID%26uc" || true)
  [ "$code" = "302" ]
}

install_extension() {
  if ! chrome_installed; then
    note "Chrome이 없어 브라우저 확장은 건너뜁니다. Safari는 확장 없이도 정상입니다."
    return
  fi
  if [ -f "$CHROME_EXT_FILE" ]; then
    note "Chrome 확장은 이미 등록되어 있습니다."
    return
  fi
  if ! extension_published; then
    note "Chrome 확장은 웹 스토어 공개 준비 중입니다. 공개되면 이 명령을 다시 실행하면 함께 등록됩니다."
    return
  fi
  step "Chrome 확장을 등록합니다."
  mkdir -p "$(dirname "$CHROME_EXT_FILE")"
  printf '{\n  "external_update_url": "https://clients2.google.com/service/update2/crx"\n}\n' >"$CHROME_EXT_FILE"
  note "Chrome을 완전히 종료(⌘Q)한 뒤 다시 열면 '새 확장 프로그램이 추가됨' 알림이 나옵니다."
  note "알림에서 '확장 프로그램 사용 설정'을 누르세요. 알림이 없으면: $STORE_URL"
}

install_app() {
  [ "$(uname -s)" = "Darwin" ] || fail "macOS에서만 설치할 수 있습니다."
  if [ "$(uname -m)" != "arm64" ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" != "1" ]; then
    fail "현재 Apple silicon(M1 이후) Mac만 지원합니다. Intel Mac용 빌드는 제공하지 않습니다."
  fi

  step "최신 버전을 확인합니다."
  local latest version
  latest=$(curl -fsSL "https://github.com/$REPO/releases/latest/download/latest.json") \
    || fail "GitHub에서 업데이트 정보를 받지 못했습니다. 인터넷 연결을 확인하세요."
  version=$(printf '%s' "$latest" | sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)
  [ -n "$version" ] || fail "업데이트 정보에서 버전을 찾지 못했습니다."
  note "한글본드 $version"

  local dmg source
  WORK_DIR=$(mktemp -d)
  MOUNT_DIR="$WORK_DIR/mnt"
  trap 'hdiutil detach "$MOUNT_DIR" -quiet >/dev/null 2>&1 || true; rm -rf "$WORK_DIR"' EXIT
  dmg="$WORK_DIR/HangulBond_${version}_aarch64.dmg"

  step "내려받는 중입니다."
  curl -fL --progress-bar -o "$dmg" "https://github.com/$REPO/releases/download/v$version/HangulBond_${version}_aarch64.dmg" \
    || fail "설치 파일을 내려받지 못했습니다."
  mkdir -p "$MOUNT_DIR"
  hdiutil attach "$dmg" -nobrowse -readonly -noautoopen -mountpoint "$MOUNT_DIR" -quiet >/dev/null 2>&1 \
    || fail "설치 파일을 열지 못했습니다."
  source="$MOUNT_DIR/$APP_NAME.app"
  [ -d "$source" ] || fail "설치 파일 안에서 $APP_NAME.app을 찾지 못했습니다."

  step "개발자 서명과 Apple 공증을 확인합니다."
  codesign --verify --deep --strict "$source" 2>/dev/null || fail "앱 서명이 올바르지 않습니다. 설치를 중단합니다."
  codesign -dv "$source" 2>&1 | grep -q "^TeamIdentifier=$TEAM_ID$" || fail "개발자 정보가 다릅니다. 설치를 중단합니다."
  spctl --assess --type execute "$source" 2>/dev/null || fail "Apple 공증을 확인하지 못했습니다. 설치를 중단합니다."

  quit_app
  step "$APP_PATH 에 설치합니다."
  # 기존 앱은 옆으로 옮겨 두었다가 새 앱 복사가 끝나면 지운다. 실패하면 되돌린다.
  local previous="$INSTALL_DIR/.hangulbond-previous-$$.app"
  if [ -e "$APP_PATH" ]; then
    run_privileged mv "$APP_PATH" "$previous"
  fi
  if ! run_privileged ditto "$source" "$APP_PATH"; then
    [ -e "$previous" ] && run_privileged mv "$previous" "$APP_PATH"
    fail "앱을 설치하지 못했습니다. 기존 앱은 그대로 두었습니다."
  fi
  if [ -e "$previous" ]; then
    run_privileged rm -rf "$previous"
  fi

  if [ "${INSTALL_EXTENSION:-1}" = "1" ]; then
    install_extension
  fi

  step "한글본드를 실행합니다. 메뉴 막대의 한글본드 아이콘에서 설정을 여세요."
  open "$APP_PATH"
  step "설치를 마쳤습니다."
}

uninstall() {
  quit_app

  step "앱을 삭제합니다."
  if [ -d "$APP_PATH" ]; then
    run_privileged rm -rf "$APP_PATH"
    note "삭제: $APP_PATH"
  fi
  # 수동 업데이트 때 남긴 이전 버전 사본. 이름이 자소 분리형일 수 있어 번들 ID로 확인한다.
  local copy
  for copy in "$INSTALL_DIR"/*.app.backup-*; do
    [ -d "$copy" ] || continue
    [ "$(defaults read "$copy/Contents/Info" CFBundleIdentifier 2>/dev/null)" = "$BUNDLE_ID" ] || continue
    run_privileged rm -rf "$copy"
    note "삭제: $copy"
  done

  step "로그인 시 자동 실행 항목을 삭제합니다."
  local agent
  for agent in "$HOME/Library/LaunchAgents"/*.plist; do
    [ -f "$agent" ] || continue
    grep -aqE "hangul-nfc-normalizer|com\.hangulbond\." "$agent" || continue
    launchctl bootout "gui/$(id -u)" "$agent" >/dev/null 2>&1 || true
    remove_path "$agent"
  done

  if [ "${KEEP_SETTINGS:-0}" = "1" ]; then
    note "설정과 로그는 남겨 두었습니다: ~/Library/Application Support/$BUNDLE_ID"
  else
    step "설정, 로그, 캐시를 삭제합니다."
    local id
    for id in "${DATA_IDS[@]}"; do
      defaults delete "$id" >/dev/null 2>&1 || true
      remove_path "$HOME/Library/Application Support/$id"
      remove_path "$HOME/Library/Caches/$id"
      remove_path "$HOME/Library/WebKit/$id"
      remove_path "$HOME/Library/HTTPStorages/$id"
      remove_path "$HOME/Library/HTTPStorages/$id.binarycookies"
      remove_path "$HOME/Library/Logs/$id"
      remove_path "$HOME/Library/Saved Application State/$id.savedState"
      remove_path "$HOME/Library/Preferences/$id.plist"
    done
    # 폴더 접근 등 개인정보 보호 권한 기록
    tccutil reset All "$BUNDLE_ID" >/dev/null 2>&1 && note "개인정보 보호 권한 기록을 초기화했습니다." || true
  fi

  step "Chrome 확장 등록을 삭제합니다."
  if [ -f "$CHROME_EXT_FILE" ]; then
    remove_path "$CHROME_EXT_FILE"
    note "Chrome을 다시 열면 확장이 제거됩니다."
  fi
  note "웹 스토어에서 직접 설치한 확장은 chrome://extensions 에서 삭제하세요."
  step "삭제를 마쳤습니다."
}

ACTION="install"
for arg in "$@"; do
  case "$arg" in
    --uninstall) ACTION="uninstall" ;;
    --no-extension) INSTALL_EXTENSION=0 ;;
    --keep-settings) KEEP_SETTINGS=1 ;;
    *) fail "알 수 없는 옵션: $arg" ;;
  esac
done

if [ "$ACTION" = "uninstall" ]; then
  uninstall
else
  install_app
fi
