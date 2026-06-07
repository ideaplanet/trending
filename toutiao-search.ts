#!/usr/bin/env -S bun run
// Copyright 2020 justjavac(迷渡). All rights reserved. MIT license.
import { join } from "node:path";

import type { ToutiaoTopSearch, ToutiaoWord } from "./types.ts";
import {
  createArchive4Toutiao,
  createReadme4Toutiao,
  formatDate,
  mergeWords4Toutiao,
} from "./utils.ts";

const response = await fetch(
  "https://is-lq.snssdk.com/api/suggest_words/?business_id=10016",
);

if (!response.ok) {
  console.error(response.statusText);
  process.exit(-1);
}

const result = await response.json() as ToutiaoTopSearch;
const words = result.data[0].words;

const yyyyMMdd = formatDate(new Date());
const fullPath = join("raw/toutiao-search", `${yyyyMMdd}.json`);

let wordsAlreadyDownload: ToutiaoWord[] = [];
const existing = Bun.file(fullPath);
if (await existing.exists()) {
  wordsAlreadyDownload = JSON.parse(await existing.text());
}

const _words = words.map((x) => {
  x.url = `https://so.toutiao.com/search?keyword=${
    x.word.replace(/(^\s+)|(\s+$)|\s+/g, "%20")
  }`;
  return x;
});

const wordsAll = mergeWords4Toutiao(_words, wordsAlreadyDownload);

export const ToutiaoSearchData = wordsAll;

export async function toutiaoSearch() {
  // 保存原始数据
  await Bun.write(fullPath, JSON.stringify(wordsAll));

  // 更新 README.md
  const readme = await createReadme4Toutiao(wordsAll);
  await Bun.write("./README.md", readme);

  // 更新 archives
  const archiveText = createArchive4Toutiao(wordsAll, yyyyMMdd);
  const archivePath = join("archives/toutiao-search", `${yyyyMMdd}.md`);
  await Bun.write(archivePath, archiveText);
}
