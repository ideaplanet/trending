// Copyright 2020 justjavac(迷渡). All rights reserved. MIT license.
import type { Source } from "../source.ts";
import type { Word } from "../types.ts";

// 微博 SSR 出来的每条热搜：<a href="/weibo?q=..." ...>标题</a> 后面跟着
// <span>[分类 ]热度数字</span>。榜首的「置顶」条没有 span，故 score 可缺。
const regexp =
  /<a href="(\/weibo\?q=[^"]+)"[^>]*>(.+?)<\/a>(?:\s*<span>(?:[^<]*?\s)?(\d+)<\/span>)?/g;

export const weiboSearch: Source<Word> = {
  name: "weibo-search",
  marker: "WEIBO",
  key: (x) => x.url,
  render: (x) => `[${x.title}](https://s.weibo.com/${x.url})`,
  toEntry: (x) => ({
    title: x.title,
    url: `https://s.weibo.com/${x.url}`,
    ...(x.hotScore !== undefined ? { hotScore: x.hotScore } : {}),
  }),
  async fetch() {
    const response = await fetch("https://s.weibo.com/top/summary", {
      headers: {
        Cookie:
          "SUB=_2AkMVdRtlf8NxqwJRmfoWy2_lb4V0yQvEieKjKeq-JRMxHRl-yT8XqmYatRB6PvU1ijEk4CykabQQvFhJAy31x99v4Ejs;",
      },
    });

    if (!response.ok) {
      throw new Error(`weibo-search: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    return Array.from(html.matchAll(regexp)).map((x) => {
      const score = x[3] ? Number(x[3]) : NaN;
      return {
        url: x[1],
        title: x[2],
        ...(Number.isFinite(score) ? { hotScore: score } : {}),
      };
    });
  },
};
