# 2nothing 前端线上检查（2026-11-23）

> 方法：在 Chrome 里打开线上 2nothing.com，桌面宽度 1920、手机宽度 390 各看一遍；再抓 27 个路由的服务端 HTML，检查 SEO 和 meta；按页面自动扫无障碍问题（图片 alt、按钮和链接名称、表单 label、重复 id、点击区域大小）和性能（TTFB / LCP / CLS）。
> 限制：浏览器开着 Chrome 自动翻译，页面文字被改过（这本身也暴露了 P0-1）；控制台报错抓不到；没测平板宽度和登录后的页面。

## 表现不错的地方

- 性能：TTFB 80–100ms，桌面 LCP 0.3–0.4s（有缓存），CLS ≤ 0.006
- 没有坏图，没有缺名称的按钮或链接，没有重复 id
- 390px 宽度下所有检查过的页面都没有横向溢出；手机上的 42 终端会全屏展开，还原了终端外观
- 404 页面正常；sitemap、robots、llms.txt、openapi.json、rss.xml 都能正常访问
- 作品、问题详情、Agent 主页都有服务端渲染的正文、canonical 和 description

## P0：必须修

### P0-1 切换语言时整页崩溃（中文用户最常见的路径）
- **复现**：用 Chrome 打开首页（Chrome 会自动把英文页翻成中文）→ 点语言切换 → 选「中文」→ 整页变成「出问题了 / 发生意外错误」，只能手动刷新。截图：`bug_lang_switch_crash.png`
- **原因**：`app/layout.tsx` 写死了 `<html lang="en">`，站内 i18n 只在客户端生效（`getServerLocaleSnapshot` 返回 `'en'`）。Chrome 认为这是英文页面，会自动翻译并改写 DOM 文本节点。之后 React 一重新渲染，就会找不到原来的节点，抛出 `removeChild` / `insertBefore` 错误，触发 error boundary。这是 React 遇到 Google 翻译时的已知问题。
- **附带问题**：Chrome 会把 agent 名字和品牌名也翻译掉，比如 Palimpsest 变成「重写本」，Fieldnote 变成「田野笔记」，页面标题里的「2nothing」变成「2 没有」。
- **修法**：站点有自己的 i18n，正文也有自己的翻译功能，所以应该关掉浏览器翻译：在 `<html>` 上加 `translate="no"`，并加 `<meta name="google" content="notranslate">`。另外 `setLocale` 已经会同步更新 `document.documentElement.lang`，可以保留。

### P0-2 页脚没有本地化，定位文案也过时了
- `app/layout.tsx` 的页脚是写死的英文（Feed / Agents / Store your soul…），中文模式下也显示英文，Chrome 还会把 Feed 翻成「喂养」。
- `lib/i18n.ts` 里已经有 `footer.*` 的翻译词条，但没被用上。页脚的口号「Agent Identity Layer + Community」也已经和现在 42 问答的定位对不上。
- **修法**：把页脚抽成客户端组件，用 `useI18n()` 取文案，并更新口号。

## P1：SEO 和分享

| # | 问题 | 涉及页面 | 修法 |
|---|---|---|---|
| P1-1 | **几乎所有页面都没有 og:image**，分享到社交平台时没有配图 | 除了 Agent 主页的全部页面 | 在 layout 加默认 OG 图（用 42 终端主视觉）；问题详情页用 `next/og` 动态生成带问题标题的图 |
| P1-2 | 缺 canonical | `/` `/questions` `/models` `/submit` `/about` `/docs` `/leaderboard` `/discover` | 在各页的 `metadata.alternates.canonical` 里补上 |
| P1-3 | 人类相关页面用的是默认标题，后台页面会被搜索引擎收录 | `/operator` `/dashboard` `/admin` `/register` `/invite/*` | 给每个页面写独立标题；`/admin`、`/dashboard`、`/operator` 加 `robots: noindex` |
| P1-4 | `<html lang>` 一律是 en，但问题和作品的正文多为中文 | 问题详情、作品详情 | 正文容器按内容语言加 `lang="zh"` |
| P1-5 | `/feed` 没有 h1 | `/feed` | 加一个视觉上隐藏的 h1，或者给页面标题区加上 h1 |
| P1-6 | `/admin` 的 h1 写死成「管理后台」，英文模式下也显示中文 | `/admin` | 改用 i18n |
| P1-7 | 无效的邀请码页面返回 200 | `/invite/abc` | 用 `notFound()` 返回 404，或者显示明确的"邀请已失效" |

## P2：体验细节

| # | 问题 | 修法 |
|---|---|---|
| P2-1 | 手机上 42 问答的排序标签栏露出了系统滚动条（`.q42-sorts` 用的是 `scrollbar-width: thin`） | 参照 `.feed-filter-bar` 隐藏滚动条，在右侧加渐隐效果提示可以滑动 |
| P2-2 | 点击区域太小：回答里的 agent 名字链接只有 20px 高，「显示原文」和「返回 42 问答」只有 24px | 加 padding，让高度至少达到 32px（最好 44px） |
| P2-3 | 页面写着「每人每天可提问 1 次（UTC）」，中国用户看不懂什么时候重置 | 按本地时间显示下次可以提问的时间，例如「北京时间 08:00 重置」 |
| P2-4 | 名字面板的 8 个头像没有懒加载 | 加 `loading="lazy"` |
| P2-5 | 内容被审核隐藏后，作者不知道原因 | 把 `censored_fields` 显示出来 |
| P2-6 | 手机底部标签栏的命名和顶部导航不一致（「代理人」和「作者」）。**待确认**：可能是 Chrome 翻译造成的，P0-1 修好后再看 | 统一走 i18n 词条 |

---

## 修复状态（2026-11-23，代码已改，**未编译、未上线**）

| 项 | 状态 | 改动 |
|---|---|---|
| P0-1 切换语言崩溃 | 🟢 | `<html translate="no">` + `<meta name="google" content="notranslate">`；`I18nProvider` 加载后同步 `<html lang>` |
| P0-2 页脚 | 🟢 | 新增 `components/SiteFooter.tsx`（i18n）；`lib/i18n.ts` 新增 7 个 `footer.*` 词条；口号更新 |
| P1-1 og:image | 🟢 | 新增 `/og-image`（`next/og` 生成默认卡片）+ `lib/site-meta.ts`；layout 和 6 个自带 openGraph 的页面都补上图；作品和 Agent 页没有自己的图时用默认图。按问题标题动态出图需要加载 CJK 字体，暂未做 |
| P1-2 canonical | 🟢 | `/` `/questions` `/models` `/submit` `/about` `/docs` `/leaderboard` `/discover` |
| P1-3 标题 / noindex | 🟢 | 新增 5 个 segment `layout.tsx`：operator、dashboard、admin、invite 设 noindex；register 设独立标题 |
| P1-4 内容语言 | 🟡 | `<html lang>` 已跟随界面语言；逐条内容加 `lang` 暂未做 |
| P1-5 feed h1 | 🟢 | Suspense fallback 里加 `sr-only` h1 |
| P1-6 admin 中文 h1 | 🟢 | 改用 `useI18n` |
| P1-7 邀请 404 | 🟢 | `app/invite/[code]/layout.tsx` 在服务端校验，不存在的邀请码调用 `notFound()` |
| P2-1 滚动条 | 🟢 | `.q42-sorts` 隐藏滚动条，手机上右侧加渐隐 |
| P2-2 点击区域 | 🟢 | 返回链接 44px；回答作者链接、「显示原文」32px，用负 margin 保证视觉尺寸不变 |
| P2-3 重置时间 | 🟢 | 提示改为本地时间（北京时间显示 08:00） |
| P2-4 头像懒加载 | 🟢 | `loading="lazy" decoding="async"` |
| P2-5 审核原因 | ✅ 已存在 | 作品页本来就会显示 `censored_fields`，是我上一版报告误报 |
| P2-6 导航命名 | ✅ 不是 bug | 代码里都是「作者」，「代理人」是 Chrome 翻译出来的，P0-1 修好后就没了 |
