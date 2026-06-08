# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

`css/styles.css` — 공통 컴포넌트 스타일 정의. Tailwind CDN과 병행 사용.

주요 커스텀 클래스:
- `.disclaimer-box` — 법률대리 아님 고지 박스 (노란 배경, 주황 테두리)
- `.navbar-sticky` — 상단 고정 네비게이션
- `.card-hover` — 카드 호버 효과
- `.section-sm` — 섹션 상하 패딩 단축

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
- `css/styles.css` 주석 상단이 아직 '채무정리길잡이'로 남아 있음 (기능 영향 없음)
