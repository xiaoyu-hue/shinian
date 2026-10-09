/**
 * 时念 ShiNian · 新代码分层统一入口（src/）
 *
 * esbuild 将本文件打成 www/assets/shinian-core.min.js（IIFE，globalName=ShiNianCore），
 * 在 release index.html 中先于业务 bundle 注入，既有 vanilla app.js 经 window.ShiNianCore 调用。
 *
 * 既有工具函数（ShiNianCore）与安全加密保险库（crypto）均在此聚合。
 */

import * as core from './shinian-core';
import * as crypto from './crypto-vault';
import * as antiTamper from './anti-tamper';
import * as secureStore from './secure-store';
import * as biometric from './biometric';

const ShiNianCore = {
  ...core.ShiNianCore,
  // 直接引用各模块完整命名空间（而非手工挑函数），从源头消除"漏导出导致功能静默失效"的隐患。
  // 以 crypto 为例：现网 app.js 的判据是 window.ShiNianCore.crypto.encryptWithPassword 是否存在，
  // 此前手工聚合仅挑 9 个函数、不含 encryptWithPassword/decryptWithPassword 等；一旦打包方式变化
  // 就可能退化为 9 函数版、使加密备份静默消失。改为引用完整命名空间后永不失同步。
  crypto,
  antiTamper,
  // A3 + B1：统一加密存储层（dev/file:// 下 window.ShiNianCore 不存在，app.js 自动降级明文）
  secureStore,
  // B2：生物锁原生桥接（Web 下 supported=false，自动降级主密码）
  biometric,
};

if (typeof window !== 'undefined') {
  (window as unknown as { ShiNianCore: typeof ShiNianCore }).ShiNianCore = ShiNianCore;
}

export { ShiNianCore };
export * from './shinian-core';
export * as crypto from './crypto-vault';
export * as antiTamper from './anti-tamper';
export * as secureStore from './secure-store';
export * as biometric from './biometric';
