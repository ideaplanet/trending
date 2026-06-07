// Copyright 2020 justjavac(迷渡). All rights reserved. MIT license.
import type { Source } from "../source.ts";
import type { Question, ZhihuQuestionList } from "../types.ts";

export const zhihuQuestions: Source<Question> = {
  name: "zhihu-questions",
  marker: "ZHIHUQUESTIONS",
  key: (x) => x.url,
  render: (x) => `[${x.title}](${x.url})`,
  async fetch() {
    const response = await fetch(
      "https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=100",
    );

    if (!response.ok) {
      throw new Error(
        `zhihu-questions: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json() as ZhihuQuestionList;
    return result.data.map((x) => ({
      title: x.target.title,
      url: `https://www.zhihu.com/question/${x.target.id}`,
    }));
  },
};
