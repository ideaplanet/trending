import type { Source } from "../source.ts";
import type { Word } from "../types.ts";

// 百度热搜整页 SSR 渲染时，会把热榜数据塞进页面里的
// `<!--s-data:{...}-->` 注释；从这里取比 DOM 解析稳得多。
const SDATA_RE = /<!--s-data:(\{[\s\S]*?\})-->/;

interface BaiduHotItem {
  word: string;
  query?: string;
  url?: string;
  rawUrl?: string;
  hotScore?: string;
  isTop?: boolean;
}

interface BaiduSData {
  data?: {
    cards?: Array<{
      component?: string;
      content?: BaiduHotItem[];
    }>;
  };
}

export const baiduHot: Source<Word> = {
  name: "baidu-hot",
  marker: "BAIDU",
  key: (x) => x.url,
  render: (x) => `[${x.title}](${x.url})`,
  async fetch() {
    const response = await fetch("https://top.baidu.com/board?tab=realtime", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`baidu-hot: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const match = html.match(SDATA_RE);
    if (!match) {
      throw new Error("baidu-hot: s-data JSON not found in page");
    }

    const data = JSON.parse(match[1]) as BaiduSData;
    const hotList = data.data?.cards?.find((c) => c.component === "hotList");
    const items = hotList?.content ?? [];

    return items
      // 榜首常驻的「置顶」要闻和实时热度不是一回事，剔掉。
      .filter((x) => !x.isTop)
      .filter((x) => x.word && (x.url || x.rawUrl || x.query))
      .map((x) => {
        const score = x.hotScore ? Number(x.hotScore) : NaN;
        const url = x.url ?? x.rawUrl ??
          `https://www.baidu.com/s?wd=${encodeURIComponent(x.query ?? "")}`;
        return {
          title: x.word,
          url,
          ...(Number.isFinite(score) ? { hotScore: score } : {}),
        };
      });
  },
};
