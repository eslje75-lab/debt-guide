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
#   -ForceFallback : export를 건너뛰고 SELECT 기반 대체 덤프로 바로 간다.
#                    export가 계속 401을 낼 때의 우회로이자, 그 경로가 죽지 않았는지 확인하는 수단.
param(
  [string]$Dest = "$PSScriptRoot\..\..\_chamroad-backups",
  [int]$Keep = 14,
  [string]$DbName = "chamroad",
  [switch]$ForceFallback
)

$ErrorActionPreference = 'Stop'

# ── 인증 ──────────────────────────────────────────────────────────────────────
# ⚠️ `d1 export`가 **간헐적으로** 401 `Authentication error [code: 10000]`으로 실패한다
#    (2026-08-16 관측: 한 번 실패 → 잠시 뒤 같은 OAuth 토큰으로 정상 성공).
#    같은 시각 `d1 execute --remote`는 계속 정상이었으므로 토큰이 통째로 죽은 것은 아니다.
#    원인은 확정하지 못했다(OAuth 토큰 갱신 타이밍 또는 export 엔드포인트 쪽 일시 오류로 추정).
#    ⛔ 한 번 실패했다고 "권한이 없다"고 단정하지 말 것 — 다시 실행하면 되는 경우가 있다.
#
# 재발에 대비해 두 가지를 둔다: ①아래 API 토큰 경로 ②실패 시 SELECT 기반 대체 덤프.
# API 토큰을 쓰면 OAuth 갱신과 무관해지므로 더 안정적이다. 찾는 순서:
#   ① 환경변수 CLOUDFLARE_API_TOKEN
#   ② <Dest>\.cf-token 파일 (저장소 **바깥**이라 커밋될 일이 없다)
# 둘 다 없으면 OAuth로 시도하고, 실패하면 아래 대체 덤프로 넘어간다.
# 토큰 만드는 법은 BACKUP.md 「백업 토큰」 절.
$tokenSource = '환경변수 CLOUDFLARE_API_TOKEN'
if (-not $env:CLOUDFLARE_API_TOKEN) {
  $tokenFile = Join-Path ([System.IO.Path]::GetFullPath($Dest)) '.cf-token'
  if (Test-Path $tokenFile) {
    $env:CLOUDFLARE_API_TOKEN = (Get-Content $tokenFile -Raw).Trim()
    $tokenSource = $tokenFile
  } else {
    $tokenSource = '없음(wrangler login OAuth로 시도 — export는 실패할 수 있다)'
  }
}
Write-Host "인증: $tokenSource"

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
  if ($ForceFallback) {
    Write-Host "D1 내보내기: 건너뜀(-ForceFallback) -> $out"
    $exportOk = $false
  } else {
    Write-Host "D1 내보내기: $DbName -> $out"
    & npx $WranglerPkg d1 export $DbName --remote --output $out
    $exportOk = ($LASTEXITCODE -eq 0) -and (Test-Path $out)
  }

  if (-not $exportOk) {
    # export가 막혔다고 백업을 통째로 포기하지 않는다 — 백업이 없는 날이 생기는 것이 더 나쁘다.
    # 살아 있는 `d1 execute --remote --command` 경로로 전 테이블을 SELECT해 덤프를 되만든다.
    if (-not $ForceFallback) {
      Write-Warning "d1 export 실패(exit $LASTEXITCODE). 대체 경로(SELECT 기반)로 덤프를 만듭니다."
      Write-Warning "  간헐적 401일 수 있으니 **한 번 더 실행해 볼 것**. 반복되면 API 토큰을 넣으세요(BACKUP.md 「백업 토큰」)."
    }
    if (Test-Path $out) { Remove-Item $out -Force }   # 반쯤 쓰다 만 파일을 정상 덤프로 착각하지 않게

    $tmpTables = Join-Path $env:TEMP "d1-tables-$stamp.json"
    $tmpRows   = Join-Path $env:TEMP "d1-rows-$stamp.json"
    try {
      $q = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name;"
      $raw = (& npx $WranglerPkg d1 execute $DbName --remote --command $q --json 2>$null) | Out-String
      if ($raw.IndexOf('[') -lt 0) { Write-Error "테이블 목록을 가져오지 못했습니다. 로그인 상태(npx wrangler whoami)를 확인하세요." }
      $listJson = $raw.Substring($raw.IndexOf('['))
      $names = ($listJson | ConvertFrom-Json)[0].results | ForEach-Object { $_.name }
      if (-not $names -or $names.Count -lt 1) { Write-Error "테이블이 0개입니다 — 대상 DB가 맞는지 확인하세요." }
      Set-Content -Path $tmpTables -Value (ConvertTo-Json @($names)) -Encoding utf8

      # 한 번의 호출로 전부 SELECT한다(문장 순서 = 결과 순서). 표가 늘어도 호출 수는 그대로다.
      $sel = ($names | ForEach-Object { "SELECT * FROM `"$_`";" }) -join ' '
      $raw2 = (& npx $WranglerPkg d1 execute $DbName --remote --command $sel --json 2>$null) | Out-String
      if ($raw2.IndexOf('[') -lt 0) { Write-Error "데이터를 가져오지 못했습니다." }
      Set-Content -Path $tmpRows -Value $raw2.Substring($raw2.IndexOf('[')) -Encoding utf8

      $schema = Join-Path $api "schema.sql"
      & node (Join-Path $PSScriptRoot "d1-dump-fallback.js") $tmpTables $tmpRows $schema $out
      if ($LASTEXITCODE -ne 0) { Write-Error "대체 덤프 생성 실패" }
    } finally {
      # 임시 파일에도 개인정보가 들어 있다 — 반드시 지운다.
      Remove-Item $tmpTables, $tmpRows -Force -ErrorAction SilentlyContinue
    }
  }
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
