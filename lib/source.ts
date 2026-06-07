/**
 * 一个 source = 一个热榜来源。source 文件只负责抓取数据；
 * 合并、写 raw / archives / README 由 lib/persist.ts 统一完成。
 */
export interface Source<T> {
  /** 既是日志名，也是 raw/<name>/、archives/<name>/ 的目录名 */
  name: string;
  /** README / archive 中 section 标签名，例如 "ZHIHUVIDEO" 对应 `<!-- BEGIN ZHIHUVIDEO -->` */
  marker: string;
  /** 抓取数据 —— 此 source 的唯一职责 */
  fetch(): Promise<T[]>;
  /** 用于按 key 去重合并 */
  key(item: T): string;
  /** 渲染单条记录为一行 markdown，会被前置 `1. ` */
  render(item: T): string;
  /**
   * 投影为跨 source 的统一条目，供合并 raw/archives 使用。
   * 缺省实现见 lib/persist.ts，仅当 source 字段与 {title,url,hotScore} 不一致时才需自定义。
   */
  toEntry?(item: T): MergedEntry;
}

/** 跨 source 统一的合并条目。 */
export interface MergedEntry {
  title: string;
  url: string;
  /** 热度，缺失时按 0 处理。 */
  hotScore?: number;
  /**
   * 源内排名百分位（万分制）：该条在原源内 hotScore 降序排序后的位置，
   * 10000 = 该源 #1，越靠后越低；由 toMergedEntries 计算注入。
   * 跨 source 排序时直接用此字段，但榜首通常并列（每个源的 #1 都是 10000）。
   */
  normalizedScore?: number;
  /** 来源 source.name，写入合并 raw/markdown 时由 persist 注入。 */
  source?: string;
}
