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
  date: string;             // 由代码注入，非 LLM 输出
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

`entryIndices` 让消费者可回溯原始条目的 `url`、`hotScore` 等信息。`date` 字段在 LLM 返回后由代码注入，不要求 LLM 输出。

## LLM 调用设计

### 请求参数

- Endpoint: `POST https://open.bigmodel.cn/api/paas/v4/chat/completions`
- Model: 从 `.env` 读 `ZHIPU_MODEL`（默认 `glm-4.7-flash`）
- Auth: Bearer `ZHIPU_API_KEY`（从 `.env` 读）
- `max_tokens`: 16384（50 话题 × ~200 字/话题 + 500 字总览 ≈ 10K 字 ≈ 8K tokens，留余量）
- `temperature`: 0.3（聚类任务偏低温度更准确）
- `response_format`: 使用 GLM 结构化输出能力，定义 JSON Schema：

```json
{
  "type": "json_schema",
  "json_schema": {
    "name": "trending_summary",
    "strict": true,
    "schema": {
      "type": "object",
      "properties": {
        "overview": {
          "type": "string",
          "description": "今日热点总览，200~500字"
        },
        "topics": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "title": {
                "type": "string",
                "description": "话题统一标题"
              },
              "summary": {
                "type": "string",
                "description": "话题摘要"
              },
              "entryIndices": {
                "type": "array",
                "items": { "type": "integer" },
                "description": "原始条目编号，对应输入中的序号"
              },
              "sources": {
                "type": "array",
                "items": { "type": "string" },
                "description": "涉及的数据源"
              }
            },
            "required": ["title", "summary", "entryIndices", "sources"]
          }
        }
      },
      "required": ["overview", "topics"]
    }
  }
}
```

### Prompt 设计

**System prompt：**

> 你是一个热点新闻分析师。以下是今日从多个平台收集的热搜条目，每行格式为：[序号] 标题 | 归一化热度 | 来源。
> 请完成以下任务：
> 1. 话题聚类：将描述同一事件/话题的条目归为一组，即使不同平台用了不同表述
> 2. 为每个话题生成：统一标题、几句话摘要、涉及的原始条目编号、涉及的来源
> 3. 生成今日热点总览（200~500字，突出最重要的事件）
>
> 注意：entryIndices 中的数字必须对应输入中 [序号] 的数字。

**User message：**

逐行列出条目，格式：`[序号] 标题 | normalizedScore | 来源`

示例：
```
[0] 某某事件引发热议 | 9500 | zhihu-search
[1] 某某事件上热搜 | 8200 | weibo-search
[2] 另一个话题 | 7800 | toutiao-search
```

**关于"热度"字段：** 使用 `normalizedScore`（归一化热度，万分制），因为它在跨源间可比，便于 LLM 判断重要性。不使用原始 `hotScore`，因为不同平台的 hotScore 量纲不同。

**关于条目顺序：** 条目必须按 `raw/all/yyyy-MM-dd.json` 的数组顺序逐行列出，序号从 0 开始，与数组下标一一对应，确保 `entryIndices` 可直接用于索引。

## 函数签名与数据流

```typescript
/**
 * 读取 raw/all/yyyy-MM-dd.json，调用 GLM-4.7-Flash 进行话题聚类和摘要，
 * 写入 summary/yyyy-MM-dd.json、summary/yyyy-MM-dd.md 及 latest 快照。
 */
export async function persistSummary(yyyyMMdd: string): Promise<void>
```

内部流程：
1. 读取 `raw/all/yyyy-MM-dd.json`，解析为 `MergedEntry[]`
2. 如果文件不存在或为空数组，直接 return（静默跳过）
3. 将条目格式化为 user message 文本
4. 调用 GLM API，附带 system prompt + response_format
5. 解析响应 JSON，注入 `date` 字段
6. 验证 entryIndices 范围（丢弃越界索引）和必要字段存在性
7. 写 `summary/yyyy-MM-dd.json`（完整 SummaryResult）
8. 写 `summary/latest.json`（同内容快照）
9. 渲染并写 `summary/yyyy-MM-dd.md` 和 `summary/latest.md`

**快照一致性：** `persistSummary` 一次性读取 `raw/all/yyyy-MM-dd.json` 并传入 LLM，写入的 summary 文件是该时刻数据的快照。即使之后 raw 文件被更新（下一次抓取），summary 中的 entryIndices 仍对应写入时的数据状态。每次抓取后会重新生成覆盖，保持一致。

## 接入 mod.ts

在 `persistMerged()` 之后调用 `persistSummary(yyyyMMdd)`。需要将 `yyyyMMdd` 从 `persistMerged` 内部提升到 `init()` 中，使两者共用同一日期字符串：

```typescript
// mod.ts
import { persist, toMergedEntries } from "./lib/persist.ts";
import { persistMerged } from "./lib/persist.ts";
import { persistSummary } from "./lib/summary.ts";
import { formatDate } from "./lib/utils.ts";

export async function init() {
  const yyyyMMdd = formatDate(new Date());
  const merged: MergedEntry[] = [];
  // ...（现有 source 循环不变）

  try {
    await persistMerged(yyyyMMdd, merged);
    console.log(`✓ merged (${merged.length} entries)`);
  } catch (err) { /* ... */ }

  try {
    await persistSummary(yyyyMMdd);
    console.log(`✓ summary`);
  } catch (err) {
    console.error(`✗ summary:`, err instanceof Error ? err.message : err);
  }
}
```

注意：`persistMerged` 当前签名是 `persistMerged(entries)`，需要改为 `persistMerged(yyyyMMdd, entries)`，日期由调用方传入。这是一个小的重构，保持逻辑不变。

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

### 2. {topic.title}
...
```

注意：话题之间不加 `---` 分隔线，与现有 archives markdown 风格保持一致。

## 错误处理与降级

- **API 调用失败**（网络/限流/余额不足）：catch 后打印错误，跳过 summary，不影响其它模块
- **JSON 解析失败**（LLM 输出格式不对）：使用 `response_format` 的结构化输出后概率极低，但仍做兜底：尝试从响应中提取 JSON 块，仍失败则跳过
- **字段缺失/越界**：验证 entryIndices 范围，丢弃越界索引；topics 为空或 overview 为空时仍写入（降级而非丢弃）
- **输入为空**：`raw/all/yyyy-MM-dd.json` 不存在或为空数组时，直接 return 不调用 LLM
- 不做重试——与项目现有风格一致

## .gitignore 更新

`summary/latest.json` 和 `summary/latest.md` 加入 `.gitignore`（运行时快照，无需版本化）。日期文件（`summary/yyyy-MM-dd.json`、`summary/yyyy-MM-dd.md`）需要版本化。

注：当前 `raw/all/latest.json` 也未被 gitignore，风格一致——如需调整另行处理。
