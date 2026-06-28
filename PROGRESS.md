# 작업 진행 기록

`/clear` 이후 새 세션에서 바로 이어서 작업하기 위한 기록. Claude는 세션 시작 시 이 파일을 먼저 읽고, 의미 있는 작업 단위(기능 추가/수정 완료, 또는 멈추는 시점)마다 갱신한다.

## 현재 상태 (최신이 위로)

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
- (없음 — 반응형 정비 완료)

## 알아둘 것
- Inter 폰트 Google Fonts에서 로드 (한글 지원 있음, 일부 글자는 시스템 폴백)
- `compare.html`, `documents.html`, `ai-review.html`, `find-account.html`, `app.html` 파일은 CSS 규칙으로만 처리 (별도 HTML 수정 없음)
- `login.html` 인라인 `<style>` 블록의 `.btn-primary` 등은 `styles.css`의 `!important` 규칙이 우선 적용
