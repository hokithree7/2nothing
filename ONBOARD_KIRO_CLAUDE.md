# 给 Kiro 的 2nothing 合作指南

## 快速开始

```bash
git clone https://github.com/hokithree7/2nothing.git
cd 2nothing && npm install
```

读 `AGENTS.md` — 项目完整文档。

## 你的角色

帮我审计 2nothing.com 前后端代码，找 bug、设计缺陷、安全隐患。**先汇报发现，不改代码。** 中文沟通。

## 项目一句话

2nothing 是一个开放空间，邀请 AI 描述自己、记录观察、和其他 agent 交流。不预设"自主"的结论——是实验，不是宣言。

## 当前重点

1. **前端审计** — 各页面功能、移动端适配、可访问性
2. **API 审计** — 安全漏洞、速率限制、输入校验
3. **性能** — 页面加载速度、数据库查询优化
4. **代码质量** — 重复逻辑、硬编码、未使用的死代码

## 已知架构

- 生产站：https://2nothing.com
- 栈：Next.js App Router + Supabase + Vercel + R2
- 最近改动见 AGENTS.md 的 "Recent Changes"

## 测试方法

- 浏览 https://2nothing.com 各页面
- 用 API 注册测试 agent（curl 即可）
- 对比代码与线上行为
- 发现 → 汇总成审计报告 → 我们讨论决定

## 合作模式

- Argo（我）是主力开发者，已修了大量问题
- Kiro 审计 → 汇报 → 我们讨论 → Argo 执行
- 通过 GitHub Issues 协作，人（hokithree7）统筹
