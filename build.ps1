# ============================================================
# build.ps1 - 채무정리길잡이 단일 파일(app.html) 빌드 스크립트
# ============================================================
$dir = "c:\Users\pc\Desktop\클로드코드 작업"
$out = "$dir\app.html"

# UTF-8 파일 읽기 헬퍼
function Read-UTF8([string]$path) {
    return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}

# header-placeholder ~ footer-placeholder 사이 본문 추출
function Get-Body([string]$file) {
    $html  = Read-UTF8 $file
    $start = $html.IndexOf('<div id="header-placeholder"></div>')
    $end   = $html.IndexOf('<div id="footer-placeholder"></div>')
    if ($start -lt 0 -or $end -le $start) { return '' }
    $start += '<div id="header-placeholder"></div>'.Length
    return $html.Substring($start, $end - $start).Trim()
}

# 마지막 인라인 <script> 블록 내용 추출
function Get-Script([string]$file) {
    $html = Read-UTF8 $file
    $ms   = [regex]::Matches($html, '(?s)<script>(.+?)</script>')
    if ($ms.Count -gt 0) { return $ms[$ms.Count - 1].Groups[1].Value.Trim() }
    return ''
}

# href="*.html" → onclick="navigate('id');return false;"
function Fix-Links([string]$html) {
    $map = @{
        'index.html'          = 'home'
        'diagnosis.html'      = 'diagnosis'
        'result.html'         = 'result'
        'rehabilitation.html' = 'rehabilitation'
        'bankruptcy.html'     = 'bankruptcy'
        'documents.html'      = 'documents'
        'ai-review.html'      = 'ai-review'
        'pricing.html'        = 'pricing'
        'mypage.html'         = 'mypage'
        'resources.html'      = 'resources'
    }
    foreach ($k in $map.Keys) {
        $v    = $map[$k]
        $html = $html.Replace("href=""$k""", "href=""#"" onclick=""navigate('$v');return false;""")
    }
    return $html
}

# ── 공유 파일 읽기 ──
$css    = Read-UTF8 "$dir\css\styles.css"
$mainJs = Read-UTF8 "$dir\js\main.js"
$diagJs = Read-UTF8 "$dir\js\diagnosis.js"

# ── 페이지 정의 ──
$pages = @(
    [pscustomobject]@{ id='home';           file="$dir\index.html" },
    [pscustomobject]@{ id='diagnosis';      file="$dir\diagnosis.html" },
    [pscustomobject]@{ id='result';         file="$dir\result.html" },
    [pscustomobject]@{ id='rehabilitation'; file="$dir\rehabilitation.html" },
    [pscustomobject]@{ id='bankruptcy';     file="$dir\bankruptcy.html" },
    [pscustomobject]@{ id='documents';      file="$dir\documents.html" },
    [pscustomobject]@{ id='ai-review';      file="$dir\ai-review.html" },
    [pscustomobject]@{ id='pricing';        file="$dir\pricing.html" },
    [pscustomobject]@{ id='mypage';         file="$dir\mypage.html" },
    [pscustomobject]@{ id='resources';      file="$dir\resources.html" }
)

# ── 각 페이지 본문·스크립트 추출 ──
$bodyMap   = @{}
$scriptMap = @{}

foreach ($p in $pages) {
    $body   = Get-Body   $p.file
    $body   = Fix-Links  $body
    $script = Get-Script $p.file

    # initPage() 호출 제거 (네비·푸터는 SPA에서 정적)
    $script = [regex]::Replace($script, 'initPage\([^)]+\);\s*', '')

    $bodyMap[$p.id]   = $body
    $scriptMap[$p.id] = $script
}

# ── 함수명 충돌 해결 ──

# [rehabilitation] renderSteps / toggleCheck / updateProgress → rehab 접두사
$rs = $scriptMap['rehabilitation']
$rs = $rs.Replace('function renderSteps(',   'function rehabRenderSteps(')
$rs = $rs.Replace('renderSteps()',            'rehabRenderSteps()')
$rs = $rs.Replace('function toggleCheck(',   'function rehabToggleCheck(')
$rs = $rs.Replace("'toggleCheck(",           "'rehabToggleCheck(")
$rs = $rs.Replace('function updateProgress(','function rehabUpdateProgress(')
$rs = $rs.Replace('updateProgress(',         'rehabUpdateProgress(')
$scriptMap['rehabilitation'] = $rs

$rh = $bodyMap['rehabilitation']
$rh = $rh.Replace("'toggleCheck(",           "'rehabToggleCheck(")
$bodyMap['rehabilitation'] = $rh

# [bankruptcy] 동일 접두사 처리
$bs = $scriptMap['bankruptcy']
$bs = $bs.Replace('function renderSteps(',   'function bankruptRenderSteps(')
$bs = $bs.Replace('renderSteps()',            'bankruptRenderSteps()')
$bs = $bs.Replace('function toggleCheck(',   'function bankruptToggleCheck(')
$bs = $bs.Replace("'toggleCheck(",           "'bankruptToggleCheck(")
$bs = $bs.Replace('function updateProgress(','function bankruptUpdateProgress(')
$bs = $bs.Replace('updateProgress(',         'bankruptUpdateProgress(')
$scriptMap['bankruptcy'] = $bs

$bh = $bodyMap['bankruptcy']
$bh = $bh.Replace("'toggleCheck(",           "'bankruptToggleCheck(")
$bodyMap['bankruptcy'] = $bh

# [documents] setTab → docsSetTab
$ds = $scriptMap['documents']
$ds = $ds.Replace('function setTab(',  'function docsSetTab(')
$ds = $ds.Replace("'setTab(",          "'docsSetTab(")
$scriptMap['documents'] = $ds

$dh = $bodyMap['documents']
$dh = $dh.Replace("'setTab(",          "'docsSetTab(")
$bodyMap['documents'] = $dh

# [resources] setTab → resourcesSetTab
$res = $scriptMap['resources']
$res = $res.Replace('function setTab(', 'function resourcesSetTab(')
$res = $res.Replace("'setTab(",         "'resourcesSetTab(")
$scriptMap['resources'] = $res

$rsh = $bodyMap['resources']
$rsh = $rsh.Replace("'setTab(",         "'resourcesSetTab(")
$bodyMap['resources'] = $rsh

# ── 네비게이션 HTML ──
$navHtml = @'
<nav class="navbar-sticky bg-white border-b border-slate-200 no-print">
  <div class="max-w-6xl mx-auto px-4">
    <div class="flex items-center justify-between h-16">
      <a href="#" onclick="navigate('home');return false;" class="flex items-center gap-2">
        <div class="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center">
          <span class="text-white font-bold text-sm">채</span>
        </div>
        <span class="font-bold text-slate-800 text-lg">채무정리길잡이</span>
      </a>
      <div class="hidden lg:flex items-center gap-5">
        <a href="#" onclick="navigate('home');return false;"           data-page="home"           class="nav-link text-sm font-medium text-slate-600 hover:text-blue-700 transition-colors">홈</a>
        <a href="#" onclick="navigate('diagnosis');return false;"      data-page="diagnosis"      class="nav-link text-sm font-medium text-slate-600 hover:text-blue-700 transition-colors">무료진단</a>
        <a href="#" onclick="navigate('rehabilitation');return false;" data-page="rehabilitation" class="nav-link text-sm font-medium text-slate-600 hover:text-blue-700 transition-colors">개인회생</a>
        <a href="#" onclick="navigate('bankruptcy');return false;"     data-page="bankruptcy"     class="nav-link text-sm font-medium text-slate-600 hover:text-blue-700 transition-colors">개인파산</a>
        <a href="#" onclick="navigate('documents');return false;"      data-page="documents"      class="nav-link text-sm font-medium text-slate-600 hover:text-blue-700 transition-colors">서류체크</a>
        <a href="#" onclick="navigate('ai-review');return false;"      data-page="ai-review"      class="nav-link text-sm font-medium text-slate-600 hover:text-blue-700 transition-colors">AI검토</a>
        <a href="#" onclick="navigate('resources');return false;"      data-page="resources"      class="nav-link text-sm font-medium text-slate-600 hover:text-blue-700 transition-colors">자료실</a>
        <a href="#" onclick="navigate('pricing');return false;"        data-page="pricing"        class="nav-link text-sm font-medium text-slate-600 hover:text-blue-700 transition-colors">요금제</a>
      </div>
      <div class="hidden lg:flex items-center gap-3">
        <a href="#" onclick="navigate('mypage');return false;" class="text-sm text-slate-600 hover:text-blue-700 transition-colors">마이페이지</a>
        <a href="#" onclick="navigate('diagnosis');return false;" class="bg-blue-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors font-medium">무료진단 시작</a>
      </div>
      <button onclick="toggleMobileMenu()" class="lg:hidden p-2 text-slate-600 hover:text-blue-700">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>
    </div>
  </div>
  <div id="mobile-menu" class="lg:hidden border-t border-slate-100">
    <a href="#" onclick="navigate('home');return false;"           data-page="home"           class="mobile-nav-link block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">홈</a>
    <a href="#" onclick="navigate('diagnosis');return false;"      data-page="diagnosis"      class="mobile-nav-link block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">무료진단</a>
    <a href="#" onclick="navigate('rehabilitation');return false;" data-page="rehabilitation" class="mobile-nav-link block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">개인회생</a>
    <a href="#" onclick="navigate('bankruptcy');return false;"     data-page="bankruptcy"     class="mobile-nav-link block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">개인파산</a>
    <a href="#" onclick="navigate('documents');return false;"      data-page="documents"      class="mobile-nav-link block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">서류체크</a>
    <a href="#" onclick="navigate('ai-review');return false;"      data-page="ai-review"      class="mobile-nav-link block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">AI검토</a>
    <a href="#" onclick="navigate('resources');return false;"      data-page="resources"      class="mobile-nav-link block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">자료실</a>
    <a href="#" onclick="navigate('pricing');return false;"        data-page="pricing"        class="mobile-nav-link block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">요금제</a>
    <div class="px-4 py-3 border-t border-slate-100 bg-slate-50">
      <a href="#" onclick="navigate('mypage');return false;" class="block text-center py-2 text-sm text-slate-600 mb-2">마이페이지</a>
      <a href="#" onclick="navigate('diagnosis');return false;" class="block w-full text-center bg-blue-700 text-white py-3 rounded-lg font-medium text-sm">무료진단 시작하기</a>
    </div>
  </div>
</nav>
'@

# ── 푸터 HTML ──
$footerHtml = @'
<footer class="bg-slate-800 text-slate-400 mt-16 no-print">
  <div class="max-w-6xl mx-auto px-4 py-10">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
      <div>
        <div class="flex items-center gap-2 mb-3">
          <div class="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
            <span class="text-white text-xs font-bold">채</span>
          </div>
          <span class="text-white font-bold">채무정리길잡이</span>
        </div>
        <p class="text-sm leading-relaxed">채무 정리 절차를 스스로 이해하고 준비할 수 있도록 돕는 정보 제공 플랫폼입니다.</p>
      </div>
      <div>
        <h4 class="text-slate-300 font-semibold mb-3 text-sm">주요 서비스</h4>
        <ul class="space-y-1.5 text-sm">
          <li><a href="#" onclick="navigate('diagnosis');return false;"      class="hover:text-white transition-colors">무료 채무진단</a></li>
          <li><a href="#" onclick="navigate('rehabilitation');return false;" class="hover:text-white transition-colors">개인회생 셀프 진행센터</a></li>
          <li><a href="#" onclick="navigate('bankruptcy');return false;"     class="hover:text-white transition-colors">개인파산·면책 셀프 진행센터</a></li>
          <li><a href="#" onclick="navigate('documents');return false;"      class="hover:text-white transition-colors">서류 체크센터</a></li>
          <li><a href="#" onclick="navigate('ai-review');return false;"      class="hover:text-white transition-colors">AI 서류 검토</a></li>
        </ul>
      </div>
      <div>
        <h4 class="text-slate-300 font-semibold mb-3 text-sm">관련 공공기관</h4>
        <ul class="space-y-1.5 text-sm">
          <li><a href="https://www.scourt.go.kr" target="_blank" rel="noopener" class="hover:text-white transition-colors">대법원 전자소송</a></li>
          <li><a href="https://www.ccrs.or.kr"   target="_blank" rel="noopener" class="hover:text-white transition-colors">신용회복위원회</a></li>
          <li><a href="https://www.klac.or.kr"   target="_blank" rel="noopener" class="hover:text-white transition-colors">대한법률구조공단</a></li>
        </ul>
      </div>
    </div>
    <div class="border-t border-slate-700 pt-6 space-y-3">
      <div style="background:#334155;border:1px solid #475569;border-left:4px solid #64748b;border-radius:8px;padding:14px 18px;font-size:13px;color:#cbd5e1;line-height:1.7">
        <strong style="color:#e2e8f0">⚠ 법률대리 아님 고지</strong><br>
        본 서비스는 법률상담, 법률대리, 사건 수임 또는 결과 보장을 제공하지 않습니다.
        사용자가 직접 절차를 이해하고 준비할 수 있도록 돕는 정보 제공 및 서류 점검 보조 서비스입니다.
        구체적인 법률 판단이 필요한 경우 변호사, 법무사, 대한법률구조공단 등 전문가 상담을 권장합니다.
      </div>
      <p class="text-xs text-slate-500 text-center">© 2025 채무정리길잡이. 본 사이트의 모든 정보는 참고용이며 법적 효력이 없습니다.</p>
    </div>
  </div>
</footer>
'@

# ── 공유 모달 (example-modal) ──
$modalHtml = @'
<div id="example-modal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" style="display:none!important">
  <div class="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 shadow-2xl">
    <div class="flex items-center justify-between mb-4">
      <h3 id="modal-title" class="font-bold text-slate-800 text-lg"></h3>
      <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&#215;</button>
    </div>
    <div id="modal-content" class="text-sm text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-200"></div>
    <button onclick="closeModal()" class="mt-4 w-full py-2.5 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors">닫기</button>
  </div>
</div>
'@

# ── SPA 라우터 JS ──
$routerJs = @'
// ── SPA 라우터 ──
function navigate(id) {
    document.querySelectorAll('.page').forEach(function(p) { p.style.display = 'none'; });
    var pg = document.getElementById('p-' + id);
    if (pg) pg.style.display = 'block';
    window.scrollTo(0, 0);

    document.querySelectorAll('.nav-link').forEach(function(a) {
        var isActive = a.dataset.page === id;
        a.classList.toggle('text-blue-700', isActive);
        a.classList.toggle('border-b-2',    isActive);
        a.classList.toggle('border-blue-700', isActive);
        a.classList.toggle('pb-0.5',        isActive);
        a.classList.toggle('text-slate-600', !isActive);
    });
    document.querySelectorAll('.mobile-nav-link').forEach(function(a) {
        var isActive = a.dataset.page === id;
        a.classList.toggle('text-blue-700',  isActive);
        a.classList.toggle('bg-blue-50',     isActive);
        a.classList.toggle('font-semibold',  isActive);
    });

    var inits = {
        'result':         function() { if (typeof renderResults      === 'function') renderResults(); },
        'rehabilitation': function() { if (typeof rehabRenderSteps   === 'function') rehabRenderSteps(); },
        'bankruptcy':     function() { if (typeof bankruptRenderSteps=== 'function') bankruptRenderSteps(); },
        'documents':      function() { if (typeof renderDocs         === 'function') renderDocs(); },
        'mypage':         function() { if (typeof renderPage         === 'function') renderPage(); },
        'resources':      function() { if (typeof renderFAQ          === 'function') renderFAQ(); }
    };
    if (inits[id]) inits[id]();
}

// 공유 모달
function showExample(title, content) {
    document.getElementById('modal-title').textContent   = decodeURIComponent(title);
    document.getElementById('modal-content').textContent = decodeURIComponent(content);
    document.getElementById('example-modal').style.removeProperty('display');
}
function closeModal() {
    document.getElementById('example-modal').style.setProperty('display','none','important');
}

// 초기 페이지
navigate('home');
'@

# ── 페이지 div 조합 ──
$sb = New-Object System.Text.StringBuilder
foreach ($p in $pages) {
    $display = if ($p.id -eq 'home') { '' } else { ' style="display:none"' }
    [void]$sb.AppendLine("<div id=""p-$($p.id)"" class=""page""$display>")
    [void]$sb.AppendLine($bodyMap[$p.id])
    [void]$sb.AppendLine("</div>")
}
$allPageDivs = $sb.ToString()

# ── 페이지 스크립트 조합 ──
$sb2 = New-Object System.Text.StringBuilder
foreach ($p in $pages) {
    if ($scriptMap[$p.id]) {
        [void]$sb2.AppendLine("// == $($p.id) ==")
        [void]$sb2.AppendLine($scriptMap[$p.id])
    }
}
$allPageScripts = $sb2.ToString()

# ── 최종 HTML 조합 ──
$sb3 = New-Object System.Text.StringBuilder
[void]$sb3.AppendLine('<!DOCTYPE html>')
[void]$sb3.AppendLine('<html lang="ko">')
[void]$sb3.AppendLine('<head>')
[void]$sb3.AppendLine('  <meta charset="UTF-8">')
[void]$sb3.AppendLine('  <meta name="viewport" content="width=device-width, initial-scale=1.0">')
[void]$sb3.AppendLine('  <title>채무정리길잡이 - 개인회생·파산 셀프 진행 지원</title>')
[void]$sb3.AppendLine('  <meta name="description" content="개인회생, 개인파산·면책, 신용회복위원회 절차를 혼자 준비할 수 있도록 돕는 무료 채무진단 플랫폼">')
[void]$sb3.AppendLine('  <script src="https://cdn.tailwindcss.com"></script>')
[void]$sb3.AppendLine('  <style>')
[void]$sb3.AppendLine($css)
[void]$sb3.AppendLine('  .page { display: none; }')
[void]$sb3.AppendLine('  </style>')
[void]$sb3.AppendLine('</head>')
[void]$sb3.AppendLine('<body class="bg-slate-50">')
[void]$sb3.AppendLine('<div id="toast"></div>')
[void]$sb3.AppendLine($modalHtml)
[void]$sb3.AppendLine($navHtml)
[void]$sb3.AppendLine($allPageDivs)
[void]$sb3.AppendLine($footerHtml)
[void]$sb3.AppendLine('<script>')
[void]$sb3.AppendLine($mainJs)
[void]$sb3.AppendLine($diagJs)
[void]$sb3.AppendLine($allPageScripts)
[void]$sb3.AppendLine($routerJs)
[void]$sb3.AppendLine('</script>')
[void]$sb3.AppendLine('</body>')
[void]$sb3.AppendLine('</html>')

$finalHtml = $sb3.ToString()

# ── 파일 저장 ──
$finalHtml | Out-File -FilePath $out -Encoding UTF8 -NoNewline

$sizeKB = [math]::Round((Get-Item $out).Length / 1KB, 1)
Write-Host "완료: app.html 생성 ($sizeKB KB)" -ForegroundColor Green
Write-Host "경로: $out" -ForegroundColor Cyan

# 배포 폴더에도 복사
$deployDir = "$dir\채무정리길잡이_배포"
if (Test-Path $deployDir) {
    Copy-Item $out "$deployDir\app.html" -Force
    Write-Host "배포 폴더 복사 완료: $deployDir\app.html" -ForegroundColor Yellow
}
