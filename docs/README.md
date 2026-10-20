# 문서 안내

| 문서 | 용도 |
|---|---|
| [`MANUAL_TEST_GUIDE.md`](MANUAL_TEST_GUIDE.md) | 기능 확인을 위한 수동 테스트 절차 |
| [`USER_GUIDE.md`](USER_GUIDE.md) | 앱 설치, 폴더 검사·정리, 자동 감시 사용 방법 |
| [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md) | 버전 갱신, 서명·공증, 빌드 및 게시 절차 |
| [`RELEASE_HISTORY.md`](RELEASE_HISTORY.md) | 완료된 공개 릴리스 기록 |
| [`ROADMAP.md`](ROADMAP.md) | 다음 플랫폼인 Windows 지원 계획 |
| [`archive/INITIAL_PROJECT_PLAN.md`](archive/INITIAL_PROJECT_PLAN.md) | 초기 설계 기록. 현재 동작의 기준 문서가 아님 |

릴리스 작업을 시작하기 전 `npm run release:preflight`를 실행한다. 이 명령은 필수 환경 변수와 키 파일의 접근 가능성만 확인하고 비밀값은 출력하지 않는다.

릴리스 자격 증명과 배포 접속 정보는 비공개 릴리스 안내 문서에서 관리한다. 인증값이나 개인 경로는 이 저장소에 포함하지 않는다.
