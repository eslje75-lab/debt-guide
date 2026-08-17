-- 점수·등급 기반 절차 판정을 폐지한 뒤 남은 구버전 파생데이터를 제거한다.
-- 원 입력(diagnosis_data), 중립적 참고 계산(diagnosis_repay), 진단일자는 보존한다.
DELETE FROM user_data
 WHERE key IN ('diagnosis_scores', 'diagnosis_levels');
