/* maintain 패키지 유료 콘텐츠 — 무료 미리보기인 첫 가이드를 제외한 상세와 서식 예시.
   정적 HTML에 되돌리면 결제 없이 전문을 읽을 수 있으므로 Worker 전용 모듈로 유지한다. */

export const STEPS = [
  {
    "title": "가이드 2 · 실직·소득 변동 대처",
    "items": [
      {
        "id": "m2-1",
        "text": "변제금 미납을 방치하지 않기",
        "hint": "미납이 계속 누적되면 개인회생절차가 폐지될 수 있음",
        "must": "필수",
        "guide": "미납이 발생하거나 누적되었다는 사정만으로 곧바로 개인회생절차가 폐지되는 것은 아닙니다. 다만 법원이 인가된 변제계획을 이행할 수 없음이 명백하다고 판단하면 절차를 폐지합니다(채무자회생법 제621조 제1항 제2호). 판단에는 지금까지의 이행 정도, 미납 사유, 성실성, 현재 수입·지출과 사정변경 등이 종합적으로 고려됩니다. 미납이 생기면 담당 회생위원·재판부에 납입 상태를 확인하고, 사정에 따라 변제계획 변경 또는 특별면책 가능성을 절차 종료 전에 검토하세요. 폐지되어도 이미 이루어진 변제의 효력은 유지됩니다(제621조 제2항)."
      },
      {
        "id": "m2-2",
        "text": "회생위원에게 상황 미리 알리기",
        "hint": "사건번호와 함께 소득 변동 상황 설명",
        "must": "필수",
        "guide": "회생위원 연락처는 개시결정문·임치 안내문에 있습니다. 사건번호를 밝히고 \"언제부터, 왜, 얼마나\" 납입이 어려운지 설명하세요. 통화 날짜와 안내받은 내용을 메모해 두면 이후 절차에서 유용합니다."
      },
      {
        "id": "m2-3",
        "text": "소득 변동 증빙자료 확보",
        "hint": "퇴직증명서·실업급여 수급자격 확인서·진단서 등",
        "must": "필수",
        "guide": "실직: 퇴직증명서·고용보험 자격상실 이력·실업급여 수급자격 확인서(고용24) / 질병: 진단서·입퇴원확인서 / 폐업: 폐업사실증명원(홈택스). 나중에 변경 신청이나 특별면책으로 가더라도 이 증빙이 모두 쓰입니다.",
        "links": [
          {
            "label": "고용보험",
            "url": "https://www.ei.go.kr"
          },
          {
            "label": "국세청 홈택스",
            "url": "https://www.hometax.go.kr"
          }
        ],
        "ex": {
          "title": "증빙 서류 → 실전 예시로 확인",
          "content": "상황별 증빙 서류와 발급처는 페이지 상단 \"실전 작성예시 → 소득 변동 증빙 정리표\" 버튼에서 표로 확인할 수 있습니다."
        }
      },
      {
        "id": "m2-4",
        "text": "일시적 변동인지, 장기적 변동인지 판단",
        "hint": "재취업 예정이면 시기·예상 소득 정리",
        "must": "권장",
        "guide": "1~2개월 공백 후 재취업이 예정되어 있다면 그 계획(시기·예상 소득)을 정리해 회생위원과 상의하세요. 장기적인 변동이라면 변제계획 변경(가이드 1)이나 특별면책(가이드 3) 검토로 넘어갑니다."
      },
      {
        "id": "m2-5",
        "text": "소득 회복이 어려우면 변제계획 변경 신청 검토",
        "hint": "가이드 1 참고",
        "must": "해당 시 필수",
        "guide": "줄어든 소득으로도 일부 납입이 가능하다면 변제계획 변경으로 월 변제액을 조정하는 것이 원칙적인 대응입니다. 가이드 1의 절차를 따라 진행하세요."
      },
      {
        "id": "m2-6",
        "text": "변제 지속이 불가능하면 특별면책 검토",
        "hint": "가이드 3 참고",
        "must": "해당 시 필수",
        "guide": "중병·재해 등으로 납입 자체가 장기적으로 불가능하고 변제계획 변경으로도 해결되지 않는다면, 특별면책(가이드 3)의 요건에 해당하는지 확인하세요."
      }
    ],
    "example": {
      "title": "실직했을 때 대처 순서",
      "content": "[실직·소득 급감 시 대처 순서]\n\n① 미납 상태 확인 및 즉시 대응\n   미납만으로 곧바로 폐지되는 것은 아니지만,\n   법원이 변제계획을 이행할 수 없음이 명백하다고 판단하면\n   개인회생절차가 폐지될 수 있습니다.\n   폐지되어도 이미 이루어진 변제의 효력은 유지됩니다.\n\n② 회생위원에게 먼저 알리기\n   사건번호를 밝히고 실직·소득 감소 상황을 설명하세요.\n\n③ 증빙자료 준비\n   - 실직: 퇴직증명서, 실업급여 수급자격 확인서\n   - 질병: 진단서, 입퇴원 확인서\n   - 폐업: 폐업사실증명원\n\n④ 상황에 맞는 절차 확인\n   - 소득이 줄었지만 일부 납입 가능 → 변제계획 변경 요건 확인 (가이드 1)\n   - 납입 자체가 불가능 → 특별면책 요건 확인 (가이드 3)\n\n※ 미납이 생기면 절차 종료 전에 담당 회생위원·재판부에 현재 상태와 가능한 대응을 확인하세요."
    }
  },
  {
    "title": "가이드 3 · 특별면책 신청",
    "items": [
      {
        "id": "m3-1",
        "text": "특별면책 요건 3가지 해당 여부 확인",
        "hint": "상세안내에서 요건 확인",
        "must": "필수",
        "guide": "법 제624조 제2항의 세 요건을 모두 충족해야 하며, 충족하더라도 법원이 이해관계인의 의견을 들은 뒤 면책 여부를 결정합니다.\n① 채무자가 책임질 수 없는 사유로 변제를 완료하지 못했을 것\n② 개인회생채권자가 면책결정일까지 변제받은 금액이, 채무자가 파산절차를 신청했을 때 배당받을 금액보다 적지 않을 것\n③ 변제계획의 변경이 불가능할 것\n또한 악의로 개인회생채권자목록에서 누락한 채권이 있거나 법에서 정한 채무자의 의무를 이행하지 않은 경우, 법원은 같은 조 제3항에 따라 면책을 불허할 수 있습니다."
      },
      {
        "id": "m3-2",
        "text": "책임질 수 없는 사유 증빙 준비",
        "hint": "질병 진단서·해고 통지서·폐업사실증명원 등",
        "must": "필수",
        "guide": "요건 ①을 서류로 보여야 합니다. 중병은 진단서·소견서(근로 불가 취지가 드러나면 좋음), 해고는 해고 통지서·수급자격 확인서, 재해는 관련 증명서로 준비하세요."
      },
      {
        "id": "m3-3",
        "text": "지금까지 변제한 금액 정리",
        "hint": "회생위원을 통해 납입 내역 확인",
        "must": "필수",
        "guide": "회생위원에게 지금까지 개인회생채권자에게 배분된 금액과 면책결정 전 추가 배분 예정액을 확인하세요. 법문상 비교 대상은 ‘면책결정일까지 개인회생채권자가 변제받은 금액’과 ‘채무자가 파산절차를 신청했을 때 배당받을 금액’입니다. 단순 납입 총액이나 신청 당시 청산가치만으로 요건 충족을 확정하지 말고 담당 법원이 요구하는 비교자료를 확인하세요."
      },
      {
        "id": "m3-4",
        "text": "특별면책 신청 서면 작성·제출",
        "hint": "요건에 해당하는 사정을 기재 — 개인회생절차 종료 전 신청",
        "must": "필수",
        "guide": "요건 3가지에 하나씩 대응하는 구조로 작성하면 법원이 판단하기 쉽습니다. 반드시 개인회생절차가 종료되기 전에 신청해야 합니다.\n상단 실전 작성예시에서 완성 형태를 확인하세요.",
        "ex": {
          "title": "특별면책 서면 → 실전 예시로 확인",
          "content": "완성된 형태의 예시는 페이지 상단 \"실전 작성예시 → 특별면책 신청 서면\" 버튼에서 확인할 수 있습니다.\n\n핵심 구조\n① 사건번호·채무자\n② 요건 ①: 책임질 수 없는 사유 (증빙 연결)\n③ 요건 ②: 면책결정일까지 채권자가 변제받은 금액과 파산 시 배당액 비교(납입 총액만으로 단정하지 않음)\n④ 요건 ③: 변제계획 변경이 불가능한 사정\n⑤ 첨부서류 목록"
        }
      },
      {
        "id": "m3-5",
        "text": "법원의 면책결정 확인",
        "hint": "면책결정 확정 후 효력 발생 — 비면책채권 등 예외 확인",
        "must": "필수",
        "guide": "면책결정은 확정되어야 효력이 생깁니다. 확정되면 변제계획에 따라 변제한 것을 제외한 개인회생채권에 대한 채무자의 책임이 원칙적으로 면제되지만, 채무 자체가 소멸하는 것은 아닙니다. 법 제625조 제2항의 비면책채권은 책임이 면제되지 않고, 보증인·공동채무자와 담보에 대한 채권자의 권리에도 영향이 없습니다. 면책결정문 원본을 잘 보관하세요."
      }
    ],
    "example": {
      "title": "특별면책 신청 안내",
      "content": "[특별면책이란]\n변제계획에 따른 변제를 다 완료하지 못했더라도, 일정 요건을 모두 충족하면 법원이 면책결정을 할 수 있는 제도입니다(채무자회생법 제624조 제2항).\n\n■ 요건 (3가지 모두 충족해야 함)\n① 채무자가 책임질 수 없는 사유로 변제를 완료하지 못했을 것\n   예: 중병, 갑작스러운 해고, 재해 등\n② 개인회생채권자가 면책결정일까지 변제받은 금액이,\n   채무자가 파산절차를 신청했을 때 배당받을 금액보다 적지 않을 것\n③ 변제계획의 변경이 불가능할 것\n\n※ 세 요건을 충족하더라도, 악의로 누락한 개인회생채권이 있거나 법에서 정한 채무자의 의무를 이행하지 않은 경우 법원은 면책을 불허할 수 있습니다(제624조 제3항).\n\n■ 신청 방법\n- 위 요건에 해당하는 사정을 기재한 서면을 담당 법원에 제출\n- 개인회생절차가 종료되기 전에 신청해야 합니다.\n\n■ 결정 절차와 효력\n면책결정은 확정되어야 효력이 생깁니다. 확정되면 변제계획에 따라 변제한 것을 제외한 개인회생채권에 대한 채무자의 책임이 원칙적으로 면제되지만, 채무 자체가 소멸하는 것은 아닙니다. 법 제625조 제2항의 비면책채권은 책임이 면제되지 않고, 보증인·공동채무자와 담보에 대한 채권자의 권리에도 영향이 없습니다.\n\n※ 요건 해당 여부 판단이 어려운 경우 전문가 상담을 권장합니다."
    }
  }
];

export const DOC_EXAMPLES = [
  {
    "icon": "📅",
    "name": "변제계획 변경신청",
    "html": "<p class=\"text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 leading-relaxed\">아래는 <strong>가상 인물의 작성 예시</strong>입니다. 실제 양식의 항목·순서는 관할 법원의 최신 양식을 기준으로 하고, 내용은 반드시 본인의 실제 상황을 사실대로 적어야 합니다.</p>\n        <p class=\"text-xs text-slate-500 mb-2\">사례: 이직으로 월 실수령이 2,600,000원 → 1,900,000원으로 줄어든 경우</p>\n        <div class=\"overflow-x-auto\"><table class=\"w-full text-xs border-collapse\">\n          <tr><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700 w-32\">칸</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">작성 내용 (예시)</th></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5 font-medium\">사건번호·채무자</td><td class=\"border border-slate-200 px-2 py-1.5\">20○○개회○○○○ / 채무자 김○민</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5 font-medium\">신청취지</td><td class=\"border border-slate-200 px-2 py-1.5\">인가된 변제계획의 변경(인가)을 구합니다.</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5 font-medium\">변경 사유</td><td class=\"border border-slate-200 px-2 py-1.5\">20○○. ○. 다니던 회사의 경영 악화로 권고사직 후 재취업하면서 월 실수령 급여가 2,600,000원에서 1,900,000원으로 감소하였음 (근로계약서·급여명세서 첨부)</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5 font-medium\">변경 내용</td><td class=\"border border-slate-200 px-2 py-1.5\">\n            <table class=\"w-full border-collapse mt-1\">\n              <tr><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\"></th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700 text-right\">변경 전</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700 text-right\">변경 후</th></tr>\n              <tr><td class=\"border border-slate-200 px-2 py-1.5\">월평균 소득</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">2,600,000</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">1,900,000</td></tr>\n              <tr><td class=\"border border-slate-200 px-2 py-1.5\">생계비 (1인 표준)</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">1,538,543</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">1,538,543</td></tr>\n              <tr class=\"bg-blue-50 font-semibold\"><td class=\"border border-slate-200 px-2 py-1.5\">월 변제액 (가용소득)</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">1,061,457</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">361,457</td></tr>\n            </table>\n          </td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5 font-medium\">첨부서류</td><td class=\"border border-slate-200 px-2 py-1.5\">새 근로계약서, 최근 3개월 급여명세서, 변경된 수입·지출 목록</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5 font-medium\">날짜·서명</td><td class=\"border border-slate-200 px-2 py-1.5\">2026. ○. ○. 채무자 김○민 (서명 또는 날인)</td></tr>\n        </table></div>\n        <ul class=\"text-xs text-slate-600 mt-3 space-y-1 leading-relaxed\">\n          <li>· 변경 전/후가 <strong>숫자로 비교</strong>되게 쓰는 것이 핵심입니다.</li>\n          <li>· 변제기간은 변제개시일부터 3년을 초과할 수 없습니다. 다만 법 제614조 제1항 제4호의 요건을 충족하기 위하여 필요한 경우 등 특별한 사정이 있으면 5년 이내로 정할 수 있습니다(채무자회생법 제611조 제5항). 변경안은 법원이 인가요건을 심리한 뒤 결정합니다.</li>\n          <li>· 실제 양식은 서울회생법원 양식모음·전자소송포털에서 내려받아 그 양식 그대로 작성하세요.</li>\n        </ul>"
  },
  {
    "icon": "📑",
    "name": "소득 변동 증빙 정리표",
    "html": "<p class=\"text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 leading-relaxed\">아래는 <strong>가상 인물의 작성 예시</strong>입니다. 실제 양식의 항목·순서는 관할 법원의 최신 양식을 기준으로 하고, 내용은 반드시 본인의 실제 상황을 사실대로 적어야 합니다.</p>\n        <p class=\"text-xs text-slate-500 mb-2\">상황별로 어떤 서류를 어디서 받는지 정리한 표입니다. 변경 신청·특별면책 어느 쪽으로 가더라도 그대로 쓰입니다.</p>\n        <div class=\"overflow-x-auto\"><table class=\"w-full text-xs border-collapse\">\n          <tr><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">상황</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">증빙 서류</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">발급처</th></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">실직 (해고·권고사직)</td><td class=\"border border-slate-200 px-2 py-1.5\">퇴직증명서, 고용보험 자격상실 이력, 해고 통지서</td><td class=\"border border-slate-200 px-2 py-1.5\">회사 / 고용24(ei.go.kr)</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">실업급여 수급 중</td><td class=\"border border-slate-200 px-2 py-1.5\">수급자격 인정 확인서, 수급 내역</td><td class=\"border border-slate-200 px-2 py-1.5\">고용24 / 고용센터</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">이직·급여 감소</td><td class=\"border border-slate-200 px-2 py-1.5\">새 근로계약서, 변경 전후 급여명세서</td><td class=\"border border-slate-200 px-2 py-1.5\">회사</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">질병·부상</td><td class=\"border border-slate-200 px-2 py-1.5\">진단서(근로 곤란 취지), 입퇴원확인서, 진료비 영수증</td><td class=\"border border-slate-200 px-2 py-1.5\">병원</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">폐업</td><td class=\"border border-slate-200 px-2 py-1.5\">폐업사실증명원</td><td class=\"border border-slate-200 px-2 py-1.5\">홈택스 / 세무서</td></tr>\n        </table></div>\n        <ul class=\"text-xs text-slate-600 mt-3 space-y-1 leading-relaxed\">\n          <li>· 증빙은 \"언제부터, 왜, 얼마나\" 소득이 줄었는지를 보여줄 수 있어야 합니다.</li>\n          <li>· 회생위원과 통화하기 전에 이 표 기준으로 서류를 모아두면 상담이 빨라집니다.</li>\n        </ul>"
  },
  {
    "icon": "🕊️",
    "name": "특별면책 신청 서면",
    "html": "<p class=\"text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 leading-relaxed\">아래는 <strong>가상 인물의 작성 예시</strong>입니다. 실제 양식의 항목·순서는 관할 법원의 최신 양식을 기준으로 하고, 내용은 반드시 본인의 실제 상황을 사실대로 적어야 합니다.</p>\n        <p class=\"text-xs text-slate-500 mb-2\">사례: 24회차까지 납입 후 중병으로 근로가 불가능해진 경우 — 요건 3가지에 하나씩 대응하는 구조입니다.</p>\n        <div class=\"bg-white border border-slate-200 rounded-xl p-4 text-xs text-slate-700 leading-relaxed space-y-3\">\n          <p class=\"font-bold text-sm text-slate-800 text-center\">면책(특별면책) 신청서</p>\n          <p>사건번호: 20○○개회○○○○<br>채무자(신청인): 김 ○ 민</p>\n          <div>\n            <p class=\"font-semibold mb-1\">1. 책임질 수 없는 사유 (요건 ①)</p>\n            <p>채무자는 인가된 변제계획에 따라 24회차까지 성실히 납입하여 왔으나, 20○○. ○. 위암 진단을 받고 수술·항암치료로 근로가 불가능해져(진단서·소견서 첨부) 더 이상 변제를 계속할 수 없게 되었습니다.</p>\n          </div>\n          <div>\n            <p class=\"font-semibold mb-1\">2. 면책결정일까지의 실제 변제액과 파산 시 배당액 비교 (요건 ②)</p>\n            <p>현재까지 회생위원 계좌에 납입한 금액은 25,474,968원(월 1,061,457원 × 24회)입니다. 이 금액이 개인회생채권자에게 배분된 내역과 면책결정일까지 추가 배분될 금액은 회생위원 자료로 확인합니다. 별도로 채무자가 파산절차를 신청했을 때 개인회생채권자가 배당받을 금액을 산정·소명해 비교합니다. 위 납입총액이 신청 당시 재산목록의 청산가치를 넘는다는 사정만으로 요건 ② 충족을 단정하지 않습니다.</p>\n          </div>\n          <div>\n            <p class=\"font-semibold mb-1\">3. 변제계획 변경이 불가능한 사정 (요건 ③)</p>\n            <p>채무자는 치료로 인해 소득 활동이 전면 중단되어 변제계획을 변경하더라도 이행할 수 없는 상태이므로, 변제계획의 변경으로는 해결이 불가능합니다.</p>\n          </div>\n          <div>\n            <p class=\"font-semibold mb-1\">첨부서류</p>\n            <p>1. 진단서 및 소견서 / 2. 채권자별 변제·배분 내역 / 3. 파산 시 배당액 비교자료 / 4. 수입·지출에 관한 목록(현재 기준)</p>\n          </div>\n          <p class=\"text-right\">20○○. ○. ○.<br>위 채무자 김 ○ 민 (서명 또는 날인)<br>○○법원 귀중</p>\n        </div>\n        <ul class=\"text-xs text-slate-600 mt-3 space-y-1 leading-relaxed\">\n          <li>· 요건 3가지(제624조 제2항)에 <strong>하나씩 번호를 붙여 대응</strong>하되, 요건 충족 여부는 법원이 제출자료와 이해관계인 의견을 바탕으로 판단합니다.</li>\n          <li>· 개인회생절차가 <strong>종료되기 전</strong>에 신청해야 합니다.</li>\n          <li>· 제624조 제3항의 불허사유와 비면책채권 등 예외도 담당 법원 또는 전문가에게 확인하세요.</li>\n        </ul>"
  }
];
