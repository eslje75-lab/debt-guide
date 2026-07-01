# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 작업 진행 기록 (PROGRESS.md)

이 저장소에는 `PROGRESS.md` 파일이 있다. 세션 시작 시(특히 `/clear` 직후) 가장 먼저 이 파일을 읽어 직전까지 무슨 작업을 하고 있었는지 파악한다. 기능 추가·버그 수정 등 의미 있는 작업 단위가 끝나거나 작업을 중단하는 시점마다 `PROGRESS.md`의 "현재 상태"와 "다음에 할 일"을 갱신한다.

## 프로젝트 개요

**챔로드** — 개인회생·파산 셀프 진행 지원 정보 제공 플랫폼 (순수 HTML/CSS/JS, 프레임워크 없음)

- 배포: GitHub Pages (`main` 브랜치 push 시 자동 반영)
- URL: https://eslje75-lab.github.io/debt-guide/
- GitHub: https://github.com/eslje75-lab/debt-guide

## 로컬 개발

별도 빌드 과정 없음. VS Code의 **Live Server** 확장으로 `index.html`을 열면 로컬에서 바로 확인 가능.

배포는 `git push origin main` 으로 완료. 몇 분 후 GitHub Pages에 반영됨.

## 아키텍처

### 공통 헤더·푸터 시스템

모든 페이지는 `js/main.js`가 헤더와 푸터를 동적으로 주입한다.

- 각 HTML 파일에 `<div id="header-placeholder"></div>`, `<div id="footer-placeholder"></div>` 위치 표시자 존재
- 페이지 하단 `<script>` 에서 `renderHeader('page-id')` / `renderFooter()` 호출
- 네비게이션 링크는 `main.js` 상단 `NAV_LINKS` 배열 하나에서 관리 — 링크 추가·수정은 여기만 변경

### 진단 로직

`diagnosis.html` + `js/diagnosis.js` 가 담당.

- 4단계 폼(채무현황 → 연체·법적현황 → 소득·생활비 → 재산·기타)
- 단계 이동: `goStep(n)` / `nextStep()` / `prevStep()`
- 결과 계산 후 `sessionStorage`에 저장 → `result.html`에서 읽어 표시

### CSS 구조

`css/styles.css` — Stripe 디자인 시스템 토큰 + Tailwind 오버라이드. Tailwind CDN과 병행 사용.

주요 커스텀 클래스:
- `.disclaimer-box` — 법률대리 아님 고지 박스 (노란 배경, 주황 테두리)
- `.navbar-sticky` — 상단 고정 네비게이션
- `.card-hover` — 카드 호버 효과
- `.section-sm` — 섹션 상하 패딩 단축
- `.hero-gradient` — 히어로 인디고/네이비 그라디언트 배경
- `.footer-stripe` / `.footer-link` / `.footer-heading` — 라이트 푸터 스타일

## 디자인 시스템 (Stripe 기반) — 새 HTML 작성 규칙

`css/styles.css`에 Stripe 디자인 토큰이 적용되어 있다. **새 페이지·컴포넌트를 만들 때 아래 규칙을 따르면 별도 CSS 없이 자동 적용된다.**

### 색상 — Tailwind 클래스 사용, 인라인 hex 금지

| 용도 | 사용할 클래스 | 실제 렌더 색 |
|---|---|---|
| 주 배경(브랜드) | `bg-blue-700` | `#533afd` (인디고) |
| 주 텍스트(브랜드) | `text-blue-700` | `#533afd` |
| 주 테두리(브랜드) | `border-blue-700` | `#533afd` |
| 히어로/섹션 배경 | `bg-blue-700 text-white` 또는 `hero-gradient` | 인디고 |
| 페이지 배경 | `bg-slate-50` (body 기본값) | `#f6f9fc` |
| 카드 배경 | `bg-white` | white |
| 다크 섹션 배경 | `bg-slate-800` | `#1c1e54` (navy) |

**금지**: `style="background:#1d4ed8"`, `style="color:#3b82f6"` 등 구버전 블루 hex 인라인 스타일 사용 금지. Tailwind 클래스로 대체할 것.

### 버튼 — 클래스만 맞추면 CSS가 pill 모양으로 자동 변환

```html
<!-- Primary (인디고 채움) — 자동으로 pill + #533afd -->
<a href="..." class="bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-blue-800 transition-colors">버튼</a>
<button class="bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm hover:bg-blue-800 transition-colors">버튼</button>

<!-- Secondary (아웃라인) — 자동으로 pill -->
<button class="border border-slate-300 px-5 py-2.5 text-slate-700 text-sm hover:bg-slate-50 transition-colors rounded-xl">취소</button>

<!-- Soft (연한 채움) — 자동으로 pill -->
<button class="bg-blue-50 text-blue-700 px-4 py-2 text-xs rounded-lg hover:bg-blue-100 transition-colors">구매하기</button>

<!-- 히어로 내 반투명 버튼 — 이 경우만 rounded-full 수동 입력 (CSS 미처리) -->
<a href="..." class="bg-white/10 text-white px-8 py-3.5 rounded-full border border-white/50 hover:bg-white/20 transition-colors">CTA</a>
```

**pill 자동 적용 대상**: `a.bg-blue-700`, `button.bg-blue-700`, `button.border-slate-300`, `a.border-slate-200` 등 — [css/styles.css](css/styles.css) 상단 "Pill buttons" 섹션 참조.

### 카드

```html
<div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">...</div>
<!-- 강조 카드 -->
<div class="bg-white rounded-2xl border-2 border-blue-500 shadow-md p-5">...</div>
```

### 폼 인풋

```html
<input class="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm">
<!-- focus 시 인디고 테두리 + glow 자동 적용 -->
```

### 새 페이지 최소 템플릿

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>페이지명 | 챔로드</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body class="bg-slate-50">
<div id="header-placeholder"></div>

<!-- 히어로 -->
<section class="bg-blue-700 text-white py-8">
  <div class="max-w-4xl mx-auto px-4 text-center">
    <h1 class="text-2xl md:text-3xl font-bold mb-1">제목</h1>
    <p class="text-blue-100 text-sm">부제목</p>
  </div>
</section>

<!-- 본문 -->
<div class="max-w-4xl mx-auto px-4 py-8">
  <!-- 콘텐츠 -->
  <div class="disclaimer-box mt-6">
    <strong>⚠️ 법률대리 아님 고지</strong><br>
    본 서비스는 법률상담, 법률대리, 사건 수임 또는 결과 보장을 제공하지 않습니다.
  </div>
</div>

<div id="footer-placeholder"></div>
<div id="toast"></div>
<script src="js/main.js"></script>
<script>initPage('page-id');</script>
</body>
</html>
```

### 요금제·결제

`pricing.html` — 현재 프리미엄(100,000원) 단일 플랜. 결제 기능 미구현(mock 모달만 존재).

## 페이지별 역할

| 파일 | 역할 |
|---|---|
| `index.html` | 메인 홈 (히어로, 요금제 미리보기) |
| `diagnosis.html` | 4단계 무료 채무진단 폼 |
| `result.html` | 진단 결과 표시 (sessionStorage에서 읽음) |
| `rehabilitation.html` | 개인회생 절차 안내 |
| `bankruptcy.html` | 개인파산·면책 절차 안내 |
| `documents.html` | 서류 체크리스트 |
| `ai-review.html` | AI 서류 검토 기능 |
| `resources.html` | FAQ·자료실 |
| `pricing.html` | 요금제 안내 및 구매 |
| `mypage.html` | 마이페이지 |
| `about.html` | 운영자 소개 |

## 법률 정보 정확성 지침

이 프로젝트는 법적 정보를 제공하는 웹사이트이므로, 정보의 정확성이 최우선이다.

### 원칙

- 모든 법률 절차·요건 정보는 **반드시 공식 출처를 WebSearch 또는 WebFetch로 직접 확인** 후 사용한다
- 훈련 데이터(학습된 지식)만으로 법률 절차를 단정하지 않는다
- 확인하지 못한 내용은 불확실함을 명시한다
- **2026년 기준 최신 정보**를 기준으로 한다 — 법령·절차는 개정될 수 있으므로 항상 현행 기준을 확인한다

### 참조해야 할 공식 사이트

| 주제 | 공식 출처 |
|---|---|
| 개인회생·파산 절차, 면책, 서류 | 대법원 전자소송 (https://ecfs.scourt.go.kr) |
| 개인회생·파산 일반 안내 | 대법원 나홀로소송 (https://pro-se.scourt.go.kr) |
| 신용회복위원회 채무조정 절차 | 신용회복위원회 (https://www.ccrs.or.kr) |
| 법령 원문 확인 | 국가법령정보센터 (https://www.law.go.kr) |

### 적용 방법

법률 절차·기준·요건에 관한 내용을 작성하거나 답변하기 전에:
1. 위 공식 사이트에서 해당 정보를 WebSearch/WebFetch로 조회한다
2. 조회한 내용을 근거로 작성한다
3. 출처를 확인할 수 없는 경우, 추측임을 명시하고 공식 사이트 확인을 안내한다

## 수정 시 주의사항

- **사이트명 변경** 시 `js/main.js` 상단 `const SITE_NAME` 한 곳만 수정
- **헤더·푸터 수정** 은 `js/main.js`의 `renderHeader()` / `renderFooter()` 함수만 수정
- **법률대리 아님 고지** 는 모든 페이지 하단에 `.disclaimer-box`로 존재 — 텍스트 변경 시 각 파일 개별 수정 필요
- **새 HTML 작성 시 인라인 hex 색상(`#1d4ed8` 등) 절대 금지** — Tailwind `blue-*` 클래스 사용 → CSS가 자동으로 인디고로 변환
