/**
 * B3 · 运行时反逆向 / 反篡改自检 单元测试
 * 运行：node test_antitamper.js（npm test 链包含）
 * 说明：anti-tamper 为 TS 模块，测试时用 esbuild 即时编译为 CJS 再加载。
 *       通过覆盖 global.window / global.navigator 模拟不同运行环境，验证检测逻辑。
 */
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const Module = require('module');

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

// 1) 即时编译 TS -> CJS
const tsSrc = fs.readFileSync(path.join(__dirname, 'src', 'anti-tamper.ts'), 'utf8');
const js = esbuild.transformSync(tsSrc, { loader: 'ts', format: 'cjs', target: 'es2020' }).code;
const m = new Module('anti-tamper');
m.filename = path.join(__dirname, 'src', 'anti-tamper.js');
m.paths = Module._nodeModulePaths(__dirname);
m._compile(js, m.filename);
const A = m.exports;

ok('模块导出齐全', A && typeof A.detectThreats === 'function' && typeof A.guard === 'function'
  && A.AntiTamper && typeof A.AntiTamper.guard === 'function');

// 2) 环境构造器
//    浏览器/WebView 中 window 就是全局对象（globalThis），Capacitor/navigator/outerHeight
//    等属性都直接挂在全局对象上；测试据此在 globalThis 上设置，精确模拟运行环境。
function setEnv({ native = false, webdriver = false, devtools = false, injection = false, core = undefined } = {}) {
  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: { webdriver }, configurable: true, writable: true,
    });
  } catch { globalThis.navigator = { webdriver }; }
  globalThis.Capacitor = { isNativePlatform: () => native };
  globalThis.outerWidth = 1280;
  globalThis.innerWidth = 1280;
  globalThis.outerHeight = 800;
  globalThis.innerHeight = devtools ? 500 : 800; // 与外框差 300 > 160 阈值
  globalThis.window = globalThis; // 让 window.X 与全局一致
  if (injection) globalThis.frida = { version: '16.0' };   // 模拟 Frida gadget 全局
  else delete globalThis.frida;
  if (core !== undefined) globalThis.ShiNianCore = core;   // 显式提供核心层形态
  else delete globalThis.ShiNianCore;
}

// 一个形态完整的 ShiNianCore 桩，用于「未篡改」场景
const intactCore = {
  secureStore: { isAvailable(){}, needsSetup(){}, isReady(){}, setup(){}, unlock(){}, lock(){}, get(){}, set(){}, changePassword(){} },
  crypto: {}, antiTamper: {}, biometric: {},
};

// 场景1：干净原生壳（应无威胁）
setEnv({ native: true });
let r1 = A.detectThreats();
ok('原生壳运行 = 无威胁', r1.native === true && r1.threats.length === 0 && r1.score === 0);

// 场景2：被搬出 App（非原生）=> NOT_NATIVE
setEnv({ native: false });
let r2 = A.detectThreats();
ok('非原生运行 = NOT_NATIVE', r2.native === false && r2.threats.includes('NOT_NATIVE') && r2.score >= 30);

// 场景3：自动化驱动 => WEBDRIVER
setEnv({ native: false, webdriver: true });
let r3 = A.detectThreats();
ok('WebDriver 驱动 = WEBDRIVER', r3.webDriver === true && r3.threats.includes('WEBDRIVER'));

// 场景4：开了 DevTools => DEVTOOLS
setEnv({ native: true, devtools: true });
let r4 = A.detectThreats();
ok('DevTools 打开 = DEVTOOLS', r4.devtools === true && r4.threats.includes('DEVTOOLS'));

// 场景5：guard() 不抛异常且返回报告（默认不阻断）
setEnv({ native: false, webdriver: true });
let g5, threw = false;
try { g5 = A.guard(); } catch (e) { threw = true; }
ok('guard() 默认不阻断', threw === false && g5 && g5.threats.length > 0);

// 场景6：guard({blockOnNonNative:true}) 在非原生时强制拦截
let blocked = false;
try { A.guard({ blockOnNonNative: true }); } catch (e) { blocked = true; }
ok('blockOnNonNative 在非原生时拒绝继续', blocked === true);

// 场景7：guard({blockOnNonNative:true}) 在原生壳不阻断
setEnv({ native: true });
let blocked2 = false;
try { A.guard({ blockOnNonNative: true }); } catch (e) { blocked2 = true; }
ok('blockOnNonNative 在原生壳不阻断', blocked2 === false);

// 场景8：完整核心 + 原生壳 = 无注入 / 篡改
setEnv({ native: true, core: intactCore });
let r8 = A.detectThreats();
ok('完整核心 + 原生壳 = 无 INJECTION/CORE_TAMPERED', r8.injection === false && r8.coreTampered === false && r8.score === 0);

// 场景9：注入框架痕迹 => INJECTION
setEnv({ native: true, injection: true, core: intactCore });
let r9 = A.detectThreats();
ok('Frida 痕迹 = INJECTION', r9.injection === true && r9.threats.includes('INJECTION'));

// 场景10：核心被替换（缺 secureStore 命名空间）=> CORE_TAMPERED
setEnv({ native: true, core: { crypto: {}, antiTamper: {}, biometric: {} } });
let r10 = A.detectThreats();
ok('核心形态异常 = CORE_TAMPERED', r10.coreTampered === true && r10.threats.includes('CORE_TAMPERED'));

// 场景11：blockOnHighRisk 在注入时强制拦截
setEnv({ native: true, injection: true, core: intactCore });
let blockedRisk = false;
try { A.guard({ blockOnHighRisk: true }); } catch (e) { blockedRisk = true; }
ok('blockOnHighRisk 在注入时拒绝继续', blockedRisk === true);

// 场景12：dev 模式（无 ShiNianCore）不误判篡改
setEnv({ native: false, webdriver: true });
let r12 = A.detectThreats();
ok('dev 模式无 core 不误判 CORE_TAMPERED', r12.coreTampered === false);

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
