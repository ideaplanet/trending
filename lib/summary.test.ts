import { expect, test } from "bun:test";
import {
  formatEntries,
  renderSummaryMarkdown,
  validateSummary,
} from "./summary.ts";
import type { SummaryResult, LlmSummaryOutput } from "./summary.ts";
import type { MergedEntry } from "./source.ts";

test("formatEntries formats entries as [index] title | hotScore | source", () => {
  const entries: MergedEntry[] = [
    {
      title: "某某事件引发热议",
      url: "https://example.com/1",
      hotScore: 41502029,
      source: "zhihu-search",
    },
    {
      title: "另一个话题",
      url: "https://example.com/2",
      hotScore: 12345,
      source: "weibo-search",
    },
    {
      title: "无热度的条目",
      url: "https://example.com/3",
      source: "toutiao-search",
    },
  ];
  expect(formatEntries(entries)).toEqual(
    "[0] 某某事件引发热议 | 41502029 | zhihu-search\n" +
      "[1] 另一个话题 | 12345 | weibo-search\n" +
      "[2] 无热度的条目 | 0 | toutiao-search",
  );
});

test("formatEntries returns empty string for empty array", () => {
  expect(formatEntries([])).toBe("");
});

test("renderSummaryMarkdown renders overview and topics", () => {
  const result: SummaryResult = {
    date: "2026-06-08",
    overview: "今日热点总览文字",
    topics: [
      {
        title: "话题A",
        summary: "这是话题A的摘要",
        entryIndices: [0, 5],
        sources: ["zhihu-search", "weibo-search"],
      },
      {
        title: "话题B",
        summary: "这是话题B的摘要",
        entryIndices: [2],
        sources: ["toutiao-search"],
      },
    ],
  };
  const md = renderSummaryMarkdown(result);
  expect(md).toContain("# 2026-06-08 热点总结");
  expect(md).toContain("## 今日总览\n\n今日热点总览文字");
  expect(md).toContain("### 1. 话题A");
  expect(md).toContain("这是话题A的摘要");
  expect(md).toContain("> 来源：zhihu-search, weibo-search | 涉及 2 条热搜");
  expect(md).toContain("### 2. 话题B");
  expect(md).toContain("> 来源：toutiao-search | 涉及 1 条热搜");
});

test("renderSummaryMarkdown handles empty topics", () => {
  const result: SummaryResult = {
    date: "2026-06-08",
    overview: "今日暂无热点",
    topics: [],
  };
  const md = renderSummaryMarkdown(result);
  expect(md).toContain("# 2026-06-08 热点总结");
  expect(md).toContain("今日暂无热点");
  expect(md).not.toContain("###");
});

test("validateSummary injects date and clamps out-of-range entryIndices", () => {
  const raw: LlmSummaryOutput = {
    overview: "总览",
    topics: [
      {
        title: "话题A",
        summary: "摘要",
        entryIndices: [0, 5, 99],
        sources: ["zhihu-search"],
      },
      {
        title: "话题B",
        summary: "摘要",
        entryIndices: [-1, 2],
        sources: ["weibo-search"],
      },
    ],
  };
  const result = validateSummary(raw, "2026-06-08", 10);
  expect(result.date).toBe("2026-06-08");
  expect(result.topics[0].entryIndices).toEqual([0, 5]);
  expect(result.topics[1].entryIndices).toEqual([2]);
});

test("validateSummary handles empty topics and missing overview", () => {
  const raw: LlmSummaryOutput = {
    overview: "",
    topics: [],
  };
  const result = validateSummary(raw, "2026-06-08", 100);
  expect(result.date).toBe("2026-06-08");
  expect(result.overview).toBe("");
  expect(result.topics).toEqual([]);
});
