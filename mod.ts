import { persist, persistMerged, toMergedEntries } from "./lib/persist.ts";
import type { MergedEntry, Source } from "./lib/source.ts";
import { persistSummary } from "./lib/summary.ts";
import { baiduHot } from "./lib/sources/baidu-hot.ts";
import { douyinHot } from "./lib/sources/douyin-hot.ts";
import { kuaishouHot } from "./lib/sources/kuaishou-hot.ts";
import { toutiaoSearch } from "./lib/sources/toutiao-search.ts";
import { weiboSearch } from "./lib/sources/weibo-search.ts";
import { zhihuSearch } from "./lib/sources/zhihu-search.ts";
import { formatDate } from "./lib/utils.ts";

const sources = [
  // zhihuVideo,
  // zhihuQuestions,
  zhihuSearch,
  weiboSearch,
  toutiaoSearch,
  baiduHot,
  douyinHot,
  kuaishouHot,
] as Source<unknown>[];

export async function init() {
  const yyyyMMdd = formatDate(new Date());

  // 串行执行：所有 source 都会读-改-写 README.md，并行会丢失修改。
  // 用 try/catch 隔离单个 source 的失败，避免一个挂掉影响其它。
  const merged: MergedEntry[] = [];
  for (const source of sources) {
    try {
      const items = await persist(source);
      merged.push(...toMergedEntries(source, items));
      console.log(`✓ ${source.name}`);
    } catch (err) {
      console.error(
        `✗ ${source.name}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // 跨 source 合并：即便部分 source 失败也写一份成功的部分。
  try {
    await persistMerged(yyyyMMdd, merged);
    console.log(`✓ merged (${merged.length} entries)`);
  } catch (err) {
    console.error(`✗ merged:`, err instanceof Error ? err.message : err);
  }

  try {
    await persistSummary(yyyyMMdd);
    console.log(`✓ summary`);
  } catch (err) {
    console.error(`✗ summary:`, err instanceof Error ? err.message : err);
  }
}

init();
