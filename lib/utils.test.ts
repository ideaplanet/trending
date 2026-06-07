import { expect, test } from "bun:test";

import {
  mergeByKey,
  rankMerged,
  renderArchive,
  renderSection,
  toMergedEntries,
} from "./persist.ts";
import { baiduHot } from "./sources/baidu-hot.ts";
import { toutiaoSearch } from "./sources/toutiao-search.ts";
import { weiboSearch } from "./sources/weibo-search.ts";
import { zhihuQuestions } from "./sources/zhihu-questions.ts";
import { zhihuSearch } from "./sources/zhihu-search.ts";
import { zhihuVideo } from "./sources/zhihu-video.ts";
import type { Question, SearchWord, ToutiaoWord, Word } from "./types.ts";

test("mergeByKey 合并去重 —— existing 保留，fresh 中的 hotScore 覆盖旧值", () => {
  const k = (x: { url: string }) => x.url;
  expect(mergeByKey([], [{ url: "a", title: "x" }], k)).toEqual([
    { url: "a", title: "x" },
  ]);

  // 同 url，existing 的 title 保留（不被 fresh 覆盖）
  expect(
    mergeByKey(
      [{ url: "a", title: "fresh" }],
      [{ url: "a", title: "existing" }],
      k,
    ),
  ).toEqual([{ url: "a", title: "existing" }]);

  // 同 url，fresh 带 hotScore 时覆盖 existing 上的旧热度
  expect(
    mergeByKey(
      [{ url: "a", title: "fresh", hotScore: 999 }],
      [{ url: "a", title: "existing", hotScore: 1 }],
      k,
    ),
  ).toEqual([{ url: "a", title: "existing", hotScore: 999 }]);

  // 同 url，fresh 没有 hotScore 时不动 existing 上的热度
  expect(
    mergeByKey(
      [{ url: "a", title: "fresh" }],
      [{ url: "a", title: "existing", hotScore: 5 }],
      k,
    ),
  ).toEqual([{ url: "a", title: "existing", hotScore: 5 }]);

  // 不同 url 全部保留，existing 先 fresh 后
  expect(
    mergeByKey(
      [{ url: "a", title: "x" }],
      [{ url: "b", title: "y" }],
      k,
    ),
  ).toEqual([
    { url: "b", title: "y" },
    { url: "a", title: "x" },
  ]);
});

test("renderSection 包含 BEGIN/END 标记和所有条目", () => {
  const items: Question[] = [
    { title: "foo", url: "bar" },
    { title: "hello", url: "world" },
  ];
  const out = renderSection("ZHIHUQUESTIONS", items, (x) =>
    `[${x.title}](${x.url})`);

  expect(out).toContain("<!-- BEGIN ZHIHUQUESTIONS -->");
  expect(out).toContain("<!-- END ZHIHUQUESTIONS -->");
  expect(out).toContain("1. [foo](bar)");
  expect(out).toContain("1. [hello](world)");
});

test("renderArchive 包含日期和条目数", () => {
  const items: Question[] = [
    { title: "foo", url: "bar" },
    { title: "hello", url: "world" },
  ];
  const out = renderArchive(
    "ZHIHUQUESTIONS",
    items,
    "2020-02-02",
    (x) => `[${x.title}](${x.url})`,
  );

  expect(out).toContain("# 2020-02-02");
  expect(out).toContain("共 2 条");
});

test("source 描述：zhihu-video", () => {
  expect(zhihuVideo.name).toBe("zhihu-video");
  expect(zhihuVideo.marker).toBe("ZHIHUVIDEO");
  const q: Question = { title: "t", url: "u" };
  expect(zhihuVideo.key(q)).toBe("u");
  expect(zhihuVideo.render(q)).toBe("[t](u)");
});

test("source 描述：zhihu-questions", () => {
  expect(zhihuQuestions.marker).toBe("ZHIHUQUESTIONS");
  const q: Question = { title: "t", url: "u" };
  expect(zhihuQuestions.key(q)).toBe("u");
  expect(zhihuQuestions.render(q)).toBe("[t](u)");
});

test("source 描述：zhihu-search 用 display_query 去重，render 拼搜索 URL", () => {
  expect(zhihuSearch.marker).toBe("ZHIHUSEARCH");
  const w: SearchWord = { query: "foo", display_query: "bar" };
  expect(zhihuSearch.key(w)).toBe("bar");
  expect(zhihuSearch.render(w)).toBe(
    "[bar](https://www.zhihu.com/search?q=foo)",
  );
});

test("source 描述：weibo-search render 拼接 s.weibo.com 前缀", () => {
  expect(weiboSearch.marker).toBe("WEIBO");
  const w: Word = { title: "t", url: "/weibo?q=foo" };
  expect(weiboSearch.key(w)).toBe("/weibo?q=foo");
  expect(weiboSearch.render(w)).toBe("[t](https://s.weibo.com//weibo?q=foo)");
});

test("source 描述：toutiao-search", () => {
  expect(toutiaoSearch.marker).toBe("TOUTIAO");
  const w: ToutiaoWord = { word: "foo", url: "bar" };
  expect(toutiaoSearch.key(w)).toBe("bar");
  expect(toutiaoSearch.render(w)).toBe("[foo](bar)");
});

test("toutiao-search toEntry 携带 fake_click_cnt 来的 hotScore", () => {
  const w: ToutiaoWord = {
    word: "foo",
    url: "u",
    hotScore: 41502029,
  };
  expect(toutiaoSearch.toEntry?.(w)).toEqual({
    title: "foo",
    url: "u",
    hotScore: 41502029,
  });
});

test("weibo-search toEntry 把相对 url 展开为绝对地址，携带热度", () => {
  const w: Word = { title: "t", url: "/weibo?q=foo", hotScore: 123 };
  expect(weiboSearch.toEntry?.(w)).toEqual({
    title: "t",
    url: "https://s.weibo.com//weibo?q=foo",
    hotScore: 123,
  });
  // 没热度时不要塞 undefined 字段
  expect(weiboSearch.toEntry?.({ title: "t", url: "/weibo?q=foo" })).toEqual({
    title: "t",
    url: "https://s.weibo.com//weibo?q=foo",
  });
});

test("zhihu-search toEntry 用 display_query 作标题、拼搜索 URL", () => {
  const w: SearchWord = { query: "foo", display_query: "bar" };
  expect(zhihuSearch.toEntry?.(w)).toEqual({
    title: "bar",
    url: "https://www.zhihu.com/search?q=foo",
  });
});

test("toMergedEntries 注入 source 名，缺省投影读出 title/url/hotScore，缺失或 <1 的 hotScore 置 1 后按 source 内总和归一化", () => {
  const items: Word[] = [
    { title: "a", url: "u1", hotScore: 10 },
    { title: "b", url: "u2" },
    { title: "c", url: "u3", hotScore: 0 },
  ];
  const entries = toMergedEntries(baiduHot, items);
  // 订正后 hotScore: a=10, b=1, c=1, sum=12 → 乘 10000 取整：a≈8333, b≈833, c≈833
  expect(entries).toEqual([
    { title: "a", url: "u1", hotScore: Math.round(10000 * 10 / 12), source: "baidu-hot" },
    { title: "b", url: "u2", hotScore: Math.round(10000 * 1 / 12), source: "baidu-hot" },
    { title: "c", url: "u3", hotScore: Math.round(10000 * 1 / 12), source: "baidu-hot" },
  ]);
});

test("rankMerged 按 hotScore 倒序，缺失热度排末尾", () => {
  const ranked = rankMerged([
    { title: "low", url: "u1", hotScore: 1 },
    { title: "missing", url: "u2" },
    { title: "high", url: "u3", hotScore: 99 },
    { title: "mid", url: "u4", hotScore: 50 },
  ]);
  expect(ranked.map((e) => e.title)).toEqual(["high", "mid", "low", "missing"]);
});
