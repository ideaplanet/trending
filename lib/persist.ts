import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { Source } from "./source.ts";
import { formatDate } from "./utils.ts";

async function writeFileEnsureDir(
  path: string,
  data: string,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

/** 按 key 合并两批数据并去重，后出现的覆盖先出现的（沿用旧实现语义）。 */
export function mergeByKey<T>(
  a: T[],
  b: T[],
  key: (item: T) => string,
): T[] {
  const map = new Map<string, T>();
  for (const item of a.concat(b)) {
    map.set(key(item), item);
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

/**
 * 抓取 + 合并旧数据 + 写 raw/archives/README。
 * source 自身只做 fetch，落盘逻辑统一在这里。
 */
export async function persist<T>(source: Source<T>): Promise<void> {
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

  // README
  const section = renderSection(source.marker, all, source.render);
  const readme = await replaceReadmeSection(source.marker, section);
  await writeFile("./README.md", readme);

  // archive
  const archive = renderArchive(source.marker, all, yyyyMMdd, source.render);
  await writeFileEnsureDir(join("archives", source.name, `${yyyyMMdd}.md`), archive);
}
