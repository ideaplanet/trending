import type { Source } from "../source.ts";
import type { Word } from "../types.ts";

// 快手首页 SSR 时会把 Apollo 缓存以 window.__APOLLO_STATE__=... 的形式塞进 HTML，
// 里面有 visionHotRank({"page":"home"}) 这一项，对应热榜。
const URL = "https://www.kuaishou.com/?isHome=1";
const APOLLO_RE =
  /window\.__APOLLO_STATE__=([\s\S]*?);\(function\(\)/;
const CACHE_KEY_RE = /clientCacheKey=([A-Za-z0-9]+)/;
const HOT_RANK_KEY = '$ROOT_QUERY.visionHotRank({"page":"home"})';
const HOT_VALUE_RE = /^(\d+(?:\.\d+)?)(万|亿)?$/;

// 快手返回的热度形如 "1343.6万" / "1.2亿" / "9876"；解析为整数。
function parseHotValue(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return NaN;
  const m = raw.trim().match(HOT_VALUE_RE);
  if (!m) return NaN;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return NaN;
  const unit = m[2] === "万" ? 1e4 : m[2] === "亿" ? 1e8 : 1;
  return Math.round(n * unit);
}

interface ApolloRef {
  id: string;
}

interface VisionHotRank {
  items?: ApolloRef[];
}

interface PhotoNode {
  name?: string;
  poster?: string;
  hotValue?: string | number | null;
  tagType?: string | null;
}

type DefaultClient = Record<string, unknown> & {
  [HOT_RANK_KEY]?: VisionHotRank;
};

export const kuaishouHot: Source<Word> = {
  name: "kuaishou-hot",
  marker: "KUAISHOU",
  key: (x) => x.title,
  render: (x) => `[${x.title}](${x.url})`,
  async fetch() {
    const response = await fetch(URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(
        `kuaishou-hot: ${response.status} ${response.statusText}`,
      );
    }

    const html = await response.text();
    const match = html.match(APOLLO_RE);
    if (!match) {
      throw new Error("kuaishou-hot: __APOLLO_STATE__ not found in page");
    }

    const state = JSON.parse(match[1]) as { defaultClient?: DefaultClient };
    const client = state.defaultClient ?? {};
    const rank = client[HOT_RANK_KEY];
    const items = rank?.items ?? [];

    const out: Word[] = [];
    for (const ref of items) {
      const node = client[ref.id] as PhotoNode | undefined;
      if (!node?.name || !node.poster) continue;
      // 排除置顶条目（tagType === "置顶"）
      if (node.tagType === "置顶" || !node.hotValue) continue;
      const cacheKey = node.poster.match(CACHE_KEY_RE)?.[1];
      // 没拿到 clientCacheKey 的条目构不出可用 URL，丢掉。
      if (!cacheKey) continue;
      const score = parseHotValue(node.hotValue);
      out.push({
        title: node.name,
        url: `https://www.kuaishou.com/short-video/${cacheKey}`,
        ...(Number.isFinite(score) ? { hotScore: score } : {}),
      });
    }
    return out;
  },
};
