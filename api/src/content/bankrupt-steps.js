/* bankrupt-full 유료 콘텐츠 — 2단계 이후 본문과 서식 예시 라이브러리.
   🔴 정적 파일(bankruptcy.html)에 두면 결제 없이 curl 한 번으로 전문이 읽힌다(2026-08-16 보안감사).
      그래서 원본을 여기로 옮겼고, Worker가 이용권을 확인한 뒤에만 내려준다.
      **이 파일을 bankruptcy.html로 되돌리지 말 것.**

   1단계는 여기 없다 — 미리보기로 공개하는 범위이고, 그 범위가 전상법 시행령 제21조의2 제1호의
   '일부 이용을 허용한 콘텐츠'에 해당해 환불 제한의 근거가 된다. 경계를 옮기면 그 근거도 함께 흔들린다.

   콘텐츠를 고치면 화면이 아니라 **Worker가 배포돼야 반영된다**(api/** 변경이므로 push 시 자동 배포).
   항목을 추가·삭제하면 bankruptcy.html의 BANKRUPT_STEPS_SKELETON(제목·항목 id)도 함께 고칠 것 —
   로드맵과 진행률이 그 뼈대를 쓴다. */

export const STEPS = [
    {
      "title": "2단계 · 채무 발생 경위 정리",
      "items": [
        {
          "id": "b2-1",
          "text": "채무 발생 원인·경위 상세 서술 작성",
          "hint": "사업실패·의료비·실직 등 구체적으로 기술",
          "must": "필수",
          "guide": "진술서의 핵심 부분입니다. 언제, 무엇 때문에(사업 실패·실직·질병·보증 등) 빚이 생겼고, 왜 갚을 수 없게 되었는지를 시간 순서대로 구체적인 날짜·금액과 함께 적습니다. 판사가 면책 여부를 판단하는 기초 자료입니다.",
          "ex": {
            "title": "진술서 → 실전 예시로 확인",
            "content": "완성된 형태의 예시는 페이지 상단 \"실전 서류 작성예시 → 진술서\" 버튼에서 확인할 수 있습니다.\n\n작성 순서 틀 (법원 양식 기준)\n① 학력·경력 (다니던 직장을 순서대로)\n② 현재까지의 생활상황\n③ 파산신청에 이르게 된 사정 (시간 순서, 금액 포함)\n④ 과거 개인회생·파산 이용 이력, 면책받은 이력\n⑤ 각 내용을 증명할 서류 첨부"
          }
        },
        {
          "id": "b2-2",
          "text": "채무 발생 시기별 타임라인 정리",
          "hint": "언제 어떤 이유로 채무가 증가했는지",
          "must": "필수",
          "guide": "연도별로 \"시기 → 사건 → 채무 변화\"를 표로 정리해 두면 진술서 작성이 쉬워집니다. 진술서·채권자목록의 날짜와 서로 맞아야 신뢰를 얻습니다."
        },
        {
          "id": "b2-3",
          "text": "면책불허가 사유 해당 여부 자체 점검",
          "hint": "도박·낭비·허위신고 등 해당 여부 확인",
          "must": "필수",
          "guide": "도박·과도한 낭비, 신청 직전 재산 처분·은닉, 특정 채권자에게만 갚기(편파변제), 허위 기재가 대표적인 불허가 사유입니다. 해당 사항이 있다면 숨기지 말고 먼저 전문가 상담을 받으세요 — 숨겼다가 드러나는 것이 가장 나쁜 경우입니다."
        },
        {
          "id": "b2-4",
          "text": "채무 증가 관련 증빙자료 수집",
          "hint": "입원확인서·사업관련 서류 등",
          "must": "권장",
          "guide": "폐업사실증명원(홈택스 발급), 진단서·입퇴원확인서, 해고통지서·고용보험 이력 등 경위를 뒷받침하는 서류를 모아두세요. 증빙이 있으면 심리가 빨라지고 보정이 줄어듭니다.",
          "links": [
            {
              "label": "국세청 홈택스",
              "url": "https://www.hometax.go.kr"
            }
          ]
        }
      ],
      "example": {
        "title": "채무 발생 경위 작성 예시",
        "content": "[채무 발생 경위 예시]\n\n2020년 10월: 코로나로 인한 사업 매출 급감\n2021년 3월: 직원 급여 지급을 위해 사업자 대출 2천만원 실행\n2021년 9월: 사업체 폐업 (매출 부재)\n2022년 1월~현재: 실직 상태로 생활비 충당을 위한 추가 대출\n\n현재 소득: 없음 (구직 활동 중)\n현재 채무: 약 ○천만원\n\n※ 사실에 기반하여 성실하게 작성해야 합니다.\n   허위 또는 과장 기재 시 면책불허가 사유가 됩니다."
      }
    },
    {
      "title": "3단계 · 채권자 목록 준비",
      "items": [
        {
          "id": "b3-1",
          "text": "전체 채권자 목록 작성 (개인 포함)",
          "hint": "금융기관·사채·개인 간 채무 모두 포함",
          "must": "필수",
          "guide": "기억에만 의존하지 말고 무료 조회로 전체를 확인하세요.\n① 크레딧포유(한국신용정보원) — 대출·카드·보증·연체 통합조회\n② 어카운트인포 — 전 금융기관 계좌·대출 조회\n③ 온크레딧 — 캠코·국민행복기금으로 넘어간 오래된 채무 조회\n지인·가족 등 개인 간 채무도 반드시 포함하세요. 알면서 일부러 목록에 적지 않은 채권은 면책되지 않습니다(채무자회생법 제566조).",
          "links": [
            {
              "label": "숫자 검산기 — 채권자목록 합계 확인",
              "url": "numcheck.html?proc=bankrupt&tab=creditor"
            },
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
            "title": "채권자목록 → 실전 예시로 확인",
            "content": "전체 서식 형태의 예시는 페이지 상단 \"실전 서류 작성예시 → 채권자목록\" 버튼에서 표 형태로 확인할 수 있습니다.\n\n핵심 규칙\n① 금융회사·개인 채권자 모두 포함 — 고의 누락 채권은 면책 제외\n② 채권자 주소 기재 (법원이 서류를 보냄)\n③ 잔액은 부채증명서 기준\n④ 채권이 매각되었으면 현재 채권을 가진 회사 기준"
          }
        },
        {
          "id": "b3-2",
          "text": "각 채권자 채무금액 최신 확인",
          "hint": "부채증명서 기준 — 발급은 서류 체크센터",
          "must": "필수",
          "guide": "채권자별 잔액은 \"파산 신청용(법원 제출용) 부채증명서\"를 기준으로 정리합니다(연체 이자까지 포함된 잔액). 부채증명서의 발급 방법은 서류 체크센터에 정리돼 있으며, 채권이 추심회사로 넘어갔다면 그 회사에서 발급받습니다.",
          "links": [
            {
              "label": "채무 서류 발급 — 서류 체크센터",
              "url": "documents.html"
            }
          ]
        },
        {
          "id": "b3-3",
          "text": "담보 채무 유무 확인 및 담보목적물 정리",
          "hint": "담보물에 대한 별도 처리 필요",
          "must": "해당 시 필수",
          "guide": "주택담보대출·자동차할부처럼 담보가 잡힌 채무는 채권자가 담보물에서 먼저 회수하고, 모자란 부분만 파산채권이 됩니다. 목록에 담보 내용(담보물·설정액)을 표시하세요."
        },
        {
          "id": "b3-4",
          "text": "세금·벌금 등 비면책 채무 별도 정리",
          "hint": "세금·벌금·과태료는 면책 대상 아님",
          "must": "필수",
          "guide": "세금·건강보험료, 벌금·과태료, 고의 불법행위 손해배상, 양육비 등은 면책결정을 받아도 사라지지 않습니다. 홈택스·위택스·건보공단에서 체납액을 확인해 별도로 정리하고, 면책 후 납부(분납) 계획을 세워두세요."
        }
      ],
      "example": {
        "title": "파산 채권자 목록 예시",
        "content": "[채권자 목록 예시]\n\n1. ○○은행 | 사업자 신용대출 | 잔액 32,000,000원\n2. △△신용보증재단 | 구상금 | 잔액 15,000,000원\n3. □□카드 | 카드론·일시불 | 잔액 11,400,000원\n4. ◇◇카드 | 카드론 | 잔액 7,000,000원\n5. ▽▽저축은행 | 신용대출 | 잔액 12,000,000원\n6. 김○○ (지인) | 차용금 | 잔액 10,000,000원 ← 개인 간 채무도 반드시 포함\n\n합계: 87,400,000원 (6건)\n\n[비면책 채무 별도 정리]\n- 국세: ○○만원 (연도별 내역)\n- 지방세: ○○만원\n\n※ 세금·벌금 등은 파산·면책 후에도 소멸되지 않습니다.\n※ 전체 서식 예시는 상단 \"실전 서류 작성예시 → 채권자목록\"에서 확인"
      }
    },
    {
      "title": "4단계 · 재산·처분이력 정리",
      "items": [
        {
          "id": "b4-1",
          "text": "보유 재산 전체 목록화 (빠짐없이)",
          "hint": "예금·보험·차량·부동산·보증금 등",
          "must": "필수",
          "guide": "예금·보험 해약환급금·차량·부동산·임차보증금 등 모든 재산을 시가 기준으로 빠짐없이 신고합니다(소액이라도 전부). 각 재산 증빙 서류의 발급 방법은 서류 체크센터에 정리돼 있습니다. 파산 사건은 최근 1~2년 거래내역서도 요구되는 경우가 많으니, 큰 금액 출금이 있으면 사용처를 설명할 수 있게 준비하세요.",
          "links": [
            {
              "label": "숫자 검산기 — 재산 합계 계산",
              "url": "numcheck.html?proc=bankrupt&tab=plan"
            },
            {
              "label": "재산 서류 발급 — 서류 체크센터",
              "url": "documents.html"
            }
          ]
        },
        {
          "id": "b4-2",
          "text": "재산 처분 이력 확인 (2년 이내)",
          "hint": "편파 변제·재산 은닉 해당 여부 확인",
          "must": "필수",
          "guide": "신청 전 2년 이내에 부동산·차량·보증금 등을 처분하거나 이전한 내역은 편파변제·재산은닉 여부의 판단 대상입니다. 처분 시기·상대방·금액·대금 사용처를 미리 표로 정리해 두면 심문·보정에 바로 대응할 수 있습니다.\n재산 은닉·허위 신고는 파산 취소 및 형사 처벌 사유입니다."
        }
      ],
      "example": {
        "title": "파산 재산 신고 주의사항",
        "content": "[재산 신고 주의]\n\n✓ 소액이라도 모든 재산 신고 필수\n✓ 신청일 기준 전 금융기관 예금 조회\n✓ 보험은 해약환급금 기준으로 신고\n✓ 2년 이내 처분 재산은 별도 서술 필요\n\n[파산재단에 들어가지 않는 재산 (예시)]\n- 압류금지재산: 생계 필수 의류·가구, 월 250만원 이하의 급여채권 등\n  (2026. 2. 시행 민사집행법 시행령 기준 — 금액은 개정될 수 있음)\n- 퇴직금 중 압류금지 부분(1/2)\n- 파산선고 이후 새로 얻는 소득(급여 등)은 원칙적으로 파산재단에 포함되지 않음\n\n※ 재산 은닉·허위 신고는 파산 취소 및 형사 처벌 가능"
      }
    },
    {
      "title": "5단계 · 소득·생활상황 정리",
      "items": [
        {
          "id": "b5-1",
          "text": "최근 3개월 소득 현황 정리",
          "hint": "없으면 없음으로 기재",
          "must": "필수",
          "guide": "소득이 없으면 \"없음\"으로 사실대로 적습니다. 일용직·아르바이트 수입, 구직급여·기초생활수급 등 공적 급여도 모두 수입으로 기재하세요. 무직 기간은 고용보험 피보험자격 이력(고용24)으로 증명할 수 있습니다.",
          "links": [
            {
              "label": "숫자 검산기 — 수입·지출 계산",
              "url": "numcheck.html?proc=bankrupt&tab=income"
            },
            {
              "label": "고용보험(고용24)",
              "url": "https://www.ei.go.kr"
            }
          ]
        },
        {
          "id": "b5-2",
          "text": "월 생활비 지출 내역 정리",
          "hint": "주거·식비·의료비 등 실제 기준",
          "must": "필수",
          "guide": "법원 양식 \"수입 및 지출에 관한 목록\"에 맞춰 실제 지출을 항목별로 정리합니다. 수입보다 지출이 많다면 그 차액을 어떻게 메우고 있는지(가족 도움 등)도 설명할 수 있어야 합니다.",
          "ex": {
            "title": "수입·지출 목록 → 실전 예시로 확인",
            "content": "완성된 형태의 예시는 페이지 상단 \"실전 서류 작성예시 → 수입·지출에 관한 목록\" 버튼에서 확인할 수 있습니다."
          }
        },
        {
          "id": "b5-3",
          "text": "부양가족 현황 정리",
          "hint": "가족관계증명서 기준",
          "must": "필수",
          "guide": "함께 사는 가족과 각자의 수입 유무를 정리합니다. 가족관계증명서·등본의 세대 구성과 일치해야 합니다."
        },
        {
          "id": "b5-4",
          "text": "취업 가능성·건강상태 기술",
          "hint": "현재 상태를 솔직하게 기재",
          "must": "필수",
          "guide": "\"현재의 생활상황\" 서면에 들어가는 내용입니다. 질병·장애가 있으면 진단서 등 증빙을 첨부하고, 근로 능력이 있다면 구직 노력도 사실대로 적습니다."
        }
      ],
      "example": {
        "title": "소득·생활상황 작성 예시",
        "content": "[현재 소득 및 생활상황]\n\n■ 소득: 없음 (2024년 ○월 이후 무직)\n   - 배우자 소득: 월 약 1,200,000원 (식당 파트타임)\n\n■ 월 생활비:\n   - 주거비 (월세+관리비): 500,000원\n   - 식비: 400,000원\n   - 의료비: 150,000원 (허리 수술 후 통원 치료)\n   - 통신비: 70,000원\n   - 공과금 등: 80,000원\n   합계: 1,200,000원\n\n■ 건강상태: 2024년 ○월 허리 수술 후 지속 통원 (진단서 첨부)\n\n※ 실제 상황을 있는 그대로 기재해야 합니다."
      }
    },
    {
      "title": "6단계 · 파산 및 면책 신청서류 작성",
      "items": [
        {
          "id": "b6-1",
          "text": "파산 신청서 작성 (법원 양식)",
          "hint": "법원 양식 다운로드 후 작성",
          "must": "필수",
          "guide": "\"파산 및 면책 동시신청서\" 양식 하나로 파산과 면책을 함께 신청하는 것이 일반적입니다. 서울회생법원 양식모음 또는 전자소송포털에서 최신 양식을 내려받으세요. 관할 법원별로 양식이 조금 다를 수 있으니 접수할 법원 양식을 쓰는 것이 안전합니다.",
          "links": [
            {
              "label": "서울회생법원 양식모음",
              "url": "https://slb.scourt.go.kr/rel/information/min/MinListAction.work?gubun=24"
            },
            {
              "label": "전자소송포털 절차안내",
              "url": "https://ecfs.scourt.go.kr/psp/index.on?m=PSPA17M02"
            }
          ],
          "ex": {
            "title": "동시신청서 → 실전 예시로 확인",
            "content": "작성 구성 예시는 페이지 상단 \"실전 서류 작성예시 → 파산·면책 동시신청서\" 버튼에서 확인할 수 있습니다."
          }
        },
        {
          "id": "b6-2",
          "text": "면책 신청서 작성 (동시 신청)",
          "hint": "파산 신청 시 면책 동시 신청 권장",
          "must": "필수",
          "guide": "동시신청서 양식을 쓰면 면책신청서를 따로 낼 필요가 없습니다. 파산만 먼저 신청한 경우에는 면책을 별도로 신청해야 하며 기한이 있으므로, 가급적 동시신청을 이용하고 별도 신청 시에는 법원에 기한을 확인하세요."
        },
        {
          "id": "b6-3",
          "text": "채권자 목록 완성",
          "hint": "누락 없이 전체 기재",
          "must": "필수",
          "guide": "부채증명서 기준 잔액으로 전체 채권자를 적고, 각 채권자의 주소도 기재합니다. 알면서 일부러 누락한 채권은 면책되지 않습니다."
        },
        {
          "id": "b6-4",
          "text": "재산목록 완성",
          "hint": "모든 재산 신고",
          "must": "필수",
          "guide": "현금·예금·보험·보증금·부동산·차량 등 모든 재산을 항목별로 적습니다. 해당 없는 항목은 \"없음\"으로 표시합니다. 재산 은닉·허위 신고는 면책불허가와 형사처벌 사유입니다.",
          "ex": {
            "title": "재산목록 → 실전 예시로 확인",
            "content": "완성된 형태의 예시는 페이지 상단 \"실전 서류 작성예시 → 재산목록\" 버튼에서 확인할 수 있습니다."
          }
        },
        {
          "id": "b6-5",
          "text": "채무자 심문 사항(진술서) 작성",
          "hint": "채무 발생 경위·면책불허가 사유 없음 진술",
          "must": "필수",
          "guide": "학력·경력 → 생활상황 → 파산에 이르게 된 사정 → 과거 회생·파산 이용 이력 순으로, 2단계에서 정리한 경위를 양식 질문에 맞춰 옮겨 적습니다. 심문기일이 열리면 판사가 이 진술서를 바탕으로 질문하므로, 쓴 내용을 스스로 설명할 수 있어야 합니다.",
          "ex": {
            "title": "진술서 → 실전 예시로 확인",
            "content": "완성된 형태의 예시는 페이지 상단 \"실전 서류 작성예시 → 진술서\" 버튼에서 확인할 수 있습니다."
          }
        }
      ],
      "example": {
        "title": "파산·면책 신청서 체크사항",
        "content": "[파산·면책 신청서 작성 체크]\n\n✓ 파산·면책 동시신청서 양식 사용 (별도 신청 가능하나 동시 권장)\n✓ 모든 채권자 빠짐없이 기재 (고의 누락 시 해당 채무 면책 불가)\n✓ 채무 발생 경위 성실 기재\n✓ 면책불허가 사유 해당 없음 여부 명확히 진술\n✓ 신청서에 서명·날인\n\n[법원 제출 서류 세트]\n□ 파산 및 면책 동시신청서\n□ 진술서\n□ 채권자목록 (주소 포함)\n□ 재산목록\n□ 현재의 생활상황\n□ 수입 및 지출에 관한 목록\n□ 첨부 증빙서류 일체 + 부본 1부"
      }
    },
    {
      "title": "7단계 · 제출 전 최종 체크",
      "items": [
        {
          "id": "b7-0",
          "text": "서류끼리 숫자가 맞는지 대조",
          "hint": "금액이 어긋나면 보정 대상",
          "must": "필수",
          "guide": "채권자목록의 채권액 합계, 재산목록의 합계, 수입·지출의 부족분이 서로 어긋나지 않는지 확인합니다. 특히 진술서에 적은 서술(예: \"2022년에 처음 대출받았다\")과 채권자목록의 발생일이 맞는지도 함께 보세요.\n숫자 검산기의 「서류 간 대조」에 앞 단계에서 계산한 값을 넣으면 한 번에 맞춰 볼 수 있습니다.",
          "links": [
            {
              "label": "숫자 검산기 — 서류 간 대조",
              "url": "numcheck.html?proc=bankrupt&tab=cross"
            }
          ]
        },
        {
          "id": "b7-1",
          "text": "서류 전체 서명·날인 확인",
          "hint": "서명 누락 시 반려",
          "must": "필수",
          "guide": "신청서·진술서·목록마다 서명(날인) 칸이 있습니다. 제출 전 한 장씩 넘기며 빈 칸이 없는지 확인하세요."
        },
        {
          "id": "b7-2",
          "text": "첨부서류 목록 대조",
          "hint": "목록 작성 후 하나씩 확인",
          "must": "필수",
          "guide": "제출 서류 목록을 종이에 쓰고 하나씩 대조합니다. 등본·증명서류처럼 발급일이 있는 서류는 너무 오래되지 않았는지(최근 발급분인지)도 확인하세요."
        },
        {
          "id": "b7-3",
          "text": "서류 사본 1부 별도 보관",
          "hint": "제출 전 반드시 복사 보관",
          "must": "권장",
          "guide": "제출 서류 전체를 복사·스캔해 보관하세요. 보정명령이나 심문에서 \"제출한 내용\"을 기준으로 답해야 하므로 사본이 꼭 필요합니다."
        },
        {
          "id": "b7-4",
          "text": "인지대·예납금 확인",
          "hint": "접수 전 법원 확인",
          "must": "필수",
          "guide": "스스로 진행하면 변호사·법무사 수임료 없이 법원 비용만 듭니다. 인지대는 소액(수천 원)이고 송달료는 채권자 수에 비례합니다. 파산관재인이 선임되면 예납금이 별도로 드는데, 서울회생법원 기준 원칙 30만원입니다(사안에 따라 증액될 수 있음).\n예납금이 부담되면 법원에 소송구조를 신청해 유예·면제받을 수 있습니다(재산이 거의 없는 경우 폭넓게 인정). 정확한 금액과 납부 방법은 접수 법원에 확인하세요."
        },
        {
          "id": "b7-5",
          "text": "관할 법원 접수 방법 확인",
          "hint": "직접 방문 또는 전자소송",
          "must": "필수",
          "guide": "법원 접수창구에 직접 제출하거나 전자소송으로 접수할 수 있습니다. 전자소송은 회원가입·공동인증 후 단계별 화면을 따라 입력하면 되고, 이후 법원 통지도 온라인으로 받을 수 있어 편리합니다."
        }
      ],
      "example": {
        "title": "파산 제출 전 최종 체크리스트",
        "content": "[파산 접수 최종 체크]\n□ 파산 및 면책 동시신청서 (원본)\n□ 진술서\n□ 채권자목록 (주소 포함)\n□ 재산목록\n□ 현재의 생활상황\n□ 수입 및 지출에 관한 목록\n□ 주민등록등본 + 초본(주소 변동 포함)\n□ 가족관계증명서(상세) + 혼인관계증명서\n□ 인감증명서\n□ 소득증명 서류 (없으면 무소득 소명)\n□ 재산관련 증빙서류\n□ 부채증명서 (채권자별)\n□ 신청서·첨부서류 부본 1부\n□ 인지대·송달료 납부\n\n※ 법원에 따라 추가 제출 서류 요청 가능"
      }
    },
    {
      "title": "8단계 · 법원 접수 후 보정 대응",
      "items": [
        {
          "id": "b8-1",
          "text": "접수증 및 사건번호 수령",
          "hint": "이후 모든 절차에 사건번호 사용",
          "must": "필수",
          "guide": "접수하면 사건번호가 부여됩니다(파산 사건과 면책 사건에 각각 번호가 부여될 수 있습니다). 보정서 제출·전화 문의·진행 조회가 모두 사건번호 기준이니 사진으로 보관하고, \"대법원 나의사건검색\"으로 진행 상황을 확인하세요."
        },
        {
          "id": "b8-2",
          "text": "파산관재인 선임 여부 확인",
          "hint": "소액파산은 선임 안 될 수 있음",
          "must": "필수",
          "guide": "파산관재인이 선임되면 관재인 사무실에서 면담이 진행되는 것이 일반적입니다. 통장 거래내역·추가 증빙을 요구받으면 기한 내에 제출하고, 면담에는 신분증과 요구 서류를 지참해 사실대로 답하면 됩니다."
        },
        {
          "id": "b8-3",
          "text": "보정명령 수신 확인 및 기한 내 제출",
          "hint": "기한 초과 시 기각 가능",
          "must": "필수",
          "guide": "보정명령은 흔한 절차입니다. 자주 나오는 보정: 통장 거래내역 중 큰 출금의 사용처 소명, 재산 처분 경위, 부채증명서 보완 등. 기한(통상 1~2주) 안에 어려우면 미리 법원에 연장을 문의하세요."
        },
        {
          "id": "b8-4",
          "text": "채무자 심문기일 출석 (지정된 경우)",
          "hint": "기일이 지정되면 반드시 출석 — 불출석 시 기각될 수 있음",
          "must": "필수",
          "guide": "심문기일이 지정되면 반드시 출석해야 합니다. 판사가 진술서를 바탕으로 채무 경위·재산 관계를 질문하므로, 제출한 진술서 사본을 다시 읽고 날짜·금액을 설명할 수 있게 준비하세요. 솔직한 답변이 가장 중요합니다."
        },
        {
          "id": "b8-5",
          "text": "이의신청 기간 대응 및 면책 확정 시점 확인",
          "hint": "이의신청은 면책결정 전 단계 — 확정은 공고일부터 14일(결정문 받은 날이 아니다)",
          "must": "필수",
          "guide": "검사·파산관재인·채권자는 <strong>심문기일부터 30일</strong>(심문기일을 정하지 않은 경우에는 법원이 정하는 날) 이내에 면책에 관한 이의를 신청할 수 있습니다(제562조 제1항). <strong>이의신청은 면책결정이 나기 전 단계</strong>입니다. 통지를 받으면 기한부터 확인하고, 이의 사유(재산 은닉, 낭비·도박, 신용거래로 재산 취득 등 제564조 제1항 각 호)에 대해 사실과 자료로 답할 준비를 하세요. 이의가 있더라도 법원은 파산에 이르게 된 경위 등을 고려해 <strong>재량으로 면책을 허가할 수 있습니다</strong>(제564조 제2항). 면책결정이 나면 그 주문이 공고되고(제564조 제3항), 공고가 있은 날부터 <strong>14일</strong> 이내에 즉시항고가 없으면 확정됩니다(제564조 제4항, 제13조 제2항). 면책결정문 원본은 잘 보관하세요."
        },
        {
          "id": "b8-6",
          "text": "면책 확정 후 남아 있는 압류 해제 신청",
          "hint": "면책이 확정돼도 압류는 자동으로 풀리지 않는다",
          "must": "필수",
          "guide": "<strong>면책이 확정되어도 통장·급여에 걸린 압류가 저절로 해제되지는 않습니다.</strong> 법률효과와 외관 정리를 나눠 보세요 — 파산선고 전에 이미 걸려 있던 강제집행·가압류·가처분은 <strong>면책결정 확정으로 효력을 잃지만</strong>(제557조 제2항), 이미 걸린 압류명령·압류등기가 자동으로 지워지지는 않아 통장·급여가 계속 묶여 있을 수 있습니다. <strong>비면책채권</strong>(세금·양육비 등)에 기한 집행과 <strong>파산선고 뒤 새로 얻은 재산</strong>에 걸린 압류는 이 실효 대상이 아닙니다.\n서울회생법원 안내에 따르면 <strong>압류를 한 집행법원에 먼저 문의한 뒤</strong>, 회생법원에서 <strong>면책결정 정본 · 채권자목록 · 면책결정 확정증명원 등</strong>을 발급받아 집행법원에 해제(집행취소)를 신청해야 합니다. <strong>요구 서류는 집행법원에 따라 다를 수 있으니 문의가 먼저입니다.</strong> 압류가 여러 건이면 각각 신청해야 하니 어느 법원에서 무엇이 걸려 있는지부터 확인하세요. 추심 연락이 계속 오면 같은 서류를 제시하면 됩니다.\n확정증명원은 <strong>항고장이 제출되지 않고 공고일부터 14일이 지나 사건이 확정된 뒤</strong>에 발급받을 수 있습니다. 자세한 안내는 [파산 선고 이후] 페이지에 정리돼 있습니다."
        }
      ],
      "example": {
        "title": "파산 접수 후 절차 안내",
        "content": "[파산 접수 후 주요 절차]\n\n① 접수 → 사건번호 부여 (파산 사건과 면책 사건에 각각 번호가 붙을 수 있음)\n② 보정명령 대응 (흔한 절차)\n③ 파산선고 — 여기서 두 갈래로 갈립니다\n   · 동시폐지 — 나눠 줄 재산이 절차비용에도 못 미치면 선고와 동시에 폐지 (제317조)\n   · 관재인 선임 — 선고와 \"동시에\" 관재인을 선임하고 채권신고기간·제1회 채권자집회·채권조사기일을 함께 정함 (제312조)\n④ (관재인 사건) 관재인 조사·면담 → 채권신고·채권조사 → 재산 환가·배당\n⑤ (관재인 사건) 파산종결 (제530조) 또는 비용부족 파산폐지 (제545조)\n⑥ 면책 심리 — 면책심문기일 또는 이의기간 (제558조·제562조)\n   ※ 심문기일은 지정되지 않는 사건도 있습니다. 이의신청 30일은 심문기일부터 셉니다.\n⑦ 이의가 있으면 채무자와 이의신청인의 의견청취 (제563조)\n⑧ 면책결정 또는 면책불허가\n⑨ 면책 확정 — 허가는 공고일부터 14일 / 불허가·기각·각하는 고지받은 날부터 1주\n⑩ 복권 — 면책이 확정되면 신청 없이 복권 (제574조 제1항 제1호)\n\n※ 선고 이후 구간의 자세한 안내는 [파산 선고 이후] 페이지에 있습니다(무료).\n\n[심문기일 준비 팁]\n- 채무 발생 경위를 간결하게 말할 수 있도록 준비\n- 질문에 솔직하게 답변\n- 추가 서류 요청 시 기한 내 제출\n- 기일에서 다음 날짜가 선고되면 따로 통지가 오지 않을 수 있으니 그 자리에서 적어 둘 것 (제558조 제4항)"
      }
    }
  ];

export const DOC_EXAMPLES = [
    {
      "icon": "📄",
      "name": "파산·면책 동시신청서",
      "html": "<p class=\"text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 leading-relaxed\">아래는 <strong>가상 인물의 작성 예시</strong>입니다. 실제 양식의 항목·순서는 관할 법원의 최신 양식을 기준으로 하고, 내용은 반드시 본인의 실제 상황을 사실대로 적어야 합니다.</p>\n        <p class=\"text-xs text-slate-500 mb-2\">동시신청서 양식 하나로 파산과 면책을 함께 신청합니다. 각 칸에 무엇을 쓰는지 구성으로 보여드립니다.</p>\n        <div class=\"overflow-x-auto\"><table class=\"w-full text-xs border-collapse\">\n          <tr><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700 w-32\">칸</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">작성 내용 (예시)</th></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5 font-medium\">사건명</td><td class=\"border border-slate-200 px-2 py-1.5\">파산 및 면책 (양식에 인쇄되어 있음)</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5 font-medium\">채무자 인적사항</td><td class=\"border border-slate-200 px-2 py-1.5\">박○수 / 740000-0000000 / ○○시 ○○구 ○○로 12, 201호 / 휴대전화 010-0000-0000</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5 font-medium\">신청취지</td><td class=\"border border-slate-200 px-2 py-1.5\">파산선고와 면책허가를 구하는 문구가 양식에 인쇄되어 있어 별도로 쓰지 않는 것이 일반적입니다.</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5 font-medium\">신청이유</td><td class=\"border border-slate-200 px-2 py-1.5\">\"별첨 진술서 기재와 같음\"으로 갈음하고, 상세 내용은 진술서에 적는 방식이 일반적입니다.</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5 font-medium\">첨부서류</td><td class=\"border border-slate-200 px-2 py-1.5\">진술서 / 채권자목록 / 재산목록 / 현재의 생활상황 / 수입·지출에 관한 목록 / 주민등록등본·초본 / 가족·혼인관계증명서 / 부채증명서 등 — 양식의 체크란에 표시</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5 font-medium\">날짜·서명</td><td class=\"border border-slate-200 px-2 py-1.5\">2026. ○. ○. 신청인(채무자) 박○수 (날인)</td></tr>\n        </table></div>\n        <ul class=\"text-xs text-slate-600 mt-3 space-y-1 leading-relaxed\">\n          <li>· 신청서 자체는 짧습니다 — <strong>실질 내용은 진술서와 4가지 목록</strong>(채권자·재산·생활상황·수입지출)에 들어갑니다.</li>\n          <li>· 신청서 및 첨부서류의 <strong>부본(복사본) 1부</strong>를 함께 제출합니다.</li>\n          <li>· 전자소송으로 접수하면 화면 입력 방식이라 종이 양식보다 놓치는 칸이 적습니다.</li>\n        </ul>"
    },
    {
      "icon": "✍️",
      "name": "진술서",
      "html": "<p class=\"text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 leading-relaxed\">아래는 <strong>가상 인물의 작성 예시</strong>입니다. 실제 양식의 항목·순서는 관할 법원의 최신 양식을 기준으로 하고, 내용은 반드시 본인의 실제 상황을 사실대로 적어야 합니다.</p>\n        <div class=\"bg-white border border-slate-200 rounded-xl p-4 text-xs text-slate-700 leading-relaxed space-y-3\">\n          <p class=\"font-bold text-sm text-slate-800 text-center\">진 술 서</p>\n          <div>\n            <p class=\"font-semibold mb-1\">1. 학력 및 경력</p>\n            <p>저는 1992년 ○○고등학교를 졸업한 후 1993년부터 2018년까지 ○○공업사 등에서 생산직으로 근무하였습니다. 2019년 5월 퇴직금과 대출금으로 ○○시 ○○동에서 음식점(백반집)을 개업하여 2022년 8월 폐업 시까지 운영하였습니다. 이후 배달 대행 등 일용 근로를 하다가 2024년 3월 허리 수술(추간판 탈출증) 이후 현재까지 무직 상태입니다.</p>\n          </div>\n          <div>\n            <p class=\"font-semibold mb-1\">2. 현재까지의 생활상황</p>\n            <p>현재 보증금 500만원, 월세 40만원의 주거지에서 배우자와 함께 생활하고 있습니다. 배우자가 식당 파트타임으로 버는 월 약 120만원으로 두 사람의 생계를 유지하고 있으며, 저는 수술 후 통원 치료 중으로 소득이 없습니다.</p>\n          </div>\n          <div>\n            <p class=\"font-semibold mb-1\">3. 파산신청에 이르게 된 사정</p>\n            <p>2019년 5월 음식점 개업 시 ○○은행에서 사업자 대출 3,200만원을 받았습니다. 개업 초기에는 월 매출이 약 900만원으로 운영이 가능했으나, 2020년 3월 이후 코로나19로 매출이 월 300만원 이하로 급감하였습니다. 임차료와 인건비를 마련하기 위해 2020년 9월부터 □□카드 카드론, 2021년 3월 ◇◇카드, 2021년 12월 ▽▽저축은행 대출을 순차로 받았고, 2021년 2월에는 △△신용보증재단이 보증채무를 대신 갚으면서 구상금 채무가 발생하였습니다.</p>\n            <p class=\"mt-1\">2022년 1월에는 지인 김○○에게 1,000만원을 빌려 밀린 임차료를 지급했으나 회복하지 못하고 2022년 8월 폐업하였습니다. 이후 배달 일용 근로로 이자 일부를 갚아왔지만, 2024년 3월 허리 수술로 근로가 어려워지면서 2024년 6월경부터 모든 채무가 연체되었습니다.</p>\n          </div>\n          <div>\n            <p class=\"font-semibold mb-1\">4. 기타 진술</p>\n            <p>도박·투기나 사치로 인한 채무는 없으며, 특정 채권자에게만 변제하거나 재산을 처분·은닉한 사실이 없습니다. 과거에 개인회생·파산 절차를 이용하거나 면책을 받은 사실이 없습니다.</p>\n          </div>\n          <p class=\"text-right\">2026. ○. ○.<br>진술인(채무자) 박 ○ 수 (날인)</p>\n        </div>\n        <ul class=\"text-xs text-slate-600 mt-3 space-y-1 leading-relaxed\">\n          <li>· 실제 양식은 <strong>질문(문항)에 답하는 형식</strong>입니다 — 위 내용을 각 문항에 나누어 적게 됩니다.</li>\n          <li>· 심문기일에 판사가 이 진술서를 바탕으로 질문하므로, 날짜·금액을 본인이 설명할 수 있어야 합니다.</li>\n          <li>· 채권자목록의 채무 발생 시기와 진술서의 시점이 서로 맞아야 합니다.</li>\n        </ul>"
    },
    {
      "icon": "📋",
      "name": "채권자목록",
      "html": "<p class=\"text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 leading-relaxed\">아래는 <strong>가상 인물의 작성 예시</strong>입니다. 실제 양식의 항목·순서는 관할 법원의 최신 양식을 기준으로 하고, 내용은 반드시 본인의 실제 상황을 사실대로 적어야 합니다.</p>\n        <div class=\"overflow-x-auto\"><table class=\"w-full text-xs border-collapse\">\n          <tr><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">번호</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">채권자 (주소)</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">발생 시기·원인</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700 text-right\">잔액(원리금, 원)</th></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">1</td><td class=\"border border-slate-200 px-2 py-1.5\">○○은행<br><span class=\"text-slate-400\">(서울 중구 ○○로 ○○)</span></td><td class=\"border border-slate-200 px-2 py-1.5\">2019. 5. 20. 사업자 신용대출</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">32,000,000</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">2</td><td class=\"border border-slate-200 px-2 py-1.5\">△△신용보증재단<br><span class=\"text-slate-400\">(○○시 ○○구 ○○로 ○○)</span></td><td class=\"border border-slate-200 px-2 py-1.5\">2021. 2. 10. 보증채무 대위변제에 따른 구상금</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">15,000,000</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">3</td><td class=\"border border-slate-200 px-2 py-1.5\">□□카드<br><span class=\"text-slate-400\">(서울 ○○구 ○○로 ○○)</span></td><td class=\"border border-slate-200 px-2 py-1.5\">2020. 9.~ 카드론·일시불</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">11,400,000</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">4</td><td class=\"border border-slate-200 px-2 py-1.5\">◇◇카드<br><span class=\"text-slate-400\">(서울 ○○구 ○○로 ○○)</span></td><td class=\"border border-slate-200 px-2 py-1.5\">2021. 3. 15. 카드론</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">7,000,000</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">5</td><td class=\"border border-slate-200 px-2 py-1.5\">▽▽저축은행<br><span class=\"text-slate-400\">(서울 ○○구 ○○로 ○○)</span></td><td class=\"border border-slate-200 px-2 py-1.5\">2021. 12. 1. 신용대출</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">12,000,000</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">6</td><td class=\"border border-slate-200 px-2 py-1.5\">김○○ (지인)<br><span class=\"text-slate-400\">(○○시 ○○구 ○○로 ○○)</span></td><td class=\"border border-slate-200 px-2 py-1.5\">2022. 1. 10. 차용금 (임차료 지급 목적)</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">10,000,000</td></tr>\n          <tr class=\"font-semibold bg-slate-50\"><td class=\"border border-slate-200 px-2 py-1.5\" colspan=\"3\">합계</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">87,400,000</td></tr>\n        </table></div>\n        <ul class=\"text-xs text-slate-600 mt-3 space-y-1 leading-relaxed\">\n          <li>· 개인 채권자(지인·가족)도 반드시 포함 — <strong>알면서 일부러 누락한 채권은 면책되지 않습니다.</strong></li>\n          <li>· 각 채권자의 주소를 기재해야 법원이 서류를 보낼 수 있습니다.</li>\n          <li>· 잔액은 부채증명서(연체 이자 포함) 기준으로 적습니다.</li>\n          <li>· 세금·벌금 등 면책되지 않는 채무는 별도로 정리해 둡니다.</li>\n        </ul>"
    },
    {
      "icon": "🏠",
      "name": "재산목록",
      "html": "<p class=\"text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 leading-relaxed\">아래는 <strong>가상 인물의 작성 예시</strong>입니다. 실제 양식의 항목·순서는 관할 법원의 최신 양식을 기준으로 하고, 내용은 반드시 본인의 실제 상황을 사실대로 적어야 합니다.</p>\n        <p class=\"text-xs text-slate-500 mb-2\">실제 양식은 재산 종류별로 \"있음/없음\"을 표시하는 항목이 이어집니다. 해당 없는 항목도 \"없음\"으로 표시해야 합니다.</p>\n        <div class=\"overflow-x-auto\"><table class=\"w-full text-xs border-collapse\">\n          <tr><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">재산 항목</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">내용</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700 text-right\">금액(원)</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">증빙</th></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">현금</td><td class=\"border border-slate-200 px-2 py-1.5\">보유 현금</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">30,000</td><td class=\"border border-slate-200 px-2 py-1.5\">—</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">예금</td><td class=\"border border-slate-200 px-2 py-1.5\">○○은행 보통예금</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">187,000</td><td class=\"border border-slate-200 px-2 py-1.5\">잔액증명서·거래내역</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">보험</td><td class=\"border border-slate-200 px-2 py-1.5\">해약환급금 있는 보험 없음 (2023. 9. 실효)</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">0</td><td class=\"border border-slate-200 px-2 py-1.5\">내보험찾아줌 조회 결과</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">임차보증금</td><td class=\"border border-slate-200 px-2 py-1.5\">○○빌라 월세 보증금</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">5,000,000</td><td class=\"border border-slate-200 px-2 py-1.5\">임대차계약서</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">부동산 / 자동차</td><td class=\"border border-slate-200 px-2 py-1.5\">없음</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">0</td><td class=\"border border-slate-200 px-2 py-1.5\">—</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">최근 2년 내 처분 재산</td><td class=\"border border-slate-200 px-2 py-1.5\">없음</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">—</td><td class=\"border border-slate-200 px-2 py-1.5\">—</td></tr>\n          <tr class=\"font-semibold bg-slate-50\"><td class=\"border border-slate-200 px-2 py-1.5\" colspan=\"2\">합계</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">5,217,000</td><td class=\"border border-slate-200 px-2 py-1.5\">—</td></tr>\n        </table></div>\n        <ul class=\"text-xs text-slate-600 mt-3 space-y-1 leading-relaxed\">\n          <li>· 소액이라도 전부 신고 — <strong>은닉·허위 신고는 면책불허가와 형사처벌 사유</strong>입니다.</li>\n          <li>· 최근 2년 내 처분한 재산이 있으면 처분 시기·상대방·대금 사용처를 적습니다.</li>\n          <li>· 통장 거래내역에서 큰 출금이 있으면 사용처를 설명할 수 있어야 합니다.</li>\n        </ul>"
    },
    {
      "icon": "🏡",
      "name": "현재의 생활상황",
      "html": "<p class=\"text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 leading-relaxed\">아래는 <strong>가상 인물의 작성 예시</strong>입니다. 실제 양식의 항목·순서는 관할 법원의 최신 양식을 기준으로 하고, 내용은 반드시 본인의 실제 상황을 사실대로 적어야 합니다.</p>\n        <div class=\"overflow-x-auto\"><table class=\"w-full text-xs border-collapse\">\n          <tr><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700 w-36\">항목</th><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\">작성 내용 (예시)</th></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5 font-medium\">주거</td><td class=\"border border-slate-200 px-2 py-1.5\">○○빌라 201호 — 보증금 5,000,000원 / 월세 400,000원 (임대차계약서 첨부)</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5 font-medium\">동거 가족</td><td class=\"border border-slate-200 px-2 py-1.5\">배우자 이○○ (50세, 식당 파트타임, 월수입 약 1,200,000원)</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5 font-medium\">본인 수입</td><td class=\"border border-slate-200 px-2 py-1.5\">없음 (2024. 3. 허리 수술 이후 무직 — 진단서 첨부)</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5 font-medium\">생계 유지 방법</td><td class=\"border border-slate-200 px-2 py-1.5\">배우자 수입으로 생활비 충당, 부족분은 처가의 도움을 일부 받고 있음</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5 font-medium\">건강 상태</td><td class=\"border border-slate-200 px-2 py-1.5\">추간판 탈출증 수술(2024. 3.) 후 통원 치료 중 — 장시간 서서 일하는 근로 곤란</td></tr>\n        </table></div>\n        <ul class=\"text-xs text-slate-600 mt-3 space-y-1 leading-relaxed\">\n          <li>· 생활상황은 <strong>\"갚을 능력이 없다\"를 사실로 보여주는 서면</strong>입니다 — 과장 없이 그대로 적으세요.</li>\n          <li>· 주거·가족·건강 내용은 등본, 가족관계증명서, 진단서 등 첨부 서류와 일치해야 합니다.</li>\n        </ul>"
    },
    {
      "icon": "💰",
      "name": "수입·지출에 관한 목록",
      "html": "<p class=\"text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 leading-relaxed\">아래는 <strong>가상 인물의 작성 예시</strong>입니다. 실제 양식의 항목·순서는 관할 법원의 최신 양식을 기준으로 하고, 내용은 반드시 본인의 실제 상황을 사실대로 적어야 합니다.</p>\n        <div class=\"overflow-x-auto\"><table class=\"w-full text-xs border-collapse\">\n          <tr><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\" colspan=\"2\">1. 수입 (월)</th></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">본인 수입</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">0</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">배우자 수입 (식당 파트타임)</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">1,200,000</td></tr>\n          <tr class=\"bg-slate-50\"><td class=\"border border-slate-200 px-2 py-1.5 font-semibold\">수입 합계</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap font-semibold\">1,200,000</td></tr>\n          <tr><th class=\"border border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-700\" colspan=\"2\">2. 지출 (월)</th></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">주거비 (월세 400,000 + 관리비 100,000)</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">500,000</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">식비</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">400,000</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">의료비 (허리 수술 후 통원)</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">150,000</td></tr>\n          <tr><td class=\"border border-slate-200 px-2 py-1.5\">통신비 / 공과금</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap\">150,000</td></tr>\n          <tr class=\"bg-slate-50\"><td class=\"border border-slate-200 px-2 py-1.5 font-semibold\">지출 합계</td><td class=\"border border-slate-200 px-2 py-1.5 text-right whitespace-nowrap font-semibold\">1,200,000</td></tr>\n        </table></div>\n        <ul class=\"text-xs text-slate-600 mt-3 space-y-1 leading-relaxed\">\n          <li>· 수입·지출이 빠듯하게 일치하거나 지출이 더 많으면, <strong>부족분을 어떻게 메우는지</strong>(가족 도움 등)를 설명합니다.</li>\n          <li>· 지출 항목은 실제 사용 내역 기준 — 통장 거래내역과 크게 다르면 보정 대상이 됩니다.</li>\n          <li>· 배우자 등 가족의 수입도 가구 생계 설명을 위해 기재합니다.</li>\n        </ul>"
    }
  ];
