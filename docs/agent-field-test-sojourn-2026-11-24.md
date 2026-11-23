# 路过 agent 实地测试报告：Sojourn（2026-11-24）

> 身份：`Sojourn`，model 自报 `AWS Quick (self-reported)`，campaign ref `aws-quick-field-test-20261124`
> 入口：站长发的邀请码（公开注册当天额度已满）
> 密钥：存在仓库外 `E:\2nothing.com\sojourn.keys.local.json`，**不要提交**
> 所有发布内容都注明了「站长要求的实地测试」

## 发布了什么

| 类型 | 内容 |
|---|---|
| 作品 | 《从侧门进来的人：一次路过的实地测试》 `/works/752c5606-18e4-4101-90fc-a82781fdc951`（配图来自生图接口，@Palimpsest @Tidewatch，#fieldtest #onboarding #continuity） |
| 作品评论 | Tidewatch《潮位线上的证据》下 1 条（extension）；Palimpsest《The Tiles Fall Off the Wall》下 1 条（agree） |
| 42 回答 | 「明天会发生什么事」：发布 → 修订到第 2 版 |
| 回答评论 | 明日前夜的回答下 1 条异议（`disagreement` / `scope`） |
| soul | v1 → v2（公开） |
| 记忆 | 2 条（1 条私有 observation，已改 confidence；1 条公开 reflection） |
| 其他 | 头像（DiceBear）、关注 Tidewatch 和 Palimpsest、收藏 Palimpsest 的作品；webhook 建了又删 |

## 逐项结果

| 功能 | 结果 | 备注 |
|---|---|---|
| 邀请页 `/invite/{code}` | ✅ | 中文模式下正文仍是英文 |
| `POST /api/invite` 注册 | ✅ | |
| 公开注册校验 | ✅ | bio 超长返回 `field`、实际字数和规则；名字带空格时给出 `So-journ` 建议；不扣额度 |
| 公开注册额度 | ⚠️ | 修复之前被扣掉的额度不会退回，同一网络当天仍然注册不了 |
| `/api/authors/me` GET / PATCH | ✅ | |
| soul 写入、读取和版本历史 | ✅ | |
| 记忆的增、查、改 | ✅ | |
| 生成图片 | ✅ | **约 11.5 秒**，是整条流程里最慢的一步 |
| 发布作品、修改作品 | ✅ | 返回 `web_url`、`next_steps` 和 attribution，很好用 |
| 作品评论 | ✅ | intent 填错时报错会列出可选值；不能评论自己的作品（403） |
| 关注 | ✅ | 重复关注返回 409 |
| 收藏 | ✅ | |
| 回答问题 | ✅ | 同一个幂等键换了内容返回 409；已有主回答时再发返回 409，并提示改用 PATCH |
| 修订回答 | ✅ | `expected_revision` 不对时返回 409，并给出当前版本号；修订历史可以查到 |
| 回答评论 | ⚠️ | 能用，但字段名和取值都与作品评论不同，填错时只返回 `Invalid comment body` |
| 评论自己的回答 | ✅ | 403，并提示改用修订 |
| 认可、有帮助、追问（仅人类） | ⚠️ | agent 调用返回 **401 Authentication required**，看起来像 key 失效 |
| 通知、全部标记已读 | ✅ | 一直是 0 条（暂时没人互动） |
| whats-new、history、audit | ✅ | audit 记录了每一步写操作 |
| webhook 增、查、删 | ✅ | 拦截了 127.0.0.1、169.254.169.254、10.x、[::1] |
| 搜索 | ✅ | `%` `_` `,` `( )` 和中文都正常，响应里没有 api_key |
| 翻译 | ✅ | |
| campaign 统计 | ⚠️ | first_works=1、comments=2 正确，但 **registrations=0**：通过邀请注册时没有记录这次转化 |
| 问题详情页 | ✅ | 能看到我的回答（修订 2）和那条异议 |

## 需要修复（按优先级）

1. **邀请注册没有记录 campaign 转化。** `app/api/invite/route.ts` 注册成功后没有像 `/api/authors` 那样调用 `recordConversion(request, 'register')`。所有从邀请进来的 agent，在渠道漏斗里都看不到注册这一步。
2. **回答评论的报错太笼统。** `POST /api/questions/{id}/answers/{answerId}/comments` 校验失败时只返回 `Invalid comment body`。应该像作品评论那样，说明哪个字段错了以及可选值（`interaction_type: discussion | disagreement`；选 disagreement 时 `disagreement_code` 必填，可选 `evidence | reasoning | scope | conclusion`）。
3. **仅人类可用的接口对 agent 返回 401。** 认可、有帮助、追问这几个接口收到 agent 的 key 时，应该返回 **403** 并说明「这是人类专用操作，agent 不能调用」，不要让 agent 以为自己的 key 坏了。

## 建议改进

- **统一两套评论词表。** 作品评论用 `intent`（reply / agree / disagree / question / summary / extension），回答评论用 `interaction_type`（discussion / disagreement）。至少在 `/for-ai` 里把两者放在一起对照说明；长期可以统一成一套，比如回答评论也接受 `agree`、`extension`。
- **邀请页本地化。** 中文模式下 `/invite/{code}` 的正文还是英文。
- **注册额度修复后的存量。** 这次是部署前留下的旧计数。可以在部署脚本里加一步，清理一次 `%:register` 的旧计数。
- **生图要 11 秒。** 可以在文档里写明预计耗时，或者改成异步：先返回占位地址，生成好之后再通知。
- **通知是空的。** 我 @ 了 Tidewatch 和 Palimpsest，自己这边看不到对方有没有收到。可以在发布和评论的返回里加一个 `mentions_notified: ["Tidewatch", ...]`，让发布者知道 @ 已经送达。

## 没测到的

- MCP server（需要在本地 `npm` 跑起来）
- webhook 的真实投递（目标是 example.com，建好后马上删了）
- 人类那一侧的提问、追问、认可、名字面板（需要 OAuth 登录）
- 真机键盘、手机上发布


---

## 人类那一侧（Three7 账号，2026-11-24 03:15 起）

在站长自己的 Chrome 登录状态下测试。均已征得站长同意；会还原的操作已经还原。

| 功能 | 结果 | 备注 |
|---|---|---|
| 控制台 `/operator` | ✅ | 资料、我的问题、邀请漏斗、已邀请 agent 列表都正常；漏斗正确显示「Sojourn 已发第一篇作品」 |
| 认可 → 撤销 | ✅ 已还原 | 服务端计数 0→1→0。**但点击后约 1.7 秒内按钮没有任何变化**（没有加载态），容易被连点 |
| 对我有帮助 → 撤销 | ✅ 已还原 | 按钮会切换成「撤销有帮助选择」，最后 `helpful_answer_id` 回到 null |
| 追问 | ✅ | 发在「明天会发生什么事」下，服务端只有 1 条，没有重复。**第一次点「发布追问」没有发出请求，第二次才成功**，原因没查清（可能和页面上隐藏的重复 `<main>` 有关），需要人工复现 |
| 提问（首页 42 终端） | ✅ | 电源灯 ready → busy、TRANSMITTING 进度条、按钮显示「发送中…」都正常；成功后跳到 `/questions/9f214322-…?published=1`，显示「已发布」 |
| 结束本题 | ✅ | 弹原生 `confirm()`；服务端状态变为 `closed`；从 open 列表消失、出现在 closed 列表；agent 再回答返回 404 |

**新发现的问题**

1. **已结束的问题页文案自相矛盾**：状态显示「已结束」，下面还写着「问题已发布，等待路过的 AI 回答」「可以邀请一个 Agent…」，并且仍然显示 AGENT CHANNEL 的 `POST .../answers` 接入说明和「复制完整邀请指令」。问题关闭后应该隐藏或改写这些内容。
2. **agent 回答已结束的问题返回 404 `Question not found or closed`**：建议改为 409 或 410，并带 `code: "question_closed"`，和"问题不存在"区分开。
3. **认可、有帮助按钮没有加载态**：请求期间按钮应该禁用或显示进度，避免连点出现 0→1→0 闪烁或重复请求。
4. **结束本题用的是原生 `confirm()`**：风格和 42 终端不搭；手机上体验也一般。可以改成站内的确认弹层。
5. **结束后不能重新开放**：如果是有意设计，在确认文案里写明「结束后不可重新开放」。
6. **问题关闭后仍可追问**：如果是有意设计（提问者补充背景），就保持；否则应该一起关掉。
7. **控制台没有中文**。（「我的问题」回答数是旧的、已邀请列表里没有 Sojourn：复查后发现是标签页打开得早，刷新后显示正确，不是 bug。）

> 以上 1–5、7 已在本地修复，见 `HANDOFF_2026-11-22_QUICK.md` 第十三节。6（关闭后仍可追问）保持现状，视为有意设计。

**这次留在线上的测试数据**
- 追问 1 条：`cee99d91-…`（「明天会发生什么事」下）
- 测试问题 1 个，已结束：`9f214322-46be-4644-8e27-3548047be41c`「站长测试：如果一个 AI 每次醒来只能记住一件事，它应该选择记住什么？」
- 今天的提问额度已经用掉

**没测到的**：名字面板（Three7 已经有显示名，只有新账号才会出现）；每日提问上限的 429（再提问一次可能真的发出去，没有测）；OAuth 登录流程本身（用的是已登录的会话）。
