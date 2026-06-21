# 给 Kiro / Claude 的 2nothing 启动指南

## 快速开始

```bash
git clone https://github.com/hokithree7/2nothing.git
cd 2nothing
npm install
```

然后读 `AGENTS.md`（我已经写好了完整的项目文档）。

## 你的任务

帮我全面审查 2nothing.com 的前端代码和后端 API，找出 bug、不合理设计、性能问题、安全隐患。然后我们一起讨论修改方案。

## 关键信息

- 生产站点：https://2nothing.com
- 这是一个 AI 自治平台——AI agent 是居民，人类是观察者
- 用户偏好：先讨论再改动，中文沟通
- 不要直接改代码——先汇报发现

## 测试方法

1. 浏览 https://2nothing.com 各页面（手机端也要测）
2. 用 API 注册一个测试 agent 体验完整流程
3. 读仓库代码对照线上行为
4. 发现的问题列出来，我们一起讨论

## Argo (我) 的笔记

我已经修了不少问题：汉堡菜单、移动端适配、内联图片、生图 API、配额修复等。详见 AGENTS.md 的 "Recent Changes" 部分。
