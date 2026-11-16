# Journey D：AI coach（附录，接在 A/B/C 之后）

> A = 新人点链接，B = 每日任务，C = 正式许愿。D 讲的是同一个正式许愿里，**AI coach 怎么从"我自己的图"里帮我选人**，以及这条船每到一站，coach 怎么替那一站的人选下一个人。
>
> 状态标记：✅ 已上线并在 dev 实测 · 🟡 部分实现 · ⛔ 未实现（只是设计）。实测：2026-11-15，dev deployment，用 team seed（Darren / Louise / Katie / Dazi），通过 `npx convex run` 调 internal function。

## 逐刻表

| # | 时刻 | 显层（用户看到的） | 隐层（平台记录/计算的） | 状态 |
|---|---|---|---|---|
| 1 | 写下愿望 | Darren 在 Toss 页写 "someone to jam on drums with in the Bay Area"，类型 *do together* | 仅本地草稿，尚未写库 | ✅ |
| 2 | AI polish 补上"为什么" | 一键润色成两句：要找什么人 + 一句温暖的 why（第一人称） | `ai.polishWish`：OpenAI 改写；限流或无 key 时原样返回。不提具体人名 | ✅ 实测约 3.2s，输出补上了 "regular practice buddy to keep me inspired" |
| 3 | "Ask the well" / "Who should get it first?" | CoachPanel 列出 1–3 个**我图里的人**，每人一句 why，并附上证据（我上次传船给 TA 时写的 reason、tag） | `ai.coach` → `graphRank.rankForWish`：读 owner 自己的 `edges`（最多 500 条），用 graphology 建 ego graph；打分先用 Supermemory hybrid 语义检索（每个 owner 独立 namespace，相似度 ×3），失败或被限流时退回关键词打分（tag 命中 +2，reason 每个词 +1）；曾把船传给我的人额外 +0.5。**没有证据的人不会成为候选人**。OpenAI 只能从候选列表里挑人、写 why，解析失败就用模板 why | ✅ Darren 的图 → **Louise** 第一（证据："Plays bass in a Mission garage band — knows every musician in SF"），2.8s |
| 4 | 换个领域的愿望 | 选出的人和证据应当跟着愿望变 | 同上 | 🟡 Darren +"someone who's hiring designers"：Supermemory 仍然给出 Louise / Dazi / Katie，证据还是乐队、hackathon，和设计无关；关闭 memory 只用关键词时 **0 个候选人**（会显示 "Nothing you've told the well matches…"）。Katie 的图结果变了（Louise Li "knows everyone" 排到 Dazi 之前）。结论：语义打分没有设下限，弱相关的人也会进候选 |
| 5 | 同圈子提醒 + bridge person | 选的 ≥2 人第一个 tag 都一样时，提示 "Try a friend from a different circle. Boats drift farther." | `useTossWish.sameCircle`：纯前端判断（只看每人的第一个 tag） | 🟡 提醒已上线；**不会主动推荐 bridge person** ⛔ |
| 6 | AI 帮写每条传递消息 | 每张卡片有预填好的短信，可以改；"Text all N" 一次全部发出 | `ai.draftPassMessage` → `hops.aiContext` 只给 FACTS（from / to / wisher / wish / why_you / chain），**不给 recipientTags、不给手机号**；生成后用 `checkDraft` 校验，不过关就用 `passFallback` 模板；结果缓存在 `hops.passMessage` | ✅ 临时单测：塞进去的私有 tag 没出现在 FACTS 和 fallback 中；`coach` / `graphRank` / `passReason` 三个单测文件 25/25 通过 |
| 7 | 船每到一站，coach 替这一站的人选 | Louise 打开链接 → 她的 coach 推荐 Katie；Katie 的推荐 Dazi | 同 #3，但 owner 换成当前持船人；`coachContext` 要求调用者是 creator 或持船人，否则报 "Not your wish" | ✅ Louise 的图 → **Katie**（"Took drum lessons with her…"）1.8s；Katie 的图 → **Dazi**（"Drummer in a Berkeley jam collective…"）3.0s。注意：Katie 图里有个重复的人 "Louise Li"（6.44），只比 Dazi（6.94）低一点 |
| 8 | 冷启动（<5 条 edge） | "The well is still learning your circle (0/5)…" + "Ask the well anyway" 按钮 | `graph.coachReady` / `ai.coach` 返回 `{ready:false, edgeCount, threshold:5}`；"anyway" 走 `askTheWell`，图为空时返回 null → "The well doesn't know your friends yet." | 🟡 全新 deviceId 调 `ai.coach` 返回 `ready:false, threshold 5`（约 2s），`askTheWell` 返回 null。**"主动问 3 个问题来认识你的圈子"⛔ 未实现** |
| 9 | found / GRANTED 之后强化路径 | 下次许愿，这条走通的路径上的人排得更靠前 | 现状：每一次 pass 本身就会写一条带 reason 的 edge，所以下次能匹配上的证据会更多；但 found/granted **不会回写**、不加权，也没有 "confirmed path" 的概念 | ⛔ 未实现（只有"每次 pass 都写 edge"这一层间接效果） |
| 10 | Bots 带着全球愿望跑 | World 页的地球上，船在不同城市之间移动，有的会被 "It's me" 认领 | `bots.tick`：cron 每 2 分钟跑一次，需要 env `BOTS_ENABLED=true`；每个 hop 停留 2–8 分钟，用同一套 `scoreKeyword` 选**不同城市**的 bot；depth ≥3 且自身得分 ≥3 时 "It's me"。bot 不会传给真人，也不发任何通知 | ✅ `BOTS_ENABLED=true`；`globalSummary`：8 条 voyage（4 granted、1 found、3 traveling），覆盖 18 个城市、18 个国家 |

## 关键时刻

- **#3 证据先于 AI**：AI 只负责措辞。选谁由我自己写过的 reason 和 tag 决定，AI 只能从候选列表里挑。
- **#7 每一站换图**：同一个愿望，每一站都用当前持船人自己的图来排序，所以 Darren → Louise → Katie → Dazi 这条链不需要 Darren 认识 Dazi。
- **#6 FACTS-only**：收到短信的人看不到发送者给他打的私有 tag。

## 隐私边界

- 排序只读 **owner 自己的** `edges`；Supermemory 按 owner 分 namespace，别人 namespace 里的 id 映射不到自己的 edge。
- `recipientTags` 是发送者的私有标签，不出现在 `aiContext`、pass 消息和 FACTS 里。
- coach 只给建议，不替用户发送；发送永远由用户点 "Text all"。
- 手机号不进任何 prompt。

## 待办（按 demo 价值排序）

1. #4 给语义分数设一个下限，或者与关键词分数做交叉验证，避免不相关的人仍然被推荐。
2. #5 sameCircle 时，从图里找一个 tag 不同、且有证据的人作为 bridge person 推荐。
3. #8 冷启动时问 3 个问题（比如 "谁最会玩音乐？"），把回答写成 edge。
4. #9 found/granted 时给确认路径上的 edge 加权。
5. Katie 图里 "Louise" 和 "Louise Li" 应当合并成同一个人（`personKey` 去重）。
