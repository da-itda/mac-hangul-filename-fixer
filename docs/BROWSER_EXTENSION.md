# 한글본드 브라우저 확장

맥에서 Chrome으로 파일을 올리면, 디스크의 파일명이 정상이어도 업로드되는 이름이 `ㅎㅏㄴㄱㅡㄹ.pdf`처럼 자소 분리됩니다. 한글본드 확장은 웹 페이지가 파일을 읽기 직전에 파일명을 NFC로 바꿔 이 문제를 막습니다.

- 원인: 맥용 Chromium이 경로를 받을 때 HFS 분해형(NFD)으로 바꿔 업로드한다. 앱으로 디스크 이름을 고쳐도 업로드 단계에서 다시 분리된다 (`docs/TROUBLESHOOTING.md`).
- 결과: 확장을 켜면 받는 쪽(웹, Windows)에서 `한글.pdf`로 정상 표시된다.

## 동작 범위

| 업로드 방식 | 결과 | 확인 |
|---|---|---|
| 파일 선택 (JavaScript 업로드) | NFC로 전송 | 자동 테스트 |
| 일반 HTML 폼 제출 | NFC로 전송 | 자동 테스트 |
| 드래그 앤 드롭 (함께 담긴 텍스트 유지) | NFC로 전송 | 자동 테스트 |
| Shadow DOM 안의 파일 입력칸 | NFC로 전송 | 자동 테스트 |
| 이미 NFC인 파일 | 개입하지 않음 | 자동 테스트 |
| 폴더째 올리기 | 변환하지 않음 (폴더 구조 유지) | 자동 테스트 |
| 붙여넣기 | 코드상 지원, 재현 환경을 만들지 못해 미확인 | - |

- 파일 내용은 그대로 두고 이름만 바꾼다.
- 권한을 요청하지 않는다. http·https 페이지에서 콘텐츠 스크립트만 실행한다.
- 데이터를 수집·저장·전송하지 않는다 (`docs/BROWSER_EXTENSION_PRIVACY.md`).

알려진 제한:
- 드롭 처리 시 원래 이벤트를 멈추고 NFC 파일을 담은 이벤트를 다시 보낸다. 페이지가 처리하지 않고 브라우저 기본 동작에 맡기던 드롭(예: 일반 편집 영역에 이미지 삽입)은 일어나지 않을 수 있다.
- File System Access API(`showOpenFilePicker`)로 파일을 여는 사이트, Slack 같은 Electron 앱, Mail·텔레그램에는 적용되지 않는다.

## 설치

- 웹 스토어 등록 전: Chrome에서 `chrome://extensions` → 개발자 모드 → `압축해제된 확장 프로그램을 로드합니다` → `browser-extension/extension` 폴더 선택
- 웹 스토어 등록 후: https://chromewebstore.google.com/detail/hmgopkkefgfppfedloeponobiamikomf (심사 통과 후 열림)

## 개발

| 명령 | 내용 |
|---|---|
| `npm run test:extension` | 설치된 Chrome을 임시 프로필로 띄워 확장을 설치하고 업로드 시나리오 7개를 검사한다. 평소 Chrome 프로필은 건드리지 않는다. |
| `npm run package:extension` | 웹 스토어 제출용 zip을 `dist/browser-extension/`에 만든다. |

- 정식 Chrome은 `--load-extension`을 막는다. 테스트는 `--enable-unsafe-extension-debugging` + `--remote-debugging-pipe`로 실행하고 `Extensions.loadUnpacked`로 설치한다.
- 이 Mac(macOS 27)에서는 Chrome for Testing 156이 페이지를 열지 못해 사용하지 않았다.

## 웹 스토어 제출

1. `browser-extension/extension/manifest.json`의 `version`을 올린다.
2. `npm run test:extension`이 전체 통과하는지 확인한다.
3. `npm run package:extension`으로 zip을 만든다.
4. 개인정보처리방침이 공개 주소에서 열리는지 확인한다 (저장소 푸시 필요).
5. 개발자 대시보드에서 zip을 올리고 `browser-extension/store/LISTING.md` 내용을 입력한 뒤 심사를 제출한다.
