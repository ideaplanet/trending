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
}
