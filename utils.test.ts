import { expect, test } from "bun:test";
import type { Question, SearchWord, ToutiaoWord, Word } from "./types.ts";

import {
  createArchive4Question,
  createArchive4Search,
  createArchive4Toutiao,
  createArchive4Video,
  createArchive4Weibo,
  createQuestionList,
  createReadme4Question,
  createReadme4Search,
  createReadme4Toutiao,
  createReadme4Video,
  createReadme4Weibo,
  createSearchList,
  createTuotiaoList,
  createWeiboList,
  mergeQuestions,
  mergeWords,
  mergeWords4Toutiao,
  mergeWords4Weibo,
} from "./utils.ts";

test("mergeWords4Toutiao", () => {
  const words1: ToutiaoWord[] = [];
  const words2: ToutiaoWord[] = [{ word: "foo", url: "bar" }];
  const words3: ToutiaoWord[] = [{ word: "foo", url: "hello" }];
  const words4: ToutiaoWord[] = [{ word: "hello", url: "world" }];
  const words5: ToutiaoWord[] = [
    { word: "foo", url: "bar" },
    { word: "hello", url: "world" },
  ];

  expect(mergeWords4Toutiao(words1, words2)).toEqual(words2);
  expect(mergeWords4Toutiao(words1, words5)).toEqual(words5);
  expect(mergeWords4Toutiao(words2, words2)).toEqual(words2);
  expect(mergeWords4Toutiao(words2, words3)).toEqual([
    { word: "foo", url: "bar" },
    { word: "foo", url: "hello" },
  ]);
  expect(mergeWords4Toutiao(words4, words5)).toEqual([
    { word: "hello", url: "world" },
    { word: "foo", url: "bar" },
  ]);
  expect(mergeWords4Toutiao(words3, words5)).toEqual([
    { word: "foo", url: "hello" },
    { word: "foo", url: "bar" },
    { word: "hello", url: "world" },
  ]);
});

test("createTuotiaoList", () => {
  const words: ToutiaoWord[] = [
    { word: "foo", url: "bar" },
    { word: "hello", url: "world" },
  ];

  expect(createTuotiaoList(words)).toContain("<!-- BEGIN TOUTIAO -->");
  expect(createTuotiaoList(words)).toContain("<!-- END TOUTIAO -->");
  expect(createTuotiaoList(words)).toContain("foo");
  expect(createTuotiaoList(words)).toContain("world");
  expect(createTuotiaoList(words)).toContain("hello");
});

test("createArchive4Toutiao", () => {
  const words: ToutiaoWord[] = [
    { word: "foo", url: "bar" },
    { word: "hello", url: "world" },
  ];

  expect(createArchive4Toutiao(words, "2020-02-02")).toContain("# 2020-02-02");
  expect(createArchive4Toutiao(words, "2020-02-02")).toContain("共 2 条");
});

test("createReadme4Toutiao", async () => {
  const words: ToutiaoWord[] = [
    { word: "foo", url: "bar" },
    { word: "hello", url: "world" },
  ];

  expect(await createReadme4Toutiao(words)).toContain("头条");
  expect(await createReadme4Toutiao(words)).toContain("trending-in-one");
});

test("mergeQuestions", () => {
  const words1: Question[] = [];
  const words2: Question[] = [{ title: "foo", url: "bar" }];
  const words3: Question[] = [{ title: "foo", url: "hello" }];
  const words4: Question[] = [{ title: "hello", url: "world" }];
  const words5: Question[] = [
    { title: "foo", url: "bar" },
    { title: "hello", url: "world" },
  ];

  expect(mergeQuestions(words1, words2)).toEqual(words2);
  expect(mergeQuestions(words1, words5)).toEqual(words5);
  expect(mergeQuestions(words2, words2)).toEqual(words2);
  expect(mergeQuestions(words2, words3)).toEqual([
    { title: "foo", url: "bar" },
    { title: "foo", url: "hello" },
  ]);
  expect(mergeQuestions(words4, words5)).toEqual([
    { title: "hello", url: "world" },
    { title: "foo", url: "bar" },
  ]);
  expect(mergeQuestions(words3, words5)).toEqual([
    { title: "foo", url: "hello" },
    { title: "foo", url: "bar" },
    { title: "hello", url: "world" },
  ]);
});

test("createQuestionList", () => {
  const words: Question[] = [
    { title: "foo", url: "bar" },
    { title: "hello", url: "world" },
  ];

  expect(createQuestionList(words)).toContain("<!-- BEGIN ZHIHUQUESTIONS -->");
  expect(createQuestionList(words)).toContain("<!-- END ZHIHUQUESTIONS -->");
  expect(createQuestionList(words)).toContain("foo");
  expect(createQuestionList(words)).toContain("world");
  expect(createQuestionList(words)).toContain("hello");
});

test("createArchive4Question", () => {
  const words: Question[] = [
    { title: "foo", url: "bar" },
    { title: "hello", url: "world" },
  ];

  expect(createArchive4Question(words, "2020-02-02")).toContain("# 2020-02-02");
  expect(createArchive4Question(words, "2020-02-02")).toContain("共 2 条");
});

test("createReadme4Question", async () => {
  const words: Question[] = [
    { title: "foo", url: "bar" },
    { title: "hello", url: "world" },
  ];

  expect(await createReadme4Question(words)).toContain("热门");
  expect(await createReadme4Question(words)).toContain("trending-in-one");
});

test("createArchive4Video", () => {
  const words: Question[] = [
    { title: "foo", url: "bar" },
    { title: "hello", url: "world" },
  ];

  expect(createArchive4Video(words, "2020-02-02")).toContain("# 2020-02-02");
  expect(createArchive4Video(words, "2020-02-02")).toContain("共 2 条");
});

test("createReadme4Video", async () => {
  const words: Question[] = [
    { title: "foo", url: "bar" },
    { title: "hello", url: "world" },
  ];

  expect(await createReadme4Video(words)).toContain("热门");
  expect(await createReadme4Video(words)).toContain("trending-in-one");
});

test("mergeWords4Weibo", () => {
  const words1: Word[] = [];
  const words2: Word[] = [{ title: "foo", url: "bar" }];
  const words3: Word[] = [{ title: "foo", url: "hello" }];
  const words4: Word[] = [{ title: "hello", url: "world" }];
  const words5: Word[] = [
    { title: "foo", url: "bar" },
    { title: "hello", url: "world" },
  ];

  expect(mergeWords4Weibo(words1, words2)).toEqual(words2);
  expect(mergeWords4Weibo(words1, words5)).toEqual(words5);
  expect(mergeWords4Weibo(words2, words2)).toEqual(words2);
  expect(mergeWords4Weibo(words2, words3)).toEqual([
    { title: "foo", url: "bar" },
    { title: "foo", url: "hello" },
  ]);
  expect(mergeWords4Weibo(words4, words5)).toEqual([
    { title: "hello", url: "world" },
    { title: "foo", url: "bar" },
  ]);
  expect(mergeWords4Weibo(words3, words5)).toEqual([
    { title: "foo", url: "hello" },
    { title: "foo", url: "bar" },
    { title: "hello", url: "world" },
  ]);
});

test("createWeiboList", () => {
  const words: Word[] = [
    { title: "foo", url: "bar" },
    { title: "hello", url: "world" },
  ];

  expect(createWeiboList(words)).toContain("<!-- BEGIN WEIBO -->");
  expect(createWeiboList(words)).toContain("<!-- END WEIBO -->");
  expect(createWeiboList(words)).toContain("foo");
  expect(createWeiboList(words)).toContain("world");
  expect(createWeiboList(words)).toContain("hello");
});

test("createArchive4Weibo", () => {
  const words: Word[] = [
    { title: "foo", url: "bar" },
    { title: "hello", url: "world" },
  ];

  expect(createArchive4Weibo(words, "2020-02-02")).toContain("# 2020-02-02");
  expect(createArchive4Weibo(words, "2020-02-02")).toContain("共 2 条");
});

test("createReadme4Weibo", async () => {
  const words: Word[] = [
    { title: "foo", url: "bar" },
    { title: "hello", url: "world" },
  ];

  expect(await createReadme4Weibo(words)).toContain("微博");
  expect(await createReadme4Weibo(words)).toContain("trending-in-one");
});

test("mergeWords", () => {
  const words1: SearchWord[] = [];
  const words2: SearchWord[] = [{ query: "foo", display_query: "bar" }];
  const words3: SearchWord[] = [{ query: "foo", display_query: "hello" }];
  const words4: SearchWord[] = [{ query: "hello", display_query: "world" }];
  const words5: SearchWord[] = [
    { query: "foo", display_query: "bar" },
    { query: "hello", display_query: "world" },
  ];

  expect(mergeWords(words1, words2)).toEqual(words2);
  expect(mergeWords(words1, words5)).toEqual(words5);
  expect(mergeWords(words2, words2)).toEqual(words2);
  expect(mergeWords(words2, words3)).toEqual([
    { query: "foo", display_query: "bar" },
    { query: "foo", display_query: "hello" },
  ]);
  expect(mergeWords(words4, words5)).toEqual([
    { query: "hello", display_query: "world" },
    { query: "foo", display_query: "bar" },
  ]);
  expect(mergeWords(words3, words5)).toEqual([
    { query: "foo", display_query: "hello" },
    { query: "foo", display_query: "bar" },
    { query: "hello", display_query: "world" },
  ]);
});

test("createSearchList", () => {
  const words: SearchWord[] = [
    { query: "foo", display_query: "bar" },
    { query: "hello", display_query: "world" },
  ];

  expect(createSearchList(words)).toContain("<!-- BEGIN ZHIHUSEARCH -->");
  expect(createSearchList(words)).toContain("<!-- END ZHIHUSEARCH -->");
  expect(createSearchList(words)).toContain("foo");
  expect(createSearchList(words)).toContain("world");
  expect(createSearchList(words)).toContain("hello");
});

test("createArchive4Search", () => {
  const words: SearchWord[] = [
    { query: "foo", display_query: "bar" },
    { query: "hello", display_query: "world" },
  ];

  expect(createArchive4Search(words, "2020-02-02")).toContain("# 2020-02-02");
  expect(createArchive4Search(words, "2020-02-02")).toContain("共 2 条");
});

test("createReadme4Search", async () => {
  const words: SearchWord[] = [
    { query: "foo", display_query: "bar" },
    { query: "hello", display_query: "world" },
  ];

  expect(await createReadme4Search(words)).toContain("热搜");
  expect(await createReadme4Search(words)).toContain("trending-in-one");
});
