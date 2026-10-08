/**
 * 时念 ShiNian · 运行时反逆向 / 反篡改自检（B3：WebView 端 RASP）
 *
 * 定位与边界（先说清，避免误解）：
 *   - 本模块运行在 WebView 内的 JS 层，做的是「客户端在 WebView 能力范围内可自检」的那部分：
 *       1) 是否运行在 Capacitor 原生壳内（而非被把 JS 拖出去用浏览器 / Node 跑）；
 *       2) 是否被自动化框架驱动（navigator.webdriver）；
 *       3) 是否开着 DevTools（outer / inner 尺寸差）；
 *       4) 是否开着调试器（debugger 多重探针耗时）；
 *       5) 是否被注入 / hook 框架附着（Frida / Xposed / Il2Cpp 等在全局留下的痕迹）；
 *       6) 核心层 ShiNianCore 是否被替换 / 注入（形态完整性校验）。
 *   - 原生级 Root / 模拟器 / 重打包 / 签名校验检测，属于原生 RASP（如 Free-RASP）范畴。
 *     经评估，本项目为零后端、零账户、零上报的单机模型，且 android/ 不入库、构建环境不编原生，
 *     引入原生 RASP SDK 的边际收益低；且 Free-RASP 的 weekly report 存在数据上报，与本项目
 *     「零采集、零上报」隐私承诺冲突，故 B3 原生级未引入。WebView 层能力范围内的 RASP 已最大化覆盖。
 *
 * 设计：纯函数、无副作用、可被 Node 单测（用全局 stub 模拟 window / navigator）。
 * 所有检测默认仅告警、不阻断流程（blockOnNonNative / blockOnHighRisk 可开启强制拦截）。
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
  /** 是否检测到注入 / hook 框架痕迹（Frida / Xposed / Il2Cpp 等）。 */
  injection: boolean;
  /** 核心层 ShiNianCore 是否形态异常（被替换 / 注入）。 */
  coreTampered: boolean;
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
    const w = globalThis as unknown as {
      outerWidth?: number; innerWidth?: number; outerHeight?: number; innerHeight?: number;
    };
    const threshold = 160;
    if (typeof w.outerWidth === 'number' && typeof w.innerWidth === 'number' && w.outerWidth - w.innerWidth > threshold) return true;
    if (typeof w.outerHeight === 'number' && typeof w.innerHeight === 'number' && w.outerHeight - w.innerHeight > threshold) return true;
    return false;
  } catch {
    return false;
  }
}

/** 调试器多重探针：连续 3 次 debugger 探针累计耗时 >250ms 即判定被附加（单次易误判，多重更稳）。 */
function detectDebugger(): boolean {
  const probes = 3;
  let total = 0;
  for (let i = 0; i < probes; i++) {
    const t0 = Date.now();
    // eslint-disable-next-line no-debugger
    debugger;
    total += Date.now() - t0;
  }
  return total > 250;
}

/** 注入 / hook 框架在全局留下的痕迹（WebView 层可探测部分）。 */
function detectInjectionFrameworks(): boolean {
  const w = globalThis as unknown as Record<string, unknown>;
  const markers = [
    'frida', 'fridaGadget', 'fridaConsole', // Frida gadget
    'Process', 'Module', 'Memory',          // Frida 注入的全局对象
    'Il2Cpp', 'Il2CppEngine',               // IL2CPP Dump / 反编译工具
    'Duktape', 'JsDuktape',                 // JS 引擎注入
    'xposed', 'XposedBridge',               // Xposed 框架
  ];
  for (const k of markers) {
    if (k in w) return true;
  }
  return false;
}

/**
 * 核心层完整性：检测 ShiNianCore 是否被替换 / 注入（轻量形态校验，非密码学签名）。
 * dev 模式无 ShiNianCore（app.js 走明文降级），此时不判篡改。
 */
function detectCoreIntegrity(): boolean {
  const w = globalThis as unknown as Record<string, unknown>;
  const core = w['ShiNianCore'];
  if (!core || typeof core !== 'object') return false; // dev 模式：不判篡改
  const expectNs = ['secureStore', 'crypto', 'antiTamper', 'biometric'];
  for (const ns of expectNs) {
    const v = (core as Record<string, unknown>)[ns];
    if (!v || typeof v !== 'object') return true; // 命名空间被抹除 / 替换
  }
  const ss = (core as Record<string, unknown>)['secureStore'] as Record<string, unknown>;
  for (const fn of ['isAvailable', 'needsSetup', 'isReady', 'setup', 'unlock', 'lock', 'get', 'set', 'changePassword']) {
    if (typeof ss[fn] !== 'function') return true; // 关键 API 被剥离 / 替换
  }
  return false;
}

/** 执行一次完整自检。 */
export function detectThreats(): ThreatReport {
  const native = hasCapacitorNative();
  const webDriver = detectWebDriver();
  const devtools = detectDevtools();
  const debuggerAttached = detectDebugger();
  const injection = detectInjectionFrameworks();
  const coreTampered = detectCoreIntegrity();

  const threats: string[] = [];
  if (!native) threats.push('NOT_NATIVE');
  if (webDriver) threats.push('WEBDRIVER');
  if (devtools) threats.push('DEVTOOLS');
  if (debuggerAttached) threats.push('DEBUGGER');
  if (injection) threats.push('INJECTION');
  if (coreTampered) threats.push('CORE_TAMPERED');

  let score = 0;
  if (webDriver) score += 30;
  if (devtools) score += 20;
  if (debuggerAttached) score += 20;
  if (!native) score += 30;       // 代码被搬出 App 运行 = 最高危信号之一
  if (injection) score += 35;     // 注入 / hook 框架附着 = 高危
  if (coreTampered) score += 50;  // 核心层被替换 / 注入 = 最高危

  return { native, webDriver, devtools, debuggerAttached, injection, coreTampered, threats, score };
}

export interface GuardOptions {
  /** 命中 NOT_NATIVE 时是否强制阻断（默认 false，仅告警）。 */
  blockOnNonNative?: boolean;
  /** 风险评分达到该阈值即视为高危（默认 50）。 */
  highScoreThreshold?: number;
  /** 命中高危（score 达阈值，或注入 / 核心篡改）时是否强制阻断（默认 false，仅告警）。 */
  blockOnHighRisk?: boolean;
}

/** 自检 + 统一告警；返回报告，默认不阻断流程（blockOnNonNative / blockOnHighRisk 可开启强制拦截）。 */
export function guard(opts: GuardOptions = {}): ThreatReport {
  const report = detectThreats();
  const threshold = opts.highScoreThreshold ?? 50;
  const high = report.score >= threshold;

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
  if (opts.blockOnHighRisk && (high || report.injection || report.coreTampered)) {
    throw new Error('ShiNian.AntiTamper: 检测到高危运行环境（' + report.threats.join(',') + '），已拒绝继续。');
  }
  return report;
}

/** 统一对外命名空间。 */
export const AntiTamper = { detectThreats, guard };
