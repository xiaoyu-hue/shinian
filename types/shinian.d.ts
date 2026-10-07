// 时念 ShiNian · 全局类型声明（JSDoc / ts-check 用）
// 作用：让原生（非模块）JS 在 `// @ts-check` 下可被 tsc 校验，
// 同时为后续 TS 新模块（src/）提供全局命名空间约定。
// 既有 vanilla 代码保持零改动，仅在此处做宽松声明（any）以打通类型门；
// 新代码（A4/B 部分）在 src/ 内使用真实强类型，由 typecheck 真正守护。

export {};

declare global {
  interface Window {
    // —— 既有全局模块（由 <script> 顺序加载、挂到 window）——
    Lunar: any;
    Solar: any;
    SunCalc: any;
    SHINIAN_CITIES: any[];
    ShiNianSeason: any;
    ShiNianWeather: any;
    ShiNianRemind: any;
    // —— Capacitor（仅 APP/WebView 内存在）——
    Capacitor?: any;
    // —— A4/B 新代码挂载点（类型化核心模块）——
    ShiNianCore?: any;
    // 兜底：允许任意 window.x 访问（宽松门，不阻断既有代码）
    [key: string]: any;
  }

  // 裸名（无 window. 前缀）全局变量，便于 app.js 内直接引用
  var Lunar: any;
  var Solar: any;
  var SunCalc: any;
  var SHINIAN_CITIES: any[];
  var ShiNianSeason: any;
  var ShiNianWeather: any;
  var ShiNianRemind: any;
  var ShiNianCore: any;
  var Capacitor: any;
}
