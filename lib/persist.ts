import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { MergedEntry, Source } from "./source.ts";
import { formatDate } from "./utils.ts";

async function writeFileEnsureDir(
  path: string,
  data: string,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

/** 按 key 合并两批数据并去重。fresh 中的 hotScore 会覆盖 existing 中的旧值。 */
export function mergeByKey<T>(
  fresh: T[],
  existing: T[],
  key: (item: T) => string,
): T[] {
  // 先把现有的放进 map
  const map = new Map<string, T>();
  for (const item of existing) map.set(key(item), item);
  // 用新数据覆盖或在缺失时追加
  for (const item of fresh) {
    const k = key(item);
    const old = map.get(k);
    if (old !== undefined) {
      // 仅覆盖 hotScore（如果有），保留 old 的其它字段
      const newHot = (item as Record<string, unknown>).hotScore;
      if (newHot !== undefined) {
        (old as Record<string, unknown>).hotScore = newHot;
      }
    } else {
      map.set(k, item);
    }
  }
  return Array.from(map.values());
}

/** 渲染 README 中带 BEGIN/END 标记的 section。 */
export function renderSection<T>(
  marker: string,
  items: T[],
  render: (item: T) => string,
): string {
  return `<!-- BEGIN ${marker} -->
<!-- 最后更新时间 ${Date()} -->
${items.map((x) => `1. ${render(x)}`).join("\n")}
<!-- END ${marker} -->`;
}

/** 渲染单日 archive。 */
export function renderArchive<T>(
  marker: string,
  items: T[],
  date: string,
  render: (item: T) => string,
): string {
  return `# ${date}\n
共 ${items.length} 条\n
${renderSection(marker, items, render)}
`;
}

/** 用新 section 替换 README 中 marker 对应区块。 */
export async function replaceReadmeSection(
  marker: string,
  section: string,
): Promise<string> {
  const readme = await readFile("./README.md", "utf-8");
  const re = new RegExp(`<!-- BEGIN ${marker} -->[\\W\\w]*<!-- END ${marker} -->`);
  return readme.replace(re, section);
}

/** 缺省 toEntry：把任意 source item 投影到 {title,url,hotScore}。 */
function defaultToEntry<T>(item: T): MergedEntry {
  const o = item as Record<string, unknown>;
  const title = (o.title ?? o.word ?? o.display_query ?? "") as string;
  const url = (o.url ?? "") as string;
  const hotScore = typeof o.hotScore === "number"
    ? (o.hotScore as number)
    : undefined;
  return { title, url, ...(hotScore !== undefined ? { hotScore } : {}) };
}

/** 把一批 source 的当日合并条目按热度排序，缺失热度排在后面。 */
export function rankMerged(entries: MergedEntry[]): MergedEntry[] {
  return [...entries].sort((a, b) => {
    const sa = a.hotScore ?? -Infinity;
    const sb = b.hotScore ?? -Infinity;
    return sb - sa;
  });
}

/** 把 source 当日全量数据投影为统一 entry，注入 source 名。
 *  订正 hotScore：缺失或 <1 置为 1；同 source 内按 hotScore 之和归一化。 */
export function toMergedEntries<T>(
  source: Source<T>,
  items: T[],
): MergedEntry[] {
  const project = source.toEntry ?? defaultToEntry;
  const entries = items.map((it) => {
    const entry = { ...project(it), source: source.name };
    if (entry.hotScore === undefined || entry.hotScore < 1) {
      entry.hotScore = 1;
    }
    return entry;
  });
  const max = entries.reduce((acc, e) => Math.max(acc, e.hotScore ?? 0), 0);

  if (max > 0) {
    for (const e of entries) {
      e.hotScore = Math.round((1000.0 * (e.hotScore ?? 0) / max));
    }
  }
  return entries;
}

function renderMergedMarkdown(date: string, entries: MergedEntry[]): string {
  const lines = entries.map((e) => {
    const score = e.hotScore !== undefined ? ` · ${e.hotScore}` : "";
    const src = e.source ? ` _(${e.source})_` : "";
    return `1. [${e.title}](${e.url})${score}${src}`;
  });
  return `# ${date}\n
共 ${entries.length} 条\n
<!-- 最后更新时间 ${Date()} -->
${lines.join("\n")}
`;
}

/**
 * 抓取 + 合并旧数据 + 写 raw/archives/README。
 * source 自身只做 fetch，落盘逻辑统一在这里。
 * 返回当日（合并去重后）的全量数据，供调用方再聚合成跨 source 合并输出。
 */
export async function persist<T>(source: Source<T>): Promise<T[]> {
  const fresh = await source.fetch();

  const yyyyMMdd = formatDate(new Date());
  const rawPath = join("raw", source.name, `${yyyyMMdd}.json`);

  let existingItems: T[] = [];
  if (existsSync(rawPath)) {
    existingItems = JSON.parse(await readFile(rawPath, "utf-8")) as T[];
  }

  const all = mergeByKey(fresh, existingItems, source.key);

  // raw
  await writeFileEnsureDir(rawPath, JSON.stringify(all));

  return all;
}

/**
 * 把多 source 当日数据合并写入 raw/all/yyyy-MM-dd.json 和 archives/yyyy-MM-dd.md。
 * 字段统一为 {title, url, hotScore, source}，按 hotScore 倒序，缺热度的排末尾。
 */
export async function persistMerged(
  entries: MergedEntry[],
): Promise<void> {
  const yyyyMMdd = formatDate(new Date());
  const ranked = rankMerged(entries);

  // raw 合并 JSON：字段 {title, url, hotScore, source}，按热度倒序，
  // 缺失热度的排末尾。
  const rawSlim = ranked.map(({ title, url, hotScore, source }) => ({
    title,
    url,
    ...(hotScore !== undefined ? { hotScore } : {}),
    ...(source !== undefined ? { source } : {}),
  }));
  await writeFileEnsureDir(
    join("raw", "all", `${yyyyMMdd}.json`),
    JSON.stringify(rawSlim),
  );

  // archives 合并 markdown：放在 archives 根目录下。
  await writeFileEnsureDir(
    join("archives", `${yyyyMMdd}.md`),
    renderMergedMarkdown(yyyyMMdd, ranked),
  );
}
