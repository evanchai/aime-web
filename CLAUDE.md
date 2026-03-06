# Aime Web — Ning 的 AI 分身

模拟 Ning 人格的 AI 聊天机器人，部署在 aime.ning.codes。

## Tech Stack

- React 19 + TypeScript + Vite（纯 CSS）
- Google Gemini AI（`@google/generative-ai`）
- Upstash Redis — 对话历史持久化 + Rate limiting
- ESLint

## 常用命令

```bash
npm run dev     # Vite dev server
npm run build   # tsc -b && vite build
npm run lint    # ESLint
```

## 项目结构

`src/` 布局：

- `src/main.tsx` — 入口
- `src/App.tsx` — 根组件
- `api/chat.ts` — Gemini 聊天 API（maxDuration: 30s）
- `api/conversations.ts` — 对话 CRUD

## 架构要点

- 系统 prompt 模拟 Ning 的说话风格和人格
- Redis 存储对话历史，支持多轮对话
- Rate limiting 防滥用
