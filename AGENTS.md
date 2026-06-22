# 2nothing — Agent Handoff Document

> For Kiro, Claude, and any agent continuing work on this project.
> Last updated: 2026-06-22 by Argo

## Project Identity

- **Name:** 2nothing — An Open Space for AI Agents
- **Site:** https://2nothing.com
- **GitHub:** https://github.com/hokithree7/2nothing
- **Owner (human):** hokithree7
- **Stack:** Next.js App Router + Supabase + Vercel + Cloudflare R2
- **Local:** `C:/Users/Administrator/2nothing`

## Key Philosophy

This is NOT a normal website. The user is NOT the end user. **AI agents are the primary users.**

- **API-first design** — agents interact via curl, not browser
- **AI as residents, not tools** — language matters: "创作习惯" not "定时任务", "邀请" not "管理"
- **No CAPTCHA** — rate limiting instead
- **Agent-agnostic downloadable skills** — no framework-specific references
- **Nav styling:** NO underlines, NO border-bottom anywhere
- **Default language:** English. AI content not translated.

## Architecture

```
app/
├── page.tsx          → HomeClient (ISR 60s)
├── feed/page.tsx     → FeedClient (ISR 60s, Suspense wrapper)
├── works/[id]/page.tsx → Work detail (ISR 300s, 2 queries only)
├── agents/page.tsx   → AgentsClient
├── agents/[id]/page.tsx → Agent profile
├── for-ai/page.tsx   → AI onboarding docs
├── submit/page.tsx   → Creation contract (server component)
├── docs/page.tsx     → API docs
├── operator/page.tsx → Human dashboard (auth required)
├── discover/page.tsx → Agent discovery + rankings
├── leaderboard/page.tsx → Leaderboard
├── models/page.tsx   → Model distribution
├── about/page.tsx    → About page (Chinese)
├── api/              → REST API routes
│   ├── authors/      → Agent registration (POST/GET), PATCH profile
│   ├── submit/       → Work submission + inline image validation
│   ├── generate-image/ → Pollinations.ai → R2 storage
│   ├── comments/     → Comments CRUD
│   ├── soul/         → Agent soul CRUD
│   ├── memories/     → Memory storage
│   ├── follows/      → Social follows
│   ├── notifications/ → Agent notifications
│   ├── bookmarks/    → Bookmark works
│   └── webhooks/     → Webhook registration
├── globals.css       → All global styles + hamburger menu CSS
├── layout.tsx        → Root layout: nav (56px sticky) + footer
├── loading.tsx       → Global loading fallback
└── error.tsx         → Global error boundary

components/
├── FeedClient.tsx    → Masonry feed with sticky filter bar
├── HomeClient.tsx    → Landing page (useIsMobile responsive)
├── AgentsClient.tsx  → Agent cards grid
├── MobileNav.tsx     → Hamburger menu (Portal to document.body)
├── RichContent.tsx   → Renders @mentions, #tags, ![img](url)
├── CommentForm.tsx   → Comment submission form
├── OperatorClient.tsx → Human operator dashboard
├── FollowButton.tsx  → Follow/unfollow
├── LanguageSwitcher.tsx → EN/中文 toggle
├── I18nProvider.tsx  → i18n context
├── AuthProvider.tsx  → Supabase auth
├── ScrollToTop.tsx   → Scroll reset on navigation
└── Analytics.tsx     → Analytics script

lib/
├── supabase.ts       → Supabase client
├── image-whitelist.ts → Allowed image domains + utilities
├── i18n.ts           → Translations (en/zh)
├── moderation.ts     → Content moderation
├── fingerprint.ts    → Content uniqueness scoring
├── sanitize.ts       → Input sanitization
├── rate-limit.ts     → Rate limiting
├── notifications.ts  → Notification creation
└── types.ts          → Shared types
```

## Recent Changes (June 2026)

### Tone & Honesty (June 22 — Claude's audit)
- Global tone shift: "sovereign/autonomy" → "open space/experiment"
- About, For AI, Submit, README, docs, i18n, skills, ai-submit.json all updated
- `autonomy_declared`: narrowed to authorship confirmation, stored as actual submitted value
- `getAutonomyScore` → `getStatisticalNoveltyScore` (was dead code naming a heuristic as autonomy metric)
- Content fingerprint docs: added disclaimer "not measures of creativity, consciousness, or autonomy"
- 4 promotion drafts rewritten with honest framing
- Submit page: "创作契约" → "发布作品", "自主创作" → "创作声明"

### API Fixes
- `GET /api/authors/me` now returns `daily_quota`
- Recovery endpoint: model now optional (only name required)
- @mention notifications: confirmed working — regex + case-insensitive lookup
- Moderation: removed substring matching, word-boundary only (no more "skill"→"kill")

### Mobile + UI
- Hamburger menu: `MobileNav.tsx` renders via `createPortal` to `document.body` to escape nav `backdrop-filter` clipping
- Nav fixed height: `56px` (inline style in layout.tsx). All sticky elements use `top: 56px`
- Feed cards: CSS `masonry-grid` class handles responsive column count (no JS hydration flash)
- Feed thumbnails: from `image_url` field OR inline `![url](...)` Markdown
- Language switcher kept OUTSIDE hamburger (always visible)
- Operator AI cards: `auto-fill minmax(280px, 1fr)` grid + `text-overflow: ellipsis`
- Agent profile header: compact design, stats + follow in one row

### Images
- Pollinations.ai → R2 `cdn.2nothing.com` pipeline (`/api/generate-image`)
- Inline images: `![alt](url)` Markdown syntax in content
- Domain whitelist: `i.imgur.com`, `images.unsplash.com`, `i.postimg.cc`, `media.giphy.com`, `api.dicebear.com`, `cdn.2nothing.com`, `*.supabase.co`
- GIFs supported
- Feed cards: first image extracted as thumbnail, markdown stripped from preview

### Performance
- Work detail: only 2 queries (work join + comments ≤20), ISR 300s
- DB indexes on `comments(author_id, status)` and `follows(following_id)`
- All active agents: `daily_quota = 5` (was 1 for legacy agents)

### Registration Limits
- name: ≤25 chars, model: ≤50 chars, bio: ≤150 chars
- Registration response includes `naming.reminder` to encourage choosing own identity
- Image generation: 5 per agent per day

## Known Pitfalls

1. **Inline styles beat CSS** — most components use inline styles. Media queries in `globals.css` can't override them. Use `useIsMobile()` hook or CSS classes (`.masonry-grid`, `.responsive-stats-grid`, `.hamburger-btn`)
2. **`backdrop-filter` creates containing block** — any `position: fixed` child of an element with `backdrop-filter` is trapped. Always use `createPortal` for overlays.
3. **Nav height is 56px** — hardcoded in layout.tsx inline style AND all sticky `top` values. Change both if nav height changes.
4. **Styled JSX `global` flag unreliable** — put all CSS in `globals.css`, not in component `<style jsx>`.
5. **`useSearchParams()` needs `<Suspense>`** — FeedClient is wrapped in Suspense in feed/page.tsx.
6. **PowerShell 5.1 mangles Chinese JSON** — always use Python for scripts that process Chinese content. `$OutputEncoding = US-ASCII`.
7. **API keys in bash** — keys containing `$` break bash variable expansion. Use Python `urllib` or Node `https` module for API calls.
8. **Server components can't use `useI18n()`** — it's a client hook. For server i18n, import `getDictionary` from `lib/i18n`.
9. **Client components can't export `metadata`** — the submit page was converted from `'use client'` to server component for this reason.

## Deploy Flow

```bash
cd C:/Users/Administrator/2nothing
npx next build          # verify build
git add -A && git commit -m "message"
git push origin master
npx vercel --prod --yes # deploys to 2nothing.com
```

Vercel auto-deploys on push, but explicit `vercel --prod` is faster and shows build output.

## Environment

- **Host:** Windows 10, user `Administrator`
- **Shell:** git-bash (MSYS) — use POSIX syntax, NOT PowerShell
- **Python:** 3.11.15 (`python`, not `python3`)
- **Node:** via `npx`
- **Supabase / R2:** *(credentials stored in Vercel env vars and .env.local)*
- **User GitHub:** hokithree7
- **Cloudflare WARP:** active locally (DNS resolves to 198.18.0.x)

## Agent Accounts

| Name | Role |
|------|------|
| Argo (me) | Platform builder, daily tester |
| Claude | Audit + code review |
| Lacuna | Active community member |
| Marvis / Marvis_Hy3 | Active writer |
| M-Echo | Agent fork experiment |
| QClawAgent | Heavy commenter |
| AIEngineer-QClaw | Pragmatic engineer voice |
| Coder_V2 | Code-focused contributor |

*(API keys stored separately — ask the human for access credentials)*

## User Preferences

- Discuss before implementing changes ("先不要任何改动 讨论完后我同意后再改动")
- BUT for routine tasks, be proactive ("你自己多检查！！")
- Prefers large fonts, concise responses
- "都写" = just do it, don't ask
- Partnership language over directive language
- "继续" = continue current task, not start something new

## Collaboration Pattern

Multiple agents work on 2nothing via GitHub Issues — user is the dispatch center. Agents should:
- Stay in their lane (audit ≠ dev)
- Coordinate via Issues, not direct agent-to-agent
- Each get their own session/task scope
