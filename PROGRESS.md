# 작업 진행 기록

`/clear` 이후 새 세션에서 바로 이어서 작업하기 위한 기록. Claude는 세션 시작 시 이 파일을 먼저 읽고, 의미 있는 작업 단위(기능 추가/수정 완료, 또는 멈추는 시점)마다 갱신한다.

## 현재 상태 (최신이 위로)

### 2026-07-03 — 소액 채무 안내 + 홈 버튼 입체화 등 UI 손질

- **소액 채무 안내(`result.html`)**: 총채무 **1,000만원 미만**이면 적합도 배너·위험 스트립·다음 단계 CTA·상세 아코디언을 모두 숨기고, "채무 규모가 크지 않은 편입니다 → 신용회복위원회 채무조정 우선 안내"(안 A) 카드 + **총 채무 숫자 1칸만** 표시. 신복위는 자격요건까지 다루지 않고 **사이트(www.ccrs.or.kr) + 대표번호 1600-5500(평일 09:00~18:00)** 만 안내(전화번호는 ccrs.or.kr 공식 확인). 구현: `LOW_DEBT_THRESHOLD`(=10,000,000) 상수 + `isLowDebt()`/`buildLowDebtGuidance()`/`buildLowDebtKeyNumber()`. `renderResults()` 날짜 로드 직후 조기 분기, 하단 `renderCta()` IIFE에도 `if(isLowDebt) return` 가드. 무데이터 분기는 그 앞이라 회귀 없음. **기준 1,000만원은 법정 최소액이 아니라 "법원 절차 비용·부담 대비 실익" 근거의 heuristic — 사용자 승인.**
- **홈 진행 버튼 입체화(`index.html`+`css/styles.css`)**: "무료 채무진단"/"챔로드 셀프진행" 버튼에 3D 눌림 효과. Tailwind arbitrary value가 CDN에서 안 먹어 `.btn-3d-white`/`.btn-3d-primary` 클래스를 styles.css에 직접 추가. 흰 버튼엔 pulse 애니메이션.
- **잔손질(`result.html`)**: 중복이던 "상세 정보 전체 펼치기" 버튼 삭제, mini-disclaimer 가독성 상향(text-sm/slate-500/medium), 하단 고지 여백 mt-8→mt-16.
- **커밋(`b3faf78`) + `git push origin main` 완료** — 이전 2~3차 미배포분 포함 전체 배포됨. GitHub Pages 반영 대기.

### 2026-07-02 (3차) — 진단결과 페이지 "간단 결과 우선" 구조로 개편

`result.html` 정보 과다 문제 해결 — "결론 먼저, 상세는 접기(무료)" 구조로 재구성. **진단결과 유료화 아이디어는 사용자 결정으로 폐기** (신뢰 훼손·퍼널 역효과·변호사법 109조 리스크 검토 결과).

**새 페이지 구조 (첫 화면 1~1.5스크롤):**
1. 추천 절차 배너 → 2. 한 줄 참고 고지(`#mini-disclaimer`) → 3. 핵심 숫자 3칸(`buildKeyNumbers` — 회생 우세: 월변제·총변제·면제예상 + 0원/청산가치 경고 노트, 파산 우세: 총채무·재산·채권자 수) → 4. 위험 요약 스트립(`buildRiskStrip` — "위험 N건" 접힌 빨간 띠, 펼치면 상세) → 5. 다음 단계 CTA → 6. 접힌 아코디언 4종(적합도 카드 / 두 절차 비교 / 변제금 계산 근거 / 파산관재인 주의) → 7. 전체 펼치기·재진단 → 8. 하단 고지

**구현 메모:**
- 공통 셸: `accordionShell(id, title, html)` / `toggleSection(id)` / `toggleAllSections()` — 본문 `.acc-body`, 화살표 `.acc-chev` 클래스 기준
- 기존 계산·문구 빌더 함수는 그대로 재사용. `buildDischargeRiskWarning` → `getDischargeRisks`(수집) + `buildRiskStrip`(요약 띠) + `buildRiskDetail`(본문)로 분리
- 삭제된 요소: 상단 disclaimer 박스(하단으로 통합), `#discharge-risk-warning`·`#result-cards`·`#tossup-advice`·`#trustee-warning`·`#detail-sections-container`·`#cards-heading` 고정 컨테이너, `makeAccordion` 데드코드
- 회귀 테스트 통과: 회생 우세+청산가치(첫 화면 799px) / 파산 우세+위험 2건 스트립 / 근접 점수(아코디언 4종) / 무데이터 가드 / 개별·전체 토글, 콘솔 에러 0건
- **아직 커밋/푸시 안 함** (2차 수정분 포함 전체 미배포 상태)

### 2026-07-02 (2차) — 점검 발견 이슈 일괄 수정 완료

아래 "1차 점검" 목록의 **1~18, 20~23번을 모두 수정**하고 브라우저 회귀 테스트(페르소나 4종 + 무데이터 + 마이페이지 진행률 + login next 차단)까지 통과. 콘솔 에러 0건. **아직 커밋/푸시 안 함.**

**수정 내용 요약:**
- `result.html` — hasRecentLoan 버그 수정(3개월/1년 분리 경고), 조문 정정(도박·투기 6호, 신용거래 2호, 재신청 기각 595조 5호), "불허가 후 7년 대기" 문구 삭제→즉시항고 안내, 사기죄는 형법 347조로 표기, "이자 3회" 속설 삭제, 배너·카드·상세의 변제 여력을 diagnosis_repay 기준으로 통일, 청산가치 경고 박스 신설, 무데이터 접근 시 진단 안내 표시, 미사용 변수 제거
- `js/diagnosis.js` — calcScores도 표준생계비(effLiving) 기준 사용, 파산 면책 이력(bankrupt-done-recent) 시 rehab -15 반영
- `diagnosis.html` — uncheckLegalNone 추가(해당없음 자동 해제), 데드코드 제거, 나이 라벨 * 추가
- `mypage.html` — rehab 42항목으로 수정(111% 버그), 미사용 상수 제거
- `pricing.html` — 당연복권·심문기일·금지명령 표현 정정 / `bankruptcy.html` — 압류금지 250만원(2026.2. 시행령)·심문기일 표현 / `resources.html` — 회생위원·압류금지 250만원 / `rehabilitation.html` — 회생위원 용어·직권면책 병기
- `login.html` — next 파라미터 same-origin 검증 / `ai-review.html` — 베타(규칙 기반) 안내 문구 / `index.html` — 인라인 hex 제거·?v=4 제거
- `app.html`·`build.ps1` **삭제** / `CLAUDE.md` 최신화(localStorage, 요금제 4종, launch.json)

**남은 항목 (별도 결정 필요):** 19·21번 — 실서비스 전환 시 백엔드(회원·결제) + 실제 AI 검토 API 연동. compare.html "파산선고와 동시에 추심 중단" 표현도 추후 검증 권장.

### 2026-07-02 (1차) — 전체 사이트 정밀 점검 완료 (수정은 아직 안 함)

전 페이지 코드 분석 + 실제 브라우저 진단 플로우 테스트(페르소나 3종) + 법률 수치 공식 출처 검증 완료. **발견 이슈만 기록하고 코드는 건드리지 않았음.** 다음 세션에서 P0부터 수정.

**P0 — 확정 버그 (동작 오류, 런타임 재현됨):**
1. `result.html` `buildReasons()`가 존재하지 않는 `data.hasRecentLoan` 필드 참조 → 최근 신규대출 경고가 적합도 카드에 절대 표시 안 됨. `data.recentLoan === 'within-3m'` 등으로 수정 필요
2. `diagnosis.html` `toggleLegalNone()` — '해당없음' 체크 상태에서 압류 등 다른 항목 체크 시 해당없음이 해제 안 됨 → 둘 다 체크되면 `hasLegalAction=false`로 계산 (압류 입력이 무시됨)
3. `mypage.html` 개인회생 진행률 분모 38 하드코딩 — 실제 `rehabilitation.html`은 9단계 42항목 (4+5+4+5+4+6+5+5+**4**) → 전부 체크 시 111% 표시. 하드코딩 대신 실데이터 기준으로 계산 권장
4. `app.html` + `build.ps1` — 예전 폴더("클로드코드 작업") 시절 단일파일 빌드 산출물. 어디서도 링크 안 되지만 GitHub Pages에 공개 배포 중 (옛 사이트명·옛 요금 10만원·신복위 포함 옛 진단). 저장소에서 삭제 필요

**P1 — 법률 정확성 (공식 출처로 검증 완료):**
5. 도박 면책불허가 근거: 사이트는 "제564조 제1항 **제4호**" → 실제는 **제6호** (`result.html` buildDischargeRiskWarning)
6. 1년 내 신용거래: 사이트는 "**제5호**" → 실제는 **제2호** (`result.html` 같은 함수)
7. "면책불허가 확정 후 **7년 대기 후 재신청**" 문구 → 법적 근거 없음. 제564조 1항 4호의 7년은 '면책을 **받은** 후' 기준 (`result.html` 면책불허가 안내 박스)
8. `pricing.html` 파산 절차 "복권 **신청**으로 자격 제한 해제" → 면책결정 확정 시 **당연복권**(제574조), 신청 불필요. 신청복권(제575조)은 면책 못 받고 5년 경과 시
9. "월 **150만원** 이하 급여 보호" → 민사집행법 시행령 개정으로 2026-02-01부터 압류금지 최저 **250만원** (`bankruptcy.html` 4단계 예시, `resources.html` 마지막 FAQ)
10. '변제**관리**인' 용어 → 개인회생은 '**회생위원**' (`rehabilitation.html` 8·9단계, `resources.html` FAQ)
11. 제595조 5호: **신청 전 5년 이내 면책(파산 면책 포함)** 받은 경우 개인회생 기각 → 현재 diagnosis.js는 '회생 면책 5년'만 반영, 파산 면책 이력의 회생 영향 미반영
12. 심문기일 출석: `pricing.html` "강제 아님, 권장" vs `bankruptcy.html` "반드시 출석" **상호 모순** — 공식 출처 확인 후 통일 필요
13. "사기죄(채무자회생법 **제643조**)로 형사고소" (`result.html` 2곳) — 643조는 사기회생죄, 파산 쪽은 사기파산죄(제650조)·형법 347조 영역. 조문 재확인 후 수정 필요
14. "이자 3회 이상 납부 이력이 있으면 사기 혐의 기각 가능성 높음" — 법적 근거 불명확한 속설. 단정 표현 완화 필요

**P2 — 로직/UX/구조 개선:**
15. `calcScores`는 입력 생활비, `calcRepayment`는 표준생계비 기준 → 같은 결과 페이지에 "변제 여력 월 100만원"(배너·카드)과 "월 변제액 0원"(상세)이 동시 표시되는 모순 (런타임 재현: 소득 250만·부양 1명 케이스)
16. 청산가치 보장 미반영: 총재산 > 3년 변제총액이면 변제금 상향·기간 연장(최대 5년) 필요한데 계산·경고 없음
17. `result.html` 진단 없이 직접 접근 시 "소득 없음" 등 허위 카드 표시 → 데이터 없으면 diagnosis.html 안내/리다이렉트
18. `login.html` `?next=` 무검증 `location.replace()` → `javascript:` URL 실행 가능. 상대경로만 허용하도록
19. AI 서류검토가 실제로는 키워드 포함 여부 검사 목업 — 유료 패키지 핵심 기능으로 판매 중이므로 실제 AI 연동(백엔드 필요) 또는 안내 문구 조정 필요
20. `index.html` 서비스 카드 인라인 `style="box-shadow: 0 0 0 2px #1d4ed8"` — CLAUDE.md 인라인 hex 금지 규칙 위반 (옛 파랑)
21. Auth/결제 전부 localStorage 목업 — 실서비스 전 백엔드 필수 (비밀번호 base64 저장, 결제 시 아무 패키지나 'premium' 부여)
22. CLAUDE.md 자체가 낡음: "sessionStorage 저장"(실제 localStorage), "프리미엄 10만원 단일 플랜"(실제 149,000/49,000/29,000/19,000 4종)
23. 잔손질: diagnosis.html 하단에 삭제된 드롭다운(`prior-adj-container`) 참조 데드코드, mypage `REHAB_TOTAL` 미사용 상수, result.html `hasFinance`·`hasNonFinanceDebt` 미사용 변수, index.html만 `styles.css?v=4` 캐시버스팅, 나이 필드 필수인데 라벨에 * 없음

**로컬 테스트 환경:** `.claude/launch.json` 추가됨 (`chamroad-static`, node 정적 서버, 포트 3456) — Claude가 브라우저 자동 테스트에 사용

### 2026-06-28 — 전체 반응형 정비 완료

모바일·태블릿에서 레이아웃이 깨지지 않도록 전체 사이트 반응형 정비.

**변경된 파일:**
- `css/styles.css` — `@media (max-width: 640px)` 확장: `.section`/`.section-sm` 패딩 축소, `#toast` 모바일 위치(좌우 여백 16px·전체 너비), `#scroll-top-btn` 위치 조정, `term-tip` 툴팁 너비·위치 모바일 최적화
- `diagnosis.html` — 단계 라벨에 `step-label` 클래스 추가(모바일 자동 숨김), 최근 대출 선택 그리드 `grid-cols-3` → `grid-cols-1 sm:grid-cols-3`, 재산 입력 라벨 `w-36` → `w-24`
- `pricing.html` — 요금제 카드 5개 모두 `flex-col sm:flex-row` 레이아웃으로 변경(모바일 세로 적층)
- `js/main.js` — 푸터 패딩 `py-16 px-6` → `py-10 md:py-16 px-4 md:px-6`, 그리드 gap 모바일 축소

### 2026-06-28 — Stripe 디자인 시스템 적용 완료

DESIGN-stripe.md 기준으로 전체 사이트 디자인 시스템 적용.

**변경된 파일:**
- `css/styles.css` — 완전 재작성. Stripe 디자인 토큰(CSS 변수), Inter 폰트, blue→indigo 색상 매핑, 필 버튼 CSS 규칙, Stripe 그림자, 라이트 푸터 클래스
- `js/main.js` — 내비게이션 로고 색상(그라디언트→인디고 단색), 푸터 재작성(다크→화이트)
- `index.html` — 히어로 CTA 버튼 `rounded-xl` → `rounded-full`

**CSS가 자동 처리하는 항목 (HTML 변경 불필요):**
- 모든 `bg-blue-700` 요소 → `#533afd` (인디고)
- `a.bg-blue-700`, `button.bg-blue-700` 등 → 필 모양(9999px)
- `button.border-slate-300`, `a.border-slate-300` → 필 모양
- `div.bg-slate-100 > button` (탭 스위처) → 필 모양
- `.btn-primary`, `.input-field`, `.auth-tab.active` (login.html 인라인 스타일 덮어쓰기)
- `from-blue-700`, `to-blue-600` 등 그라디언트 → 인디고/네이비
- `bg-slate-700`, `bg-slate-800` → `#1c1e54` (brand-dark)
- `.hero-gradient` → 인디고/네이비 그라디언트
- 토스트, 스크롤-투-탑 버튼 → 인디고
- 단계 점, 푸터 — 새 CSS 클래스로 처리

### 2026-06-21
- PROGRESS.md 신설. 작업 추적 체계 도입.

## 다음에 할 일 / 미정 사항
- 실서비스 로드맵 결정: 백엔드(회원·결제·비밀번호 안전 저장) + AI 서류검토 실제 API 연동
- compare.html "파산선고와 동시에 추심·강제집행 즉시 중단" 표현 공식 출처 검증 후 다듬기
- 신용회복위원회 채무조정 자격요건(연체 전/후 단계별)은 아직 ccrs.or.kr 공식 확인 전 — result.html 소액 안내는 사이트·전화번호만 노출해 우회 중

## 알아둘 것
- Inter 폰트 Google Fonts에서 로드 (한글 지원 있음, 일부 글자는 시스템 폴백)
- `compare.html`, `documents.html`, `ai-review.html`, `find-account.html` 파일은 CSS 규칙으로만 처리 (별도 HTML 수정 없음). `app.html`은 2026-07-02 삭제됨 — 다시 만들지 말 것
- `login.html` 인라인 `<style>` 블록의 `.btn-primary` 등은 `styles.css`의 `!important` 규칙이 우선 적용
