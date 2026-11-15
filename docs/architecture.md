# Raincheck — Architecture & Sponsor Stack

> YC Consumer Mobile Hackathon, 2026-11-15. Required stack: **Capy + Revyl + Convex**.

一句话：**iOS + Android 一套 Expo (React Native) code，后端全部在 Convex，前后端都是 TypeScript。Capy 写 code，Revyl 在真设备上测。**

## 整体架构

```
 ┌────────────── Dev workflow ──────────────┐
 │ Capy (cloud agents) 写 code → PR          │
 │   → Capy review → auto-merge main         │
 │ Revyl: build dev client → cloud iOS /     │
 │   Android device 上跑 test case           │
 └───────────────────────────────────────────┘

 ┌──── Frontend (one codebase, two platforms) ┐
 │ Expo SDK 58 + React Native + TypeScript    │
 │ expo-router (src/app/ = screens)           │
 │ iOS (.app / TestFlight)                    │
 │ Android (.apk)                             │
 │ ConvexReactClient ← WebSocket realtime     │
 └──────────────┬─────────────────────────────┘
                │ useQuery / useMutation (auto realtime)
 ┌──────────────▼──── Backend: Convex ────────┐
 │ convex/*.ts — all TypeScript               │
 │ • Database (document DB + schema)          │
 │ • query / mutation (transactional) / action│
 │ • Auth (JWT provider or Convex Auth)       │
 │ • scheduler + crons                        │
 │ • File storage, full-text / vector search, │
 │   HTTP endpoints (webhooks)                │
 │ • env vars: OPENAI_API_KEY, etc.           │
 └──────────────┬─────────────────────────────┘
                │ fetch() inside actions
        OpenAI / Expo Push / Luma iCal
```

## 各 sponsor 的角色

| Sponsor | 用途 |
|---|---|
| **Capy** | Cloud coding agents：开 thread 写 feature → 开 PR → Capy review → automation "Auto-merge clean Capy PRs" 自动 merge 干净的 `capy/*` PR |
| **Revyl** | Device testing：`revyl build --profile development --platform ios` → `revyl dev`；用 `testID`（如 `home-screen`、`convex-status`）写 assertion |
| **Convex** | 整个 backend：database、realtime、auth、cron、file storage、AI 调用 |

## Convex 支持什么

参考：`convex/_generated/ai/guidelines.md`（由 `npx convex ai-files install` 生成，写 Convex code 前必读）。

| 需求 | Convex 怎么做 |
|---|---|
| **Database** | 内建 document DB，`convex/schema.ts` 定义 schema + index，不用另外配 Postgres |
| **API** | 不写 REST。`convex/` 里写 `query`（只读、前端自动 realtime 订阅）、`mutation`（写入，每次都是一个 transaction），前端直接 `api.xxx.yyy` 调用，type 全程打通 |
| **外部服务** | `action` 里可以 `fetch()`（OpenAI、push）；需要 Node 依赖时文件顶部加 `"use node"` |
| **定时任务** | `ctx.scheduler.runAfter` + `crons.ts` → 卡片 aging（"欠了 12 天"）、提醒 |
| **Auth** | ① **Convex Auth**（`@convex-dev/auth`：OAuth Google/Apple、password/OTP、anonymous）② 外部 JWT provider（Clerk、WorkOS 等）：配 `convex/auth.config.ts` + 前端 `ConvexProviderWithAuth` |
| **其他** | File storage（头像/图片）、full-text search、vector search（AI 推荐）、`convex/http.ts` webhook |

Auth 规则：后端一律用 `ctx.auth.getUserIdentity()`（用 `tokenIdentifier` 做 ownership），**不要信任前端传的 userId**。

## 今天的建议（PM 视角）

- **Auth 先别做 Google/Apple 登录。** Native OAuth 要配 redirect + bundle id，容易卡 1–2 小时。先用 Convex Auth 的 **anonymous**（或 device id + 昵称）；demo 用两台 Revyl 设备分别扮演"我"和"朋友"。Google/Apple 登录列为 stretch goal。
- **"朋友实时收到 raincheck" 是 Convex 原生能力**：`useQuery` 订阅就是 realtime，不用自己写 WebSocket，正好是核心 loop 的卖点。
- **Retention 主题**：卡片 aging + 提醒用 crons/scheduler；push 可考虑 Convex 的 Expo push component（`@convex-dev/expo-push-notifications`，尚未在本项目验证，用前先确认）。
- **OpenAI 只在 action 里调**，key 放 Convex env（`OPENAI_API_KEY`），不进 app bundle。

## 本地跑起来

```sh
npm install
npx convex dev            # 登录并 link AI-Forge-Hackthon；写入 .env.local 的 EXPO_PUBLIC_CONVEX_URL
npx expo run:ios          # 本地 Xcode build dev client 装到 simulator（或 EAS：npx eas-cli@latest build --profile development-simulator --platform ios）
npx expo start --dev-client
```
