# 독자 해석 메타콘솔 검수본

검수 브랜치: `feat/reader-interpretation-metaconsole`

기준 커밋: `a3dbe741f3cd0acfcdf5def27bbc731adde5b739`. 사용자 검수 전 main 병합 및 GitHub Pages 배포를 하지 않는다.

## 변경 내용

- 원문 카드에 복수의 독자 해석 추가·수정, 두 해석 비교, 출전 보완을 제공한다.
- 출전을 새 해석에 상속한다. 해석별 출전은 사본이므로 나중에 원문 출전을 보완해도 기존 해석의 출전은 바뀌지 않는다. 빈 값은 화면에서 ‘미확인’으로 표시한다.
- 문맥 속 의미, 정서적 함의와 대상, 원문 근거를 자유롭게 작성한다. 문헌 해석·개인 연상·미정을 구분하며 점수나 자동 판정은 없다.
- 기본값은 개인 보관, 작성 중, 성격 미정이다. 공유 의사 표시는 전달본 포함 여부에만 사용하며 서버 전송은 없다. JSON 백업은 개인 주석도 포함한다.
- 원문의 근거 구절을 마우스·터치 또는 키보드로 선택할 수 있다. 직접 적은 구절도 원문 일치 여부를 확인한다. 미기입은 허용한다.
- 기존 세피아 텍스트는 출처 성격 미확인으로 표시한다. `interpretation`, `sepia`, `trans`, `usage`, `memo`의 원문 값을 보존하며, 서로 다른 텍스트는 모두 표시한다. 새 독자 해석으로 자동 전환하지 않는다.

## 저장 및 호환성

기존 IndexedDB 이름 `corpus_notebook`, 버전 `1`, `entries`/`meta` 스토어 및 localStorage 키 `corpus_notebook_data_v2`를 유지한다. 로딩 시 저장값을 다시 쓰지 않는다. 기존 필드와 알 수 없는 추가 필드는 보존한다.

카드에 `readerAnnotations` 배열만 추가한다. 각 주석은 `id`, `schemaVersion: 1`, `version`, `createdAt`, `updatedAt`, `source: {book, author, locator}`, `meaning`, `emotion`, `target`, `kind`, `reviewStatus`, `visibility`, `evidence: {quote, start, end, method, coordinateSpace}`를 저장한다. 선택 좌표는 LF로 정규화한 원문의 UTF-16 오프셋이다. 직접 입력은 좌표가 null이다. 수정 시 ID·작성 시각을 유지하고 버전을 올린다. 내용이 같으면 버전을 유지한다. 전체 수정 이력 보관 기능은 이번 범위가 아니다.

JSON 내보내기 버전은 2이다. 기존 배열과 `{entries: [...]}` 형식의 v1 백업을 읽을 수 있다. 동일 ID는 기존 기록을 유지하고 건너뛰며, 다른 기기의 수정본을 자동 덮어쓰거나 병합하지 않는다. 새 v2 백업을 빈 브라우저에 가져오면 주석을 포함해 복원한다. 반복 가져오기의 추가·중복·제외 건수를 표시한다.

저장 성공 후에만 화면의 기록 배열을 갱신한다. 실패 시 입력을 남긴다. 영구 저장소를 모두 사용할 수 없으면 저장을 차단한다. DB 스키마 변경이나 파괴적 마이그레이션은 없다.

## 재현 및 HTML 검수본

Node.js에서 `node tools/prepare-review.cjs`를 실행하면 저장소 바깥 `../review/sepia-reader-review.html`에 단독 실행 HTML을 생성한다. 검수본은 `sepia_reader_review_only` 및 `sepia_reader_review_only_v2` 저장 키를 사용하므로 공개 수첩 기록과 분리된다. 이 HTML을 브라우저에서 열고 합성 기록만 입력한다. 검수본의 기록을 공개 사이트로 옮기지 않는다.

자동 검수는 Playwright가 설치된 환경에서 `node tools/test-reader.cjs`로 실행한다. 기본 브라우저는 설치된 Edge이며 `TEST_BROWSER_PATH`로 테스트 실행 파일을 지정할 수 있다. 항상 임시 비영구 프로필 및 독립적인 localhost 포트를 사용한다. 실제 사용자 프로필과 실제 독서 기록을 사용하지 않는다. 행성 클릭 검수에 필요한 좌표 관찰 함수는 검수 서버에서만 삽입되며 제품 코드에는 없다.

## 확인 결과

jook / Windows / Edge 155.0.4283.45에서 합성 데이터 검수 28개 통과:

- 기존 IndexedDB 기록의 무변경 로딩, 기존 텍스트의 정확한 보존·표시
- 빈 포집, 빈 해석, 누락 출전, 출전 상속과 개인 보관 기본값
- 키보드 부분 선택, 근거 불일치 거부, 근거 좌표 저장
- 반복 저장 방지, 취소·Escape·포커스 복귀, 무변경 저장, 수정 버전 증가
- 두 해석 비교, 출전 보완과 이전 주석 출전 사본 보존
- 개인 주석의 전달본 제외, 복사, Markdown 다운로드
- JSON v2 내보내기·재반입, 기존 배열·v1 가져오기, 반복 가져오기, 잘못된 JSON 보존
- 12건 페이지, 최근 100개 행성, 다른 페이지의 행성 클릭으로 해당 카드 열기
- Command+Enter 키 이벤트와 중복 클릭 방지, 재시작 후 저장 유지
- IndexedDB 차단 시 localStorage 대체, 용량 오류 시 입력과 기존 기록 보존
- 1440×1050, 820×1180, 768×1024, 390×844에서 가로 넘침 없음; 화면 이미지 육안 확인
- 단독 HTML 검수본 실행 및 공개 사이트와 다른 저장 키 확인
- JavaScript 런타임 오류 없음

`test-results/results.json` 및 화면 PNG는 로컬 검수 산출물이며 Git 추적에서 제외한다. 코드 구문 확인과 `git diff --check`도 통과했다.

## 실행 제한 및 남은 확인

- 최초 제한 환경의 Git 조회는 `getaddrinfo() thread failed to start`로 실패했다. 정식 권한 승인 후 복제가 성공했다.
- 제한 환경의 첫 Edge 실행은 임시 프로필 파일 접근 오류 및 프로세스 종료로 실패했다. 승인된 실행 환경에서 새 임시 프로필로 검수했다. 사용자 프로필에 접속하지 않았다.
- macOS Safari 및 실제 iPad 터치·가상 키보드·VoiceOver 검수는 미실시다. Command 키 이벤트와 화면 크기 검수는 실제 기기 검수를 대체하지 않는다.
- 서버 동기화·실제 공유·AI 생성/학습·도서 대출 연동은 추가하지 않았다.

## 변경 파일

`index.html` (기존 패치 유지, 줄바꿈 정규화 및 확장 코드 로드), `reader-console.js`, `reader-console.css`, `tools/prepare-review.cjs`, `tools/test-reader.cjs`, `.gitignore`, `REVIEW.md`.

기존 `sepia-base-v5.1.html`은 수정하지 않았다.
