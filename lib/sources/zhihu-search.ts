// Copyright 2020 justjavac(迷渡). All rights reserved. MIT license.
import type { Source } from "../source.ts";
import type { SearchWord, TopSearch } from "../types.ts";

export const zhihuSearch: Source<SearchWord> = {
  name: "zhihu-search",
  marker: "ZHIHUSEARCH",
  key: (x) => x.display_query,
  render: (x) =>
    `[${x.display_query}](https://www.zhihu.com/search?q=${x.query})`,
  toEntry: (x) => ({
    title: x.display_query,
    url: `https://www.zhihu.com/search?q=${x.query}`,
    ...(x.hotScore !== undefined ? { hotScore: x.hotScore } : {}),
  }),
  async fetch() {
    const response = await fetch(
      "https://www.zhihu.com/api/v4/search/top_search",
    );

    if (!response.ok) {
      throw new Error(`zhihu-search: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as TopSearch;
    const words = result.top_search.words || [];
    return words.map((w, index) => ({
      ...w,
      hotScore: 2 * words.length - index,
    }));
  },
};
