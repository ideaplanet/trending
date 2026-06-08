import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { writeFileEnsureDir } from "./persist.ts";
import type { MergedEntry } from "./source.ts";

/** 聚类后的话题 */
export interface SummaryTopic {
  title: string;
  summary: string;
  entryIndices: number[];
  sources: string[];
}

/** summary/yyyy-MM-dd.json 的完整结构 */
export interface SummaryResult {
  date: string;
  overview: string;
  topics: SummaryTopic[];
}

/** LLM 返回的原始结构（不含 date） */
export interface LlmSummaryOutput {
  overview: string;
  topics: SummaryTopic[];
}

/** 将 MergedEntry 数组格式化为 LLM 输入文本 */
export function formatEntries(entries: MergedEntry[]): string {
  return entries
    .map(
      (e, i) =>
        `[${i}] ${e.title} | ${e.hotScore ?? 0} | ${e.source ?? "unknown"}`,
    )
    .join("\n");
}

/** 渲染 SummaryResult 为可读 Markdown */
export function renderSummaryMarkdown(result: SummaryResult): string {
  const topicSections = result.topics
    .map((t, i) => {
      const sources = t.sources.join(", ");
      return `### ${i + 1}. ${t.title}\n\n${t.summary}\n\n> 来源：${sources} | 涉及 ${t.entryIndices.length} 条热搜`;
    })
    .join("\n\n");

  return `# ${result.date} 热点总结\n\n## 今日总览\n\n${result.overview}\n\n## 话题列表\n\n${topicSections}`;
}

const SYSTEM_PROMPT = `你是一个热点新闻分析师。以下是今日从多个平台收集的热搜条目，每行格式为：[序号] 标题 | 热度 | 来源。
请完成以下任务：
1. 话题聚类：将描述同一事件/话题的条目归为一组，即使不同平台用了不同表述
2. 为每个话题生成：统一标题、几句话摘要、涉及的原始条目编号、涉及的来源
3. 生成今日热点总览（200~500字，突出最重要的事件）

注意：entryIndices 中的数字必须对应输入中 [序号] 的数字。

输出严格为以下 JSON 格式，不要包含任何其它文字：
{
  "overview": "今日热点总览文字",
  "topics": [
    {
      "title": "话题统一标题",
      "summary": "话题摘要",
      "entryIndices": [0, 5],
      "sources": ["zhihu-search", "weibo-search"]
    }
  ]
}`;

/** 调用 GLM API 进行话题聚类和摘要 */
export async function callGLM(
  userMessage: string,
  apiKey: string,
  model: string,
): Promise<LlmSummaryOutput> {
  const response = await fetch(
    "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 16384,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GLM API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content: string = data.choices[0].message.content;

  try {
    return JSON.parse(content) as LlmSummaryOutput;
  } catch {
    const match = content.match(/```json\s*([\s\S]*?)```/);
    if (match) {
      return JSON.parse(match[1]) as LlmSummaryOutput;
    }
    throw new Error(
      `Failed to parse GLM response as JSON: ${content.slice(0, 200)}`,
    );
  }
}

/** 校验 LLM 输出并注入 date 字段，丢弃越界 entryIndices */
export function validateSummary(
  raw: LlmSummaryOutput,
  date: string,
  totalEntries: number,
): SummaryResult {
  const topics = raw.topics.map((t) => ({
    ...t,
    entryIndices: t.entryIndices.filter(
      (idx) => Number.isInteger(idx) && idx >= 0 && idx < totalEntries,
    ),
  }));

  return {
    date,
    overview: raw.overview ?? "",
    topics,
  };
}

/** 读取 raw/all/yyyy-MM-dd.json，调用 GLM 进行话题聚类和摘要，写入 summary/ */
export async function persistSummary(yyyyMMdd: string): Promise<void> {
  const rawPath = join("raw", "all", `${yyyyMMdd}.json`);

  if (!existsSync(rawPath)) return;

  const entries: MergedEntry[] = JSON.parse(await readFile(rawPath, "utf-8"));
  if (entries.length === 0) return;

  const apiKey = process.env.ZHIPU_API_KEY;
  const model = process.env.ZHIPU_MODEL;
  if (!apiKey || !model) {
    throw new Error("ZHIPU_API_KEY or ZHIPU_MODEL are not set in environment");
  }

  const userMessage = formatEntries(entries);
  const raw = await callGLM(userMessage, apiKey, model);

  const result = validateSummary(raw, yyyyMMdd, entries.length);

  const jsonStr = JSON.stringify(result, null, 2);
  await writeFileEnsureDir(join("summary", `${yyyyMMdd}.json`), jsonStr);
  await writeFileEnsureDir(join("summary", "latest.json"), jsonStr);

  const mdStr = renderSummaryMarkdown(result);
  await writeFileEnsureDir(join("summary", `${yyyyMMdd}.md`), mdStr);
  await writeFileEnsureDir(join("summary", "latest.md"), mdStr);
}
