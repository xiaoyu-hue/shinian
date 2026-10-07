#!/usr/bin/env node
/**
 * 发布态构建（A1 最小版，仅拷贝；A2 升级为 esbuild 打包+混淆）。
 * 设计原则：发布态产物与已通过 145 项测试的网页版资源 1:1 一致，
 * 不在 A1 引入任何可能改变运行时行为的打包逻辑，先验证「Capacitor + 云端构建」通道。
 *
 * - index.html 原样拷贝到 www/
 * - assets/ 整体拷贝（dereference：跟随并展开本地 F3 符号链接，CI 干净检出下即为真实文件）
 * 这样 www/ 的目录结构与 index.html 的引用（assets/*.js）完全对应。
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const out = path.join(root, 'www');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

fs.copyFileSync(path.join(root, 'index.html'), path.join(out, 'index.html'));
fs.cpSync(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true, dereference: true });

console.log('build:release -> www/ (index.html + assets/, dereferenced, 1:1 镜像网页版)');
