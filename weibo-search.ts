#!/usr/bin/env -S bun run
// Copyright 2020 justjavac(迷渡). All rights reserved. MIT license.
import { join } from "node:path";

import type { Word } from "./types.ts";
import {
  createArchive4Weibo,
  createReadme4Weibo,
  formatDate,
  mergeWords4Weibo,
} from "./utils.ts";

const regexp = /<a href="(\/weibo\?q=[^"]+)".*?>(.+)<\/a>/g;

const response = await fetch("https://s.weibo.com/top/summary", {
  headers: {
    "Cookie":
      "SUB=_2AkMVdRtlf8NxqwJRmfoWy2_lb4V0yQvEieKjKeq-JRMxHRl-yT8XqmYatRB6PvU1ijEk4CykabQQvFhJAy31x99v4Ejs;",
  },
});

if (!response.ok) {
  console.error(response.statusText);
  process.exit(-1);
}

const result: string = await response.text();

const matches = result.matchAll(regexp);

const words: Word[] = Array.from(matches).map((x) => ({
  url: x[1],
  title: x[2],
}));

const yyyyMMdd = formatDate(new Date());
const fullPath = join("raw/weibo-search", `${yyyyMMdd}.json`);

let wordsAlreadyDownload: Word[] = [];
const existing = Bun.file(fullPath);
if (await existing.exists()) {
  wordsAlreadyDownload = JSON.parse(await existing.text());
}

const queswordsAll = mergeWords4Weibo(words, wordsAlreadyDownload);

export const weiboSearchData = queswordsAll.map((x) => {
  x.realurl = `https://s.weibo.com/${x.url}`;
  return x;
});

export async function weiboSearch() {
  // 保存原始数据
  await Bun.write(fullPath, JSON.stringify(queswordsAll));

  // 更新 README.md
  const readme = await createReadme4Weibo(queswordsAll);
  await Bun.write("./README.md", readme);

  // 更新 archives
  const archiveText = createArchive4Weibo(queswordsAll, yyyyMMdd);
  const archivePath = join("archives/weibo-search", `${yyyyMMdd}.md`);
  await Bun.write(archivePath, archiveText);
}
