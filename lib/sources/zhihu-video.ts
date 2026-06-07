// Copyright 2020 justjavac(迷渡). All rights reserved. MIT license.
import type { Source } from "../source.ts";
import type { Question, ZhihuVideoList } from "../types.ts";

export const zhihuVideo: Source<Question> = {
  name: "zhihu-video",
  marker: "ZHIHUVIDEO",
  key: (x) => x.url,
  render: (x) => `[${x.title}](${x.url})`,
  async fetch() {
    const response = await fetch(
      "https://www.zhihu.com/api/v3/feed/topstory/hot-lists/zvideo?limit=100",
      { headers: { "x-api-version": "3.0.76" } },
    );

    if (!response.ok) {
      throw new Error(`zhihu-video: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as ZhihuVideoList;
    return result.data.map((x) => ({
      title: x.target.title_area.text,
      url: x.target.link.url,
    }));
  },
};
