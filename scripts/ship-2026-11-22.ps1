# 2nothing · 2026-11-22 一键提交并推送（功能分支）
# 用法（在 E:\2nothing.com\2nothing 下）：
#   powershell -ExecutionPolicy Bypass -File scripts\ship-2026-11-22.ps1            # 检查 + 分主题提交 + 推送功能分支
#   powershell -ExecutionPolicy Bypass -File scripts\ship-2026-11-22.ps1 -Production # 额外快进合并到 master 并推送（正式上线）
param([switch]$Production)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Run($cmd) {
  Write-Host "`n> $cmd" -ForegroundColor Cyan
  Invoke-Expression $cmd
  if ($LASTEXITCODE -ne 0) { throw "失败：$cmd" }
}
function Commit($msg, [string[]]$files) {
  $existing = $files | Where-Object { Test-Path -LiteralPath $_ }
  if (-not $existing) { Write-Host "跳过（无文件）：$msg" -ForegroundColor Yellow; return }
  git add -- $existing
  if ($LASTEXITCODE -ne 0) { throw "git add 失败：$msg" }
  git diff --cached --quiet
  if ($LASTEXITCODE -eq 0) { Write-Host "跳过（无改动）：$msg" -ForegroundColor Yellow; return }
  git commit -m $msg
  if ($LASTEXITCODE -ne 0) { throw "git commit 失败：$msg" }
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { throw '暂存区非空，先核对所有权；脚本不会混入既有暂存改动。' }
if ($branch -ne 'codex/translation-attribution-20261105') { throw "当前分支是 $branch，请先切到 codex/translation-attribution-20261105" }

Write-Host '== 1/3 检查 ==' -ForegroundColor Green
Run 'npm run typecheck'
Run 'npm run test:all'
Run 'npm run lint'
Run 'npm run check:contracts'
Run 'npm run build'

Write-Host '== 2/3 分主题提交（不会提交 AGENTS.md / DESIGN.md / .codex 等无关改动）==' -ForegroundColor Green
Commit 'fix(42): include name input in terminal focus trap' @(
  'components/FortyTwoTerminal.tsx')

Commit 'fix(moderation): escape keywords before building RegExp' @(
  'lib/moderation.ts', 'app/api/questions/route.ts',
  'app/api/questions/[id]/answers/route.ts',
  'app/api/questions/[id]/answers/[answerId]/comments/route.ts',
  'app/api/questions/[id]/followups/route.ts', 'app/api/comments/route.ts',
  'app/api/works/[id]/route.ts', 'app/api/submit/route.ts')

Commit 'fix(security): trusted rate-limit key, write-tier limits, timing-safe admin key, search escaping' @(
  'lib/rate-limit.ts', 'lib/admin-auth.ts',
  'app/api/admin/notify/route.ts', 'app/api/admin/backfill-fingerprint/route.ts',
  'app/api/search/route.ts', 'app/api/memories/route.ts', 'app/api/soul/route.ts',
  'app/api/webhooks/route.ts', 'app/api/invitations/route.ts', 'app/api/review/route.ts',
  'app/api/human-profile/route.ts', 'app/api/authors/me/route.ts',
  'app/api/agents/[id]/route.ts', 'app/api/notifications/route.ts')

# authors / bookmarks / invite 同时含限流、哈希、注册修复的改动，统一放在这一个提交里
Commit 'feat(auth): hash api_key at rest (phase A+B) + registration UX: validate before quota, 400 on bad JSON, rules on every error, no 409 leak' @(
  'lib/api-key.ts', 'lib/api-key-crypto.ts', 'lib/api-key-lookup.ts', 'lib/api-key.test.ts', 'lib/auth.ts', 'lib/types.ts',
  'sql/api_key_hash_2026_11.sql', 'sql/api_key_hash_2026_11_rollback.sql',
  'scripts/rotate_keys.mjs', 'app/api/authors/recover/route.ts',
  'app/api/audit/route.ts', 'app/api/history/route.ts',
  'app/api/authors/route.ts', 'app/api/authors/check/route.ts',
  'app/api/bookmarks/route.ts', 'app/api/invite/route.ts',
  'components/ForAiCodeSteps.tsx', 'public/llms.txt',
  'skills/2nothing.md', 'public/skills/2nothing.md')

Commit 'fix: works default limit 50; explicit ai_authors columns on author pages' @(
  'app/api/works/route.ts', 'public/openapi.json', 'public/.well-known/openapi.json', 'generate_openapi.py',
  'app/authors/page.tsx', 'app/authors/[id]/page.tsx')

Commit 'fix(frontend): disable browser auto-translate (lang-switch crash), i18n footer, default OG image, canonicals, noindex/titles for private pages, invite 404, feed h1, admin i18n, tap targets, local quota reset time' @(
  'app/layout.tsx', 'proxy.ts', 'components/SiteFooter.tsx', 'components/I18nProvider.tsx', 'lib/i18n.ts',
  'lib/site-meta.ts', 'app/og-image/route.tsx',
  'app/page.tsx', 'app/feed/page.tsx', 'app/agents/page.tsx', 'app/agents/[id]/page.tsx',
  'app/works/[id]/page.tsx', 'app/tags/[tag]/page.tsx', 'app/questions/page.tsx', 'app/questions/[id]/page.tsx',
  'app/models/page.tsx', 'app/submit/page.tsx', 'app/about/page.tsx', 'app/docs/page.tsx',
  'app/leaderboard/page.tsx', 'app/discover/page.tsx',
  'app/operator/layout.tsx', 'app/dashboard/layout.tsx', 'app/admin/layout.tsx', 'app/register/layout.tsx',
  'app/invite/[code]/layout.tsx', 'app/admin/page.tsx',
  'app/globals.css', 'components/QuestionDetail.module.css')

Commit 'docs: release checklist, fixlist review, api_key hashing plan, commit plan, ship script' @(
  'docs/release-checklist-crt.md', 'docs/fixlist-2026-11-22.md',
  'docs/api-key-hashing-plan.md', 'docs/commit-plan-2026-11-22.md',
  'scripts/ship-2026-11-22.ps1', 'HANDOFF_2026-11-22_QUICK.md', 'docs/frontend-audit-2026-11-23.md')

Write-Host '== 3/3 推送 ==' -ForegroundColor Green
Run 'git push origin codex/translation-attribution-20261105'
Write-Host '功能分支已推送 → Vercel 会生成预览部署。' -ForegroundColor Green

if ($Production) {
  Write-Host "`n即将快进合并到 master 并推送（正式上线）。" -ForegroundColor Yellow
  Write-Host '请确认：已在 Supabase 执行 sql/api_key_hash_2026_11.sql，且预览部署验收通过。' -ForegroundColor Yellow
  $ok = Read-Host '输入 YES 继续'
  if ($ok -ne 'YES') { Write-Host '已取消，未改动 master。'; exit 0 }
  Run 'git fetch origin'
  Run 'git checkout master'
  Run 'git merge --ff-only origin/master'
  Run 'git merge --ff-only codex/translation-attribution-20261105'
  Run 'git push origin master'
  Run 'git checkout codex/translation-attribution-20261105'
  Write-Host '已推送 master → Vercel 正式部署中。' -ForegroundColor Green
}

Write-Host "`n剩余未提交的文件（应只剩今天之前的本地改动）：" -ForegroundColor Green
git status --short
