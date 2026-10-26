# Chrome 웹 스토어 제출 정보

Chrome 웹 스토어 개발자 대시보드(https://chrome.google.com/webstore/devconsole)에 그대로 입력할 내용이다.

## 등록 상태

- 게시자: newer.corpor@gmail.com
- 항목 ID: `hmgopkkefgfppfedloeponobiamikomf`
- 2026-10-26: 초안 작성 완료(패키지 0.1.0, 등록정보, 이미지, 개인정보 보호). 심사 제출 전

## 패키지

- 파일: `npm run package:extension` → `dist/browser-extension/hangulbond-extension-<version>.zip`
- 버전: `browser-extension/extension/manifest.json`의 `version`

## 스토어 등록정보

| 항목 | 값 |
|---|---|
| 이름 | manifest에서 자동 (`한글본드 - 업로드 파일명 자소 분리 방지`) |
| 요약 | manifest에서 자동 |
| 카테고리 | 도구 (Tools) |
| 언어 | 한국어 (영어 번역 포함) |
| 아이콘 | `browser-extension/extension/icons/icon-128.png` |
| 스크린샷 (1280×800) | `browser-extension/store/screenshot.png` |
| 작은 프로모션 타일 (440×280) | `browser-extension/store/promo.png` |
| 홈페이지 | https://github.com/da-itda/mac-nfd-nfc-hangulbond |
| 지원 | https://github.com/da-itda/mac-nfd-nfc-hangulbond/issues |

### 상세 설명 (한국어)

```text
맥에서 Chrome으로 파일을 올리면 한글 파일명이 Windows나 웹에서 "ㅎㅏㄴㄱㅡㄹ.pdf"처럼 자소 분리되어 보이는 문제가 있습니다. 맥용 Chrome이 업로드할 때 파일명을 NFD(자소 분리) 형태로 보내기 때문입니다. 파일명을 미리 고쳐 두어도 업로드할 때 다시 분리됩니다.

한글본드 확장은 웹 페이지가 파일을 읽기 직전에 파일명을 NFC(완성형)로 바꿔, 받는 쪽에서도 "한글.pdf"로 정상 표시되게 합니다.

지원
- 파일 선택 업로드, 일반 폼 제출
- 드래그 앤 드롭
- http·https 사이트의 일반적인 파일 업로드 화면

안전
- 파일 내용은 그대로 두고 이름만 바꿉니다.
- 이름이 바뀌어야 할 때만 동작하고, 이미 정상인 파일은 건드리지 않습니다.
- 데이터를 수집하거나 외부로 보내지 않습니다. 별도 권한을 요청하지 않습니다.

알려진 제한
- 폴더째 올리기는 폴더 구조를 지키기 위해 변환하지 않습니다.

맥 디스크의 파일명을 정리하려면 한글본드 앱을 함께 사용하세요.
https://github.com/da-itda/mac-nfd-nfc-hangulbond
```

### 상세 설명 (English)

```text
When you upload files from a Mac in Chrome, Korean and accented file names can show up decomposed on Windows and websites, like "ㅎㅏㄴㄱㅡㄹ.pdf". Chrome on macOS sends file names in NFD form, so names are split again on upload even if you fixed them on disk.

HangulBond converts file names to NFC right before the page reads the files, so the recipient sees "한글.pdf".

Supports file pickers, regular form submissions, and drag and drop on http and https sites. File contents are never changed. The extension collects no data, sends nothing anywhere, and requests no permissions. Folder uploads are left unchanged to keep their folder structure.
```

## 개인정보 보호 탭

| 항목 | 입력 |
|---|---|
| 단일 목적 | 웹 페이지에 파일을 올릴 때 파일명을 유니코드 NFC 형태로 바꿔, 맥에서 올린 한글 파일명이 자소 분리되지 않게 한다. |
| 호스트 권한 사유 (콘텐츠 스크립트 `http://*/*`, `https://*/*`) | 사용자가 파일을 올리는 사이트를 미리 알 수 없어서, 모든 http·https 페이지의 파일 선택·드롭 이벤트에서 파일명만 NFC로 바꾼다. 페이지 내용을 읽거나 저장·전송하지 않는다. |
| 원격 코드 사용 | 아니요 |
| 데이터 사용 | 수집하는 사용자 데이터 없음 (모든 항목 체크하지 않음) |
| 인증 | 판매·무관한 용도 사용·신용 평가 용도 사용을 하지 않음에 모두 동의 |
| 개인정보처리방침 URL | https://github.com/da-itda/mac-nfd-nfc-hangulbond/blob/main/docs/BROWSER_EXTENSION_PRIVACY.md (저장소에 푸시한 뒤 열리는지 확인) |
