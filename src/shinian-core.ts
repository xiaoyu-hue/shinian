/**
 * 时念 ShiNian · 强类型核心模块（src/ 新代码分层）
 *
 * 这是「混合架构」中新代码的落点：既有 vanilla 代码保持零改动，
 * 所有新增逻辑（工具函数、安全/加密、生物锁等）以 TypeScript 落地于此，
 * 由 `jsconfig.json` 的 typecheck 门严格守护（strict 模式）。
 *
 * 编译：tools/build-www.js 用 esbuild 将 src/ 打成
 *   www/assets/shinian-core.min.js（IIFE，globalName=ShiNianCore），
 * 在 index.html 中先于业务 bundle 注入，app.js 通过 window.ShiNianCore 调用。
 */

/** 日期字符串是否为合法 YYYY-MM-DD（或能被 Date 解析）。 */
export function isValidDate(value: unknown): boolean {
  if (typeof value !== 'string' || value.trim() === '') return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

/** 将数值限制在 [min, max] 区间。 */
export function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** 解析 JSON，失败时返回 fallback（不抛异常，便于本地存储容错）。 */
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 生成 url-safe 的随机十六进制串（用于 salt / nonce 等）。 */
export function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 核心命名空间（在 src/index.ts 统一挂到 window.ShiNianCore）。 */
export const ShiNianCore = {
  isValidDate,
  clamp,
  safeJsonParse,
  randomHex,
};
