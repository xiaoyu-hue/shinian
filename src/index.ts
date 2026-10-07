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

const ShiNianCore = {
  ...core.ShiNianCore,
  crypto: {
    generateDek: crypto.generateDek,
    deriveKek: crypto.deriveKek,
    wrapDek: crypto.wrapDek,
    unwrapDek: crypto.unwrapDek,
    aesEncrypt: crypto.aesEncrypt,
    aesDecrypt: crypto.aesDecrypt,
    createVault: crypto.createVault,
    unlockVault: crypto.unlockVault,
    PBKDF2_ITERATIONS: crypto.PBKDF2_ITERATIONS,
  },
};

if (typeof window !== 'undefined') {
  (window as unknown as { ShiNianCore: typeof ShiNianCore }).ShiNianCore = ShiNianCore;
}

export { ShiNianCore };
export * from './shinian-core';
export * as crypto from './crypto-vault';
