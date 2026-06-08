# trending-in-one

[![Build Status](https://github.com/ideaplanet/trending/workflows/ci/badge.svg?branch=master)](https://github.com/ideaplanet/trending-in-one/actions)
[![license](https://img.shields.io/github/license/ideaplanet/trending)](https://github.com/ideaplanet/trending/blob/master/LICENSE)

今日头条热搜,知乎热搜榜，知乎热门视频，知乎热门话题， 微博热搜榜，百度热搜，抖音热搜；记录从
2026-06-07 日开始的热搜。每小时抓取一次数据，按天[归档](./archives)。

## 使用

可通过访问**jsdelivr**提供的 CDN 文件路径获取到本项目的存档文件，
如想获取**2026-06-07**当天的知乎热搜，只需访问[**https://cdn.jsdelivr.net/gh/ideaplanet/trending/raw/zhihu-search/2026-06-07.json**](https://cdn.jsdelivr.net/gh/ideaplanet/trending/raw/zhihu-search/2026-06-07.json)
即可；

## 数据目录说明

- [raw/](./raw) — 各数据源的原始抓取结果，按 `源名/yyyy-MM-dd.json` 组织，例如 [raw/zhihu-search/](./raw/zhihu-search)、[raw/weibo-search/](./raw/weibo-search)、[raw/baidu-hot/](./raw/baidu-hot)、[raw/douyin-hot/](./raw/douyin-hot)、[raw/toutiao-search/](./raw/toutiao-search)。同一天内多次抓取会按 key 合并去重，最新的 `hotScore` 覆盖旧值，保留首次出现的其它字段。
- [raw/all/](./raw/all) — 跨数据源合并后的当日 JSON，每条统一为 `{title, url, hotScore, normalizedScore, source}`，按 `normalizedScore` 倒序排列，缺失沉底，便于一次性消费全部热搜。`normalizedScore` 是该条在原源内 `hotScore` 降序排序后的排名百分位（万分制，落在 (0, 10000) 开区间内，条数越多的源 #1 越接近 10000）。
- [summary/](./summary) — 每日热点聚类和摘要，由 GLM-4.7-Flash 生成。`summary/yyyy-MM-dd.json` 为结构化数据（含全天总览 `overview` 和话题列表 `topics`，每个话题含统一标题、摘要、原始条目索引和来源）；`summary/yyyy-MM-dd.md` 为可读的 Markdown 版本；`summary/latest.json` 和 `summary/latest.md` 为当天快照。
- [archives/](./archives) — 跨数据源合并后的当日 Markdown 归档（`yyyy-MM-dd.md`），内容与 `raw/all` 对应，可直接在 GitHub 上阅读历史热点。


