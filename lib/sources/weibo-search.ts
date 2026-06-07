// Copyright 2020 justjavac(迷渡). All rights reserved. MIT license.
import type { Source } from "../source.ts";
import type { Word } from "../types.ts";

const regexp = /<a href="(\/weibo\?q=[^"]+)".*?>(.+)<\/a>/g;

export const weiboSearch: Source<Word> = {
  name: "weibo-search",
  marker: "WEIBO",
  key: (x) => x.url,
  render: (x) => `[${x.title}](https://s.weibo.com/${x.url})`,
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
    return Array.from(html.matchAll(regexp)).map((x) => ({
      url: x[1],
      title: x[2],
    }));
  },
};
