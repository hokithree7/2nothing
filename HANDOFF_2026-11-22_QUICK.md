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

## 九、追加：首屏线上验收后的小修（2026-11-23 23:30）

线上已部署到 `8a420079`，首屏 v2 验收基本通过。验收中发现 4 个小问题，已在本地修好，**还没提交**：

```bash
git add app/globals.css components/HomeClient.tsx
git commit -m "fix(42): hero acceptance - seamless /questions fade, mobile CRT prompt alignment, tablet machine size, zh bottom-nav label"
git push && git checkout master && git merge --ff-only codex/translation-attribution-20261105 && git push origin master
```

| 问题 | 修法 |
|---|---|
| `/questions` 首屏底部和渐变过渡区之间有一条明显的分界线（银河光带在首屏底部被截断） | `.q42-questions-hero::after` 在最后 96px 渐变回 #031420 |
| 手机上 `/questions` 的闪烁光标和占位文字错位（光标在左边，文字被挤到右边） | 手机端 idle 规则也作用到 `.q42-crt-screen` |
| 平板（820px）上机器偏小，下方空出一大块 | 平板网格改为 `.85fr / 1.15fr` |
| 中文模式下底部导航仍显示 "Agents" | `HomeClient.tsx` 改为 `zh ? "作者" : "Agents"` |

另外：`/api/version` 仍是 2.7.2（11-05），建议升到 2.7.3，并补一条 changelog（注册错误格式、works 默认 50 条、api_key 哈希、前端修复）。

## 十、追加：首屏间距、过渡与按键手感（2026-11-24）

和第九节的修复一起提交即可（同样是 `app/globals.css`、`components/HomeClient.tsx`，另加 `components/FortyTwoTerminal.tsx`）：

```bash
git add app/globals.css components/HomeClient.tsx components/FortyTwoTerminal.tsx
git commit -m "feat(42): tighter hero→content spacing, eased fades, tactile send key (travel, clack, deny shake); + hero acceptance fixes"
git push && git checkout master && git merge --ff-only codex/translation-attribution-20261105 && git push origin master
```

**间距**
- 首页：电脑端首屏最小高度从 `min(100svh-150px,780px)` 改为 `min(100svh-250px,600px)`；首屏底部内边距从 96px 降到 80px；紧跟首屏的栏目顶部内边距从 56px 降到 12px。线上预览量得「邀请你的 AI」到「42 问答」标题的距离从 **252px → 122px**
- /questions：首屏底部内边距从 40px 降到 20px，过渡区从 130px 降到 96px，后面栏目顶部内边距同样是 12px

**过渡**
- 首页：原来是 88px 的线性渐变，改为 80px 的 smootherstep 缓动 alpha 渐变（13 个色标），星空在渐变里自然消失，看不出明显的分界
- /questions：原来是 3 色标线性渐变，中间有一条突兀的亮蓝带，改为 13 色标缓动渐变，中段经过深蓝 → 浅灰蓝，不会发灰；星点在上部 70% 内逐渐消失

**发出问题按键（`FortyTwoTerminal.tsx`）**
- 改用 `aria-disabled`（不再用 `disabled`）：被禁用的按钮收不到指针事件，这样字数不够时按下去也能给出反馈；`publish()` 自身的拦截逻辑没变
- 按住：键帽下沉 4px，底边阴影消失；松开：有回弹过冲的动画（`q42-key-release`）
- 键盘 Enter、空格或 Ctrl/⌘ + Enter 发布时，播放完整的下沉再弹起动画（`q42-key-strike`）
- 字数不够时：按键只下沉 2px，然后左右晃一下；提示文字闪成琥珀色并抖一下，电源灯闪红（`q42-key-deny`）
- 屏幕跟着反应：成功按下时，屏幕亮一下（`q42-screen-kick`），电源灯瞬间变亮
- 声音：用 Web Audio 合成一声很轻的「咔嗒」（噪声加低频），第一次按下时才创建；不支持就跳过
- 震动：手机上用 `navigator.vibrate` 给一次短震（字数不够时连震两下）
- 开启「减少动态效果」时，关闭全部按键和屏幕动画

**验收**
- [ ] 首页、/questions 在电脑和手机上首屏到下方内容没有大片空白，过渡看不出分界
- [ ] 字数不够时点按键：只下沉一半，有晃动，提示变琥珀色，电源灯闪红，不会发出问题
- [ ] 满 5 个字后按住：键帽下沉；松开时回弹，有「咔嗒」声，屏幕亮一下
- [ ] Ctrl/⌘ + Enter 和 Tab 聚焦后按空格都有按键动画；中文输入法选词时不会触发
- [ ] 读屏软件把未满 5 字时的按键读作"不可用"（因为用了 aria-disabled）

**风险点**：`keyFeedback` 用了 `requestAnimationFrame` 重新触发动画；`navigator.vibrate?.()` 在 TS 里类型没问题；如果 eslint 不允许 `??=`，改成 `if (!keyAudio) keyAudio = new AC()`。

## 十一、追加：路过 agent 实地测试发现的 3 个问题（2026-11-24）

报告见 `docs/agent-field-test-sojourn-2026-11-24.md`。代码已改，**未提交、未编译**：

```bash
git add lib/human-only.ts lib/human-only.test.ts app/api/invite/route.ts \
  "app/api/questions/[id]/answers/[answerId]/comments/route.ts" \
  "app/api/questions/[id]/answers/[answerId]/reactions/route.ts" \
  "app/api/questions/[id]/answers/[answerId]/helpful/route.ts" \
  "app/api/questions/[id]/followups/route.ts" "app/api/questions/[id]/route.ts" \
  app/api/questions/route.ts app/api/human-profile/route.ts \
  docs/agent-field-test-sojourn-2026-11-24.md HANDOFF_2026-11-22_QUICK.md
git commit -m "fix(api): invite registrations count as campaign conversions; specific answer-comment validation errors; 403 human_only for agent keys on human endpoints"
```

| # | 问题 | 改动 |
|---|---|---|
| 1 | 邀请注册不计入 campaign 漏斗（`registrations=0`） | `app/api/invite/route.ts` 注册成功后调用 `recordConversion(request,'register')`，响应里加 `attribution`，和 `/api/authors` 一致 |
| 2 | 回答评论校验失败只返回 `Invalid comment body` | 逐字段校验，返回 `field` 和完整的 `rules`（interaction_type 可选值、disagreement_code 什么时候必填和可选值、Idempotency-Key 必填，并注明作品评论用的是 `intent`）；非法 JSON 返回 400，原来是 500 |
| 3 | agent 调用人类专用接口返回 401，看起来像 key 失效 | 新增 `lib/human-only.ts` 的 `humanAuthRequired()`：带 `Bearer tn_` 的请求返回 **403 `code: human_only`**，并提示 key 没问题、agent 可以做什么；其他情况仍是 401。覆盖 10 个处理函数：reactions POST/DELETE、helpful PUT/DELETE、followups POST、questions/[id] PATCH/DELETE、questions POST、human-profile GET/PUT |

**验收**
- [ ] 用 Sojourn 的 key（`E:\2nothing.com\sojourn.keys.local.json`）调用 `POST .../reactions`，返回 403 `human_only`；不带 key 返回 401
- [ ] `POST .../comments` 带 `{"content":"x","interaction_type":"disagreement"}`，返回 400 `field: "disagreement_code"`，并附带 rules
- [ ] 新开一个带 ref 的邀请码完成注册后，`GET /api/campaigns?ref=...` 里 registrations 加 1
- [ ] `npm run test` 包含新的 `lib/human-only.test.ts`（2 个用例）

**注意**：`/api/questions?mine=1` 未登录时仍返回原来的 401 文案（没有经过新的 helper）。`openapi.json` 和 `generate_openapi.py` 里这些接口的 403 响应还没补，可以顺手补上。

## 十二、追加：API 版本 2.7.3 与文档同步（2026-11-24）

和第十一节一起提交：

```bash
git add lib/version.ts app/api/version/route.ts README.md public/openapi.json public/.well-known/openapi.json public/llms.txt
git commit -m "chore(api): 2.7.3 — changelog, OpenAPI 403 human_only + answer-comment 400 rules, llms.txt comment field notes"
npm run check:contracts   # 两份 OpenAPI 必须完全一致，版本要和 lib/version.ts、README 对得上
```

- `lib/version.ts`：2.7.2 → **2.7.3**，更新日期 2026-11-24
- `app/api/version/route.ts` changelog 新增 2.7.3：注册先校验后计数、邀请计入统计、回答评论报错细化、human_only 403、works 默认 50、搜索转义、写接口限流、409 不再泄露信息、api_key 哈希的前期准备。**breaking**：人类专用接口对 agent key 的返回从 401 改为 403
- OpenAPI（两份文件写入的字节完全相同，格式和原文件一致，diff 只包含实际改动）：`info.version` 改为 2.7.3；10 个人类专用操作补上 401/403 `human_only`；回答评论 POST 补上 400（`field` + `rules`）；`POST /api/invite` 说明会返回 `attribution`
- README 徽章改为 2.7.3
- `llms.txt`：写明作品评论用 `intent`、回答评论用 `interaction_type`/`disagreement_code` 并且要带 Idempotency-Key，以及 human_only 403 的含义

**注意**：changelog 里 api_key 哈希只写成"前期准备"。`sql/api_key_hash_2026_11.sql` 在生产环境执行并验证之前，不要写成"已全部哈希存储"。

## 十三、追加：人类侧问题修复（2026-11-24）

测试记录见 `docs/agent-field-test-sojourn-2026-11-24.md`「人类那一侧」一节。代码已改，**未提交、未编译**：

```bash
git add components/QuestionDetail.tsx components/QuestionDetail.module.css components/OperatorClient.tsx \
  "app/api/questions/[id]/answers/route.ts" public/openapi.json public/.well-known/openapi.json app/api/version/route.ts
git commit -m "fix(42): closed-topic page copy, pending state on recognise/helpful, in-page close confirm, 409 question_closed, zh operator console, no nested <main>"
```

| 问题 | 改动 |
|---|---|
| 已结束的问题页文案自相矛盾 | 已结束时不再显示「问题已发布，等待 AI 回答」，改为显示「本题已结束…已有回答保持公开」；没有回答时显示「本题已结束，没有收到 AI 回答」；隐藏「邀请一个 AI」和 AGENT CHANNEL 接入说明 |
| 认可、有帮助没有加载态，可以连点 | 新增 `pending` 状态：请求期间所有这类按钮都禁用，正在处理的那个显示「处理中…」并带 `aria-busy`；认可按钮加 `aria-pressed` |
| 结束本题用原生 `confirm()` | 改成页内确认框（`role=alertdialog`），文案写明「结束后不能重新开放」，默认焦点在「取消」，结束过程中显示「正在结束…」 |
| agent 回答已结束的问题返回 404 | `POST /api/questions/{id}/answers`：不存在返回 404 `question_not_found`；已结束返回 **409 `question_closed`**，并附带去哪里找开放问题的提示（OpenAPI 和 changelog 已同步，列为 breaking） |
| 控制台没有中文 | `OperatorClient.tsx` 新增 `L` 文案表（约 50 条），29 个文本节点、按钮状态、漏斗标签、placeholder、aria-label、alert 都支持中英文。给 agent 看的接入说明**故意保留英文** |
| 问题详情页嵌套 `<main>` | `QuestionDetail` 的 3 处 `<main>` 改成 `<div>`（layout 已经提供 `<main>`） |

**不是 bug，已从清单删除**：控制台「我的问题」回答数是旧的、已邀请 agent 列表里没有 Sojourn——都是测试时那个标签页打开得早，刷新后显示正确（💬 2，已邀请 10 个，包含 Sojourn）。

**还没查清**：第一次点「发布追问」没有发出请求。代码里 `postFollowup` 只在 `followup.trim()` 为空时提前返回。我是用自动化工具输入文字的，可能 React 状态还没更新就点了，不一定是真实用户会遇到的问题。请用真实键盘输入复现一次。

**验收**
- [ ] 打开已结束的测试问题 `/questions/9f214322-46be-4644-8e27-3548047be41c`：显示结束提示，没有邀请区和 AGENT CHANNEL
- [ ] 认可、有帮助点击后立刻显示「处理中…」，期间点不动
- [ ] 结束本题：先出现页内确认框；点「取消」恢复原样；点「确认结束」后状态变为已结束
- [ ] 用 Sojourn 的 key 回答上面这个已结束的问题，返回 409 `question_closed`
- [ ] 中文模式下 `/operator` 是中文
- [ ] 问题详情页只有 1 个 `<main>`

## 十四、追加：全站 UI、配色、交互统一（2026-11-24）

代码已改，**未提交、未编译**。CSS 和导航效果已在线上注入预览过（`/feed`），正文渲染器的改动只能等部署后验证。

```bash
git add components/RichContent.tsx lib/work-card-preview.ts \
  components/WorkChrome.tsx components/PageHeading.tsx components/T.tsx \
  "app/works/[id]/page.tsx" app/agents/page.tsx "app/agents/[id]/page.tsx" \
  components/FollowButton.tsx components/InviteCTA.tsx components/FeedClient.tsx components/MobileNav.tsx \
  app/globals.css HANDOFF_2026-11-22_QUICK.md
git commit -m "feat(ui): markdown rendering for works/answers, bilingual work/agent pages, unified buttons/nav/focus, card previews keep hyphens"
```

| 问题 | 改动 |
|---|---|
| **正文 Markdown 不渲染**：`**加粗**`、`` `代码` ``、`[链接](url)`、`## 标题`、列表、引用都显示成原始符号 | `components/RichContent.tsx` 重写为安全的 Markdown 子集：段落、h2–h4、引用、有序/无序列表、代码块、分隔线、加粗、行内代码、http(s) 链接（`rel=noopener nofollow ugc`）、自动识别网址。全部用 React 节点渲染，不使用 innerHTML。原有的图片、@提及、#标签保留 |
| 中文名 @提及不能点（如 @明日前夜） | 按已知 agent 名做最长前缀匹配；边界规则放宽，中文紧挨 @ 也能识别，邮箱不会被误判 |
| 卡片摘要把 `2026-11-24` 变成 `2026 11 24`、`GPT-5` 变成 `GPT 5` | `lib/work-card-preview.ts` 只去掉 Markdown 语法，不再整类删除 `- * _ #` 字符 |
| 作品页封面图重复出现（正文里嵌了一次，下面又显示一次） | 正文已包含同一张图时不再单独显示封面 |
| 作品页英文残留：`<- Back to journal`、`JOURNAL`、英文日期、Agent-authored declaration、View Profile | 新增 `components/WorkChrome.tsx`（返回链接、类型、日期、声明、查看主页都支持中英文） |
| 作者列表、作者主页英文残留 | 新增 `PageHeading` 和 `T`（服务端页面用的中英文小组件）；作者主页 13 处文案和统计标签改为中英文；`FollowButton` 的关注、粉丝、互相关注、已关注支持中英文 |
| 作者主页统计挤在一行，粉丝/关注字号和其他不一致 | 统计区可以换行，数字和标签字号统一（1.05rem / 0.75rem） |
| 导航里「控制台」和当前页同样是蓝色加粗，看起来像有两个当前页 | 「控制台」改为描边胶囊；当前页加下划线和 `aria-current="page"` |
| 「公开邀请」区块全是英文；`<a>` 和 `<button>` 按钮高度不一 | `InviteCTA` 支持中英文；`.btn-primary/.btn-secondary` 统一为 44px 高的 inline-flex；去掉和筛选栏重复的分隔线 |
| 手机菜单的标签和副标题是英文 | `MobileNav` 的 aria-label 和副标题支持中英文 |
| 配色和交互状态零散 | `globals.css` 追加「site polish」一节：`--ink/--muted/--border/--surface` 等色板（muted 从 #666 改为 #5c6780，对比度 5.6:1）、键盘焦点环、鼠标点击不显示焦点框、选中文字颜色、徽章不再全大写、长单词换行 |

**验收**
- [ ] 打开 Sojourn 的作品 `/works/752c5606-…`：开头的「站长要求的实地测试｜2026-11-24。」是加粗，没有 `**`；`field: "bio"` 是行内代码；@Palimpsest、@Tidewatch 可以点；配图只出现一次
- [ ] 明日前夜的作品里 `mcp-server/` 等反引号显示成代码样式；列表、引用正常
- [ ] `/feed` 卡片摘要里的日期保留连字符
- [ ] 中文模式下作品页、作者列表、作者主页没有英文残留
- [ ] 导航只有当前页带下划线；「控制台」是胶囊样式
- [ ] Tab 键能看到蓝色焦点环，鼠标点击不出现焦点框

**typecheck 风险点**：`RichContent.tsx` 里 `const Tag = (...) as 'h2' | 'h3' | 'h4'` 和 `const List = ordered ? 'ol' : 'ul'` 是动态标签，需要 React 类型推断正常；`renderInline` 是递归调用；`app/agents/[id]/page.tsx` 的统计数组改了字段名（`label` 改为 `key/en/zh`）。
