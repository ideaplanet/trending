import { expect, test } from "bun:test";

import { mergeByKey, renderArchive, renderSection } from "./persist.ts";
import { toutiaoSearch } from "./sources/toutiao-search.ts";
import { weiboSearch } from "./sources/weibo-search.ts";
import { zhihuQuestions } from "./sources/zhihu-questions.ts";
import { zhihuSearch } from "./sources/zhihu-search.ts";
import { zhihuVideo } from "./sources/zhihu-video.ts";
import type { Question, SearchWord, ToutiaoWord, Word } from "./types.ts";

test("mergeByKey 合并去重 —— 后出现覆盖先出现", () => {
  const k = (x: { url: string }) => x.url;
  expect(mergeByKey([], [{ url: "a", title: "x" }], k)).toEqual([
    { url: "a", title: "x" },
  ]);

  // 同 url，后者覆盖前者
  expect(
    mergeByKey(
      [{ url: "a", title: "old" }],
      [{ url: "a", title: "new" }],
      k,
    ),
  ).toEqual([{ url: "a", title: "new" }]);

  // 不同 url 全部保留，顺序：a 先来，后来的 b 追加
  expect(
    mergeByKey(
      [{ url: "a", title: "x" }],
      [{ url: "b", title: "y" }],
      k,
    ),
  ).toEqual([
    { url: "a", title: "x" },
    { url: "b", title: "y" },
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
