#!/usr/bin/env -S bun run
// Copyright 2020 justjavac(迷渡). All rights reserved. MIT license.
import { join } from "node:path";

import type { SearchWord, TopSearch } from "./types.ts";
import {
  createArchive4Search,
  createReadme4Search,
  formatDate,
  mergeWords,
} from "./utils.ts";

const response = await fetch("https://www.zhihu.com/api/v4/search/top_search");

if (!response.ok) {
  console.error(response.statusText);
  process.exit(-1);
}

const result = await response.json() as TopSearch;
const words = result.top_search.words;

const yyyyMMdd = formatDate(new Date());
const fullPath = join("raw/zhihu-search", `${yyyyMMdd}.json`);

let wordsAlreadyDownload: SearchWord[] = [];
const existing = Bun.file(fullPath);
if (await existing.exists()) {
  wordsAlreadyDownload = JSON.parse(await existing.text());
}

const wordsAll = mergeWords(words, wordsAlreadyDownload);

export const zhihuSearchData = wordsAll.map((x) => {
  x.url = `https://www.zhihu.com/search?q=${
    x.query.replace(/(^\s+)|(\s+$)|\s+/g, "%20")
  }`;
  return x;
});

export async function zhihuSearch() {
  // 保存原始数据
  await Bun.write(fullPath, JSON.stringify(wordsAll));

  // 更新 README.md
  const readme = await createReadme4Search(wordsAll);
  await Bun.write("./README.md", readme);

  // 更新 archives
  const archiveText = createArchive4Search(wordsAll, yyyyMMdd);
  const archivePath = join("archives/zhihu-search", `${yyyyMMdd}.md`);
  await Bun.write(archivePath, archiveText);
}
