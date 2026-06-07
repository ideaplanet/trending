import { persist, persistMerged, toMergedEntries } from "./lib/persist.ts";
import type { MergedEntry, Source } from "./lib/source.ts";
import { baiduHot } from "./lib/sources/baidu-hot.ts";
import { douyinHot } from "./lib/sources/douyin-hot.ts";
import { toutiaoSearch } from "./lib/sources/toutiao-search.ts";
import { weiboSearch } from "./lib/sources/weibo-search.ts";
import { zhihuSearch } from "./lib/sources/zhihu-search.ts";

const sources = [
  // zhihuVideo,
  // zhihuQuestions,
  zhihuSearch,
  weiboSearch,
  toutiaoSearch,
  baiduHot,
  douyinHot,
] as Source<unknown>[];

export async function init() {
  // 串行执行：所有 source 都会读-改-写 README.md，并行会丢失修改。
  // 用 try/catch 隔离单个 source 的失败，避免一个挂掉影响其它。
  let failed = 0;
  const merged: MergedEntry[] = [];
  for (const source of sources) {
    try {
      const items = await persist(source);
      merged.push(...toMergedEntries(source, items));
      console.log(`✓ ${source.name}`);
    } catch (err) {
      failed++;
      console.error(
        `✗ ${source.name}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // 跨 source 合并：即便部分 source 失败也写一份成功的部分。
  try {
    await persistMerged(merged);
    console.log(`✓ merged (${merged.length} entries)`);
  } catch (err) {
    failed++;
    console.error(
      `✗ merged:`,
      err instanceof Error ? err.message : err,
    );
  }

  if (failed > 0) process.exitCode = 1;
}

init();
