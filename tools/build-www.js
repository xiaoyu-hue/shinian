#!/usr/bin/env node
/**
 * 发布态构建（A2：esbuild 按序拼接 + minify）。
 *
 * 设计原则（混合方案核心）：
 *   - dev 模式完全不变：仓库根 index.html 仍是散 <script src="assets/*.js" defer>，
 *     file:// 双击可用、145 项测试直接 require 单文件，零构建。
 *   - release 模式（本脚本生成 www/）：把 12 个非条件脚本按序拼接，用 esbuild
 *     transform(minify) 压缩为单个 assets/bundle.min.js；release 版 index.html
 *     只引用这一个 bundle，并保留 local-notifications.js 的条件注入（APK 内才加载）。
 *
 * 为什么不 bundle 重组：当前源码是「裸全局 var + <script> 加载顺序」模式
 * （lunar/suncalc 走 UMD 挂 window，cities 顶层 var，各模块靠 window.X 通信），
 * 这是 file:// 双击可用的根基。esbuild 的 --bundle 会改变顶层 var 作用域、破坏
 * UMD 全局挂载；故采用「按序拼接 + transform(minify)」——不改变全局语义，仅压缩，
 * 已用 jsdom 验证全部全局接口保留、无致命错误。
 *
 * 混淆（javascript-obfuscator）不在本步：归属于 B 部分安全专项，
 * 与 RASP / WebView 加固一并做安全审计，避免在已验证通道上引入新风险。
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = process.cwd();
const out = path.join(root, 'www');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });
fs.mkdirSync(path.join(out, 'assets', 'plugins'), { recursive: true });

// 1) 按 index.html 顺序收集非条件脚本（local-notifications 走条件注入，单独保留）
const order = ['cities', 'lunar', 'season', 'sky', 'weather', 'suncalc', 'sunmoon',
               'notifications', 'decor', 'clouds', 'intro', 'app'];
const raw = order
  .map(n => '/* ==== ' + n + '.js ==== */\n' + fs.readFileSync(path.join(root, 'assets', n + '.js'), 'utf8'))
  .join('\n;\n');

const bundled = esbuild.transformSync(raw, { minify: true, loader: 'js', target: 'es2018' }).code;
fs.writeFileSync(path.join(out, 'assets', 'bundle.min.js'), bundled);

// 2) 保留：样式 + 条件通知插件（APK 内才由 window.Capacitor 触发加载）
fs.copyFileSync(path.join(root, 'assets', 'style.css'), path.join(out, 'assets', 'style.css'));
fs.copyFileSync(path.join(root, 'assets', 'plugins', 'local-notifications.js'),
                path.join(out, 'assets', 'plugins', 'local-notifications.js'));

// 3) 生成 release 版 index.html：去掉散 script，改为引用单 bundle；保留条件注入块
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<script src="assets\/[^"]+\.js" defer><\/script>\s*/g, '');
html = html.replace(/(<link rel="stylesheet" href="assets\/style\.css">)/,
  '$1\n  <script src="assets/bundle.min.js" defer></script>');
fs.writeFileSync(path.join(out, 'index.html'), html);

// 4) 自检：release index.html 应含 bundle 引用、且不再有散 assets/*.js 的 defer script
const hasBundle = /<script src="assets\/bundle\.min\.js" defer><\/script>/.test(html);
// 残留散 script：带 defer 且不是 bundle 自身（bundle 自己会被正则命中，需排除）
const stray = (html.match(/<script src="assets\/[^"]+\.js" defer><\/script>/g) || [])
  .filter(s => !/bundle\.min\.js/.test(s)).length;
console.log('build:release -> www/');
console.log('  bundle.min.js:', bundled.length, 'bytes (原始拼接', raw.length, 'bytes)');
console.log('  单 bundle 引用:', hasBundle ? 'OK' : '缺失!', '| 残留散 script:', stray);
if (!hasBundle || stray > 0) {
  console.error('  自检失败：release index.html 结构异常');
  process.exit(1);
}
