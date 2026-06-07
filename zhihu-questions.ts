#!/usr/bin/env -S bun run
// Copyright 2020 justjavac(迷渡). All rights reserved. MIT license.
import { join } from "node:path";

import type { Question, ZhihuQuestionList } from "./types.ts";
import {
  createArchive4Question,
  createReadme4Question,
  formatDate,
  mergeQuestions,
} from "./utils.ts";

const response = await fetch(
  "https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=100",
);

if (!response.ok) {
  console.error(response.statusText);
  process.exit(-1);
}

const result = await response.json() as ZhihuQuestionList;

const questions: Question[] = result.data.map((x) => ({
  title: x.target.title,
  url: `https://www.zhihu.com/question/${x.target.id}`,
}));

const yyyyMMdd = formatDate(new Date());
const fullPath = join("raw/zhihu-questions", `${yyyyMMdd}.json`);

let questionsAlreadyDownload: Question[] = [];
const existing = Bun.file(fullPath);
if (await existing.exists()) {
  questionsAlreadyDownload = JSON.parse(await existing.text());
}

const questionsAll = mergeQuestions(questions, questionsAlreadyDownload);

export const zhihuQuestionData = questionsAll;

export async function zhihuQuestions() {
  // 保存原始数据
  await Bun.write(fullPath, JSON.stringify(questionsAll));

  // 更新 README.md
  const readme = await createReadme4Question(questionsAll);
  await Bun.write("./README.md", readme);

  // 更新 archives
  const archiveText = createArchive4Question(questionsAll, yyyyMMdd);
  const archivePath = join("archives/zhihu-questions", `${yyyyMMdd}.md`);
  await Bun.write(archivePath, archiveText);
}
