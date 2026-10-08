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
  antiTamper: {
    detectThreats: antiTamper.detectThreats,
    guard: antiTamper.guard,
  },
  // A3 + B1：统一加密存储层（dev/file:// 下 window.ShiNianCore 不存在，app.js 自动降级明文）
  secureStore: {
    isAvailable: secureStore.isAvailable,
    needsSetup: secureStore.needsSetup,
    isReady: secureStore.isReady,
    setup: secureStore.setup,
    unlock: secureStore.unlock,
    unlockWithBiometric: secureStore.unlockWithBiometric,
    lock: secureStore.lock,
    get: secureStore.get,
    set: secureStore.set,
    changePassword: secureStore.changePassword,
    KNOWN_KEYS: secureStore.KNOWN_KEYS,
  },
  // B2：生物锁原生桥接（Web 下 supported=false，自动降级主密码）
  biometric: {
    init: biometric.init,
    isSupported: biometric.isSupported,
    isEnrolled: biometric.isEnrolled,
    storeSecret: biometric.storeSecret,
    getSecret: biometric.getSecret,
    deleteSecret: biometric.deleteSecret,
  },
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
