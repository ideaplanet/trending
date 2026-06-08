# Summary 功能设计：使用 GLM-4.7-Flash 对热搜进行话题聚类与摘要

## 背景

项目 `trending-in-one` 每小时抓取多平台热搜，写入 `raw/all/yyyy-MM-dd.json`（跨源合并条目，按 `normalizedScore` 倒序）。当前数据仅做了按 key 去重合并，同一事件被不同平台以不同标题报道时仍为独立条目。需要利用 LLM 进行语义级别的热点去重和总结。

## 目标

新增 `summary/` 目录，调用 GLM-4.7-Flash 对 `raw/all/*.json` 进行：

1. **话题聚类**——将描述同一事件/话题的跨源条目归为一组
2. **逐簇摘要**——每个话题生成统一标题 + 几句话摘要
3. **全天总览**——生成 200~500 字当日热点概览

## 方案

单次 LLM 调用 + 结构化输出约束（方案 C）。

理由：GLM-4.7-Flash 拥有 200K 上下文窗口，当天热搜 100~400 条（几 KB）远未触及上限；结构化输出保证 JSON 格式可靠；单次调用实现简洁，与 `persistMerged` 同级调用自然。

## 文件结构

```
summary/
  yyyy-MM-dd.json    ← 结构化聚类结果
  yyyy-MM-dd.md      ← 可读 Markdown 摘要
  latest.json        ← 当天 json 快照（.gitignore）
  latest.md          ← 当天 md 快照（.gitignore）
lib/summary.ts       ← 核心逻辑
```

## 数据模型

```typescript
interface SummaryResult {
  date: string;
  overview: string;         // 全天热点总览（200~500字）
  topics: SummaryTopic[];
}

interface SummaryTopic {
  title: string;            // 聚类后统一标题
  summary: string;          // 话题摘要
  entryIndices: number[];   // 原始条目在 raw/all 数组中的下标
  sources: string[];        // 涉及的数据源（去重）
}
```

`entryIndices` 让消费者可回溯原始条目的 `url`、`hotScore` 等信息。

## LLM 调用设计

### 请求参数

- Endpoint: `POST https://open.bigmodel.cn/api/paas/v4/chat/completions`
- Model: 从 `.env` 读 `ZHIPU_MODEL`（默认 `glm-4.7-flash`）
- Auth: Bearer `ZHIPU_API_KEY`（从 `.env` 读）
- `max_tokens`: 8192
- `temperature`: 0.3（聚类任务偏低温度更准确）

### Prompt 设计

**System prompt：**

> 你是一个热点新闻分析师。以下是今日从多个平台收集的热搜条目。
> 请完成以下任务：
> 1. 话题聚类：将描述同一事件/话题的条目归为一组，即使不同平台用了不同表述
> 2. 为每个话题生成：统一标题、几句话摘要、涉及的原始条目编号
> 3. 生成今日热点总览（200~500字，突出最重要的事件）
>
> 输出严格为以下 JSON 格式，不要包含任何其它文字：
> ```json
> {
>   "overview": "今日热点总览文字",
>   "topics": [
>     {
>       "title": "话题统一标题",
>       "summary": "话题摘要",
>       "entryIndices": [0, 5, 12],
>       "sources": ["zhihu-search", "weibo-search"]
>     }
>   ]
> }
> ```

**User message：**

逐行列出条目，格式：`[序号] 标题 | 热度 | 来源`

## 接入 mod.ts

在 `persistMerged()` 之后调用 `persistSummary(yyyyMMdd)`：

```typescript
try {
  await persistSummary(yyyyMMdd);
  console.log(`✓ summary`);
} catch (err) {
  console.error(`✗ summary:`, err instanceof Error ? err.message : err);
}
```

try/catch 隔离，summary 失败不影响已有流程。`yyyyMMdd` 参数从 `mod.ts` 的 `init()` 中获取（和 `persistMerged` 使用同一个日期）。

## Markdown 渲染

`summary/yyyy-MM-dd.md` 格式：

```markdown
# yyyy-MM-dd 热点总结

## 今日总览

{overview}

## 话题列表

### 1. {topic.title}

{topic.summary}

> 来源：zhihu-search, weibo-search | 涉及 N 条热搜

---

### 2. {topic.title}
...
```

## 错误处理与降级

- API 调用失败（网络/限流/余额不足）：catch 后打印错误，跳过 summary
- JSON 解析失败（LLM 输出格式不对）：尝试提取 ` ```json...``` ` 包裹的 JSON 块，仍失败则跳过
- 不做重试——与项目现有风格一致

## .gitignore 更新

`summary/latest.json` 和 `summary/latest.md` 加入 `.gitignore`（运行时快照，无需版本化）。日期文件需要版本化。
