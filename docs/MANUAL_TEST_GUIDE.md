# 수동 테스트 가이드

## 현재 테스트 가능한 범위

현재 앱에서 테스트할 수 있는 기능:

- 폴더 선택
- 선택한 폴더 저장 및 재실행 후 복원
- 선택 폴더 검사
- NFD 한글 파일명/폴더명 탐지
- 파일 저장 안정화 후 정리
- 파일명/폴더명 NFC 변경
- 임시 파일 제외
- 성공/실패/충돌 로그 저장
- 최근 로그 10개 표시
- 파일 저장 후 대기 시간 저장
- 하위 폴더 포함 설정 저장
- 자동 감시 ON/OFF
- 저장된 폴더에서 새로 생긴 NFD 파일명 자동 정리
- 반복 이벤트 debounce
- 최근 변환 파일 재처리 방지
- 자동 감시 보정 스캔

아직 테스트 대상이 아닌 기능:

- 로그인 시 자동 실행 ON/OFF
- 정식 앱 아이콘
- Windows 트레이 빌드 검증

## 실행 방법

macOS debug 앱 위치:

```text
$PROJECT_ROOT/src-tauri/target/debug/bundle/macos/한글본드.app
```

터미널에서 실행:

```sh
open "$PROJECT_ROOT/src-tauri/target/debug/bundle/macos/한글본드.app"
```

## 안전한 테스트 폴더

테스트용 샌드박스 폴더:

```text
$PROJECT_ROOT/tmp/manual-test-fixture
```

이 폴더에는 자소 분리된 파일명과 폴더명이 들어 있다. 앱에서 이 폴더를 선택해 테스트한다.

## 테스트 순서

1. 앱을 실행한다.
2. `폴더 선택`을 누른다.
3. 테스트용 샌드박스 폴더를 선택한다.
4. `검사`를 누른다.
5. 검사 결과에 변환 예정 항목이 표시되는지 확인한다.
6. `지금 정리`를 누른다.
7. 결과와 최근 로그가 표시되는지 확인한다.
8. Finder에서 파일명이 NFC 형태로 바뀌었는지 확인한다.
9. 앱을 종료한 뒤 다시 실행한다.
10. 선택했던 폴더와 대기 시간 설정이 유지되는지 확인한다.

예상 변경:

```text
한글.txt → 한글.txt
test_한글.docx → test_한글.docx
한글폴더 → 한글폴더
가.txt → 가.txt
```

예상 유지:

```text
보고서.tmp
```

## 로그 파일 위치

macOS 로그 파일 예상 위치:

```text
~/Library/Application Support/com.codex.hangul-nfc-normalizer/activity.jsonl
```

로그는 JSONL 형식으로 저장된다.

## 자동 감시 테스트

1. 앱을 실행한다.
2. 테스트 폴더를 선택하고 저장된 폴더 목록에 들어갔는지 확인한다.
3. `자동 감시`를 켠다.
4. 상태가 `자동 감시 중`으로 바뀌는지 확인한다.
5. 터미널에서 테스트 폴더 안에 NFD 파일을 만든다.

```sh
printf "auto watch test\n" > "$PROJECT_ROOT/tmp/manual-test-fixture/자동감시.txt"
```

6. 약 3-8초 기다린다. 파일 이벤트를 받으면 debounce 후 처리하고, 이벤트를 놓쳐도 보정 스캔으로 처리한다.
7. Finder 또는 터미널에서 파일명이 NFC로 바뀌었는지 확인한다.

예상 결과:

```text
자동감시.txt → 자동감시.txt
```

8. 앱의 최근 로그에 성공 기록이 남는지 확인한다.

참고:

- 자동 감시 처리 결과가 생기면 앱 화면의 검사 결과와 최근 로그가 자동 갱신된다.
- 자동 감시가 켜진 직후에는 상태가 `자동 감시 중`인지 먼저 확인한다.

## 설정 파일 위치

macOS 설정 파일 예상 위치:

```text
~/Library/Application Support/com.codex.hangul-nfc-normalizer/settings.json
```

설정은 JSON 형식으로 저장된다.
