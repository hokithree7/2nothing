# Codex：收尾上线（2026-11-24）

> 只读这一个文件就能完成。细节和来龙去脉在 `HANDOFF_2026-11-22_QUICK.md` 第九到第十四节，需要时再查。
> 仓库：`E:\2nothing.com\2nothing`　分支：`codex/translation-attribution-20261105`（HEAD `8a420079`，= 线上 master）

## 0. 规则

- 在这台电脑的这个目录里工作，**不要重新 clone**。改动全在工作区，GitHub 上没有。
- **不要 `git add -A` / `git add .`**。`AGENTS.md`、`DESIGN.md`、`.codex/`、旧交接文件是以前就有的本地改动，不提交。
- 下面 37 个文件都**没编译、没跑测试**。先跑检查，报错就修，修完再提交。
- `E:\2nothing.com\sojourn.keys.local.json` 是测试 agent 的密钥，在仓库外，**不要复制进仓库**。

## 1. 检查（必须全部通过）

```bash
cd E:\2nothing.com\2nothing
git status --short          # 应该看到下面第 2 节的 37 个文件，外加以前就有的那几个
npm run typecheck
npm run lint
npm run test:all            # 包含新的 lib/human-only.test.ts
npm run check:contracts     # 两份 openapi.json 一致，版本 2.7.3 和 lib/version.ts、README 对得上
npm run build
```

最可能报错的地方：
- `components/RichContent.tsx`：动态标签 `Tag`（h2/h3/h4）、`List`（ol/ul），递归的 `renderInline`
- `app/api/questions/[id]/answers/[answerId]/comments/route.ts`：`body` 改成 `let` + try/catch 解析
- `components/OperatorClient.tsx`：新增的 `L` 文案对象（约 50 个 key）
- `app/agents/[id]/page.tsx`：统计数组字段从 `label` 改成 `key/en/zh`
- `components/FortyTwoTerminal.tsx`：`??=`（如果 lint 不允许，改成 `if (!keyAudio) keyAudio = new AC()`）

## 2. 分 5 个提交（文件互不重叠）

```bash
# A. 42 首屏：验收小修、间距、过渡、按键敲击感
git add components/HomeClient.tsx components/FortyTwoTerminal.tsx
git commit -m "feat(42): hero acceptance fixes, tighter hero spacing, tactile send key (travel, clack, deny shake)"

# B. API：邀请计入统计、回答评论报错细化、human_only 403、已结束问题 409
git add lib/human-only.ts lib/human-only.test.ts app/api/invite/route.ts \
  "app/api/questions/[id]/answers/route.ts" \
  "app/api/questions/[id]/answers/[answerId]/comments/route.ts" \
  "app/api/questions/[id]/answers/[answerId]/reactions/route.ts" \
  "app/api/questions/[id]/answers/[answerId]/helpful/route.ts" \
  "app/api/questions/[id]/followups/route.ts" "app/api/questions/[id]/route.ts" \
  app/api/questions/route.ts app/api/human-profile/route.ts
git commit -m "fix(api): invite conversions, field-level answer-comment errors, 403 human_only, 409 question_closed"

# C. 人类侧：已结束问题页、加载态、页内确认框、控制台中文、去掉嵌套 main
git add components/QuestionDetail.tsx components/QuestionDetail.module.css components/OperatorClient.tsx
git commit -m "fix(42): closed-topic copy, pending states, in-page close confirm, zh operator console, no nested main"

# D. 全站 UI：Markdown 正文、中英文、按钮/导航/配色统一（globals.css 里也包含首屏 v3 的样式）
git add components/RichContent.tsx lib/work-card-preview.ts components/WorkChrome.tsx \
  components/PageHeading.tsx components/T.tsx "app/works/[id]/page.tsx" \
  app/agents/page.tsx "app/agents/[id]/page.tsx" components/FollowButton.tsx \
  components/InviteCTA.tsx components/FeedClient.tsx components/MobileNav.tsx app/globals.css
git commit -m "feat(ui): markdown work bodies, bilingual work/agent pages, unified buttons/nav/focus, hero v3 styles"

# E. 版本 2.7.3 与文档
git add lib/version.ts app/api/version/route.ts README.md public/llms.txt \
  public/openapi.json public/.well-known/openapi.json \
  docs/agent-field-test-sojourn-2026-11-24.md HANDOFF_2026-11-22_QUICK.md CODEX_START_HERE.md
git commit -m "chore(api): 2.7.3 changelog, OpenAPI and llms.txt sync, field-test report"

git status --short          # 只应剩以前就有的本地改动
git push origin codex/translation-attribution-20261105
```

## 3. 预览部署验收（Vercel 预览链接）

**42 首屏**
- [ ] 首页、`/questions` 首屏到下方内容没有大片空白，过渡看不出分界
- [ ] 字数不足 5 时点黄色按键：只下沉一半并晃动，提示变琥珀色，电源灯闪红，不会发出问题
- [ ] 满 5 字后按住按键会下沉，松开回弹，有轻微「咔嗒」声

**API**（用 `sojourn.keys.local.json` 里的 api_key）
- [ ] 带 Sojourn 的 key 调 `POST /api/questions/96367548-cb24-413f-96b2-fcd3803e1431/answers/db48635f-63e9-4079-9d1d-426f8c1f48da/reactions`：返回 403，`code: "human_only"`
- [ ] 同一个回答的 `POST .../comments`，body 为 `{"content":"x","interaction_type":"disagreement"}`，带 Idempotency-Key：返回 400，`field: "disagreement_code"`，并带 `rules`
- [ ] 回答已结束的测试问题 `9f214322-46be-4644-8e27-3548047be41c`：返回 409，`code: "question_closed"`
- [ ] `GET /api/version` 显示 2.7.3

**页面**
- [ ] `/questions/9f214322-…`（已结束）：显示结束提示，没有邀请区和 AGENT CHANNEL；页面只有 1 个 `<main>`
- [ ] 以提问者身份点认可、有帮助：立刻显示「处理中…」，期间点不动；结束本题出现页内确认框
- [ ] `/works/752c5606-18e4-4101-90fc-a82781fdc951`：加粗、行内代码正常渲染，看不到 `**` 和反引号；@Palimpsest 可以点；配图只出现一次
- [ ] 中文模式下 `/operator`、作品页、作者列表、作者主页没有英文残留
- [ ] `/feed` 卡片摘要里的日期保留连字符（`2026-11-24`）
- [ ] 导航只有当前页带下划线，「控制台」是胶囊样式；按 Tab 能看到焦点环

## 4. 正式上线

```bash
git fetch origin
git checkout master
git merge --ff-only origin/master
git merge --ff-only codex/translation-attribution-20261105
git push origin master
git checkout codex/translation-attribution-20261105
```

上线后在 https://2nothing.com 把第 3 节快速再过一遍。出问题就在 Vercel 里 Promote 上一个部署（`8a420079`）。

## 5. 需要人类或数据库权限的事（做不了就停下来告诉站长）

- **api_key 哈希 SQL 是否执行过**：在 Supabase 跑 `sql/api_key_hash_2026_11.sql` 末尾的验证查询，`missing` 和 `mismatch` 都应为 0。如果列不存在，先执行整个文件。执行前代码也能正常工作（会退回明文查询）。
- 上线 7 天后看 Vercel 日志里有没有 `plaintext api_key fallback hit`。为 0 就可以按 `docs/api-key-hashing-plan.md` 做阶段 D（删除明文列）。

## 6. 已知但这次不处理

- 第一次点「发布追问」没发出请求：只在自动化输入时出现过，需要人类用真实键盘复现
- 问题结束后仍可追问：保持现状，视为有意设计
- 其余待办见 `docs/fixlist-2026-11-22.md`
