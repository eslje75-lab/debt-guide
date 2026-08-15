# D1 운영 DB 백업 — 저장소 바깥으로 내보내고 오래된 덤프를 정리한다.
#
# 사용:  powershell -ExecutionPolicy Bypass -File tools\backup-d1.ps1
#        (챔로드 폴더에서 실행. 다른 위치에 두려면 -Dest 로 지정)
#
# 🔴 덤프에는 회원 이메일·비밀번호 해시·전화번호·민감정보 동의 기록·결제 내역이 들어 있다.
#    ① 저장소 안에 두지 말 것(그 자체가 유출이다. .gitignore가 2차 방어선일 뿐이다)
#    ② 개인정보는 필요한 기간만 보관한다 — 이 스크립트가 오래된 덤프를 자동 삭제한다
# 상세 절차·복구 방법은 BACKUP.md 참조.

# 매개변수
#   -Dest   : 덤프를 둘 폴더(저장소 바깥이어야 한다)
#   -Keep   : 보관 개수. 개인정보 최소보관 원칙상 무한정 쌓지 않는다
#   -DbName : D1 데이터베이스 이름
# ⚠️ 이 파일은 반드시 UTF-8 BOM으로 저장할 것.
#    Windows PowerShell 5.1은 BOM이 없으면 ANSI로 읽어 한글 주석이 깨지고 파서가 죽는다.
param(
  [string]$Dest = "$PSScriptRoot\..\..\_chamroad-backups",
  [int]$Keep = 14,
  [string]$DbName = "chamroad"
)

$ErrorActionPreference = 'Stop'

# ⚠️ wrangler 버전 고정 — 4.120.1은 D1 원격 작업이 code 7403(account not authorized)로 실패한다
$WranglerPkg = "wrangler@4.120.0"

$api = Join-Path $PSScriptRoot "..\api"
if (-not (Test-Path (Join-Path $api "wrangler.jsonc"))) {
  Write-Error "api/wrangler.jsonc를 찾지 못했습니다. 챔로드 폴더에서 실행하세요."
}

$Dest = [System.IO.Path]::GetFullPath($Dest)
if (-not (Test-Path $Dest)) { New-Item -ItemType Directory -Path $Dest | Out-Null }

# 저장소 안에 백업을 만들려 하면 막는다 — 실수 한 번이 유출이 된다
$repo = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
if ($Dest.StartsWith($repo, [StringComparison]::OrdinalIgnoreCase)) {
  Write-Error "백업 위치가 저장소 안($repo)입니다. 개인정보가 커밋될 수 있으니 저장소 바깥을 지정하세요."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$out = Join-Path $Dest "$DbName-d1-$stamp.sql"

Push-Location $api
try {
  Write-Host "D1 내보내기: $DbName -> $out"
  & npx $WranglerPkg d1 export $DbName --remote --output $out
  if ($LASTEXITCODE -ne 0) { Write-Error "wrangler d1 export 실패 (exit $LASTEXITCODE)" }
} finally { Pop-Location }

if (-not (Test-Path $out)) { Write-Error "덤프 파일이 만들어지지 않았습니다: $out" }

$f = Get-Item $out
$tables = (Select-String -Path $out -Pattern '^CREATE TABLE' -AllMatches | Measure-Object).Count
$inserts = (Select-String -Path $out -Pattern '^INSERT INTO' -AllMatches | Measure-Object).Count
Write-Host ""
# ⚠️ 한글은 PowerShell 변수명으로 유효하다 — "$tables개"라고 쓰면 'tables개'라는 없는 변수로 읽혀
#    빈칸이 출력된다. 한글이 바로 붙는 자리에는 반드시 ${} 로 경계를 준다.
Write-Host "완료: $($f.Name)  /  $([math]::Round($f.Length/1KB,1)) KB  /  테이블 ${tables}개  /  INSERT ${inserts}건"

if ($tables -lt 1) { Write-Error "테이블이 0개입니다 — 덤프가 비정상입니다. 이 파일을 믿지 마세요." }

# 오래된 덤프 정리(개인정보 최소보관)
$old = Get-ChildItem "$Dest\$DbName-d1-*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -Skip $Keep
if ($old) {
  $old | Remove-Item -Force
  Write-Host "오래된 덤프 $($old.Count)개 삭제(보관 ${Keep}개 유지)"
}

Write-Host ""
Write-Host "다음: 복구 리허설로 이 덤프가 실제로 복원되는지 확인하세요"
Write-Host "  node tools\restore-drill.js `"$out`""
