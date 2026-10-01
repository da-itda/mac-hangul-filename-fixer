# 작업 계획

작성일: 2026-10-01

## 진행 순서

| 순서 | 작업 | 상태 |
|---|---|---|
| 1 | macOS 메뉴바 아이콘 템플릿 적용 | 완료 |
| 2 | UI/UX 개선 | 완료 (배포 전) |
| 3 | 1~2번을 묶어 업데이트 배포 (0.1.4) | 예정 |
| 4 | Windows 수신 측 한글본드 (아래 계획) | 계획 검토 중 |

### 1. macOS 메뉴바 아이콘 템플릿 적용
- 원인: `tray.png`가 흰색 고정(`icon_as_template(false)`)이라 밝은 메뉴바에서 거의 보이지 않았다.
- 해결: 모양은 같고 색만 검정인 `tray-template.png`를 추가하고, macOS에서만 템플릿으로 지정했다. 메뉴바 밝기와 클릭 강조 상태에 맞춰 시스템이 색을 칠한다. Windows는 기존 `tray.png`를 그대로 쓴다.
- [x] `src-tauri/icons/tray-template.png` 추가
- [x] `src-tauri/src/lib.rs` 플랫폼별 아이콘 분기
- [x] `cargo test` 통과 (27개)
- [x] 실제 메뉴바에서 라이트/다크 확인: 두 모드 모두 옆의 시스템 아이콘과 같은 색으로 표시됨

### 2. UI/UX 개선

| 단계 | 비중 | 작업 |
|---|---|---|
| 2-1 | 20% | 탭 4개와 `+`·`−` 아이콘을 Phosphor Light로 교체 (회색 단색, 아이콘 뒤 상자 제거) |
| 2-2 | 5% | 상단 탭 영역 위아래 여백 4px 추가 |
| 2-3 | 25% | 일반·정보 상단을 Shottr 스타일로 변경 (작은 앱 아이콘 + 굵은 제목 + 회색 부제), 제목·문구 변경 |
| 2-4 | 10% | 일반 탭 상단 상자 3개: 텍스트 가운데 정렬, 높이 20% 증가 |
| 2-5 | 30% | 창 높이를 탭 내용에 맞춰 자동 조절 (최대 높이 넘으면 내부 스크롤) |
| 2-6 | 10% | 변경 전후 화면 비교, 실제 앱 실행 확인 |

- [x] 2-1 아이콘 교체 (gear-six, folder-simple, clock-counter-clockwise, info, plus, minus)
- [x] 2-2 탭 여백 (위 8px, 아래 9px)
- [x] 2-3 일반·정보 상단 (제목 `한글본드(NFD to NFC)`, 창 제목·메뉴는 그대로)
- [x] 2-4 상단 상자 3개 (가운데 정렬, 높이 70px)
- [x] 2-5 창 높이 자동 조절 (최대 720px, 넘치면 내부 스크롤)
- [x] 2-6 검증: 실제 앱에서 탭 4개 모두 내용에 맞게 조절, 너비 560 유지, 창 위쪽 고정

검증 중 발견·해결:
- 원인: macOS에서 Tauri 창 크기에 제목 표시줄(32px)이 포함되어 웹 화면보다 크다. 결과: 내용 높이만큼 크기를 주면 32px가 잘렸다. → 창 크기와 웹 화면의 차이를 실행 중에 재서 더한다.
- 원인: 숨겨진 창에서는 `window.innerWidth`가 틀리고 `requestAnimationFrame`이 멈춘다. 결과: 너비가 최소값 500으로 줄었다. → 너비는 Tauri 값을 쓰고, 디바운스는 타이머로 바꿨다.
- 원인: 프로젝트를 SynologyDrive에서 옮긴 뒤 `src-tauri/target/`에 옛 경로가 남아 빌드가 실패했다. → `cargo clean`으로 정리했다.

수정 파일: `app/index.html`, `app/styles.css`, `app/main.js`, `app/icons/`(Phosphor SVG + MIT 라이선스), `src-tauri/capabilities/default.json`(창 크기 변경 권한), `src-tauri/tauri.conf.json`(최소 높이)

리스크:
- 창 높이 변경 시 macOS에서 창 위쪽이 고정되지 않고 움직일 수 있다 → 실제 앱에서 확인 후 위치 보정
- 로그·폴더 탭은 내용이 길어질 수 있다 → 최대 높이 제한 + 내부 스크롤
- 실제 앱 확인에는 `cargo clean`과 설치된 앱 일시 종료가 필요하다

---

# Windows 수신 측 한글본드

상태: 계획 검토 중 (개발 시작 전)

## 1. 배경

- 원인: Mail, 텔레그램(macOS 앱)은 첨부할 때 macOS API로 파일명을 다시 읽으면서 NFD로 되돌린다. 맥 디스크의 이름을 NFC로 바꿔도 전송 단계에서 다시 분리된다.
- 결과: Windows 수신자에게 `ㅎㅏㄴㄱㅡㄹ`로 보인다. 카카오톡은 앱이 자체적으로 NFC로 바꿔서 정상이다.
- 결론: 맥에서 보내는 쪽 변환만으로는 해결할 수 없다. 받는 Windows 쪽에서 저장된 파일명을 정리한다.

## 2. 목표와 완료 기준

기존 앱을 Windows에서도 빌드한다. 별도 앱을 새로 만들지 않고 코드베이스 하나로 두 OS를 지원한다.

완료 기준:
- Windows 10/11 x64에서 설치 후 트레이 아이콘으로 상주한다.
- 맥에서 메일/텔레그램으로 보낸 파일을 Windows에서 다운로드 폴더나 바탕화면에 저장하면 10초 안에 정상 한글 이름이 된다.
- 파일 내용은 변하지 않고, 충돌 시 덮어쓰지 않는다.
- 로그인 시 자동 실행되고, 앱 안에서 업데이트된다.

범위 제외:
- 메일 앱 화면에 보이는 첨부 이름 (저장 전 단계)
- zip 내부 이름 문자 깨짐 (`�븳湲` 형태, 별도 문제)
- Windows ARM64, 코드 서명(2차 작업)

## 3. 단계와 비중

### 1단계: 빌드·테스트 환경 (10%)
- [ ] 빌드 방식 결정: Windows PC / Mac 크로스 빌드(cargo-xwin + NSIS) / GitHub Actions
- [ ] Windows 테스트 환경 확보 (실제 PC 또는 Parallels·UTM VM)
- [ ] 수정 없이 첫 Windows 빌드와 실행 확인

### 2단계: Windows 호환 수정 (30%)
- [ ] 릴리스 빌드에서 콘솔 창 숨김 (`windows_subsystem`)
- [ ] 단일 인스턴스 잠금을 `File::try_lock`으로 교체 (macOS·Windows 공통, libc 제거)
- [ ] 사용 중인 파일(os error 32) rename 실패 시 재시도, 같은 실패 로그 반복 억제
- [ ] 대량 파일 처리 지연 개선: 현재는 파일마다 대기 시간을 순서대로 적용한다
- [ ] 주기 검사(5초마다 전체 폴더) 부하 점검
- [ ] 임시 파일 패턴 보강 (`.sb-*` 등)
- [ ] 외부 링크 열기에서 `cmd start` 사용 제거 (콘솔 깜빡임, URL의 `&` 문제)

### 3단계: 수신 측 기본값·UX (15%)
- [ ] Windows 첫 실행 시 다운로드·바탕화면 자동 감시 ON, 로그인 시 자동 실행 ON
  - OneDrive로 옮겨진 바탕화면도 실제 경로로 인식해야 한다
- [ ] 트레이 좌클릭 시 메뉴와 창이 동시에 뜨지 않게 조정
- [ ] Windows용 트레이 아이콘과 폰트(Malgun Gothic) 적용
- [ ] OS별 문구 정리 (메뉴바 / 트레이)

### 4단계: 빌드·배포 (20%)
- [ ] `tauri.conf.json` NSIS 설치 파일과 WebView2 설치 설정
- [ ] 업데이트 목록 생성 스크립트에 `windows-x86_64` 추가
- [ ] 서버 업로드 경로 확정 (`local_server_info/` 규칙 확인 후, 업로드는 승인 후 진행)
- [ ] `docs/RELEASE_CHECKLIST.md`에 Windows 절차 추가

### 5단계: 테스트 (20%)
- [ ] Windows에서 Rust 테스트 실행
  - macOS에서 건너뛴 "NFC·NFD 동시 존재" 충돌 테스트를 Windows에서 활성화
- [ ] 맥→Windows 시나리오: 메일(Outlook·Gmail 웹), 텔레그램, 카카오톡
- [ ] 예외: 열려 있는 파일, zip 해제 100개, 재부팅 후 자동 실행, 업데이트

### 6단계: 문서·정리 (5%)
- [ ] `README.md` 실행 방법, `docs/TROUBLESHOOTING.md` 원인·해결 기록
- [ ] 기능 단위 커밋

## 4. 수정 예정 파일

| 파일 | 내용 |
|---|---|
| `src-tauri/src/main.rs` | 콘솔 창 숨김 |
| `src-tauri/src/lib.rs` | 단일 인스턴스, 첫 실행 기본값, 트레이, 외부 링크 |
| `src-tauri/src/scanner.rs`, `watcher.rs` | 사용 중 파일 재시도, 대량 처리, 주기 검사 |
| `src-tauri/src/normalizer.rs` | 임시 파일 패턴 |
| `src-tauri/src/settings.rs` | OS별 기본값 |
| `src-tauri/tauri.conf.json`, `Cargo.toml` | Windows 번들, 의존성 |
| `app/main.js`, `app/styles.css`, `app/index.html` | 문구, 폰트 |
| `scripts/generate-update-manifest.mjs` | Windows 업데이트 목록 |
| `docs/RELEASE_CHECKLIST.md`, `README.md`, `docs/TROUBLESHOOTING.md` | 문서 |

## 5. 예상 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| Windows 빌드·테스트 환경 없음 | 일정 전체 지연 | 1단계에서 먼저 결정 |
| 코드 서명 없음 | SmartScreen 경고로 설치 이탈 | 1차는 안내 문구, 2차에 인증서 검토 |
| 받는 사람마다 설치 필요 | 효과 범위 제한 | 자주 받는 사람부터 배포, 설치형이 부담되면 휴대용 실행 파일 검토 |
| Windows 파일 잠금 | 열린 파일 변환 실패 | 재시도 후 파일이 닫히면 처리 |
| 백신·Defender 간섭 | rename 지연·실패 | 테스트에서 확인 |
| 큰 폴더 감시 부하 | CPU·디스크 사용 증가 | 주기 검사 조건 조정 |

## 6. 결정 필요 사항

1. 빌드·테스트 환경: Windows PC가 있는지, 없으면 VM이나 CI 중 무엇을 쓸지
2. 1차 배포를 코드 서명 없이 해도 되는지
3. Windows 첫 실행 기본값: 다운로드·바탕화면 자동 감시 ON, 자동 실행 ON
4. 대상: Windows 10/11 x64만

## 7. 추가 제안 (범위 밖)

- 휴대용 실행 파일: 설치 없이 실행하면 폴더를 한 번 정리하는 방식. 상주 앱 설치를 꺼리는 수신자용.
- 탐색기 우클릭 메뉴 "한글 이름 정리".
