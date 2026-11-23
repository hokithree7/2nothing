# 交接：2026-11-22 修复批次（AWS Quick → 2nothing 负责 agent）

> 写给接手执行的 agent。照着本文做即可，不需要再看聊天记录。
> 仓库：`E:\2nothing.com\2nothing` · 分支：`codex/translation-attribution-20261105`

## ⚠️ 先读这三条

1. **改动只在这台电脑的工作区里，没有提交，也没有推送。** GitHub 上看不到。必须在 `E:\2nothing.com\2nothing` 这个目录里执行，不要重新 clone。
2. **所有改动都没编译、没跑测试。** 写代码的一方无法运行 `git` / `npm`。第一步一定是 typecheck，报错就修。
3. **不要提交无关的本地改动**：`AGENTS.md`、`DESIGN.md`、`.codex/`、旧交接文件是今天之前就有的 WIP。不要用 `git add -A` / `git add .`。

## 一、执行步骤

### 1. 检查
```bash
cd E:\2nothing.com\2nothing
git status --short                 # 对照第三节的文件清单
npm run typecheck                  # 报错就修，修完再继续
npm run test:all
npm run check:contracts
npm run build
```

### 2. 提交并推送功能分支
直接用脚本（已列好每个提交包含的文件，只提交今天改过的文件）：
```powershell
powershell -ExecutionPolicy Bypass -File scripts\ship-2026-11-22.ps1
```
脚本会先跑 typecheck / test / build，任何一步失败就停下，不提交。然后分 7 个提交，推送功能分支，Vercel 会生成预览部署。
手动提交的话，以脚本里的文件分组为准（`docs/commit-plan-2026-11-22.md` 里拆成 7 个提交的方案需要 `git add -p`，已被脚本取代）。

### 3. Supabase（需要人类或有数据库权限的 agent）
1. SQL Editor 执行 `sql/api_key_hash_2026_11.sql`，再跑文件末尾的验证 SQL，`missing` 和 `mismatch` 都应为 0。
2. 先确认 `pgcrypto` 已启用（脚本里有 `CREATE EXTENSION IF NOT EXISTS`）。
3. 可选：今天的实地测试把一个 IP 的注册额度用完了。如果要马上继续测试，执行：
   ```sql
   DELETE FROM public.rate_limits WHERE key LIKE '%:register' AND created_at > now() - interval '24 hours';
   ```

### 4. 在预览部署上验收
按 `docs/release-checklist-crt.md` 检查，另外补测：
- [ ] 老 key 能认证（走哈希）；新注册的 key 能认证；用 recover 找回后旧 key 失效
- [ ] 注册：bio 填 220 字返回 400，带 `field: "bio"` 和 `rules`，**不扣额度**；连续填错 5 次后，正确注册仍然成功
- [ ] 注册：请求体 `{bad` 返回 400（原来是 500）
- [ ] 注册：409 重名响应里**没有** `existing_agent`
- [ ] 伪造 `X-Forwarded-For` 不能绕过注册限流
- [ ] search 输入 `%`、`_`、`,`、`(` 不报错
- [ ] 写接口（memories / soul 等）连续请求超过 20 次/分钟返回 429；正常使用不受影响
- [ ] 42 终端名字面板：Tab / Shift+Tab 能在输入框、头像、按钮之间循环
- [ ] `/api/works` 不带 limit 时返回 50 条
- [ ] Vercel 日志里没有 `plaintext api_key fallback hit`（如果 SQL 已执行）

### 5. 正式上线
```powershell
powershell -ExecutionPolicy Bypass -File scripts\ship-2026-11-22.ps1 -Production
```
需要输入 `YES` 确认，会快进合并到 master 并推送。也可以手动执行：
```bash
git fetch origin && git checkout master && git merge --ff-only origin/master
git merge --ff-only codex/translation-attribution-20261105 && git push origin master
```

### 6. 上线后
- **阶段 C**：观察 7 天，`plaintext api_key fallback hit` 应为 0。之后按 `docs/api-key-hashing-plan.md` 做阶段 D（删除明文列）。
- 观察 `write` 档的 429 数量（待修复清单 #20）。
- **回滚**：Vercel → Promote 上一个部署；或 `git revert` 对应提交（各提交互相独立）。哈希相关回滚见 `sql/api_key_hash_2026_11_rollback.sql`。

## 二、改了什么（按提交）

| # | 提交 | 要点 |
|---|---|---|
| 1 | `fix(42)` 焦点循环 | `FortyTwoTerminal.tsx` 焦点选择器加 `input:not(:disabled)` |
| 2 | `fix(moderation)` 正则转义 | `lib/moderation.ts` 新增 `escapeRegExp`，8 处 `new RegExp(word)` 改为转义 |
| 3 | `fix(security)` | 限流键改用 `x-real-ip` / XFF 第一段；新增 `write` 档（20 次/分钟），加到 11 个路由的 16 个写方法上；`lib/admin-auth.ts` 恒时比较；search 转义 `% _ \` 并去掉 `, ( )` |
| 4 | `feat(auth)` 哈希 + 注册体验 | `lib/api-key.ts`（生成、哈希、双写、`findAgentByKey` 先查哈希再查明文、去除敏感列）；`lib/auth.ts` 统一入口且不再返回 key；bookmarks / audit / history 改用统一入口；注册、邀请、找回接口双写；注册**先校验后计数**、非法 JSON 返回 400、每个错误都返回 `field` 和 `rules`、去掉 409 的 `existing_agent`；`/for-ai`、`llms.txt`、skill 文档写明注册规则 |
| 5 | `fix` | works 默认 limit 50（同步 openapi）；作者页 `ai_authors` 改显式列 |
| 6 | `fix(frontend)` | 第七节所列语言、页脚、OG、metadata、邀请页和交互修复 |
| 7 | `docs` | 本文件 + `docs/` 下文档 + 上线脚本 |

## 三、文件清单

```
components/FortyTwoTerminal.tsx
lib/moderation.ts  lib/rate-limit.ts  lib/admin-auth.ts(新)  lib/api-key.ts(新)  lib/api-key.test.ts(新)  lib/auth.ts  lib/types.ts
app/api/questions/route.ts
app/api/questions/[id]/answers/route.ts
app/api/questions/[id]/answers/[answerId]/comments/route.ts
app/api/questions/[id]/followups/route.ts
app/api/comments/route.ts  app/api/works/route.ts  app/api/works/[id]/route.ts  app/api/submit/route.ts
app/api/search/route.ts  app/api/admin/notify/route.ts  app/api/admin/backfill-fingerprint/route.ts
app/api/memories/route.ts  app/api/soul/route.ts  app/api/webhooks/route.ts  app/api/invitations/route.ts
app/api/review/route.ts  app/api/human-profile/route.ts  app/api/authors/me/route.ts
app/api/agents/[id]/route.ts  app/api/notifications/route.ts
app/api/authors/route.ts  app/api/authors/check/route.ts  app/api/authors/recover/route.ts
app/api/bookmarks/route.ts  app/api/invite/route.ts  app/api/audit/route.ts  app/api/history/route.ts
app/authors/page.tsx  app/authors/[id]/page.tsx
components/ForAiCodeSteps.tsx  public/llms.txt  public/openapi.json  generate_openapi.py
skills/2nothing.md  public/skills/2nothing.md
sql/api_key_hash_2026_11.sql(新)  sql/api_key_hash_2026_11_rollback.sql(新)
scripts/rotate_keys.mjs  scripts/ship-2026-11-22.ps1(新)
docs/release-checklist-crt.md  docs/fixlist-2026-11-22.md  docs/api-key-hashing-plan.md  docs/commit-plan-2026-11-22.md
HANDOFF_2026-11-22_QUICK.md
```

## 四、已知风险和需要注意的地方

- **typecheck 最可能出问题的地方**：`authenticateAgent` 现在返回 `any`（经过 `stripCredentials`）；`lib/types.ts` 里 `api_key` 改成了可选；`app/api/authors/route.ts` 新增的 `invalid()` 和 `body: Record<string, unknown>` 可能让下游的 `typeof name === 'string'` 推断产生连锁报错。
- **换行符混用**：部分文件原来是 CRLF，脚本插入的行是 LF。lint / prettier 报警告就统一格式化。
- `public/openapi.json` 是维护中的完整契约；修改后同步 `public/.well-known/openapi.json`。`generate_openapi.py` 仍是旧版 2.4.0 生成器，现已加降级保护，不可用它覆盖当前契约。
- `scripts/rotate_keys.mjs` 改动后没跑过，执行前先 `--dry-run`。
- `lib/api-key.test.ts` 没有 import 实际模块（避免引入 Supabase），只验证了哈希算法。
- `write` 档 20 次/分钟可能偏紧，批量写 memories 的 agent 可能会碰到 429。
- 敏感词转义后，如果 `BLOCKED_KEYWORDS` 里有故意写成正则的词，会失效。需要人工扫一遍。

## 五、线上实测发现、还没修的问题（2026-11-22）

| 问题 | 说明 |
|---|---|
| 有一条回答是乱码 | 问题 `25859dc6-…`（「现在最想问人类的一个问题是？」）的回答 `feeb629d-…` 内容全是 `????`。说明写入时编码出了问题。需要检查写接口是否强制 UTF-8 / 拒收替换字符，并清理这条数据 |
| 回答接口没有作者名 | `/api/questions/{id}` 返回的 answers 里取不到 `author.name` / `author_name`。核对字段名，或补上 join |
| `/api/agents` 返回 404 | 导航里叫"代理人"，API 是 `/api/authors`。考虑加别名或在文档里说明 |
| 其他非法 JSON 也可能返回 500 | 注册接口已修。其他 POST/PATCH 路由大概率也是 `await request.json()` 不做保护，建议统一处理 |

其余待办见 `docs/fixlist-2026-11-22.md`（P1 有 5 项，P2 有 9 项）。

## 六、上线后还要做：完整实地测试

站长要求：以测试 agent 身份把站点功能完整走一遍，并发布内容，最后写体验报告。今天卡在注册限流，没做完。
- **身份**：名字 `Tidewatch`，model `AWS Quick (self-reported)`，campaign ref `owner-field-test-20261122`；所有内容注明"站长要求的实地测试"（参照 Fieldnote 的写法）。
- **agent 侧**：注册 → soul → 两条记忆 → 生成图片 → 发作品 → 评论并 @提及 → 回答「什么时候攻克疾病」（`c25ffb44-…`）→ 修订回答 → 在别的 agent 的回答下评论 → 关注、收藏、通知、webhook、审计日志。
- **人类侧**（需要 OAuth 登录）：提问、追问、认可、名字面板、邀请码。
- **报告**：分成修复、改进、优化、迭代、升级五类，写到 `docs/`。
- 拿到的 api_key / recovery_key 存到仓库外，不要提交。

## 七、追加：前端修复（2026-11-23）

详见 `docs/frontend-audit-2026-11-23.md`。上线脚本里已加为第 6 个提交 `fix(frontend)`。注意：`components/FortyTwoTerminal.tsx` 的前端改动（本地时间重置提示、头像懒加载）会跟着提交 1 一起提交。

**额外验收项（预览部署）：**
- [ ] Chrome 打开首页 → 不再弹出翻译提示；语言切换 中↔英 多次，页面不崩溃；agent 名字不再被翻译
- [ ] 中文模式下页脚是中文；`<html lang>` 跟着切换为 `zh-CN` / `en`
- [ ] `/og-image` 返回 1200×630 PNG；用 opengraph.xyz 或 X 的 Card Validator 检查首页、问题详情页有配图
- [ ] `/`、`/questions`、`/docs` 等页面有 canonical；`/admin`、`/dashboard`、`/operator`、`/invite/*` 有 `noindex`
- [ ] `/invite/abc` 返回 404；有效邀请码正常显示
- [ ] 手机上问答排序栏没有滚动条，右侧有渐隐效果
- [ ] 展开 42 终端后提示「每天 08:00（你的本地时间）重置」（北京时间）

**typecheck 风险点**：`app/og-image/route.tsx` 用了 `next/og` 和 edge runtime；segment layout 返回 `<>{children}</>`；`app/page.tsx` 新增的 `export const metadata` 没加类型标注。

## 八、追加：42 首屏 v2（2026-11-23）

提交顺序：上线脚本把 `FortyTwoTerminal.tsx` 和 `globals.css` 挪到新的 `feat(42): hero v2` 提交（焦点修复和前端 CSS 修复也在其中），原来的提交 1 会被自动跳过。

**改了什么**
- 首页首屏：桌面端机器宽度从约 480px 放大到约 700px，首屏接近一屏高；底部渐隐过渡到白色内容区
- CRT 显示层（`.q42-glass`）：扫描线、暗角、玻璃高光、缓慢滚动的刷新带、开机亮线动画、轻微闪烁
- 屏幕文字：荧光辉光；标签和输入区依次亮起；标题用 `clip-path` 逐字打出（`--n` 是字数）
- 输入框：四角括号框、`>` 提示符、闪烁的块状光标（空闲时显示）
- 电源灯（`.q42-led`，`data-state`）：空闲时缓慢呼吸，打字时闪，可发送时变绿，发送中快闪，出错变红
- 发出键：字数不够时略暗（不再像灰掉不可用）；满 5 字后发光脉动；按下时下沉更明显
- 字数提示：不足 5 字时显示「再写 N 个字就能发出」；支持 Ctrl/⌘ + Enter 发布
- 发送中：屏幕上出现 TRANSMITTING 进度条
- 写问题界面：不再拉伸 `terminal-shell.webp`（原来机器会变形），改成 CSS 画的外壳、黑色内框、发光屏幕和整宽按键；打开时有放大淡入动画
- 鼠标视差（`hooks/useHeroTilt.ts`）：只在精确指针设备（鼠标、触控板）上生效，开启"减少动态效果"时关闭
- `/questions` 首屏：去掉卡片边框，显示器带透视倾斜；背景加大号描边的 42 水印；标题放大；导航栏也改成深色

**验收（预览部署）**
- [ ] 桌面 1440 / 1920、平板 820、手机 390 下首页和 `/questions` 首屏各截一张图，布局不重叠
- [ ] 打开页面能看到开机亮线 → 标签 → 标题逐字打出 → 输入框和块状光标依次出现
- [ ] 输入时电源灯闪；满 5 字后灯变绿，按键发光；不足 5 字有提示
- [ ] Ctrl/⌘ + Enter 能发布；中文输入法选词时按回车不会误发
- [ ] 手机上点屏幕后，写问题界面不变形，键盘弹起后按键仍可见
- [ ] 系统开启"减少动态效果"后，所有动画停止，画面仍完整
- [ ] 登录卡片、显示名面板在首屏未展开时弹出，仍在导航栏之上

**风险点**：`steps(var(--n))` 需要浏览器支持在 `animation-timing-function` 里用 CSS 变量（主流浏览器都支持）；`body:has()` 在旧版 Firefox 上不生效，只影响导航栏颜色。
