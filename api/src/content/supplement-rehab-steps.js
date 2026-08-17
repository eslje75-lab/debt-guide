/* 개인회생 보정 대응 유료 콘텐츠 — 무료 미리보기인 첫 단계를 제외한 상세와 서식 예시.
   정적 HTML에 되돌리면 결제 없이 전문을 읽을 수 있으므로 Worker 전용 모듈로 유지한다. */

export const STEPS = [
  {
    "title": "2단계 · 요구 자료 준비",
    "items": [
      {
        "id": "s2-1",
        "text": "요구 서류별 발급처 확인",
        "hint": "서류 체크센터에서 발급처 안내 참고",
        "must": "필수",
        "guide": "서류 체크센터에 서류별 발급처와 공식 사이트 링크를 정리해 두었습니다. 부채증명서(각 금융사 고객센터), 등본·초본(정부24), 소득 증명(홈택스), 통장 거래내역(각 은행) 등 대부분의 요구 자료가 목록에 있습니다.",
        "links": [
          {
            "label": "서류 체크센터",
            "url": "documents.html"
          }
        ]
      },
      {
        "id": "s2-2",
        "text": "증명서·확인서 발급 신청",
        "hint": "발급에 며칠 걸리는 서류부터 먼저 신청",
        "must": "필수",
        "guide": "금융사 부채증명서처럼 발급에 며칠 걸리는 서류부터 먼저 신청하세요. \"○월 ○일 기준\"처럼 기준일을 지정받았다면 그 날짜 기준으로 발급되는지 발급 전에 확인해야 두 번 걸음하지 않습니다."
      },
      {
        "id": "s2-3",
        "text": "설명이 필요한 항목은 소명서(경위서) 초안 작성",
        "hint": "사실관계를 시간 순서대로 정리",
        "must": "해당 시 필수",
        "guide": "\"왜, 어디에 썼는지\"를 묻는 요구는 서류만으로 답이 안 되고 설명 서면(소명서)이 필요합니다. 시간 순서 + 구체적 금액 + 증빙 연결(첨부 번호)이 기본 구조입니다.\n상단 실전 작성예시의 소명서·사용내역표를 참고해 초안을 만들어 보세요.",
        "ex": {
          "title": "소명서 → 실전 예시로 확인",
          "content": "완성된 형태의 예시는 페이지 상단 \"실전 작성예시 → 소명서\" 버튼에서 확인할 수 있습니다.\n\n핵심 구조\n① 무엇에 대한 소명인지 제목에 명시\n② 시간 순서대로, 구체적 금액과 함께 설명\n③ 각 내용 뒤에 증빙(첨부 번호) 연결\n④ 소명하지 못하는 금액이 없도록 합계 맞추기"
        }
      },
      {
        "id": "s2-4",
        "text": "준비한 자료를 요구 항목 순서대로 정리",
        "hint": "항목 번호를 매겨 대조 확인",
        "must": "권장",
        "guide": "요구 항목 번호별로 자료를 묶어(클립·라벨) 정리하면 보정서 작성과 제출 직전 대조가 쉬워집니다. 1단계에서 만든 목록과 하나씩 대조해 빠진 것이 없는지 확인하세요."
      }
    ],
    "example": {
      "title": "자료 준비 예시",
      "content": "[요구 항목별 준비 예시]\n\n요구 1. 채무잔액증명서\n → 해당 금융사 고객센터·인터넷뱅킹에서 발급\n\n요구 2. 소득 소명자료\n → 급여명세서, 통장 입금내역, 소득금액증명원 등\n\n요구 3. 재산 관련 소명\n → 등기사항전부증명서, 보험 해약환급금 조회서 등\n\n요구 4. 경위 설명\n → 소명서에 사실관계를 시간 순서대로 작성\n\n※ 발급까지 시간이 걸리는 서류(금융사 증명서 등)를\n   가장 먼저 신청해 두는 것이 안전합니다."
    }
  },
  {
    "title": "3단계 · 보정서 작성·제출",
    "items": [
      {
        "id": "s3-1",
        "text": "보정서에 사건번호·성명 기재",
        "hint": "보정권고서에 기재된 사건번호 그대로",
        "must": "필수",
        "guide": "보정권고서에 적힌 사건번호를 한 글자도 다르지 않게 옮겨 적으세요. 사건번호가 틀리면 다른 사건으로 잘못 접수되어 기한을 넘긴 것으로 처리될 수 있습니다."
      },
      {
        "id": "s3-2",
        "text": "요구 항목별 답변과 첨부서류 목록 작성",
        "hint": "항목 순서대로 답변하면 확인이 쉬움",
        "must": "필수",
        "guide": "\"1.에 대하여 → 답변 + (첨부 1)\" 구조로 요구 항목 순서 그대로 답하는 것이 법원이 확인하기 가장 좋습니다. 마지막에 첨부서류 목록을 번호 순서로 정리하세요.\n상단 실전 작성예시의 보정서를 참고하면 형태를 그대로 따라 쓸 수 있습니다.",
        "ex": {
          "title": "보정서 → 실전 예시로 확인",
          "content": "완성된 형태의 예시는 페이지 상단 \"실전 작성예시 → 보정서\" 버튼에서 확인할 수 있습니다.\n\n핵심 구조\n① 사건번호·채무자 성명\n② 요구 항목 순서대로 \"1.에 대하여 → 답변 + 첨부 번호\"\n③ 첨부서류 목록\n④ 날짜·서명, \"○○법원 귀중\""
        }
      },
      {
        "id": "s3-3",
        "text": "AI 서류 검토로 초안 점검",
        "hint": "AI 서류 검토 메뉴 이용",
        "must": "권장",
        "guide": "작성한 보정서·소명서 초안을 AI 서류 검토(서류 유형: 보정서 / 소명서·사용내역서)에 붙여넣으면 누락되기 쉬운 항목을 참고용으로 점검해 줍니다.",
        "links": [
          {
            "label": "AI 서류 검토",
            "url": "ai-review.html"
          }
        ]
      },
      {
        "id": "s3-4",
        "text": "기한 내 제출",
        "hint": "전자소송 또는 법원 접수창구",
        "must": "필수",
        "guide": "보정권고서에 적힌 지정기한 안에 제출하세요. 전자소송은 제출 직후 접수 통지를 확인하고, 창구 제출은 접수증을 받으세요. 우편은 발송일과 법원 접수일이 다를 수 있으므로 ‘하루 먼저 발송’을 안전한 기준으로 삼지 말고, 기한 전에 법원에 도착하도록 충분히 여유를 둔 뒤 실제 접수 여부를 담당 재판부 또는 회생위원에게 확인하세요. 준비가 어렵다면 원래 기한 전에 보정기간연장신청서를 제출하고 연장 허가 여부와 새 기한을 확인하세요."
      },
      {
        "id": "s3-5",
        "text": "제출 후 접수 완료 여부 확인",
        "hint": "전자소송 진행내역 또는 접수증 확인",
        "must": "권장",
        "guide": "전자소송은 제출 후 진행내역에서 접수 표시를 확인하고, 창구 제출은 접수증을 받아 보관하세요. \"대법원 나의사건검색\"에서도 사건 진행 상황을 조회할 수 있습니다. 제출한 보정서 사본은 반드시 보관하세요."
      }
    ],
    "example": {
      "title": "보정서 작성 예시",
      "content": "[보정서 기본 구성]\n\n사건번호: 20○○개회○○○○ (보정권고서 기재 번호)\n신청인(채무자): 홍길동\n\n1. 요구사항 ①에 대하여\n   ○○은행 채무잔액증명서를 첨부합니다. (첨부 1)\n\n2. 요구사항 ②에 대하여\n   최근 3개월 급여명세서를 첨부합니다. (첨부 2)\n   ※ 설명이 필요한 경우 소명 내용을 함께 기재\n\n첨부서류\n 1. ○○은행 채무잔액증명서 1통\n 2. 급여명세서 3매\n\n20○○. ○. ○.\n위 신청인 홍길동 (서명 또는 날인)\n\n○○법원 귀중\n\n※ 제출 전 사본 1부를 반드시 보관하세요."
    }
  }
];

export const DOC_EXAMPLES = [
  {
    "icon": "📄",
    "name": "보정서",
    "html": "<p class=\"text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 leading-relaxed\">아래는 <strong>가상 인물의 작성 예시</strong>입니다. 실제 작성 시에는 받은 보정서의 요구 문구와 본인의 실제 상황을 기준으로 사실대로 적어야 합니다.</p>\n        <div class=\"bg-white border border-slate-200 rounded-xl p-4 text-xs text-slate-700 leading-relaxed space-y-3\">\n          <p class=\"font-bold text-sm text-slate-800 text-center\">보 정 서</p>\n          <p>사건번호: 20○○개회○○○○ (보정권고서에 기재된 번호 그대로)<br>채무자(신청인): 김 ○ 민</p>\n          <div>\n            <p class=\"font-semibold mb-1\">1. 보정권고 요구사항 ①(◇◇저축은행 대출금 7,000,000원의 사용처 소명)에 대하여</p>\n            <p>위 대출금은 연체 카드대금 상환 3,200,000원, 연체 월세 3개월분 1,350,000원, 부친 병원비 480,000원, 생활비 1,970,000원에 사용하였습니다. 상세 내역과 증빙은 별첨 소명서 및 사용내역서(첨부 1)와 같습니다.</p>\n          </div>\n          <div>\n            <p class=\"font-semibold mb-1\">2. 요구사항 ②(최근 3개월 급여 입금내역 제출)에 대하여</p>\n            <p>급여 입금 통장의 최근 3개월 거래내역서(첨부 2)를 제출합니다.</p>\n          </div>\n          <div>\n            <p class=\"font-semibold mb-1\">첨부서류</p>\n            <p>1. 소명서 및 사용내역서(이체확인증·영수증 사본 포함) 1부<br>2. 급여 입금 통장 거래내역서 1부</p>\n          </div>\n          <p class=\"text-right\">2026. ○. ○.<br>위 채무자 김 ○ 민 (서명 또는 날인)<br>○○법원 귀중</p>\n        </div>\n        <ul class=\"text-xs text-slate-600 mt-3 space-y-1 leading-relaxed\">\n          <li>· 요구사항 번호 순서 그대로 답변하고, 답마다 첨부 번호를 연결하세요.</li>\n          <li>· 제출 전 사본을 보관하고, 기한(보정권고서 기재)을 반드시 지키세요.</li>\n        </ul>"
  },
  {
    "icon": "✍️",
    "name": "소명서",
    "html": "<p class=\"text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 leading-relaxed\">아래는 <strong>가상 인물의 작성 예시</strong>입니다. 실제 작성 시에는 받은 보정서의 요구 문구와 본인의 실제 상황을 기준으로 사실대로 적어야 합니다.</p>\n        <div class=\"bg-white border border-slate-200 rounded-xl p-4 text-xs text-slate-700 leading-relaxed space-y-3\">\n          <p class=\"font-bold text-sm text-slate-800 text-center\">소 명 서 (대출금 사용처)</p>\n          <p>채무자 김○민은 2025. 11. 10. ◇◇저축은행에서 대출받은 7,000,000원의 사용처를 아래와 같이 소명합니다.</p>\n          <p>① 대출 당일인 2025. 11. 10. 연체 중이던 △△카드 대금 3,200,000원을 상환하였습니다(이체확인증 첨부).</p>\n          <p>② 2025. 11. 12. 연체된 월세 3개월분 1,350,000원을 임대인에게 이체하였습니다(이체내역·임대차계약서 첨부).</p>\n          <p>③ 2025. 11. 20. 부친의 병원비 480,000원을 납부하였습니다(진료비 영수증 첨부).</p>\n          <p>④ 나머지 1,970,000원은 2025. 11.~2026. 1. 식비·교통비·공과금 등 생활비로 4회에 나누어 인출·사용하였습니다(출금내역·가계부 정리 첨부).</p>\n          <p>대출금 7,000,000원과 사용 합계 7,000,000원이 일치하며, 상세 내역은 별첨 사용내역서와 같습니다.</p>\n          <p class=\"text-right\">2026. ○. ○.<br>채무자 김 ○ 민 (서명 또는 날인)</p>\n        </div>\n        <ul class=\"text-xs text-slate-600 mt-3 space-y-1 leading-relaxed\">\n          <li>· 시간 순서 + 구체적 금액 + 증빙 연결이 소명서의 기본 구조입니다.</li>\n          <li>· 소명하지 못한 금액은 재산(청산가치)으로 계산되어 변제금이 늘 수 있습니다.</li>\n        </ul>"
  },
  {
    "icon": "🧾",
    "name": "사용내역표",
    "html": "<p class=\"text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 leading-relaxed\">아래는 <strong>가상 인물의 작성 예시</strong>입니다. 실제 작성 시에는 받은 보정서의 요구 문구와 본인의 실제 상황을 기준으로 사실대로 적어야 합니다.</p>\n        <p class=\"text-xs text-slate-500 mb-2\">소명서에 붙이는 상세 내역표입니다. 개인회생 셀프 진행센터의 \"대출금 사용내역서\" 예시와 같은 사례입니다.</p>\n        <div class=\"overflow-x-auto\"><table class=\"w-full text-xs border-collapse\">\n          <tr><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">일자</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">구분</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700 text-right\">금액(원)</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">사용처·내용</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">증빙</th></tr>\n          <tr class=\"bg-blue-50\"><td class=\"border border-slate-200 px-2 py-1.5\">2025.11.10</td><td class=\"border border-slate-200 px-2 py-1.5\">입금</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">+7,000,000</td><td class=\"border border-slate-200 px-2 py-1.5\">◇◇저축은행 대출금 입금</td><td class=\"border border-slate-200 px-2 py-1.5\">통장 거래내역</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">2025.11.10</td><td class=\"border border-slate-200 px-2 py-1.5\">지출</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">−3,200,000</td><td class=\"border border-slate-200 px-2 py-1.5\">△△카드 연체대금 상환</td><td class=\"border border-slate-200 px-2 py-1.5\">이체확인증</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">2025.11.12</td><td class=\"border border-slate-200 px-2 py-1.5\">지출</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">−1,350,000</td><td class=\"border border-slate-200 px-2 py-1.5\">연체 월세 3개월분 (임대인)</td><td class=\"border border-slate-200 px-2 py-1.5\">이체내역, 임대차계약서</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">2025.11.20</td><td class=\"border border-slate-200 px-2 py-1.5\">지출</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">−480,000</td><td class=\"border border-slate-200 px-2 py-1.5\">부친 병원비 (○○병원)</td><td class=\"border border-slate-200 px-2 py-1.5\">진료비 영수증</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">2025.11.~2026.1.</td><td class=\"border border-slate-200 px-2 py-1.5\">지출</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">−1,970,000</td><td class=\"border border-slate-200 px-2 py-1.5\">생활비 (식비·교통·공과금, 4회 분할 인출)</td><td class=\"border border-slate-200 px-2 py-1.5\">출금내역, 가계부 정리</td></tr>\n          <tr class=\"font-semibold bg-slate-50\"><td class=\"border border-slate-200 px-2 py-1.5\" colspan=\"2\">사용 합계</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">7,000,000</td><td class=\"border border-slate-200 px-2 py-1.5\" colspan=\"2\">입금액과 일치</td></tr>\n        </table></div>\n        <ul class=\"text-xs text-slate-600 mt-3 space-y-1 leading-relaxed\">\n          <li>· 입금액과 사용 합계가 끝까지 맞아떨어지게 정리하는 것이 핵심입니다.</li>\n          <li>· 현금 인출분은 인출 날짜·사유를 설명하고 가계부·영수증으로 뒷받침하세요.</li>\n        </ul>"
  }
];
