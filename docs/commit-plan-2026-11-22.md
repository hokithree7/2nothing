# 2nothing · 2026-11-22 提交计划

> **执行以 `scripts/ship-2026-11-22.ps1` 为准**（6 个提交，不需要 `git add -p`）；交接说明见仓库根目录 `HANDOFF_2026-11-22_QUICK.md`。下文是最初拆成 7 个提交的方案，仅供参考。


> 分支：`codex/translation-attribution-20261105`
> 原则：每个提交只包含一个主题，可以单独回滚。**不要用 `git add -A` 或 `git add .`**。仓库里原来就有和今天无关的本地改动（`AGENTS.md`、`DESIGN.md`、`.codex/` 等），不能一起提交。

---

## 0. 先检查

```bash
cd E:\2nothing.com\2nothing
git status --short          # 核对改动文件与下表一致，有多出来的先别动
npm run typecheck           # 全部改动一起检查一次，失败先修再拆提交
```

## 1. 有 3 个文件同时属于两个主题

| 文件 | 提交 3（安全加固） | 提交 4（api_key 哈希） |
|---|---|---|
| `app/api/authors/route.ts` | 409 不再返回 `existing_agent` | `generateApiKey` / `apiKeyColumns` / 响应改为直接返回内存里的 key |
| `app/api/bookmarks/route.ts` | 写接口限流 | 认证改用 `findAgentByKey` |
| `app/api/invite/route.ts` | 写接口限流 | `generateApiKey` / `apiKeyColumns` |

在提交 3 里用 `git add -p` 只暂存限流和 409 相关的代码块，其余代码块留给提交 4。
**嫌麻烦的话**：把这 3 个文件整个放进提交 4，并在提交 3 的说明里写明"authors/bookmarks/invite 的改动见下一个提交"。

---

## 提交 1：焦点修复

```bash
git add components/FortyTwoTerminal.tsx
git commit -m "fix(42): include name input in terminal focus trap"
```

## 提交 2：审核正则转义

```bash
git add lib/moderation.ts \
  app/api/questions/route.ts \
  "app/api/questions/[id]/answers/route.ts" \
  "app/api/questions/[id]/answers/[answerId]/comments/route.ts" \
  "app/api/questions/[id]/followups/route.ts" \
  app/api/comments/route.ts \
  "app/api/works/[id]/route.ts" \
  app/api/submit/route.ts
git commit -m "fix(moderation): escape keywords before building RegExp"
```

## 提交 3：S 级安全加固

```bash
git add lib/rate-limit.ts lib/admin-auth.ts \
  app/api/admin/notify/route.ts \
  app/api/admin/backfill-fingerprint/route.ts \
  app/api/search/route.ts \
  app/api/memories/route.ts app/api/soul/route.ts app/api/webhooks/route.ts \
  app/api/invitations/route.ts app/api/review/route.ts \
  app/api/human-profile/route.ts app/api/authors/me/route.ts \
  "app/api/agents/[id]/route.ts" app/api/notifications/route.ts
git add -p app/api/authors/route.ts app/api/bookmarks/route.ts app/api/invite/route.ts
#   只选：409 删除 existing_agent、writeLimit 两行 + rate-limit import
git commit -m "fix(security): trusted rate-limit key, write-tier limits, timing-safe admin key, search escaping, no 409 leak"
```

## 提交 4：api_key 哈希化 · 阶段 A+B

```bash
git add lib/api-key.ts lib/api-key.test.ts lib/auth.ts lib/types.ts \
  sql/api_key_hash_2026_11.sql sql/api_key_hash_2026_11_rollback.sql \
  scripts/rotate_keys.mjs \
  app/api/authors/recover/route.ts app/api/audit/route.ts app/api/history/route.ts \
  app/api/authors/route.ts app/api/bookmarks/route.ts app/api/invite/route.ts
git commit -m "feat(auth): hash api_key at rest — phase A+B (dual-write, hash-first lookup)"
```

## 提交 5：works 默认条数 + 作者页显式列

```bash
git add app/api/works/route.ts public/openapi.json generate_openapi.py \
  app/authors/page.tsx "app/authors/[id]/page.tsx"
git commit -m "fix: works default limit 50; explicit ai_authors columns on author pages"
```

## 提交 7：注册体验修复

```bash
git add app/api/authors/check/route.ts components/ForAiCodeSteps.tsx public/llms.txt \
  skills/2nothing.md public/skills/2nothing.md
git add -p app/api/authors/route.ts   # 选：REGISTRATION_RULES / invalid() / JSON 解析 / 限流后移
git commit -m "fix(register): validate before counting quota, 400 on bad JSON, return rules on every error, document limits"
```

## 提交 6（可选）：文档

把今天的 4 份文档从 Quick 里下载，放到 `docs/` 下：
`release-checklist-crt.md`、`fixlist-2026-11-22.md`、`api-key-hashing-plan.md`、`commit-plan-2026-11-22.md`

```bash
git add docs/release-checklist-crt.md docs/fixlist-2026-11-22.md docs/api-key-hashing-plan.md docs/commit-plan-2026-11-22.md
git commit -m "docs: CRT release checklist, fixlist review, api_key hashing plan"
```

---

## 6. 提交后

```bash
git status --short            # 应只剩今天之前就存在的 WIP
git log --oneline -6
npm run typecheck && npm run test:all && npm run check:contracts && npm run build
git push                      # 推送功能分支 → Vercel 预览部署
```

## 7. 上线顺序

1. **Supabase**：执行 `sql/api_key_hash_2026_11.sql` 和末尾的验证 SQL（missing / mismatch 都应为 0）
2. 在**预览部署**上跑一遍验收清单，补测：
   - 老 key 能认证；新注册的 key 能认证；找回后旧 key 失效
   - 伪造 `X-Forwarded-For` 不能绕过注册限流
   - search 输入 `%`、`_`、`,` 不报错，结果正常
3. 快进合并到 master，推送，触发正式部署
4. 观察 7 天：Vercel 日志里 `plaintext api_key fallback hit` 出现的次数应为 0（阶段 C）

## 回滚

| 出问题的部分 | 怎么回滚 |
|---|---|
| 整体 | Vercel → Promote 旧部署 `008418a1` |
| 某一个主题 | `git revert <该提交>`，各提交互相独立 |
| 哈希相关 | revert 提交 4 即可，数据库里明文还在；SQL 用 `api_key_hash_2026_11_rollback.sql` |
