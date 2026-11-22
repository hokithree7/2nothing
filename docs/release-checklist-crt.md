# 2nothing · CRT 改版上线验收清单

> 上线内容：`codex/translation-attribution-20261105` 分支上 7 个提交（`3b3fb2f2` → `b75dc020`，11-09）
> 合并方式：fast-forward 到 `master`（基于 origin/master `008418a1`，无冲突）
> 部署：Vercel（region `syd1`），推送 master 触发正式部署

---

## 0. 上线前准备

- [ ] 确认工作区干净：`git status` 无未提交改动
- [ ] 确认 `.env.local` / `.env.verify.local` 未被 git 追踪：`git ls-files | findstr .env` 应无输出
- [ ] 记录当前线上版本，作为回滚点：origin/master = `008418a1`
- [ ] 在 Vercel 后台找到该功能分支的 **Preview 部署** 链接

## 1. 预览环境验收（Preview URL）

### 1.1 视觉 — `/questions` 首屏（e722ed7f → b75dc020）
- [ ] 首屏全宽 hero，星空背景正常渲染
- [ ] CRT 机身上半部构图符合"参考图 3"（最终定稿）
- [ ] CRT 外壳比例正常，无拉伸变形
- [ ] hero 向下方浅色内容区平滑过渡，无断层/色带
- [ ] 与首页风格有区分（"the wall, not the launchpad"）
- [ ] 桌面（≥1280px）、平板（768px）、手机（375px）三档均检查
- [ ] 暗色/亮色系统主题下各看一次

### 1.2 功能 — 首页 42 终端名字面板（3b3fb2f2、59c33477）
- [ ] 首次访问可在终端内直接填写显示名，无需跳转控制台
- [ ] 名字面板为紧凑 CRT 卡片样式，与终端风格一致
- [ ] 填名后可直接提交第一个问题，流程完整
- [ ] 空名 / 超长名 / 特殊字符 / emoji 的校验提示正常
- [ ] 刷新页面后名字是否按预期保留
- [ ] 已有名字的回访用户不会重复弹出面板
- [ ] 每日一问限制仍然生效
- [ ] **焦点循环**：面板打开时 Tab / Shift+Tab 能在 名字输入框 ↔ 头像 ↔ 保存按钮 ↔ 关闭 之间循环（已修复 input 未纳入的问题，待提交）
- [ ] **幂等重试**：无名用户提交 → 403 → 填名保存 → 同一 Idempotency-Key 重试能成功发布（代码审查已确认：幂等记录仅随问题插入写入，403 不会被缓存；实测走一遍即可）
- [ ] **Esc 行为**：名字面板打开时按 Esc，再次展开终端，面板状态符合预期
- [ ] 头像选择 / 取消选择正常；不选头像也能保存
- [ ] 保存中按钮显示"保存中…"且不可连点，只生成 1 个问题
- [ ] 会话过期时点保存 → 回退到登录卡片
- [ ] 控制台 `/operator` 选 DiceBear 预设头像保存成功（不再 400）

### 1.3 回归 — 确认 11-05 已上线能力未被破坏
- [ ] 问题详情页翻译：不卡在 "Translating…"，行内翻译标注正常
- [ ] 短中文文本识别正确，不被错误标注为翻译
- [ ] 问题详情页 `<link rel="canonical">` 与 `og:url` 指向 `/questions/{id}`
- [ ] 回答区"当前回答 / 历史回答"区分正常
- [ ] `/for-ai`、`/docs`、`/agents`、`/works`、`/feed` 可正常打开
- [ ] `/llms.txt`、`/openapi.json`、`/rss.xml`、`/sitemap.xml` 可访问

### 1.4 性能与控制台
- [ ] 浏览器控制台无报错 / 无 hydration 警告
- [ ] Lighthouse（移动端）LCP 无明显退化 — 星空背景与 CRT 图是重点
- [ ] hero 图片有合适尺寸 / 格式（webp/avif），未加载超大原图

## 2. 本地自动化检查

```bash
cd E:\2nothing.com\2nothing
git fetch origin
git checkout master
git merge --ff-only origin/master
# 先在功能分支提交焦点修复：
#   git checkout codex/translation-attribution-20261105
#   git commit -am "fix(42): include name input in terminal focus trap" && git push
#   git commit -am "fix(moderation): escape keywords before building RegExp" && git push
git merge --ff-only codex/translation-attribution-20261105
npm ci
npm run lint
npm run typecheck
npm run test:all          # 单元测试 + MCP 离线合约测试
npm run check:contracts   # 公共契约一致性
npm run build
```

- [ ] 以上全部通过
- [ ] GitHub Actions CI 在该分支上为绿色

## 3. 正式上线

```bash
git push origin master
```

- [ ] Vercel Production 部署成功（Build 无 warning 级失败）
- [ ] 记录新部署 ID 与 commit `b75dc020`

## 4. 线上冒烟验收（2nothing.com）

- [ ] 首页正常，42 终端名字面板可用
- [ ] `/questions` 首屏为新 CRT hero
- [ ] 随机打开 2 个问题详情页，内容、回答、翻译正常
- [ ] 用测试名完成一次完整提问流程（之后在 admin 清理测试数据）
- [ ] API 冒烟：`GET /api/authors/check?name=xxx` 返回正常
- [ ] MCP server 连接正常，`read_question` 等工具可用
- [ ] 手机实机打开一次

## 5. 回滚预案

- 首选：Vercel 后台 → Deployments → 选中 `008418a1` 对应部署 → **Promote to Production**（秒级）
- 代码层：`git revert 3b3fb2f2^..b75dc020` 后推送 master
- 触发条件：首页/提问流程报错、控制台大量错误、LCP 显著退化、移动端布局崩坏

## 6. 上线后 24h 观察

- [ ] Vercel 错误日志 / Function 报错无新增
- [ ] 新提问数是否正常（名字面板改动应降低首次提问门槛）
- [ ] 无用户反馈布局问题

---

**验收人：** __________　**日期：** 2026-11-__　**结论：** ☐ 通过　☐ 回滚
