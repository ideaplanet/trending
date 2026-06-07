# 设计：normalizedScore 改为 rank-based 线性归一化

- 日期：2026-06-07
- 范围：`lib/persist.ts`、`lib/source.ts`、`lib/utils.test.ts`、`README.md`
- 不涉及：各 source 抓取实现、`mod.ts` 编排、持久化字段结构

## 背景

`toMergedEntries` 当前的归一化算法是 `round(10000 × log1p(x) / log1p(max))`，每个 source
内部对原始 `hotScore` 做对数压缩 + max 归一化，结果写入 `normalizedScore`。`rankMerged`
按 `normalizedScore` 做跨源排序。

实际数据（`raw/all/2026-06-07.json`）里各 source 的 `hotScore` 量级差异极大：

| Source         | min     | median  | max      |
|----------------|---------|---------|----------|
| toutiao-search | 5K      | 1.7M    | **41.8M** |
| douyin-hot     | 7.6M    | 7.7M    | 11.5M    |
| baidu-hot      | 3.1M    | 5.5M    | 7.9M     |
| weibo-search   | 208K    | 381K    | 2.2M     |
| zhihu-search   | —       | —       | —        |

这导致当前算法存在四类问题：

1. **跨源公平性失真**：每个 source 内 max → 10000，多个源的 #1 跨源排序时并列第一。
2. **头部塌缩**：抖音 50 条 `hotScore` 集中在 7.6M–11.5M，对数压缩后几乎全部 9700+。
3. **无 hotScore 的源**：知乎搜索原始接口无 `hotScore`，被全置 1 后同分。
4. **可读性**：对数压缩后的万分制对人类没有直观语义。

## 决策

把 `toMergedEntries` 的归一化从"对数压缩 + max 归一"改为**纯排名归一化**（rank-based
linear），完全不再依赖各 source `hotScore` 的数值含义。`normalizedScore` 的语义从"经
对数压缩后的相对热度"变更为"该条在原源内的排名百分位 × 10000"。

跨源排序逻辑（`rankMerged`）与持久化字段结构均保持不变。

### 关键设计选择（每一项均经用户确认）

| 选项 | 选择 | 理由 |
|---|---|---|
| 跨源公平性策略 | **B：rank-based** | 不引入主观 source weight；不依赖各源 `hotScore` 的同质性 |
| 源内归一化公式 | **B1：线性递减** `10000 × (1 - rank / N)` | 直观、相邻名次分差稳定；条数越多的源分差越小符合直觉 |
| 缺 hotScore 的源处理 | **S1：信任接口返回顺序** | 知乎接口本身就是"搜索热榜"，顺序即热度 |
| rank 来源 | **T1：在 toMergedEntries 内按 hotScore 排序得出 rank** | 鲁棒，不依赖各 source 抓取代码返回数组的顺序约定 |
| README 是否说明 | **R1：在数据目录说明里加一行** | 万分制数字出现在归档 markdown 里，需要给读者一个直接的语义入口 |
| 是否加 zhihu-search 专项测试 | **T2：不加** | zhihu-search 在新算法下走完全相同的代码路径，无特殊分支 |

### 主动接受的取舍

- **跨源 #1 仍然并列**：每个 source 的 #1 都是 10000，多个源混排时榜首会出现并列，
  tie-break 由 sort 稳定性决定。这是选择 B 方案的核心代价——拒绝引入主观跨源权重。
- **`normalizedScore` 不再可比原始热度**：从此该字段反映的是"在本源中的相对位置"，而
  不是"绝对热度"，例如 weibo 第 10 名（10000 × 173/183 ≈ 9454）和 douyin 第 5 名
  （10000 × 45/50 = 9000）哪个更"热"——本设计不回答这个问题，等价于说"它们都属于本源
  头部"。

## 算法

```text
items
  ↓ project (source.toEntry ?? defaultToEntry)
  ↓ inject source name
  ↓ correct hotScore: undefined or < 1 → 1
  ↓ sort entries DESC by hotScore     ← 新增
  ↓ for rank in 0..N-1:
  ↓   entry.normalizedScore = round(10000 × (1 - rank / N))   ← 替换 log + max
  ↓
result: entries (sorted by hotScore DESC, with normalizedScore filled)
```

`hotScore` 原值保留不变。

## 受影响的代码与改动

### `lib/persist.ts` — `toMergedEntries`

替换函数体后半段（从 `const max = ...` 到 `denom > 0` 分支结束），改为按 `hotScore`
降序排序后线性写入 `normalizedScore`。结构示意：

```typescript
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

  // 按 hotScore 降序确定 rank，再做线性归一化。
  // 不再依赖 source 抓取代码返回数组的顺序约定，hotScore 是唯一的热度信号。
  entries.sort((a, b) => (b.hotScore ?? 0) - (a.hotScore ?? 0));
  const n = entries.length;
  for (let rank = 0; rank < n; rank++) {
    entries[rank].normalizedScore = Math.round(10000 * (1 - rank / n));
  }
  return entries;
}
```

注释需要更新：JSDoc 里把"对数压缩"那段改成"按 hotScore 降序排序后线性归一化到万分制"。

### `lib/source.ts` — `MergedEntry.normalizedScore` 注释

把 `/** 归一化后的热度（万分制 / 跨 source 可比较），由 toMergedEntries 计算注入。 */`
更新为：

```typescript
/**
 * 源内排名百分位（万分制）：该条在原源内 hotScore 降序排序后的位置，
 * 10000 = 该源 #1，越靠后越低；由 toMergedEntries 计算注入。
 * 跨 source 排序时直接用此字段，但榜首通常并列（每个源的 #1 都是 10000）。
 */
normalizedScore?: number;
```

### `lib/persist.ts` — `rankMerged` 与 `persistMerged`

**不动**。

`rankMerged` 仍按 `normalizedScore` 倒序，缺失沉底；`persistMerged` 落盘字段顺序
`{title, url, hotScore, normalizedScore, source}` 不变；`renderMergedMarkdown` 输出
格式 `1. [title](url) · {normalizedScore} _(source)_` 不变。

### `lib/utils.test.ts`

**替换** `toMergedEntries` 那一个测试，期望值从对数压缩公式改为线性 rank 公式。结构示意：

```typescript
test("toMergedEntries 按 hotScore 倒序后线性归一化到万分制写入 normalizedScore；hotScore 缺失或 <1 订正为 1；hotScore 原值保留", () => {
  const items: Word[] = [
    { title: "b", url: "u2" },                      // 无 hotScore → 订正为 1
    { title: "a", url: "u1", hotScore: 10 },
    { title: "c", url: "u3", hotScore: 0 },         // <1 → 订正为 1
  ];
  const entries = toMergedEntries(baiduHot, items);
  // 订正后 hotScore: a=10, b=1, c=1
  // 按 hotScore 降序: [a, b, c]（b/c 间由 sort 稳定性决定）
  // N=3 线性归一化: rank 0/1/2 → 10000 / 6667 / 3333
  expect(entries).toEqual([
    { title: "a", url: "u1", hotScore: 10, normalizedScore: 10000, source: "baidu-hot" },
    { title: "b", url: "u2", hotScore: 1,  normalizedScore: 6667,  source: "baidu-hot" },
    { title: "c", url: "u3", hotScore: 1,  normalizedScore: 3333,  source: "baidu-hot" },
  ]);
});
```

`rankMerged` 测试**不动**（与本次改动正交，行为不变）。

不新增 zhihu-search 专项测试（T2 决策）。

### `README.md`

在"数据目录说明"段落里 `raw/all/` 那一项的描述后追加一句：

> 每条新增 `normalizedScore` 字段：该条在原源内 `hotScore` 降序排序后的排名百分位（万分制，10000 = 该源 #1）。跨源排序按此字段倒序，缺失沉底。

## 边界情况

| 情况 | 行为 |
|---|---|
| N = 0 | for 循环不执行，函数返回空数组 |
| N = 1 | 唯一条目 normalizedScore = 10000 |
| 全部 hotScore 相同（含全部缺失被订正为 1） | sort 稳定 → 保持 project 后的数组顺序，依然写入 10000 / ... / round(10000 × (1 - (N-1)/N)) |
| hotScore 全相同时**用户可能期望**全部得 10000 | **不实现**——会让"无热度差异的源"全部沉到 normalizedScore=10000 的并列里，且使跨源排序失去意义。本设计明确选择"始终分散到 [round(10000/N), 10000] 区间"。 |
| zhihu-search（无原始 hotScore） | `fetch()` 已注入伪分数 `words.length - index`，进入 `toMergedEntries` 后排序结果与抓取顺序一致 |

## 不做的事

- 不引入跨 source 权重（A/D 方案）
- 不引入跨源全局归一化（C 方案）
- 不引入对数衰减或反对数（B3/B4）
- 不修改 `mod.ts` 编排逻辑
- 不修改任何 source 的抓取实现
- 不修改 `raw/all/*.json` 与 `archives/*.md` 的输出字段结构
- 不为 zhihu-search 新增专项测试

## 验证

- `bun test` 全部通过（关键是更新后的 `toMergedEntries` 测试）
- 手动跑一次 `bun mod.ts`，检查 `raw/all/2026-06-07.json` 中：
  - 每个 source 的 #1 `normalizedScore` 都是 10000
  - 每个 source 内 `normalizedScore` 单调递减且分差均匀
  - 跨源排序结果合理（榜首存在并列符合预期）
- 检查 `archives/2026-06-07.md` 渲染出的 `· {score}` 数字与 raw JSON 一致
