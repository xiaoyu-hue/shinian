#!/usr/bin/env node
/* 重新生成 assets/cities.js（内联城市数据）
 * 用法：node tools/gen-cities.js
 * 先修改 data/cities.json，再运行本脚本保持两份文件同步。 */
var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '..');
var cities = JSON.parse(fs.readFileSync(path.join(root, 'data/cities.json'), 'utf8'));
var header = '/* ============================================================\n' +
  '   时念 · 城市列表（内联版）\n' +
  '   ------------------------------------------------------------\n' +
  '   由 data/cities.json 生成，内联引入是为了支持 file:// 双击打开\n' +
  '   （浏览器安全策略禁止 file:// 页面 fetch 本地 JSON，v0.3.1 修复）。\n' +
  '   增改城市请先改 data/cities.json，再运行：\n' +
  '   node tools/gen-cities.js\n' +
  '   ============================================================ */\n\n' +
  'var SHINIAN_CITIES = ';
fs.writeFileSync(path.join(root, 'assets/cities.js'), header + JSON.stringify(cities, null, 2) + ';\n');
console.log('已生成 assets/cities.js，共', cities.length, '城');
