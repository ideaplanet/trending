import type { Source } from "../source.ts";
import type { Word } from "../types.ts";

// 抖音热搜 API。直接请求会被 401，需要带上 passport_csrf_token cookie——
// 这个 token 在访问登录页时由服务端写在 Set-Cookie 里，拿来即用。
const HOT_URL =
  "https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&detail_list=1&round_trip_time=50";
const COOKIE_URL = "https://login.douyin.com/";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

interface DouyinWord {
  word: string;
  sentence_id: string;
  hot_value?: number;
}

interface DouyinHotResp {
  data?: {
    word_list?: DouyinWord[];
  };
}

async function fetchCsrfToken(): Promise<string> {
  const resp = await fetch(COOKIE_URL, {
    headers: { "User-Agent": UA },
    redirect: "manual",
  });
  // Set-Cookie 在 fetch 里要从 headers 读；Node 的 fetch 会把多个 Set-Cookie 合并。
  const setCookie = resp.headers.get("set-cookie") ?? "";
  const m = setCookie.match(/passport_csrf_token=([^;]+)/);
  return m ? m[1] : "";
}

export const douyinHot: Source<Word> = {
  name: "douyin-hot",
  marker: "DOUYIN",
  key: (x) => x.url,
  render: (x) => `[${x.title}](${x.url})`,
  async fetch() {
    const token = await fetchCsrfToken();
    if (!token) {
      throw new Error("douyin-hot: failed to obtain passport_csrf_token");
    }

    const response = await fetch(HOT_URL, {
      headers: {
        "User-Agent": UA,
        Cookie: `passport_csrf_token=${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `douyin-hot: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as DouyinHotResp;
    const words = data.data?.word_list ?? [];

    return words
      .filter((w) => w.word && w.sentence_id)
      .map((w) => {
        const score = typeof w.hot_value === "number" ? w.hot_value : NaN;
        return {
          title: w.word,
          url: `https://www.douyin.com/hot/${w.sentence_id}`,
          ...(Number.isFinite(score) ? { hotScore: score } : {}),
        };
      });
  },
};
