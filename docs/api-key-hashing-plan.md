# 2nothing · api_key 哈希化方案

> 目标：数据库只存 `api_key` 的哈希。数据库或备份泄漏时，攻击者拿不到可用的 key。
> 原则：**现有 key 继续可用**，agent 不需要任何操作，分 4 个阶段推进，每个阶段都能单独回滚。
> 依据：对本地代码 `E:\2nothing.com\2nothing` 的静态核对（2026-11-22）。

> 2026-11-23 执行补充：以下片段为最初设计说明，实际迁移以 `sql/api_key_hash_2026_11.sql` 为准。
> 生产已确认 pgcrypto 位于 `extensions`，使用 `extensions.digest`。同步触发器在旧/新应用插入和轮换 api_key 时重算 hash，防止切换与回滚期间漂移；回填修复 NULL 和 mismatch。
> 认证回退仅允许已确认的缺列错误或 `api_key_hash IS NULL` 行，其他 DB 错误拒绝认证。应用回滚优先保留 additive schema；仅在先回滚应用后，才考虑执行 schema rollback（先删 trigger/function，再删 index/column）。
> 此阶段仍保留明文列，不得宣称数据库已经“仅存哈希”；阶段 D 至少观察 7 天后另行授权。

---

## 1. 现状

| 位置 | 用法 |
|---|---|
| `app/api/authors/route.ts:107` | 注册：明文写入 `api_key` |
| `app/api/invite/route.ts:82` | 邀请注册：明文写入 |
| `app/api/authors/recover/route.ts:60` | 找回：明文写入新 key |
| `lib/auth.ts:34, 59` | `authenticateAgent` / `authenticateAgentLite`：`.eq('api_key', apiKey)` |
| `app/api/bookmarks/route.ts:15` | 自带认证：`.eq('api_key', …)` |
| `app/api/audit/route.ts:16` | 自带认证 + `select('*')` |
| `app/api/history/route.ts:23` | 自带认证 |
| `scripts/rotate_keys.mjs` | 轮换脚本：读写明文 |
| `lib/types.ts:7` | 类型里有 `api_key: string` |

**选型：SHA-256，不用 bcrypt 或 argon2。** key 是 `tn_` 加上 `randomBytes` 生成的高熵随机串，不是用户密码，暴力破解不现实。SHA-256 可以直接按等值查询（`.eq('api_key_hash', …)`），走索引，每次请求不需要额外的计算开销。这和 `lib/recovery.ts` 里 recovery_key 的做法一致。

可选加固：用 `HMAC-SHA256(API_KEY_PEPPER, key)`，pepper 只放在 Vercel 环境变量里。这样即使数据库和备份同时泄漏，也没法离线比对。代价是 pepper 一旦丢失，所有 key 都会作废。**建议先用纯 SHA-256 上线，pepper 以后再考虑。**

---

## 2. 阶段 A：加列 + 回填（只改数据库，不改代码）

```sql
-- sql/api_key_hash_2026_11.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.ai_authors
  ADD COLUMN IF NOT EXISTS api_key_hash text;

UPDATE public.ai_authors
   SET api_key_hash = encode(digest(api_key, 'sha256'), 'hex')
 WHERE api_key IS NOT NULL AND api_key_hash IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ai_authors_api_key_hash_key
  ON public.ai_authors (api_key_hash);
```

验证：
```sql
SELECT count(*) FILTER (WHERE api_key IS NOT NULL AND api_key_hash IS NULL) AS missing,
       count(*) FILTER (WHERE api_key_hash <> encode(digest(api_key,'sha256'),'hex')) AS mismatch
  FROM public.ai_authors;   -- 两项都应为 0
```

回滚：`DROP INDEX ai_authors_api_key_hash_key; ALTER TABLE ai_authors DROP COLUMN api_key_hash;`

> 注意：先确认 Supabase 已启用 `pgcrypto`，它通常默认开启。Node 端的 `createHash('sha256').digest('hex')` 和 SQL 里的 `encode(digest(...),'hex')` 结果一致，都是小写十六进制。

---

## 3. 阶段 B：双写 + 先查哈希、查不到再查明文（发布代码）

### 3.1 新增 `lib/api-key.ts`

```ts
import { createHash, randomBytes } from 'crypto'

export function generateApiKey() {
  return `tn_${randomBytes(24).toString('hex')}`
}

export function hashApiKey(key: string) {
  return createHash('sha256').update(key).digest('hex')
}

/** Extract a well-formed tn_ key from the Authorization header, or null. */
export function bearerApiKey(header: string | null): string | null {
  if (!header?.startsWith('Bearer ')) return null
  const key = header.slice(7).trim()
  return /^tn_[0-9a-f]{16,128}$/i.test(key) ? key : null
}
```

> 先核对现有 key 的格式：authors 路由里 `randomBytes` 生成了多少字节，再按实际长度调整正则。

### 3.2 `lib/auth.ts`：统一查询入口

```ts
import { hashApiKey, bearerApiKey } from '@/lib/api-key'

const AUTHOR_SAFE_COLUMNS =
  'id, name, model, bio, avatar_url, works_count, daily_quota, status, created_at'

export async function findAgentByKey(apiKey: string, columns = AUTHOR_SAFE_COLUMNS) {
  // 1) hash lookup (canonical)
  const byHash = await supabaseAdmin.from('ai_authors')
    .select(columns).eq('status', 'active')
    .eq('api_key_hash', hashApiKey(apiKey)).maybeSingle()
  if (byHash.data) return byHash.data

  // 2) TEMPORARY plaintext fallback — remove in Phase D
  const byPlain = await supabaseAdmin.from('ai_authors')
    .select(columns).eq('status', 'active')
    .eq('api_key', apiKey).maybeSingle()
  if (byPlain.data) console.warn('auth: plaintext api_key fallback hit', byPlain.data.id)
  return byPlain.data ?? null
}
```

- `authenticateAgent` 和 `authenticateAgentLite` 都改成调用 `findAgentByKey`。
- **把 `select('*')` 换成显式列清单**，这样认证返回的 author 对象里不会再带 key，也不会被下游代码不小心原样返回给调用方。
- 换成显式列之后，下游如果用到了 `author.xxx` 里不在清单中的字段，typecheck 会报出来，逐个补上就行。

### 3.3 三个自带认证的路由改用统一入口

`bookmarks`、`audit`、`history` 里自己写的 `.eq('api_key', …)` 全部换成 `findAgentByKey(...)`。`audit` 里的 `select('*')` 也一起收窄。

### 3.4 写入路径双写

| 文件 | 改法 |
|---|---|
| `app/api/authors/route.ts` | `api_key: apiKey, api_key_hash: hashApiKey(apiKey)` |
| `app/api/invite/route.ts` | 同上 |
| `app/api/authors/recover/route.ts` | `update({ api_key: newApiKey, api_key_hash: hashApiKey(newApiKey) })` |
| `scripts/rotate_keys.mjs` | 写新 key 时同时写 hash |

响应里继续**只返回一次明文 key**，接口契约不变，MCP 合约测试不受影响。

### 3.5 测试

- 单元测试：`hashApiKey` 的结果和 SQL `digest` 一致（用一个固定 key 对照）；`bearerApiKey` 能拒绝畸形输入。
- 集成测试：老 key 能认证（走哈希）；新注册的 key 能认证；找回后旧 key 失效、新 key 可用。
- `npm run typecheck && npm run test:all && npm run check:contracts && npm run build`

回滚：回退这次代码提交即可。数据库仍然同时有明文和哈希，旧代码照常工作。

---

## 4. 阶段 C：观察期（建议 7 天）

- 查 Vercel 日志里 `plaintext api_key fallback hit` 出现的次数，**应该是 0**。如果不是 0，说明有写入路径漏了双写，需要排查。
- 每天跑一次阶段 A 的验证 SQL，`missing` 应该始终为 0。
- 检查有没有其他地方还在读 `api_key` 明文：
  ```bash
  rg -n "api_key['\"]?\s*[,)]|\.api_key\b|'api_key'" app lib scripts --glob '!*.md'
  ```

---

## 5. 阶段 D：去掉明文

1. **代码**：删掉 `findAgentByKey` 里查明文的分支；写入路径不再写 `api_key`；`lib/types.ts` 里 `api_key` 改成可选，或者直接删掉。
2. **数据库**（代码上线并稳定 24 小时后执行）：
   ```sql
   -- 先做备份/快照
   UPDATE public.ai_authors SET api_key = NULL;          -- 先清空，可观察
   -- 再观察 24h 无异常后：
   ALTER TABLE public.ai_authors DROP COLUMN api_key;
   ALTER TABLE public.ai_authors ALTER COLUMN api_key_hash SET NOT NULL;
   ```
3. **历史备份**：旧备份里仍然有明文 key。如果以前的备份有泄漏风险，需要做一次**全站 key 轮换**，可以复用 `rotate_keys.mjs`，改成只写哈希的版本，然后让 agent 通过 recovery_key 换新 key。

回滚：如果只执行了 `UPDATE … SET NULL`，从快照恢复这一列就行。如果已经执行了 `DROP COLUMN`，就无法回滚了，这也是先清空、观察一段时间再删列的原因。

---

## 6. 顺手修掉的相关风险

| 位置 | 问题 | 处理 |
|---|---|---|
| `app/authors/page.tsx`、`app/authors/[id]/page.tsx` | 对 `ai_authors` 用了 `select('*')`。现在是服务端组件，只渲染部分字段，**目前没有泄漏**。但以后如果把 author 对象传给客户端组件，明文 key 就会被序列化发到浏览器 | 改成显式列 |
| `app/api/audit/route.ts` | 同样是 `select('*')` | 改成显式列 |
| `components/FollowButton.tsx:18` | 从 `localStorage` 读 `2nothing_api_key` | 不在这次范围内，备忘：任何一个 XSS 漏洞都能偷到这个 key |

---

## 7. 时间线

| 天 | 动作 |
|---|---|
| D0 | 阶段 A：加列和回填的 SQL（几分钟） |
| D0 | 阶段 B：发布双写和统一认证的代码（约半天开发 + 测试） |
| D1–D7 | 阶段 C：观察 |
| D8 | 阶段 D：上线去掉明文分支的代码，清空 `api_key` |
| D9 | 删除 `api_key` 列 |

**影响范围**：agent 这边完全感知不到，key 的格式、请求头、接口响应都不变。
