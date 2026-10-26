#!/bin/bash
# 한글본드 설치 스크립트 (macOS, Apple silicon)
#
# 설치:  curl -fsSL https://raw.githubusercontent.com/da-itda/mac-nfd-nfc-hangulbond/main/install.sh | bash
# 삭제:  curl -fsSL https://raw.githubusercontent.com/da-itda/mac-nfd-nfc-hangulbond/main/install.sh | bash -s -- --uninstall
#
# 옵션:  --no-extension  Chrome 확장은 등록하지 않고 앱만 설치
#        --uninstall     앱과 Chrome 확장 등록을 삭제 (설정·로그는 남김)
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
LAUNCH_AGENT="$HOME/Library/LaunchAgents/HangulBond.plist"

step() { printf '\033[1m==>\033[0m %s\n' "$*"; }
note() { printf '    %s\n' "$*"; }
fail() { printf '\033[31m오류:\033[0m %s\n' "$*" >&2; exit 1; }

# 설치 폴더나 기존 앱에 쓸 수 없으면 관리자 암호를 묻는다.
run_privileged() {
  if [ -w "$INSTALL_DIR" ] && { [ ! -e "$APP_PATH" ] || [ -w "$APP_PATH" ]; }; then
    "$@"
  else
    note "응용 프로그램 폴더에 쓰려면 Mac 로그인 암호가 필요합니다."
    sudo "$@"
  fi
}

quit_app() {
  pgrep -f "$APP_PATH/Contents/MacOS/" >/dev/null || return 0
  step "실행 중인 한글본드를 종료합니다."
  osascript -e "tell application id \"$BUNDLE_ID\" to quit" >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    pgrep -f "$APP_PATH/Contents/MacOS/" >/dev/null || return 0
    sleep 0.5
  done
  pkill -f "$APP_PATH/Contents/MacOS/" || true
  sleep 1
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
  run_privileged rm -rf "$APP_PATH"
  run_privileged ditto "$source" "$APP_PATH"

  if [ "${INSTALL_EXTENSION:-1}" = "1" ]; then
    install_extension
  fi

  step "한글본드를 실행합니다. 메뉴 막대의 한글본드 아이콘에서 설정을 여세요."
  open "$APP_PATH"
  step "설치를 마쳤습니다."
}

uninstall() {
  quit_app
  if [ -d "$APP_PATH" ]; then
    step "$APP_PATH 를 삭제합니다."
    run_privileged rm -rf "$APP_PATH"
  else
    note "설치된 앱이 없습니다."
  fi
  if [ -f "$LAUNCH_AGENT" ]; then
    launchctl unload "$LAUNCH_AGENT" >/dev/null 2>&1 || true
    rm -f "$LAUNCH_AGENT"
    note "로그인 시 자동 실행 항목을 삭제했습니다."
  fi
  if [ -f "$CHROME_EXT_FILE" ]; then
    rm -f "$CHROME_EXT_FILE"
    note "Chrome 확장 등록을 삭제했습니다. Chrome을 다시 열면 확장이 제거됩니다."
  fi
  note "웹 스토어에서 직접 설치한 확장은 chrome://extensions 에서 삭제하세요."
  note "설정과 로그는 남겨 두었습니다: ~/Library/Application Support/$BUNDLE_ID"
  step "삭제를 마쳤습니다."
}

ACTION="install"
for arg in "$@"; do
  case "$arg" in
    --uninstall) ACTION="uninstall" ;;
    --no-extension) INSTALL_EXTENSION=0 ;;
    *) fail "알 수 없는 옵션: $arg" ;;
  esac
done

if [ "$ACTION" = "uninstall" ]; then
  uninstall
else
  install_app
fi
