// Copyright 2020 justjavac(迷渡). All rights reserved. MIT license.
import type { Source } from "../source.ts";
import type { ToutiaoTopSearch, ToutiaoWord } from "../types.ts";

export const toutiaoSearch: Source<ToutiaoWord> = {
  name: "toutiao-search",
  marker: "TOUTIAO",
  key: (x) => x.url,
  render: (x) => `[${x.word}](${x.url})`,
  async fetch() {
    const response = await fetch(
      "https://is-lq.snssdk.com/api/suggest_words/?business_id=10016",
    );

    if (!response.ok) {
      throw new Error(
        `toutiao-search: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json() as ToutiaoTopSearch;
    return result.data[0].words.map((x) => ({
      ...x,
      url: `https://so.toutiao.com/search?keyword=${
        x.word.replace(/(^\s+)|(\s+$)|\s+/g, "%20")
      }`,
    }));
  },
};
