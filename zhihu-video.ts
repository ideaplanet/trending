#!/usr/bin/env -S bun run
// Copyright 2020 justjavac(迷渡). All rights reserved. MIT license.
import { join } from "node:path";

import type { Question, ZhihuVideoList } from "./types.ts";
import {
  createArchive4Video,
  createReadme4Video,
  formatDate,
  mergeQuestions,
} from "./utils.ts";

const response = await fetch(
  "https://www.zhihu.com/api/v3/feed/topstory/hot-lists/zvideo?limit=100",
  {
    "headers": {
      "x-api-version": "3.0.76",
    },
  },
);

if (!response.ok) {
  console.error(response.statusText);
  process.exit(-1);
}

const result = await response.json() as ZhihuVideoList;

const questions: Question[] = result.data.map((x) => ({
  title: x.target.title_area.text,
  url: x.target.link.url,
}));

const yyyyMMdd = formatDate(new Date());
const fullPath = join("raw/zhihu-video", `${yyyyMMdd}.json`);

let questionsAlreadyDownload: Question[] = [];
const existing = Bun.file(fullPath);
if (await existing.exists()) {
  questionsAlreadyDownload = JSON.parse(await existing.text());
}

const questionsAll = mergeQuestions(questions, questionsAlreadyDownload);

export const zhihuVideoData = questionsAll;

export async function zhihuVideo() {
  // 保存原始数据
  await Bun.write(fullPath, JSON.stringify(questionsAll));

  // 更新 README.md
  const readme = await createReadme4Video(questionsAll);
  await Bun.write("./README.md", readme);

  // 更新 archives
  const archiveText = createArchive4Video(questionsAll, yyyyMMdd);
  const archivePath = join("archives/zhihu-video", `${yyyyMMdd}.md`);
  await Bun.write(archivePath, archiveText);
}
