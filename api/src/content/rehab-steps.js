/* 유료 개인회생 본문. 공개 HTML에 복사하지 말 것.
+ * rehabilitation.html은 1단계 무료 미리보기만 가지며, 나머지는 Worker의 명시적 open 계약으로 제공한다.
+ */

export const STEPS = [
  {
    "title": "2단계 · 채권자 목록 작성",
    "items": [
      {
        "id": "r2-1",
        "text": "전체 채권자(금융사) 목록 작성",
        "hint": "은행·카드사·캐피탈·저축은행·대부업체 포함",
        "must": "필수",
        "guide": "기억에만 의존하면 반드시 빠지는 채권자가 생깁니다. 아래 무료 조회로 전체를 확인하세요.\n① 크레딧포유(한국신용정보원) — 내 대출·카드·보증·연체 내역 통합조회\n② 어카운트인포(계좌정보통합관리서비스) — 전 금융기관 계좌·대출 조회\n③ 온크레딧(한국자산관리공사) — 캠코·국민행복기금으로 넘어간 오래된 채무 조회\n조회 결과에 나오는 금융회사 전부가 채권자입니다. 채권이 추심회사로 매각되었다면 \"현재 채권을 가진 회사\" 기준으로 적습니다.",
        "links": [
          {
            "label": "크레딧포유",
            "url": "https://www.credit4u.or.kr"
          },
          {
            "label": "어카운트인포",
            "url": "https://www.payinfo.or.kr"
          },
          {
            "label": "온크레딧",
            "url": "https://www.oncredit.or.kr"
          }
        ],
        "ex": {
          "title": "채권자 전체 확인 정리 예시",
          "content": "[신용정보 조회 결과를 표로 정리]\n\n① ○○은행 | 신용대출 | 조회 잔액 18,540,000원\n② △△카드 | 카드론 | 조회 잔액 12,680,000원\n③ □□캐피탈 | 신용대출 | 조회 잔액 8,210,000원\n④ ◇◇저축은행 | 신용대출 | 조회 잔액 7,260,000원\n⑤ (개인) 친구 이○○ | 차용금 | 3,000,000원 ← 조회에 안 나오므로 직접 추가\n\n※ 조회 화면을 캡처·저장해 두면 이후 부채증명서 발급과 대조할 때 편리합니다."
        }
      },
      {
        "id": "r2-2",
        "text": "채권자별 금액·발생일 정리 (원금/이자 구분)",
        "hint": "부채증명서 기준 — 발급은 서류 체크센터",
        "must": "필수",
        "guide": "채권자목록에는 각 채권의 원금과 이자를 나누어 적고, \"채권의 원인\"란에 발생일과 종류(예: 2022. 3. 15.자 대출금)를 기재합니다. 금액·발생일의 근거가 되는 부채증명서(대출잔액증명서)의 발급 방법은 서류 체크센터에 정리돼 있습니다. 신청일과 가까운 기준일로 발급받아야 금액 차이로 인한 보정을 줄일 수 있습니다.",
        "links": [
          {
            "label": "숫자 검산기 — 채권자목록 합계 확인",
            "url": "numcheck.html?proc=rehab&tab=creditor"
          },
          {
            "label": "채무 서류 발급 — 서류 체크센터",
            "url": "documents.html"
          }
        ]
      },
      {
        "id": "r2-3",
        "text": "사채·개인 간 채무 별도 정리",
        "hint": "채권자 실명·금액·발생 경위 포함",
        "must": "해당 시 필수",
        "guide": "지인·가족·사채 등 개인 간 채무도 채권자목록에 반드시 포함해야 합니다. 목록에서 빠진 채권은 개인회생의 효력(면책)을 받지 못하므로, 알리기 부담스러워도 누락하면 본인만 손해입니다. 목록에 올리면 법원이 그 채권자에게도 서류를 보냅니다.\n차용증이 없으면 계좌이체 내역, 문자·메신저 대화 등으로 금액과 경위를 정리해 두세요.",
        "ex": {
          "title": "개인 간 채무 정리 예시",
          "content": "[개인 채권자 정리]\n\n채권자: 이○○ (지인)\n주소: ○○시 ○○구 ○○로 ○○ (송달 가능한 주소)\n금액: 3,000,000원\n발생 경위: 2024. 8. 생활비 부족으로 차용, 매월 20만원씩 갚기로 구두 약정\n증빙: 2024. 8. 12. 계좌이체 내역(3,000,000원 입금), 카카오톡 대화 캡처\n\n※ 차용증이 없어도 이체내역·대화 기록으로 소명할 수 있습니다.\n※ 개인 채권자에게도 법원 서류가 송달되므로 주소를 정확히 적어야 합니다."
        }
      }
    ],
    "example": {
      "title": "채권자 목록 작성 예시",
      "content": "채권자명 | 채무종류 | 잔액 | 최초발생일\n○○은행 | 신용대출 | 18,542,000원 | 2022.03.15\n△△카드 | 카드론 | 12,680,000원 | 2023.06.10\n□□캐피탈 | 신용대출 | 8,214,000원 | 2024.02.05\n◇◇저축은행 | 신용대출 | 7,264,000원 | 2025.11.10\n\n※ 목록에서 누락된 채권은 개인회생의 효력(면책)을 받지 못함 → 개인 간 채무까지 반드시 모두 포함\n※ 전체 서식 예시는 상단 \"실전 서류 작성예시 → 개인회생채권자목록\"에서 확인"
    }
  },
  {
    "title": "3단계 · 소득 정리",
    "items": [
      {
        "id": "r3-1",
        "text": "평균 월 소득 산정 및 정리",
        "hint": "최근 3~12개월 세후 평균",
        "must": "필수",
        "guide": "세후 기준 최근 3~12개월 평균(법원 실무에 따라 기간이 다름)으로 월평균 소득을 계산합니다. 이 숫자가 수입·지출 목록과 변제계획안의 \"월평균 소득\"이 되므로, 증빙 서류의 숫자와 정확히 일치해야 합니다.\n급여명세서·원천징수영수증·소득금액증명 등 소득 증빙의 발급 방법은 서류 체크센터에 정리돼 있습니다.",
        "links": [
          {
            "label": "소득 서류 발급 — 서류 체크센터",
            "url": "documents.html"
          }
        ]
      },
      {
        "id": "r3-2",
        "text": "근로소득 외 소득이 있으면 함께 반영",
        "hint": "임대·프리랜서·플랫폼 수입 등",
        "must": "해당 시 필수",
        "guide": "임대소득은 임대차계약서, 프리랜서·배달 등 플랫폼 수입은 정산내역서와 입금내역으로 증빙해 월평균에 포함합니다. 수입이 일정하지 않으면 최근 여러 달의 평균으로 정리하세요."
      }
    ],
    "example": {
      "title": "소득 정리 예시",
      "content": "[급여명세서 내용 정리]\n2026년 2월: 세후 실수령 2,600,000원\n2026년 3월: 세후 실수령 2,600,000원\n2026년 4월: 세후 실수령 2,600,000원\n\n3개월 평균 실수령: 2,600,000원\n\n※ 소득 증빙 서류의 발급 방법은 서류 체크센터 참고. 급여명세서가 없으면 고용주 확인서·계좌 입금내역으로 대체 가능한지 확인."
    }
  },
  {
    "title": "4단계 · 재산·청산가치 정리",
    "items": [
      {
        "id": "r4-1",
        "text": "보유 재산 전체 목록화 (빠짐없이)",
        "hint": "예금·보증금·보험·차량·부동산·퇴직금 등",
        "must": "필수",
        "guide": "예금·임차보증금·보험 해약환급금·차량·부동산 등 모든 재산을 시가 기준으로 빠짐없이 적습니다. 퇴직급여는 일반 퇴직금·법정 퇴직연금·공무원 퇴직급여 등 종류별 보호 범위가 다르므로 예상액 자료를 받아 법원 양식 기준으로 반영합니다. 각 재산 증빙 서류의 발급 방법은 서류 체크센터에 정리돼 있습니다.\n소액이라도 누락하면 보정이나 변제계획 심사에 영향을 줄 수 있습니다.",
        "links": [
          {
            "label": "재산 서류 발급 — 서류 체크센터",
            "url": "documents.html"
          }
        ]
      },
      {
        "id": "r4-2",
        "text": "재산목록 합계와 청산가치 자료 확인",
        "hint": "현재가치 계산은 법원 공식 양식으로",
        "must": "필수",
        "guide": "재산목록 합계는 청산가치 산정의 출발점입니다. 면제재산·담보·환가비용 등 때문에 단순 합계와 법원이 평가하는 청산가치는 다를 수 있습니다. 또한 법 제614조의 비교는 인가결정일 기준 현재가치로 하므로 월 변제액×횟수의 명목합계만으로 충족 여부를 단정하지 말고 법원 공식 변제계획안 계산을 따르세요.",
        "links": [
          {
            "label": "숫자 검산기 — 재산 합계·명목 납부합계 확인",
            "url": "numcheck.html?proc=rehab&tab=plan"
          }
        ]
      }
    ],
    "example": {
      "title": "재산·청산가치 정리 예시",
      "content": "[재산 목록]\n① 예금·현금: 370,000원\n② 임차보증금: 5,000,000원\n③ 보험 해약환급금: 890,000원\n④ 퇴직급여: 종류와 예상액·보호 범위를 확인해 반영\n⑤ 부동산·자동차: 없음\n──────────────\n입력 재산 합계: 법원 양식에 따라 계산\n\n※ 이 합계는 청산가치 산정의 기초일 뿐입니다. 면제재산·담보 등을 반영한 청산가치와 변제액의 인가시점 현재가치는 법원 공식 양식으로 확인하세요."
    }
  },
  {
    "title": "5단계 · 수입·지출 정리",
    "items": [
      {
        "id": "r5-1",
        "text": "월 수입·지출 명세서 작성",
        "hint": "법원 양식 기준",
        "must": "필수",
        "guide": "법원 공식 「수입 및 지출에 관한 목록」에 세후 월평균 수입과 실제 지출을 증빙에 맞춰 적습니다. 이 사이트가 보여 주는 기준중위소득 60% 차액은 기계적 참고값일 뿐, 법원이 인정한 가용소득이나 월 변제액이 아닙니다. 초과 생계비는 항목별 사유와 증빙을 법원이 확인합니다.",
        "ex": {
          "title": "수입·지출 계산 구조",
          "content": "월평균 소득(세후) 2,600,000원\n− 기준중위소득 60% 참고값 1,538,543원 (2026년 1인 가구)\n──────────────────\n= 60% 기준 월 잔여소득 1,061,457원\n\n※ 실제 제출용 생계비·가용소득은 부양가족 인정, 초과 생계비 증빙과 법원 심사에 따라 달라집니다. 전체 서식 예시는 상단 「실전 서류 작성예시 → 수입·지출에 관한 목록」에서 확인하세요."
        },
        "links": [
          {
            "label": "숫자 검산기 — 가용소득 계산",
            "url": "numcheck.html?proc=rehab&tab=income"
          }
        ]
      },
      {
        "id": "r5-2",
        "text": "생계비 항목별 정리 (주거·식비·교통·의료 등)",
        "hint": "실제 지출 기준 작성",
        "must": "필수",
        "guide": "기준중위소득 60%는 개인회생 생계비 산정의 실무상 출발점입니다(2026년 1인 가구 약 154만원, 2인 가구 약 252만원). 실제 지출의 초과분은 의료비·주거비 등 사유와 증빙을 제출해 법원의 확인을 받아야 하므로 자동 인정되는 금액으로 표시하지 않습니다."
      },
      {
        "id": "r5-3",
        "text": "부양가족 생활비 포함 여부 확인",
        "hint": "부양가족 수 기준",
        "must": "필수",
        "guide": "실제로 부양하는 가족만 포함합니다. 배우자에게 충분한 소득이 있으면 부양가족으로 인정되지 않을 수 있습니다. 가족관계증명서의 가족 구성과 맞아야 합니다."
      },
      {
        "id": "r5-4",
        "text": "기준중위소득 60% 참고값과 추가 생계비 자료 확인",
        "hint": "신청 연도 참고값·실제 부양관계·추가 지출 증빙 확인",
        "must": "권장",
        "guide": "기준중위소득 60%는 생계비 검토의 출발점으로 쓰이는 참고값이며 법원이 인정할 금액을 자동 확정하지 않습니다. 신청 연도의 값과 함께 실제 부양관계, 주거비·의료비 등 추가 지출 사유와 증빙을 확인하세요."
      }
    ],
    "example": {
      "title": "수입·지출 예시",
      "content": "[월 수입·지출 명세]\n■ 수입\n - 근로소득(세후): 2,600,000원\n\n■ 실제 지출\n - 주거비(월세+관리비): 500,000원\n - 식비: 400,000원\n - 교통비: 120,000원\n - 통신비: 60,000원\n - 의료비: 40,000원\n - 기타생활비: 180,000원\n 합계: 1,300,000원\n\n■ 기준중위소득 60% 참고값: 1,538,543원 (2026년 1인 가구)\n■ 60% 기준 월 잔여소득: 1,061,457원\n\n※ 이 값은 법원이 인정한 가용소득·월 변제액이 아닙니다. 실제 제출값은 증빙과 개별 심사에 따라 달라집니다."
    }
  },
  {
    "title": "6단계 · 신청서류 작성",
    "items": [
      {
        "id": "r6-1",
        "text": "개인회생 신청서 (법원 양식)",
        "hint": "법원 양식 다운로드 후 작성",
        "must": "필수",
        "guide": "반드시 법원 양식을 사용하세요. 서울회생법원 양식모음 또는 전자소송포털 절차안내에서 최신 양식 파일을 무료로 내려받을 수 있습니다. 법원마다 양식이 조금씩 달라, 접수할 관할 법원의 양식을 쓰는 것이 가장 안전합니다.\n신청서에는 인적사항, 소득 형태(급여소득자/영업소득자), 신청 취지·원인을 기재합니다.",
        "links": [
          {
            "label": "서울회생법원 양식모음",
            "url": "https://slb.scourt.go.kr/rel/information/min/MinListAction.work?gubun=25"
          },
          {
            "label": "전자소송포털 절차안내",
            "url": "https://ecfs.scourt.go.kr/psp/index.on?m=PSPA17M01"
          }
        ]
      },
      {
        "id": "r6-2",
        "text": "채권자 목록 작성",
        "hint": "양식에 맞게 전체 채권자 기재",
        "must": "필수",
        "guide": "부채증명서를 옆에 두고 채권자별로 원금/이자를 나누어 옮겨 적습니다. 목록에서 누락된 채권은 개인회생의 효력(면책)을 받지 못하므로 개인 간 채무까지 전부 적으세요.\n제출 시 부본(복사본)이 \"채권자 수 + 2통\" 필요합니다. 각 채권자의 주소(금융회사는 부채증명서에 적힌 주소)도 기재합니다.",
        "ex": {
          "title": "채권자목록 → 실전 예시로 확인",
          "content": "전체 서식 형태의 예시는 페이지 상단 \"실전 서류 작성예시 → 개인회생채권자목록\" 버튼에서 표 형태로 확인할 수 있습니다.\n\n핵심 규칙\n① 원금과 이자를 나누어 기재\n② \"채권의 원인\"란에 발생 날짜와 종류 기재 (예: 2022. 3. 15.자 대출금)\n③ 개인 간 채무 포함, 누락 금지\n④ 부본은 채권자 수 + 2통"
        }
      },
      {
        "id": "r6-3",
        "text": "재산목록 작성",
        "hint": "모든 재산 빠짐없이 기재",
        "must": "필수",
        "guide": "모든 재산을 시가 기준으로 빠짐없이 적습니다. 재산목록은 청산가치 산정의 기초이며, 면제재산·담보 등과 변제액의 인가시점 현재가치를 법원 공식 양식에서 함께 확인합니다. 재산을 누락하면 보정이나 변제계획 심사에 영향을 줄 수 있습니다."
      },
      {
        "id": "r6-4",
        "text": "수입·지출 명세서 작성",
        "hint": "법원 양식 기준",
        "must": "필수",
        "guide": "5단계에서 정리한 수입·지출을 법원 양식 칸에 맞춰 옮겨 적습니다. 소득 증빙 서류의 숫자와 일치해야 하며, 다르면 보정 대상이 됩니다."
      },
      {
        "id": "r6-5",
        "text": "변제계획안 초안 작성",
        "hint": "월 가용소득 × 36~60개월",
        "must": "필수",
        "guide": "통상 36회 계획이 많이 사용되지만 법은 3년을 최단기간으로 정한 것이 아니라 원칙적 상한으로 정합니다. 특별한 사정이 있으면 최대 5년까지 정할 수 있습니다(채무자회생법 제611조). 총변제액의 청산가치 요건은 인가시점 현재가치로 심사되므로 명목합계만으로 판단하지 말고 공식 양식을 사용하세요.\n변제계획안은 신청일부터 14일 안에 내면 되지만 실무에서는 신청서와 함께 제출합니다.",
        "ex": {
          "title": "변제계획안 → 실전 예시로 확인",
          "content": "완성된 형태의 예시는 페이지 상단 \"실전 서류 작성예시 → 변제계획안\" 버튼에서 확인할 수 있습니다.\n\n핵심 구조\n① 변제 재원: 법원이 인정한 가용소득\n② 변제기간: 통상 36회 이내, 특별한 사정 시 최대 60회\n③ 청산가치 요건: 인가시점 현재가치로 법원 공식 양식에서 확인\n④ 각 채권자 배당: 채권의 성질과 법원 양식에 따라 작성"
        },
        "links": [
          {
            "label": "숫자 검산기 — 변제계획안 검산",
            "url": "numcheck.html?proc=rehab&tab=plan"
          }
        ]
      },
      {
        "id": "r6-6",
        "text": "진술서 또는 채무 발생 경위서 작성",
        "hint": "사실대로 구체적으로 작성",
        "must": "필수",
        "guide": "언제·왜 빚이 늘었는지 시간 순서대로, 사실대로 적습니다. 직업·경력, 채무가 늘어난 경위, 갚기 어려워진 시점과 사정을 구체적인 날짜·금액과 함께 정리하세요. 판사가 사건을 이해하는 핵심 서류이며, 꾸미거나 숨기면 보정·불인가 사유가 됩니다.",
        "ex": {
          "title": "진술서 → 실전 예시로 확인",
          "content": "완성된 형태의 예시는 페이지 상단 \"실전 서류 작성예시 → 진술서(채무 발생 경위)\" 버튼에서 확인할 수 있습니다.\n\n작성 순서 틀\n① 학력·경력 (연도순)\n② 채무가 늘어난 경위 (연도순, 금액 포함)\n③ 갚기 어려워진 시점과 사정\n④ 현재 상황"
        }
      }
    ],
    "example": {
      "title": "신청서 작성 주의사항",
      "content": "[개인회생 신청서 주요 확인사항]\n✓ 채무자 인적사항 정확 기재\n✓ 채권자 전원 누락 없이 기재\n✓ 채무금액은 신청일 기준 최신 잔액\n✓ 재산은 과소 신고하지 않도록 주의\n✓ 수입·지출 명세는 실제 기준으로 작성\n✓ 변제계획안은 실제 변제 가능한 금액 기준\n✓ 모든 서류에 서명·날인\n\n※ 법원 양식은 서울회생법원 양식모음·전자소송포털에서 무료 다운로드 가능"
    }
  },
  {
    "title": "7단계 · 제출 전 최종 체크",
    "items": [
      {
        "id": "r7-0",
        "text": "서류끼리 숫자가 맞는지 대조",
        "hint": "보정권고가 가장 많이 나오는 지점",
        "must": "필수",
        "guide": "개인회생 서류는 서로 물려 있습니다 — 채권자목록의 채권액 합계는 변제계획안의 확정채권액 합계와 같아야 하고, 수입·지출에서 계산한 가용소득은 변제계획안의 월 변제액과 같아야 합니다. 서류를 하나씩 따로 보면 이 어긋남이 보이지 않고, 그대로 내면 보정권고를 받습니다.\n숫자 검산기의 「서류 간 대조」에 앞 단계에서 계산한 값을 넣으면 한 번에 맞춰 볼 수 있습니다.",
        "links": [
          {
            "label": "숫자 검산기 — 서류 간 대조",
            "url": "numcheck.html?proc=rehab&tab=cross"
          }
        ]
      },
      {
        "id": "r7-1",
        "text": "모든 양식 서명·날인 확인",
        "hint": "서명 누락 시 반려",
        "must": "필수",
        "guide": "서류마다 서명·날인 칸의 위치가 다릅니다. 제출 전 전체 서류를 한 장씩 넘기며 빈 서명칸이 없는지 확인하세요."
      },
      {
        "id": "r7-2",
        "text": "첨부서류 전체 목록 대조 확인",
        "hint": "목록 작성 후 하나씩 대조",
        "must": "필수",
        "guide": "\"신청서 + 첨부서류\" 목록을 종이에 쓰고 하나씩 대조하세요. 부채증명서·등본처럼 발급일이 있는 서류는 유효기간(신청일 기준 2개월 이내 원칙)도 함께 확인합니다."
      },
      {
        "id": "r7-3",
        "text": "서류 1부 복사 보관",
        "hint": "제출 전 반드시 사본 보관",
        "must": "권장",
        "guide": "제출한 서류 전체를 복사하거나 사진·스캔으로 보관하세요. 보정권고가 왔을 때 \"내가 뭘 제출했는지\"를 알아야 정확하게 대응할 수 있습니다."
      },
      {
        "id": "r7-4",
        "text": "인지대·송달료 금액 확인",
        "hint": "법원 홈페이지 또는 접수창구 문의",
        "must": "필수",
        "guide": "스스로 진행하면 변호사·법무사 수임료 없이 법원 비용만 듭니다. 인지대 30,000원(전자소송으로 접수하면 27,000원), 송달료는 1회 5,640원(2026. 7. 1. 기준) × (10회분 + 채권자 수 × 8회분)으로 채권자 수에 비례해 늘어납니다(접수 시 자동 계산). 송달료 단가는 우편요금에 연동돼 바뀌므로 접수 시점 금액을 확인하세요. 외부 회생위원이 선임되면 예납금(통상 15만원)이 추가될 수 있으나 서울회생법원 등 다수 법원은 내부 회생위원이라 없는 경우가 많습니다.\n비용 마련이 어려우면 법원에 소송구조를 신청해 유예·면제받을 수 있습니다. 전자소송으로 접수하면 화면에서 자동 계산되어 온라인 결제할 수 있습니다.\n미리 총액을 알아보시려면 숫자 검산기의 「법원 비용」 탭에 채권자 수를 넣어 보세요.",
        "links": [
          {
            "label": "숫자 검산기 — 법원 비용 계산",
            "url": "numcheck.html?proc=rehab&tab=cost"
          }
        ]
      },
      {
        "id": "r7-5",
        "text": "제출 법원 확인 (주민등록상 주소지 관할)",
        "hint": "이 페이지 하단 \"내 관할법원 찾기\" 이용",
        "must": "필수",
        "guide": "개인회생은 주민등록상 주소지 관할 법원(지방법원 본원 또는 회생법원)에만 제출할 수 있습니다 — 지원(支院)은 접수하지 않습니다(춘천지법 강릉지원만 예외). 2026. 3.부터 회생법원이 서울·수원·부산·대전·대구·광주 6곳으로 늘었습니다.\n이 페이지 하단의 \"내 관할법원 찾기\"에서 거주 지역을 선택하면 관할법원을 확인할 수 있고, 전자소송으로 접수하면 자동 안내됩니다. 잘못 내면 이송 절차로 시간이 걸립니다."
      },
      {
        "id": "r7-6",
        "text": "(압류·추심이 급한 경우) 중지·금지명령 신청서 준비",
        "hint": "신청서와 동시 제출 가능",
        "must": "해당 시 권장",
        "guide": "급여·통장 압류나 심한 추심이 진행 중이면 개인회생 신청서와 함께 중지명령(진행 중인 강제집행을 멈춤)·금지명령(새로운 강제집행·추심을 막음) 신청서를 제출할 수 있습니다(채무자회생법 제593조). 법원이 명령을 내리면 그때부터 중단되며, 이후 개시결정이 나면 별도 명령 없이도 자동으로 중지됩니다(제600조). 법원 양식모음에서 신청서 양식을 내려받아 사건 내용·압류 현황을 적어 제출하세요."
      }
    ],
    "example": {
      "title": "제출 전 최종 체크리스트",
      "content": "[법원 접수 전 최종 점검]\n□ 개인회생 신청서 원본 1부 (+부본 1부)\n□ 채권자 목록 (원본 1부 + 채권자 수 + 2통의 부본)\n□ 재산목록 원본 1부\n□ 수입·지출 명세서 원본 1부\n□ 변제계획안 원본 1부\n□ 진술서 원본 1부\n□ 주민등록등본 1통\n□ 가족관계증명서(상세) 1통\n□ 소득증명서류\n□ 부채증명서 (채권자별)\n□ 재산증명서류\n□ 인지대·송달료 납부 영수증\n\n※ 법원에 따라 추가 서류 요청 가능"
    }
  },
  {
    "title": "8단계 · 법원 접수 후 보정 대응",
    "items": [
      {
        "id": "r8-1",
        "text": "접수증 수령 및 사건번호 확인",
        "hint": "이후 모든 연락에 사건번호 필요",
        "must": "필수",
        "guide": "접수하면 사건번호가 부여됩니다. 이후 보정서 제출, 전화 문의, 진행 조회가 모두 사건번호 기준이니 사진을 찍어 보관하세요. \"대법원 나의사건검색\"에서 진행 상황을 조회할 수 있습니다."
      },
      {
        "id": "r8-2",
        "text": "보정권고 수신 여부 확인 (우편·전자소송)",
        "hint": "정기적으로 확인 필수",
        "must": "필수",
        "guide": "보정권고는 대부분의 사건에서 나오는 정상적인 절차이니 당황할 필요 없습니다. 전자소송 이용 시 알림이 오고, 우편 수령이면 등본상 주소로 옵니다. 확인이 늦으면 기한을 넘기게 되니 우편함과 전자소송을 주기적으로 확인하세요."
      },
      {
        "id": "r8-3",
        "text": "보정기한 내 추가자료 제출",
        "hint": "기한 초과 시 신청 기각 가능",
        "must": "필수",
        "guide": "보정 기한은 통상 1~2주로 짧습니다. 자주 나오는 보정: 신청 직전 1년 이내 대출금의 사용처 소명, 지출 증빙, 부채증명서 기준일 갱신 등. 기한 안에 준비가 어려우면 미리 법원에 기한 연장을 문의하세요.",
        "ex": {
          "title": "대출금 사용내역 → 실전 예시로 확인",
          "content": "가장 자주 나오는 보정인 \"대출금 사용처 소명\"의 작성 예시는 페이지 상단 \"실전 서류 작성예시 → 대출금 사용내역서\" 버튼에서 표 형태로 확인할 수 있습니다.\n\n핵심 규칙\n① 대출 입금일부터 시간 순서로, 사용처를 구체적으로\n② 이체내역·영수증 등 증빙을 최대한 첨부\n③ 현금 인출은 인출 사유와 사용처를 설명\n④ 소명하지 못한 금액은 재산(청산가치)으로 계산되어 변제금이 늘 수 있음"
        }
      },
      {
        "id": "r8-4",
        "text": "개시결정 후 변제계획 인가 절차 진행",
        "hint": "법원 안내에 따라 진행",
        "must": "필수",
        "guide": "개시결정이 나면 채권자 이의기간 등을 거쳐 변제계획 인가 여부가 결정됩니다. 법원·회생위원의 안내문에 따라 진행하면 되고, 요청 자료는 기한 내에 제출하세요."
      },
      {
        "id": "r8-5",
        "text": "회생위원 임치계좌로 변제금 입금 시작",
        "hint": "통상 개시결정 후부터 임치 시작 — 법원·회생위원 안내에 따름",
        "must": "필수",
        "guide": "통상 개시결정 후부터 회생위원이 지정한 임치계좌로 매달 입금을 시작합니다. 미납이 쌓이면 절차가 폐지(중단)될 수 있으니, 급여일 직후로 자동이체를 걸어두는 것이 안전합니다."
      },
      {
        "id": "r8-6",
        "text": "회생위원 면담 준비 (기일·연락 통지 시)",
        "hint": "사건번호·소득 증빙 지참, 채무 경위 답변 준비",
        "must": "해당 시 필수",
        "guide": "접수 후 회생위원이 면담(또는 전화·서면 확인)을 진행하는 경우가 있습니다. 사건번호, 신분증, 최근 소득 증빙(급여명세서·입금내역), 생활비 지출 자료를 준비하고, 자주 묻는 내용 — ① 채무가 늘어난 경위 ② 현재 소득과 직장 ③ 월 생활비 내역 ④ 변제 가능 금액 — 을 진술서 내용과 어긋나지 않게 답변할 수 있도록 정리해 두세요. 제출 서류와 답변이 다르면 보정·소명 요구로 이어질 수 있습니다."
      },
      {
        "id": "r8-7",
        "text": "개인회생채권자집회 기일 확인·출석",
        "hint": "개시결정문에 기일 기재 — 불출석 시 불이익 가능",
        "must": "해당 시 필수",
        "guide": "개시결정이 나면 개인회생채권자집회 기일이 함께 지정되어 결정문에 기재됩니다. 채권자의 이의 여부를 확인하고 변제계획안 인가로 나아가는 절차입니다. 특별한 사정 없이 불출석하면 절차상 불이익을 받을 수 있으니 기일에 출석하세요(법원에 따라 서면·비대면으로 갈음하는 경우도 있으니 안내문을 확인). 채권자가 이의를 제기하면 회생위원·법원 안내에 따라 변제계획안을 수정하거나 소명하면 됩니다."
      }
    ],
    "example": {
      "title": "보정권고 대응 예시",
      "content": "[보정권고가 왔을 때 대처 방법]\n\n1. 보정권고서에서 요구하는 항목 확인\n   예: \"◇◇저축은행 대출금 7,000,000원의 사용처를 소명하시기 바랍니다\"\n\n2. 요구 자료를 기한 내에 준비\n   - 기한: 통상 1~2주\n\n3. 보정서 양식에 사건번호·성명 기재 후 제출\n   - 법원 접수 창구 또는 전자소송으로 제출 가능\n\n※ 보정권고는 흔한 절차입니다. 당황하지 말고 차분히 대응하세요."
    }
  }
];

export const DOC_EXAMPLES = [
  {
    "icon": "📋",
    "name": "개인회생채권자목록",
    "html": "<p class=\"text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 leading-relaxed\">아래는 <strong>가상 인물의 작성 예시</strong>입니다. 실제 양식의 항목·순서는 관할 법원의 최신 양식을 기준으로 하고, 내용은 반드시 본인의 실제 상황을 사실대로 적어야 합니다.</p>\n        <p class=\"text-xs text-slate-500 mb-2\">부채증명서의 숫자를 그대로 옮겨, 원금과 이자를 나누어 적습니다.</p>\n        <div class=\"overflow-x-auto\"><table class=\"w-full text-xs border-collapse\">\n          <tr><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">번호</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">채권자 (주소)</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">채권의 원인</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700 text-right\">원금</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700 text-right\">이자</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700 text-right\">합계</th></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">1</td><td class=\"border border-slate-200 px-2 py-1.5\">○○은행<br><span class=\"text-slate-400\">(서울 중구 ○○로 ○○)</span></td><td class=\"border border-slate-200 px-2 py-1.5\">2022. 3. 15.자<br>대출금(신용)</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">18,000,000</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">542,000</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">18,542,000</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">2</td><td class=\"border border-slate-200 px-2 py-1.5\">△△카드<br><span class=\"text-slate-400\">(서울 ○○구 ○○로 ○○)</span></td><td class=\"border border-slate-200 px-2 py-1.5\">2023. 6. 10.자<br>카드론</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">12,300,000</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">380,000</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">12,680,000</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">3</td><td class=\"border border-slate-200 px-2 py-1.5\">□□캐피탈<br><span class=\"text-slate-400\">(부산 ○○구 ○○로 ○○)</span></td><td class=\"border border-slate-200 px-2 py-1.5\">2024. 2. 5.자<br>대출금(신용)</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">8,000,000</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">214,000</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">8,214,000</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">4</td><td class=\"border border-slate-200 px-2 py-1.5\">◇◇저축은행<br><span class=\"text-slate-400\">(서울 ○○구 ○○로 ○○)</span></td><td class=\"border border-slate-200 px-2 py-1.5\">2025. 11. 10.자<br>대출금(신용)</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">7,000,000</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">264,000</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">7,264,000</td></tr>\n          <tr class=\"font-semibold bg-slate-50\"><td class=\"border border-slate-200 px-2 py-1.5\" colspan=\"3\">합계</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">45,300,000</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">1,400,000</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">46,700,000</td></tr>\n        </table></div>\n        <ul class=\"text-xs text-slate-600 mt-3 space-y-1 leading-relaxed\">\n          <li>· 금액은 <strong>부채증명서 발급일 기준 잔액</strong>을 그대로 적습니다.</li>\n          <li>· 지인 등 <strong>개인 간 채무도 반드시 포함</strong> — 목록에서 빠진 채권은 면책되지 않습니다.</li>\n          <li>· 채권자 주소는 부채증명서에 적힌 주소(금융회사 본점 등)를 그대로 적습니다.</li>\n          <li>· 제출 시 부본(복사본)이 <strong>채권자 수 + 2통</strong> 필요합니다.</li>\n        </ul>"
  },
  {
    "icon": "🏠",
    "name": "재산목록",
    "html": "<p class=\"text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 leading-relaxed\">아래는 <strong>가상 인물의 작성 예시</strong>입니다. 실제 양식의 항목·순서는 관할 법원의 최신 양식을 기준으로 하고, 내용은 반드시 본인의 실제 상황을 사실대로 적어야 합니다.</p>\n        <p class=\"text-xs text-slate-500 mb-2\">재산 종류별 금액과 증빙을 정리한 예시입니다. 입력 합계만으로 정확한 청산가치나 인가 여부가 정해지지는 않습니다.</p>\n        <div class=\"overflow-x-auto\"><table class=\"w-full text-xs border-collapse\">\n          <tr><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">재산 항목</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">내용</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700 text-right\">금액(원)</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">증빙</th></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">현금</td><td class=\"border border-slate-200 px-2 py-1.5\">보유 현금</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">50,000</td><td class=\"border border-slate-200 px-2 py-1.5\">—</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">예금</td><td class=\"border border-slate-200 px-2 py-1.5\">○○은행 보통예금</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">320,000</td><td class=\"border border-slate-200 px-2 py-1.5\">잔액증명서</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">보험</td><td class=\"border border-slate-200 px-2 py-1.5\">□□생명 종신보험 해약환급금</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">890,000</td><td class=\"border border-slate-200 px-2 py-1.5\">환급금 조회서</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">임차보증금</td><td class=\"border border-slate-200 px-2 py-1.5\">△△빌라 월세 보증금</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">5,000,000</td><td class=\"border border-slate-200 px-2 py-1.5\">임대차계약서</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">퇴직급여</td><td class=\"border border-slate-200 px-2 py-1.5\">제도 종류·예상액과 보호 범위를 공식 양식 기준으로 확인</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">별도 확인</td><td class=\"border border-slate-200 px-2 py-1.5\">예상액 증명서</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">부동산 / 자동차</td><td class=\"border border-slate-200 px-2 py-1.5\">없음</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">0</td><td class=\"border border-slate-200 px-2 py-1.5\">—</td></tr>\n          <tr class=\"font-semibold bg-slate-50\"><td class=\"border border-slate-200 px-2 py-1.5\" colspan=\"2\">입력 재산 합계</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">6,260,000</td><td class=\"border border-slate-200 px-2 py-1.5\">—</td></tr>\n        </table></div>\n        <ul class=\"text-xs text-slate-600 mt-3 space-y-1 leading-relaxed\">\n          <li>· 퇴직급여는 종류별 보호 범위가 다릅니다. 일반 퇴직금·법정 퇴직연금·공무원 퇴직급여를 구분해 법원 양식 기준으로 반영하세요.</li>\n          <li>· 담보가 잡힌 재산은 담보채무를 뺀 실제 가치를 적습니다.</li>\n          <li>· 소액이라도 누락하면 불인가·변제금 증액 사유가 될 수 있습니다.</li>\n        </ul>"
  },
  {
    "icon": "💰",
    "name": "수입·지출에 관한 목록",
    "html": "<p class=\"text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 leading-relaxed\">아래는 <strong>가상 인물의 작성 예시</strong>입니다. 실제 양식의 항목·순서는 관할 법원의 최신 양식을 기준으로 하고, 내용은 반드시 본인의 실제 상황을 사실대로 적어야 합니다.</p>\n        <div class=\"overflow-x-auto\"><table class=\"w-full text-xs border-collapse\">\n          <tr><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\" colspan=\"2\">1. 수입 (세후 월평균)</th></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">근로소득 — (주)○○물류 (2021. 4. 입사, 재직 중)</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">2,600,000</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">기타 소득</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">없음</td></tr>\n          <tr><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\" colspan=\"2\">2. 지출 (월)</th></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">주거비(월세 400,000 + 관리비 100,000)</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">500,000</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">식비</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">400,000</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">교통비 / 통신비</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">180,000</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">의료비 / 기타</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">220,000</td></tr>\n          <tr class=\"bg-slate-50\"><td class=\"border border-slate-200 px-2 py-1.5 font-semibold\">실제 지출 합계</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap font-semibold\">1,300,000</td></tr>\n          <tr><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\" colspan=\"2\">3. 가용소득 계산</th></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">60% 기본 참고값 (1인 가구, 2026)</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">1,538,543</td></tr>\n          <tr class=\"bg-blue-50\"><td class=\"border border-slate-200 px-2 py-1.5 font-semibold text-blue-800\">60% 기준 월 잔여소득 (2,600,000 − 1,538,543)</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap font-semibold text-blue-800\">1,061,457</td></tr>\n        </table></div>\n        <ul class=\"text-xs text-slate-600 mt-3 space-y-1 leading-relaxed\">\n          <li>· 가구원 입력은 참고용입니다. 실제 부양가족 인정 여부는 관계·소득·부양 사실과 증빙을 법원이 확인합니다.</li>\n          <li>· 실제 지출이 표준생계비보다 많으면 초과 사유(의료비 등)와 증빙을 첨부해야 합니다.</li>\n          <li>· 소득 숫자는 급여명세서·원천징수영수증 등 <strong>증빙 서류와 정확히 일치</strong>해야 합니다.</li>\n        </ul>"
  },
  {
    "icon": "✍️",
    "name": "진술서 (채무 발생 경위)",
    "html": "<p class=\"text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 leading-relaxed\">아래는 <strong>가상 인물의 작성 예시</strong>입니다. 실제 양식의 항목·순서는 관할 법원의 최신 양식을 기준으로 하고, 내용은 반드시 본인의 실제 상황을 사실대로 적어야 합니다.</p>\n        <div class=\"bg-white border border-slate-200 rounded-xl p-4 text-xs text-slate-700 leading-relaxed space-y-3\">\n          <p class=\"font-bold text-sm text-slate-800 text-center\">진 술 서</p>\n          <div>\n            <p class=\"font-semibold mb-1\">1. 학력 및 경력</p>\n            <p>저는 2007년 ○○고등학교를 졸업하고 물류회사 등에서 근무해 왔습니다. 2021년 4월부터 현재까지 (주)○○물류에서 사무직으로 재직 중이며, 월 실수령 급여는 약 260만원입니다.</p>\n          </div>\n          <div>\n            <p class=\"font-semibold mb-1\">2. 채무가 늘어난 경위</p>\n            <p>2022년 3월, 부친의 암 수술비와 간병비를 마련하기 위해 ○○은행에서 1,800만원을 대출받았습니다. 이후 매달 상환액이 급여의 상당 부분을 차지하면서 생활비가 부족해졌고, 2023년 6월 △△카드 카드론 1,230만원, 2024년 2월 □□캐피탈 800만원을 순차로 대출받아 기존 대출 상환과 생활비에 사용했습니다.</p>\n            <p class=\"mt-1\">2025년 11월에는 연체를 막기 위해 ◇◇저축은행에서 700만원을 추가 대출받았으나, 이자 부담이 월 90만원을 넘어서면서 더 이상 정상 상환이 불가능하다고 판단하였습니다.</p>\n          </div>\n          <div>\n            <p class=\"font-semibold mb-1\">3. 지급이 어려워진 사정</p>\n            <p>2026년 1월부터 ◇◇저축은행 대출의 상환이 연체되기 시작하였고, 현재 총 채무 원리금은 약 4,670만원으로 월 급여로는 이자조차 감당하기 어려운 상태입니다. 도박·투기나 사치성 소비로 발생한 채무는 없습니다.</p>\n          </div>\n          <div>\n            <p class=\"font-semibold mb-1\">4. 현재 상황</p>\n            <p>현재 월세 보증금 500만원의 주거지에서 혼자 생활하며 근로소득으로 생계를 유지하고 있습니다. 가용소득 전액을 변제에 제공하여 성실히 변제할 것을 다짐하며, 개인회생절차 개시를 신청합니다.</p>\n          </div>\n          <p class=\"text-right\">2026. ○. ○.<br>진술인(채무자) 김 ○ 민 (서명 또는 날인)</p>\n        </div>\n        <ul class=\"text-xs text-slate-600 mt-3 space-y-1 leading-relaxed\">\n          <li>· <strong>시간 순서 + 구체적 날짜·금액</strong>이 핵심입니다. 각 대출이 \"왜, 어디에\" 쓰였는지 밝히세요.</li>\n          <li>· 사실대로 작성해야 합니다 — 허위·과장 기재는 불인가 사유가 됩니다.</li>\n          <li>· 진술서의 대출 시점·금액은 채권자목록과 서로 맞아야 합니다.</li>\n        </ul>"
  },
  {
    "icon": "📅",
    "name": "변제계획안",
    "html": "<p class=\"text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 leading-relaxed\">아래는 <strong>가상 인물의 작성 예시</strong>입니다. 실제 양식의 항목·순서는 관할 법원의 최신 양식을 기준으로 하고, 내용은 반드시 본인의 실제 상황을 사실대로 적어야 합니다.</p>\n        <div class=\"bg-white border border-slate-200 rounded-xl p-4 text-xs text-slate-700 leading-relaxed space-y-3\">\n          <p class=\"font-bold text-sm text-slate-800 text-center\">변 제 계 획 안</p>\n          <div>\n            <p class=\"font-semibold mb-1\">1. 변제에 제공되는 소득</p>\n            <p>채무자는 급여소득자로서, 월평균 소득 2,600,000원에서 생계비 1,538,543원을 공제한 <strong>월 가용소득 1,061,457원 전액</strong>을 변제에 제공한다.</p>\n          </div>\n          <div>\n            <p class=\"font-semibold mb-1\">2. 변제기간 및 방법</p>\n            <p>변제기간은 <strong>36개월(총 36회)</strong>로 하고, 매월 회생위원이 지정하는 임치계좌에 1,061,457원씩 입금하는 방법으로 변제한다.</p>\n          </div>\n          <div>\n            <p class=\"font-semibold mb-1\">3. 개인회생재단채권 등의 변제</p>\n            <p>회생위원 보수 등 개인회생재단채권은 일반 개인회생채권에 우선하여 전액 변제한다. (양식의 표준 문구)</p>\n          </div>\n          <div>\n            <p class=\"font-semibold mb-1\">4. 일반 개인회생채권의 변제 (채권액 비율대로 안분)</p>\n            <div class=\"overflow-x-auto\"><table class=\"w-full text-xs border-collapse mt-1\">\n              <tr><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">채권자</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700 text-right\">확정채권액(원)</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700 text-right\">비율</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700 text-right\">월 배당액(약)</th></tr>\n              <tr><td class=\"border border-slate-200 px-2 py-1.5\">○○은행</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">18,542,000</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">39.70%</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">421,398</td></tr>\n              <tr><td class=\"border border-slate-200 px-2 py-1.5\">△△카드</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">12,680,000</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">27.15%</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">288,186</td></tr>\n              <tr><td class=\"border border-slate-200 px-2 py-1.5\">□□캐피탈</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">8,214,000</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">17.59%</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">186,710</td></tr>\n              <tr><td class=\"border border-slate-200 px-2 py-1.5\">◇◇저축은행</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">7,264,000</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">15.56%</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">165,163</td></tr>\n              <tr class=\"font-semibold bg-slate-50\"><td class=\"border border-slate-200 px-2 py-1.5\">합계</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">46,700,000</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">100%</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">1,061,457</td></tr>\n            </table></div>\n          </div>\n          <div>\n            <p class=\"font-semibold mb-1\">5. 청산가치 보장</p>\n            <p>36개월 명목 납부합계는 38,212,452원(1,061,457원 × 36회)이다. 이 단순 곱셈만으로 청산가치 요건 충족 여부를 판단할 수 없으며, 법원 공식 양식에서 인가시점 현재가치와 정확한 청산가치를 확인한다.</p>\n          </div>\n        </div>\n        <ul class=\"text-xs text-slate-600 mt-3 space-y-1 leading-relaxed\">\n          <li>· 법원 양식에 표준 문구가 인쇄되어 있어 실제로는 <strong>숫자 칸을 채우는 방식</strong>에 가깝습니다.</li>\n          <li>· 통상 36회 계획이 많이 사용되지만 3년은 법정 최단기간이 아니라 원칙적 상한이며, 특별한 사정이 있으면 최대 5년입니다(제611조).</li>\n          <li>· 청산가치 요건은 인가시점 현재가치로 심사되므로 명목합계만으로 인가 여부를 단정하거나 기간을 임의로 조정하지 마세요.</li>\n        </ul>"
  },
  {
    "icon": "🧾",
    "name": "대출금 사용내역서 (보정 대비)",
    "html": "<p class=\"text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 leading-relaxed\">아래는 <strong>가상 인물의 작성 예시</strong>입니다. 실제 양식의 항목·순서는 관할 법원의 최신 양식을 기준으로 하고, 내용은 반드시 본인의 실제 상황을 사실대로 적어야 합니다.</p>\n        <p class=\"text-xs text-slate-500 mb-2\">신청 직전 1년 이내에 받은 대출은 법원이 \"어디에 썼는지\"를 소명하라고 요구하는 경우가 많습니다(보정권고). ◇◇저축은행 대출 700만원의 사용내역 예시입니다.</p>\n        <div class=\"overflow-x-auto\"><table class=\"w-full text-xs border-collapse\">\n          <tr><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">일자</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">구분</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700 text-right\">금액(원)</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">사용처·내용</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">증빙</th></tr>\n          <tr class=\"bg-blue-50\"><td class=\"border border-slate-200 px-2 py-1.5\">2025.11.10</td><td class=\"border border-slate-200 px-2 py-1.5\">입금</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">+7,000,000</td><td class=\"border border-slate-200 px-2 py-1.5\">◇◇저축은행 대출금 입금</td><td class=\"border border-slate-200 px-2 py-1.5\">통장 거래내역</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">2025.11.10</td><td class=\"border border-slate-200 px-2 py-1.5\">지출</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">−3,200,000</td><td class=\"border border-slate-200 px-2 py-1.5\">△△카드 연체대금 상환</td><td class=\"border border-slate-200 px-2 py-1.5\">이체확인증</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">2025.11.12</td><td class=\"border border-slate-200 px-2 py-1.5\">지출</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">−1,350,000</td><td class=\"border border-slate-200 px-2 py-1.5\">밀린 월세 3개월분 (집주인 정○○)</td><td class=\"border border-slate-200 px-2 py-1.5\">이체내역, 임대차계약서</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">2025.11.20</td><td class=\"border border-slate-200 px-2 py-1.5\">지출</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">−480,000</td><td class=\"border border-slate-200 px-2 py-1.5\">부친 병원비 (○○병원)</td><td class=\"border border-slate-200 px-2 py-1.5\">진료비 영수증</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">2025.11.~2026.1.</td><td class=\"border border-slate-200 px-2 py-1.5\">지출</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">−1,970,000</td><td class=\"border border-slate-200 px-2 py-1.5\">생활비 (식비·교통·공과금, 4회 분할 인출)</td><td class=\"border border-slate-200 px-2 py-1.5\">출금내역, 가계부 정리</td></tr>\n          <tr class=\"font-semibold bg-slate-50\"><td class=\"border border-slate-200 px-2 py-1.5\" colspan=\"2\">사용 합계</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">7,000,000</td><td class=\"border border-slate-200 px-2 py-1.5\" colspan=\"2\">입금액과 일치</td></tr>\n        </table></div>\n        <ul class=\"text-xs text-slate-600 mt-3 space-y-1 leading-relaxed\">\n          <li>· 입금액과 사용 합계가 <strong>끝까지 맞아떨어지게</strong> 정리하는 것이 핵심입니다.</li>\n          <li>· 현금 인출분은 인출 날짜·사유를 설명하고 가계부·영수증으로 뒷받침하세요.</li>\n          <li>· 소명하지 못한 금액은 재산(청산가치)으로 계산되어 변제금이 늘 수 있습니다.</li>\n          <li>· 미리 이 표를 만들어 두면 보정권고가 와도 1~2일 안에 대응할 수 있습니다.</li>\n        </ul>"
  }
];
