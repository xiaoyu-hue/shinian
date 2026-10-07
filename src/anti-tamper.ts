/**
 * 时念 ShiNian · 运行时反逆向 / 反篡改自检（B3：WebView 端轻量自保护）
 *
 * 定位与边界（先说清，避免误解）：
 *   - 本模块运行在 WebView 内的 JS 层，做的是「客户端可自检」的那部分：
 *       1) 是否运行在 Capacitor 原生壳内（而非被把 JS 拖出去用浏览器/Node 跑）；
 *       2) 是否被自动化框架驱动（navigator.webdriver）；
 *       3) 是否开着 DevTools（outer/inner 尺寸差）；
 *       4) 是否被 debugger 注入（debugger 探针耗时）。
 *   - 真正的「原生级」Root / 模拟器 / 重打包 / Hook（Frida、Xposed）检测，需要原生 SDK，
 *     属于 Free-RASP 原生插件范畴；本模块不伪造这部分能力，仅做 WebView 层力所能及的自检，
 *     并在检测到高危信号时给出统一告警（当前默认告警不阻断，避免误伤，可按需开启强拦截）。
 *
 * 设计：纯函数、无副作用、可被 Node 单测（用全局 stub 模拟 window/navigator）。
 */

/** 单次检测报告。 */
export interface ThreatReport {
  /** 是否运行在原生 Capacitor 壳内（false = 很可能被搬出 App 运行）。 */
  native: boolean;
  /** 是否检测到自动化驱动（WebDriver / 爬虫 / 无头浏览器）。 */
  webDriver: boolean;
  /** 是否检测到 DevTools 打开（仅桌面端有意义，移动 WebView 一般为 false）。 */
  devtools: boolean;
  /** 是否检测到 debugger 被命中（注入式调试）。 */
  debuggerAttached: boolean;
  /** 命中的威胁代码清单。 */
  threats: string[];
  /** 风险评分 0–100，越高越危险。 */
  score: number;
}

/** 是否运行在 Capacitor 原生壳内。 */
function hasCapacitorNative(): boolean {
  try {
    const w = globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
    return !!(w.Capacitor && typeof w.Capacitor.isNativePlatform === 'function' && w.Capacitor.isNativePlatform());
  } catch {
    return false;
  }
}

/** 是否处于自动化驱动环境。 */
function detectWebDriver(): boolean {
  try {
    const nav = globalThis as unknown as { navigator?: { webdriver?: boolean } };
    return !!(nav.navigator && nav.navigator.webdriver === true);
  } catch {
    return false;
  }
}

/** DevTools 尺寸差启发式（桌面开 DevTools 才会出现，移动 WebView 一般 equal）。 */
function detectDevtools(): boolean {
  try {
    const w = globalThis as unknown as { outerWidth?: number; innerWidth?: number; outerHeight?: number; innerHeight?: number };
    const threshold = 160;
    if (typeof w.outerWidth === 'number' && typeof w.innerWidth === 'number' && w.outerWidth - w.innerWidth > threshold) return true;
    if (typeof w.outerHeight === 'number' && typeof w.innerHeight === 'number' && w.outerHeight - w.innerHeight > threshold) return true;
    return false;
  } catch {
    return false;
  }
}

/** debugger 探针：若被调试器命中会暂停 >100ms。无调试器时为 no-op。 */
function detectDebugger(): boolean {
  const t0 = Date.now();
  // eslint-disable-next-line no-debugger
  debugger;
  return Date.now() - t0 > 100;
}

/** 执行一次完整自检。 */
export function detectThreats(): ThreatReport {
  const native = hasCapacitorNative();
  const webDriver = detectWebDriver();
  const devtools = detectDevtools();
  const debuggerAttached = detectDebugger();

  const threats: string[] = [];
  if (!native) threats.push('NOT_NATIVE');
  if (webDriver) threats.push('WEBDRIVER');
  if (devtools) threats.push('DEVTOOLS');
  if (debuggerAttached) threats.push('DEBUGGER');

  let score = 0;
  if (webDriver) score += 30;
  if (devtools) score += 20;
  if (debuggerAttached) score += 20;
  if (!native) score += 30; // 代码被搬出 App 运行 = 最高危信号

  return { native, webDriver, devtools, debuggerAttached, threats, score };
}

export interface GuardOptions {
  /** 命中 NOT_NATIVE 时是否强制阻断（默认 false，仅告警）。 */
  blockOnNonNative?: boolean;
  /** 风险评分达到该阈值即视为高危（默认 50）。 */
  highScoreThreshold?: number;
}

/** 自检 + 统一告警；返回报告，默认不阻断流程（blockOnNonNative 可开启强制拦截）。 */
export function guard(opts: GuardOptions = {}): ThreatReport {
  const report = detectThreats();
  const threshold = opts.highScoreThreshold ?? 50;
  const high = report.score >= threshold;

  // obfuscator 会重写 console 输出；此处用 try 保护，确保告警本身不引发二次异常
  try {
    if (report.threats.length) {
      const fn = high ? 'error' : 'warn';
      // eslint-disable-next-line no-console
      (console as unknown as Record<string, (...a: unknown[]) => void>)[fn](
        '[时念·安全] 运行环境异常:',
        report.threats.join(','),
        'score=' + report.score,
      );
    }
  } catch {
    /* 静默 */
  }

  if (opts.blockOnNonNative && !report.native) {
    throw new Error('ShiNian.AntiTamper: 非原生运行环境，已拒绝继续。');
  }
  return report;
}

/** 统一对外命名空间。 */
export const AntiTamper = { detectThreats, guard };
