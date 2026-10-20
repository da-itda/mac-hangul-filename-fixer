# 문서 안내

| 문서 | 용도 |
|---|---|
| [`MANUAL_TEST_GUIDE.md`](MANUAL_TEST_GUIDE.md) | 기능 확인을 위한 수동 테스트 절차 |
| [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md) | 버전 갱신, 서명·공증, 빌드 및 게시 절차 |
| [`RELEASE_HISTORY.md`](RELEASE_HISTORY.md) | 완료된 공개 릴리스 기록 |
| [`ROADMAP.md`](ROADMAP.md) | 다음 플랫폼인 Windows 지원 계획 |
| [`archive/INITIAL_PROJECT_PLAN.md`](archive/INITIAL_PROJECT_PLAN.md) | 초기 설계 기록. 현재 동작의 기준 문서가 아님 |

릴리스 작업을 시작하기 전 `npm run release:preflight`를 실행한다. 이 명령은 필수 환경 변수와 키 파일의 접근 가능성만 확인하고 비밀값은 출력하지 않는다.

공개 저장소에는 비밀값을 두지 않는다. 실제 릴리스 자격 증명 위치는 로컬 비밀 저장소의 `private release notes`에서 확인한다.
