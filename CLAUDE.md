# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 작업 진행 기록 (PROGRESS.md)

이 저장소에는 `PROGRESS.md` 파일이 있다. 세션 시작 시(특히 `/clear` 직후) 가장 먼저 이 파일을 읽어 직전까지 무슨 작업을 하고 있었는지 파악한다. 기능 추가·버그 수정 등 의미 있는 작업 단위가 끝나거나 작업을 중단하는 시점마다 `PROGRESS.md`의 "현재 상태"와 "다음에 할 일"을 갱신한다.

## 프로젝트 개요

**챔로드** — 개인회생·파산 셀프 진행 지원 정보 제공 플랫폼 (순수 HTML/CSS/JS, 프레임워크 없음)

- 배포: GitHub Pages (`main` 브랜치 push 시 자동 반영)
- URL: https://chamroad.com/ (구 GitHub Pages 주소 https://eslje75-lab.github.io/debt-guide/ 도 병행 유효)
- GitHub: https://github.com/eslje75-lab/debt-guide

## 로컬 개발

별도 빌드 과정 없음. `node tools/serve.js` → http://localhost:3456 (또는 VS Code **Live Server** 확장).
`.claude/launch.json`의 `chamroad-static`도 같은 서버를 쓴다.

포트 3456인 이유: Worker의 `ALLOWED_ORIGINS`에 들어 있어 로컬 화면에서 운영 API를 호출해 볼 수 있다.
기본 API 대상은 `wrangler dev`(:8787)이고, 운영 API로 붙으려면 주소에 **`?api=prod`**를 한 번 붙인다
(그 브라우저에 기억된다. 되돌리려면 `?api=local`). 결제 점검용으로 `?paytest=1`도 있다 —
버튼만 열릴 뿐 실제 허용은 서버 명단(`payAllowlisted`)이 판정한다.

### PC를 바꿀 때

저장소에 없는 것은 **`api/.dev.vars`** 하나뿐이다(`.claude/settings*.json`은 기계별 설정이라 제외).
새 PC에서는 `git clone` → `cd api && npm install` → `npx wrangler login` → `.dev.vars` 재작성 순.

⚠️ **`.dev.vars`의 `PEPPER`는 반드시 비밀번호 관리자에 따로 백업해 둘 것.**
Cloudflare에 올린 시크릿은 이름만 조회되고 값은 다시 읽을 수 없다. PEPPER를 잃으면
기존 회원의 비밀번호 해시를 검증할 수 없어 전원 재설정해야 한다.
나머지 시크릿(Anthropic·Resend·솔라피·포트원·Turnstile)은 각 콘솔에서 재발급하면 된다.

※ 과거 단일파일 빌드 산출물(`app.html`, `build.ps1`)은 2026-07-02에 삭제됨 — 다시 만들지 말 것.

## 배포 (2026-08-09 자동화)

**`git push origin main` 하나로 화면과 서버가 모두 반영된다.**

| 대상 | 경로 | 걸리는 시간 |
|---|---|---|
| 화면 (HTML·CSS·JS) | push → GitHub Pages 자동 빌드 | 1~3분 + 브라우저 캐시 최대 10분(`max-age=600`) |
| 서버 (`api/src/index.js`) | push → GitHub Actions(`.github/workflows/deploy-worker.yml`) → `wrangler deploy` | 10초 내외 |

- 서버 배포는 `api/**`가 바뀐 push에서만 돈다. 화면만 고친 push는 Actions를 거치지 않는다.
- Worker(10초)가 Pages(1~3분)보다 먼저 끝나므로 **"서버 먼저, 화면 나중"** 순서가 자연히 지켜진다.
  이 순서가 중요한 이유: 옛 화면 + 새 서버는 안전하지만, 새 화면 + 옛 서버는 없는 기능을 불러 깨진다.
- 배포 전 `node --check api/src/index.js`가 자동 실행된다. 문법 오류면 배포되지 않는다.
- 실패하면 GitHub 저장소 **Actions** 탭에서 로그 확인. 수동 배포는 여전히 `cd api && npx wrangler deploy`.

⚠️ **D1 마이그레이션은 자동화하지 않았다.** 테이블·컬럼 변경은 되돌리기 어려우므로
`api/migrations/*.sql`을 사람이 확인하고 `wrangler d1 execute chamroad --remote --command "..."`로 적용한다.
(원격은 `--file`이 인증오류를 내므로 `--command`를 쓸 것.)

⚠️ **약관·개인정보처리방침 변경은 즉시 반영하면 안 된다.** 시행 7일 전 공지(이용자에게 불리한 변경은 30일 전)가
법정 의무다. 문서의 시행일·변경이력을 함께 갱신하고, 서버 `CONSENT_VERSION`도 올릴 것.

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
- 결과 계산 후 `localStorage`(`cdg_diagnosis_*` 키, `js/main.js`의 `Storage` 헬퍼)에 저장 → `result.html`에서 읽어 표시
- 변제 여력 계산 기준: 표준생계비(2026 기준중위소득 60%)와 입력 생활비 중 큰 값 — `calcScores`와 `calcRepayment`가 동일 기준을 사용해야 함 (수치 불일치 방지)
- ⚠️ **표준생계비(`MEDIAN_INCOME_2026` / `getStandardLiving`)는 `js/main.js`에 있다.** 진단·숫자 검산·작성예시가 모두 이 하나를 쓴다. 다른 파일에 복사본을 만들지 말 것(기준이 갈리면 화면마다 다른 금액이 나온다). 매년 보건복지부 고시가 바뀌므로 연초 갱신 대상.

### 숫자 검산 (`js/numcheck.js` + `numcheck.html`)

법원 제출 서류의 **금액이 서로 맞는지를 코드로 계산**하는 모듈. 무료·비로그인 이용, 서버 전송 없음(입력값을 저장하지 않으므로 방침 개정 대상이 아님 — 저장 기능을 붙일 거면 `privacy.html`부터 고칠 것).

- **AI에게 산술을 시키지 않는다**가 설계 전제다. 언어모델의 계산은 틀려도 그럴듯해 보인다. `api/src/index.js`의 `AI_SYSTEM_PROMPT` 금지 6번이 이를 명시하고, AI 검토는 서술형(진술서·경위서·보정서)만 맡는다. 이 분리를 되돌리지 말 것.
- 4종: `creditorList`(원금+이자·세로 합계·안분율 100%) / `incomeExpense`(수입−생계비 = 가용소득, 표준생계비 초과 확인) / `rehabPlan`(가용소득×횟수 ≥ 청산가치, 변제기간 상한, 채권자별 안분) / `courtCost`(인지대+송달료+예납금 — 채권자 수만 넣으면 총액).
- ⚠️ **송달료 단가는 `SONGDAL_FEE` 한 곳에만 둔다**(현재 5,640원, 2026-07-01 인상). 국내 통상우편요금에 연동돼 바뀌므로 인상 시 이 상수와 `resources.html`·`rehabilitation.html`의 서술을 함께 고칠 것. 화면에는 **항상 기준일을 함께** 표기한다.
- ⚠️ **파산 인지(2,000원)에 조문 번호를 붙이지 말 것** — 근거가 인지법이 아니라 「민사접수서류에 붙일 인지액… 예규」다(2026-08-12 반박 검증). 전자소송 감액(10분의 9)도 파산에는 확인되지 않아 적용하지 않는다.
- 비율·금액 배분은 **최대잉여법**(`largestRemainder`) — 각 항목을 그냥 반올림하면 합이 100%·가용소득과 어긋난다. 법원 양식의 합계 칸이 딱 떨어져야 하므로 이 방식을 쓴다.
- **판정하지 않는다**: 결과는 `ok`(계산이 맞음)/`diff`(숫자가 어긋남)/`ask`(확인할 점)뿐이고, "인가된다·제출해도 된다" 같은 평가는 내지 않는다(변호사법 제109조 제1호). 근거 조문은 파일 상단 주석에 출처와 함께 정리돼 있다.
- 예시 숫자는 `rehabilitation.html`의 '실전 서류 작성예시'와 **같은 값**이다. 한쪽을 고치면 다른 쪽도 고칠 것.

### 서류 간 대조 (`js/crosscheck.js`) — 이 서비스의 차별점

개인회생 서류 6종은 서로 물려 있고(채권자목록 ↔ 변제계획안 ↔ 수입·지출 ↔ 재산목록 ↔ 진술서), **보정명령의 상당수가 그 사이의 어긋남에서 나온다.** 서류를 하나씩 채팅창에 붙여넣는 방식으로는 구조적으로 못 잡는 것이고, **여러 서류를 동시에 들고 있는 플랫폼만 할 수 있다.** 이 기능을 약화시키는 방향의 변경은 서비스의 존재 이유를 깎는 것이다.

두 층으로 나뉘며 **경계를 섞지 말 것**:

| | 무엇을 | 어디서 | 비용 |
|---|---|---|---|
| **코드** (`js/crosscheck.js`) | 숫자·이름·건수 대조 | 브라우저 안 (전송 0) | 무료 |
| **AI** (`POST /api/ai/crosscheck`) | 진술서의 **서술** ↔ 숫자 | Anthropic | AI 회수 1회 차감 |

- 코드 층이 아무것도 전송하지 않는 덕에 **무료 제공이 가능하고 방침 개정도 필요 없다.** 여기에 서버 저장을 붙이면 그 장점이 사라진다.
- AI 층으로 나가는 항목은 **`CrossCheck.summaryForAI()` 하나가 경계선**이고, 서버에서 `sanitizeFigures()`가 다시 거른다. **항목을 늘리면 `privacy.html` 국외이전 ②와 제2항 표를 함께 고쳐야 한다.**
- 사건 파일(`numcheck.html`의 `LAST`)은 **메모리에만** 있다. localStorage·서버 저장 없음 — 새로고침하면 사라진다.
- 회수는 서류검토와 **한 주머니**를 쓴다(`checkAiQuota`/`consumeAiQuota`). 약관 제5조에 명시돼 있으니 나누려면 약관부터 고칠 것.
- 채권자명 대조는 `normName()`으로 `(주)`·`주식회사` 표기 차이를 흡수한다 — 안 하면 거짓 경고가 쏟아진다.

### 이용자 절차 상황을 AI에 함께 보내기 (`js/aicontext.js`)

챗봇 이용자는 매번 "제 상황은…"부터 설명해야 하지만 이 서비스는 진단 답변으로 이미 안다. 그 상황을 AI 검토·대조에 함께 넘겨 **이 사람에게 법원이 실제로 물을 것**을 질문에 반영한다(예: 폐업 이력이 있는데 진술서에 폐업 이야기가 없음).

**이 파일과 서버 `sanitizeContext()`가 개인정보의 경계선이다. 항목을 늘리려면 반드시 셋을 함께 고칠 것** — `js/aicontext.js`의 `build()`, `api/src/index.js`의 `CTX_*` 사전과 `sanitizeContext()`, `privacy.html`(제2항 표 · 제6항 국외이전 ②).

- 🔴 **민감정보는 절대 넣지 않는다**: `hasHealthIssues`(건강)·`debtCauses`(도박 등 포함)는 「개인정보 보호법」 제23조 관련 항목이라 `main.js DataSync.SENSITIVE_FIELDS`로 **서버 동기화에서도 이미 제외**돼 있다. 여기로 내보내면 그 조치가 무의미해진다. 연령·금액도 넣지 않는다(금액이 필요한 대조는 `crosscheck.js`가 별도 통로로 담당 — 통로를 나눠야 방침에 정확히 적을 수 있다).
- 화면의 "무엇이 전송되나요?" 목록은 `describe()`가 만든다. **전송 내용과 고지 내용이 구조적으로 어긋날 수 없게** 한 것이니 목록을 손으로 쓰지 말 것.
- 플래그는 **`=== true`로 엄격 비교**한다. 느슨하게 보면 `'yes'` 같은 문자열이 클라이언트만 통과하고 서버에서 걸려, 고지한 것과 실제 전송이 달라진다.
- 서버는 클라이언트를 믿지 않고 화이트리스트로 다시 거른다 — 방침 일치 목적 + **프롬프트 인젝션 차단**(이용자 문자열이 지시로 읽히지 않게 enum 키만 통과).
- 기본 켬이되 **이용자가 끌 수 있다**(`payload()`가 null 반환). 끄면 아무것도 안 보낸다.

### 용어 툴팁 (`js/main.js`의 `GLOSSARY`)

본문에 나온 어려운 말에 점선 밑줄과 설명을 자동으로 붙인다(`tagTerms`, 용어마다 화면당 첫 1회만).

**이 서비스가 지향하는 쉬움은 "낱말이 쉽다"가 아니라 "과정 안내가 쉽고 명확하다"이다.** 툴팁을 많이 달수록 쉬워지는 게 아니라, 밑줄이 빽빽해져 정작 읽어야 할 문장이 묻힌다. 그래서 **자동 태깅은 아래 셋 중 하나에 해당할 때만** 한다(2026-08-15 기준 34개).

1. **일상어로 읽으면 뜻이 어긋나는 말** — `가용소득`(단순히 소득−생활비가 아니라 법원이 인정하는 생계비를 뺀 값), `청산가치`, `환가`, `별제권`, `편파변제`, `지급불능`, `채무초과`, `동시폐지`
2. **잘못 알면 행동이 달라지는 말** — `보정권고`↔`보정명령`, `중지명령`↔`금지명령`↔`포괄적금지명령`, `면책`↔`면책불허가`↔`재량면책`↔`특별면책`, `즉시항고`(기간이 걸려 있다)
3. **숫자 계산의 기준이 되는 말** — `표준생계비`, `기준중위소득`, `안분율`, `변제기간`

**넣지 않는 것**: 이름만 봐도 뜻이 잡히는 서류·비용(`부채증명서`·`확정증명원`·`인지대`·`송달료`·`예납금`·`전자소송`·`집행법원`·`소송구조`·`생계비계좌`), 일상어(`압류`·`추심`·`기각`·`부양가족`·`원천징수`·`수임료`), 기관 이름(`신용회복위원회` — 툴팁보다 링크가 맞다). 이런 말이 처음 나오는 자리에서는 **툴팁 대신 문장 안에서 한 번 풀어 쓴다**(예: "부채증명서(금융회사에서 떼는 빚 확인 서류)").

⚠️ 추가할 때 **중복 키를 반드시 확인할 것.** 객체 리터럴이라 같은 키를 두 번 쓰면 조용히 뒤엣것이 이긴다(2026-08-13에 `송달료`가 그 상태였다).

### 화면 텍스트 — 쓰기 전에 확인할 것 (2026-08-14)

측정해 보니 이 사이트의 피로감은 **분량**이 아니라 **본론 앞에 쌓인 서문**에서 왔다.
`rehabilitation.html` 10,619자 중 실제 절차 내용은 1,048자뿐이고 나머지는 이미 접혀 있었는데,
정작 첫 체크박스에 닿기까지 412자를 읽어야 했다(numcheck은 653자).

**새 화면을 만들 때 이 셋은 쓰지 말 것:**

1. **UI를 말로 설명하는 문장** — "눌러서 이동하세요", "자세히에서 방법을 확인하세요",
   "해당없음으로 넘기세요". 버튼이 화면에 보이면 설명은 군더더기다.
   단, **색은 학습이 필요하므로 범례로 남긴다**(점 + 한 단어).
2. **아래 요소와 1:1로 겹치는 목록** — numcheck의 「이 도구가 하는 것」 5줄은 탭 5개와 같았고,
   각 탭 안에 같은 설명이 또 있었다. 설명은 **그것이 쓰이는 자리 한 곳에만** 둔다.
3. **도구 소개 문단** — 카드 설명은 한 문장. "무엇을 하는지"가 아니라 **"왜 눌러야 하는지"**만
   남긴다(예: "보정권고가 가장 많이 나오는 지점입니다").

**줄이면 안 되는 것**: 법률 고지·경고의 **내용**. 짧게 만들려면 삭제가 아니라
`details.fold`로 **접는다**(결론은 보이고 근거는 접힘). 고지 문장을 자르는 위치를 정하는 것은
법률 판단이 섞이므로 반드시 사람 확인 + `/legal-verify`를 거칠 것.

접이식은 `css/styles.css`의 `details.fold` 사용:
```html
<details class="fold bg-white rounded-2xl shadow-sm border border-slate-100">
  <summary class="px-5 py-4 flex items-center justify-between gap-2 hover:bg-slate-50 rounded-2xl">
    <span class="font-bold text-slate-800 text-sm">제목</span>
    <span class="fold-shut text-xs text-slate-400 shrink-0">펼치기 ▼</span>
    <span class="fold-open text-xs text-slate-400 shrink-0">접기 ▲</span>
  </summary>
  <div class="px-5 pb-5">…</div>
</details>
```
Tailwind의 `group-open:`은 CDN 버전에 따라 없을 수 있어 쓰지 않는다.

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

`pricing.html` — 회생 완주 패키지 149,000원 / 변제기간 관리 패키지 29,000원 / 파산 완주 패키지 49,000원 / 보정 추가 대응 19,000원·회. 결제 기능 미구현(mock 모달만 존재). 구매 시 `plan='premium'`과 함께 `plan_package`(rehab-full / maintain / correction-rehab / bankrupt-full / correction-bankrupt)·`plan_package_name`이 저장되고 패키지별 전용 페이지로 이동 — 완주 패키지는 `rehabilitation.html`/`bankruptcy.html`, 변제기간 관리는 `maintenance.html`, 보정 추가 대응은 `supplement.html?type=rehab|bankrupt`.

## 페이지별 역할

| 파일 | 역할 |
|---|---|
| `index.html` | 메인 홈 (히어로, 요금제 미리보기) |
| `diagnosis.html` | 4단계 무료 채무진단 폼 |
| `result.html` | 진단 결과 표시 (sessionStorage에서 읽음) |
| `rehabilitation.html` | 개인회생 절차 안내 |
| `bankruptcy.html` | 개인파산·면책 절차 안내 |
| `maintenance.html` | 변제기간 관리 센터 (변제계획 변경·실직 대처·특별면책 — 변제기간 관리 패키지 전용) |
| `supplement.html` | 보정 대응 센터 (`?type=rehab\|bankrupt` — 보정 추가 대응 전용) |
| `setup.html` | 맞춤 준비 진단 (?type=rehab\|bankrupt — 상황 질문지 → 필요 서류 선별 + 체크리스트·서류센터 '해당없음' 자동 반영, cdg_profile 저장) |
| `documents.html` | 서류 체크리스트 |
| `ai-review.html` | AI 서류 검토 기능 (서술형 전용 — 숫자 계산은 하지 않음) |
| `numcheck.html` | 숫자 검산기 (채권자목록·수입지출·변제계획안 — 무료, 저장 없음) |
| `resources.html` | FAQ (25문항, 4개 카테고리: 제도 이해/자격·비용/진행 중 생활·상황/결과·이후) |
| `pricing.html` | 요금제 안내 및 구매 |
| `mypage.html` | 마이페이지 |
| `about.html` | 운영자 소개 |

## 개인정보 — 손대기 전에 반드시 읽을 것

세 가지가 **법 위반과 직결**된다. 편의를 이유로 완화하지 말 것.

### ① 주민등록번호는 어떤 경우에도 처리하지 않는다 (제24조의2)

법령에 구체적 근거가 없으면 **정보주체의 동의를 받아도** 처리할 수 없다(제23조 민감정보와 다른 점). 우리에겐 근거가 없다.

- 안내가 아니라 **코드로 지운다**: `maskIdNumbers()`가 `js/main.js`(화면)와 `api/src/index.js`(서버)에 **같은 정규식으로** 있다. 한쪽만 고치지 말 것.
- 서버에서 지우는 지점이 셋: AI 검토 본문 / AI 대조 본문 / **`/api/data` 동기화의 직렬화 문자열**. 마지막 것 덕분에 앞으로 새 기능이 추가돼도 저장 경로는 자동으로 보호된다.
- 옛 방식("○○으로 가린 뒤 입력해 주세요" + confirm에서 [예] 누르면 그대로 전송)으로 되돌리지 말 것 — **안내를 읽은 사람만 보호받는 구조**였다.

### ② 건강 등 민감정보는 별도 동의를 받고 그대로 받는다 (제23조)

채무 발생 경위에는 질병·치료 이야기가 사실상 반드시 들어간다. 지우게 하면 검토가 의미를 잃는다.

- `users.sensitive_consent_at`에 동의 시각 기록. 동의를 받았다는 사실은 처리자가 증명해야 하므로(제23조 제1항 제1호의 '별도 동의' 요건 + 제22조 제1항 제5호) 화면 체크만으로는 부족하다.
  ⚠️ 제22조 **제3항**을 이 근거로 인용하지 말 것 — 그 항의 입증책임은 "**동의 없이** 처리할 수 있는 개인정보라는 것"에 대한 입증책임이지 동의 취득의 입증책임이 아니다(2026-08-12 반박 검증에서 정정).
- 서버 `requireSensitiveConsent()`가 AI 두 엔드포인트를 막는다. **회수 차감보다 먼저** 호출할 것(동의가 없어 되돌려보내는 요청이 회수를 태우면 안 된다).
- **철회 창구가 있어야 동의로서 온전하다** — 마이페이지 `doRevokeConsent()`. 없애지 말 것.

### ③ 국외이전은 방침에 적은 것과 실제가 같아야 한다

- `AI_INFERENCE_GEO = 'us'`. 기본값 `'global'`은 "어느 지역에서든 추론이 돌 수 있다"는 뜻이라 방침의 "이전되는 국가: 미국"이 거짓이 된다. 요금 1.1배를 내고 사실로 만든 것이다.
- AI로 나가는 통로는 셋뿐이다: 서류 본문 / `CrossCheck.summaryForAI()` / `AiContext.build()`. **늘리면 `privacy.html` 제2항 표와 제6항 국외이전 ②를 함께 고칠 것.**
- 검토 이력에 **서류 본문을 저장하지 않는다**(옛 `preview` 80자는 폐지 — 법원 서류 첫머리가 대개 "신청인 ○○○ (주민등록번호 …)"였다). AI가 만든 질문 주제만 남긴다.

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
