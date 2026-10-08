/**
 * 时念 ShiNian · 统一加密存储层（A3：安全层雏形 + B1 接入 + B2 生物锁封装）
 *
 * 仅发布态（esbuild 编译进 www/assets/shinian-core.min.js，globalName=ShiNianCore）
 * 注入页面；dev/file:// 双击模式下 window.ShiNianCore 不存在，assets/app.js 自动降级为
 * 明文 localStorage（见 app.js 的 Store 封装）。
 *
 * 设计要点（先说清，避免误解）：
 *   - Web Crypto 的 crypto.subtle 是异步的，但 app.js 既有存储是同步读写。为避免牵动整个
 *     启动流程，本层采用「解锁后预解密到内存缓存 + 同步 get/set + 异步落盘」：
 *       · unlock/setup 成功后 prime() 把 4 个已知键解密进内存 cache；
 *       · get/set 操作内存 cache（同步，app.js 透明调用）；
 *       · set 内部异步加密写回 localStorage（单用户交互无竞态风险）。
 *   - 内部用 crypto-vault 的 AES-GCM + PBKDF2 加解密；envelope 持久化，主密码与 DEK 永不落盘。
 *   - 每条业务数据以 `<key>__enc` 为键，存「密文 blob 的 JSON」（非明文）。
 *   - 设备丢失 → 无主密码 / 无生物无法还原 DEK → 数据不可读（B1 防泄露 + 高迭代抗离线爆破）。
 *   - B2 生物锁：DEK 另用 bioKEK 封装一份（shinian.vault.bio.v1），bioKEK 由系统密钥库
 *     （Android Keystore / iOS Keychain，生物认证门控）保管；生物解锁 = 认证后取回 bioKEK → 解 DEK。
 *     bioKEK 仅在会话内存短暂停留，DEK 永不落盘。
 */

import { createVault, unlockVault, aesEncrypt, aesDecrypt, VaultEnvelope, bytesToB64, bytesFromB64, EncryptedBlob } from './crypto-vault';
import * as biometric from './biometric';

const VAULT_KEY = 'shinian.vault.v1';
const BIO_WRAP_KEY = 'shinian.vault.bio.v1'; // DEK 经 bioKEK 封装的密文（AndroidKeyStore 间接保护）
const ENC_SUFFIX = '__enc';
/** 已知业务键（changePassword 重加密 / prime 预热时遍历）。 */
export const KNOWN_KEYS = [
  'shinian.items.v1',
  'shinian.wishes.v1',
  'shinian.city.v1',
  'shinian.settings.v1',
];

let dek: Uint8Array | null = null;
let bioKEK: Uint8Array | null = null; // 会话内缓存（用于改密时重封装，不落盘）
const cache = new Map<string, unknown>();

/**
 * v1.1.1（Q4）：落盘写队列。set() 的异步加密落盘按调用顺序串行执行，
 * 杜绝「两次快速写同一键时，旧值后完成覆盖新值」的乱序覆盖。
 * 单次写失败不断队列（失败仍会向该次调用方抛出，见 persist）。
 */
let writeQueue: Promise<void> = Promise.resolve();

/** v1.1.1（Q3）：扫描 localStorage 中所有 `<key>__enc` 密文键。
 *  与 KNOWN_KEYS 取并集参与 prime / changePassword，
 *  防止「未来新增业务键不在 KNOWN_KEYS 里」时改密后数据不可解（自愈式键发现）。 */
function encKeysInStorage(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.endsWith(ENC_SUFFIX)) out.push(k.slice(0, -ENC_SUFFIX.length));
    }
  } catch { /* localStorage 不可用时退化为 KNOWN_KEYS */ }
  return out;
}

/** 实际持有加密数据的全部键（KNOWN_KEYS ∪ 存储中发现的密文键）。 */
export function dataKeys(): string[] {
  const set = new Set<string>(KNOWN_KEYS);
  for (const k of encKeysInStorage()) set.add(k);
  return Array.from(set);
}

function loadEnvelope(): VaultEnvelope | null {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    return raw ? (JSON.parse(raw) as VaultEnvelope) : null;
  } catch {
    return null;
  }
}
function persistEnvelope(env: VaultEnvelope): void {
  localStorage.setItem(VAULT_KEY, JSON.stringify(env));
}

function loadBioWrap(): EncryptedBlob | null {
  try {
    const raw = localStorage.getItem(BIO_WRAP_KEY);
    return raw ? (JSON.parse(raw) as EncryptedBlob) : null;
  } catch {
    return null;
  }
}
function persistBioWrap(blob: EncryptedBlob): void {
  localStorage.setItem(BIO_WRAP_KEY, JSON.stringify(blob));
}
function clearBioWrap(): void {
  localStorage.removeItem(BIO_WRAP_KEY);
}

/** 当前运行环境是否具备 Web Crypto（浏览器 / WebView / Node18+ 均具备）。 */
export function isAvailable(): boolean {
  return typeof crypto !== 'undefined' && !!(crypto as Crypto).subtle;
}

/** 是否首次运行（尚未创建保险库）。 */
export function needsSetup(): boolean {
  return loadEnvelope() === null;
}

/** 是否处于解锁态（会话内 DEK 在内存、cache 已预热）。 */
export function isReady(): boolean {
  return dek !== null;
}

/** 解锁后把已知键预解密进内存 cache，使 get/set 同步可用。 */
async function prime(): Promise<void> {
  cache.clear();
  if (!dek) return;
  // v1.1.1（Q3）：遍历 KNOWN_KEYS ∪ 存储中实际存在的密文键（自愈式键发现）
  for (const k of dataKeys()) {
    const raw = localStorage.getItem(k + ENC_SUFFIX);
    if (!raw) continue;
    try {
      const blob = JSON.parse(raw) as EncryptedBlob;
      cache.set(k, JSON.parse(await aesDecrypt(dek, blob)));
    } catch {
      /* 单条损坏不影响其余 */
    }
  }
}

/** 用已还原的 DEK 完成解锁（密码路径与生物路径共用）。 */
async function unlockWithDek(k: Uint8Array): Promise<void> {
  dek = k;
  await prime();
}

/** 创建保险库并设置主密码（首次运行）；若设备支持则一并登记生物锁。 */
export async function setup(password: string): Promise<void> {
  const { envelope, dek: k } = await createVault(password);
  persistEnvelope(envelope);
  dek = k;
  await prime();
  await maybeEnrollBio(k); // B2：设备支持则封装 DEK（失败自动降级主密码）
}

/** 用主密码解锁（还原会话 DEK + 预热 cache）。 */
export async function unlock(password: string): Promise<void> {
  const env = loadEnvelope();
  if (!env) throw new Error('ShiNian.SecureStore: 保险库未初始化，请先 setup');
  const k = await unlockVault(password, env);
  await unlockWithDek(k);
}

/**
 * 用生物锁解锁（B2）：取回 bioKEK（触发生物认证）→ 解开 DEK → 解锁。
 * 生物锁是主密码的便捷通道；未启用生物锁时抛错，提示改用主密码。
 */
export async function unlockWithBiometric(): Promise<void> {
  const wrap = loadBioWrap();
  if (!wrap) throw new Error('ShiNian.SecureStore: 未启用生物锁，请改用主密码解锁');
  const bioKey = await biometric.getSecret(); // 触发生物认证并返回 bioKEK
  bioKEK = bioKey;
  const k = bytesFromB64(await aesDecrypt(bioKey, wrap)); // 解开 DEK
  await unlockWithDek(k);
}

/** 上锁（清空内存 DEK / bioKEK 与 cache；应用锁 / 切后台调用）。 */
export function lock(): void {
  dek = null;
  bioKEK = null;
  cache.clear();
}

/** 读取（同步，读内存 cache）；未解锁返回 null（应用层需先解锁）。 */
export function get(key: string): unknown {
  if (!dek) return null;
  return cache.has(key) ? cache.get(key) : null;
}

/** 写入（同步更新 cache + 队列化异步落盘）；未解锁抛错（拒绝在锁态写入）。
 *  v1.1.1（Q1）：persist 失败会向调用方抛出（原先静默吞掉——迁移场景依赖该信号
 *  决定是否删除明文副本，吞错会导致「明文已删、密文未落」的数据丢失）。 */
export async function set(key: string, value: unknown): Promise<void> {
  if (!dek) throw new Error('ShiNian.SecureStore: 保险库未解锁，拒绝写入');
  cache.set(key, value);
  await persist(key, value);
}

/** 队列化落盘：按调用顺序串行执行（Q4），失败抛给该次调用方（Q1）。 */
function persist(key: string, value: unknown): Promise<void> {
  const task = writeQueue.then(async () => {
    const blob = await aesEncrypt(dek as Uint8Array, JSON.stringify(value));
    localStorage.setItem(key + ENC_SUFFIX, JSON.stringify(blob));
  });
  writeQueue = task.catch(() => { /* 吞掉以保持队列存活，错误已由 task 本身传播 */ });
  return task;
}

/**
 * B2：若设备支持生物锁，生成 bioKEK 封装 DEK 并存入系统密钥库。
 * 登记失败（用户取消 / 不支持）自动降级主密码，不影响主流程。
 */
async function maybeEnrollBio(k: Uint8Array): Promise<void> {
  if (!biometric.isSupported()) return; // Web / 无生物 → 跳过
  try {
    const bio = new Uint8Array(32);
    crypto.getRandomValues(bio); // bioKEK
    const wrap = await aesEncrypt(bio, bytesToB64(k)); // DEK 用 bioKEK 封装
    persistBioWrap(wrap);
    await biometric.storeSecret(bio); // bioKEK 存入系统密钥库（AndroidKeyStore）
    bioKEK = bio;
  } catch (e) {
    // 生物锁登记失败不应阻断主流程（仍可主密码解锁）
    if (typeof window !== 'undefined' && window.console) {
      // eslint-disable-next-line no-console
      console.warn('[时念·安全] 生物锁登记失败（已降级主密码）:', e);
    }
    clearBioWrap();
    bioKEK = null;
  }
}

/** 修改主密码：验证旧密码 → 新密码重建 vault（重封装 DEK）→ 重加密全部已知数据 → 重封装生物锁。 */
export async function changePassword(oldPwd: string, newPwd: string): Promise<void> {
  const env = loadEnvelope();
  if (!env) throw new Error('ShiNian.SecureStore: 保险库未初始化');
  dek = await unlockVault(oldPwd, env); // 验证旧密码并还原 DEK
  const keys = dataKeys(); // v1.1.1（Q3）：并集，防止新业务键在改密后成不可解密文
  const snapshot: Record<string, unknown> = {};
  for (const k of keys) snapshot[k] = get(k); // 用旧 DEK 解密到明文
  const { envelope: newEnv, dek: newDek } = await createVault(newPwd);
  persistEnvelope(newEnv);
  dek = newDek; // 切到新 vault 的 DEK
  for (const k of keys) {
    if (snapshot[k] !== null && snapshot[k] !== undefined) await set(k, snapshot[k]); // 用新 DEK 重加密
  }
  await reWrapBio(newDek); // B2：新 DEK 重新封装生物锁
}

/**
 * B2：改密后把新 DEK 用 bioKEK 重新封装。
 *   - 会话内已有 bioKEK 缓存：直接重封装，无需重新验证（改密本就是已认证会话）。
 *   - 生物锁已登记但本会话未缓存 bioKEK：尝试取回（会再弹一次生物验证），失败则清除生物锁避免脏状态。
 *   - 未登记生物锁：确保无残留封装。
 */
async function reWrapBio(newDek: Uint8Array): Promise<void> {
  let key = bioKEK;
  if (!key && biometric.isEnrolled()) {
    try { key = await biometric.getSecret(); } catch { key = null; }
  }
  if (key) {
    try {
      const wrap = await aesEncrypt(key, bytesToB64(newDek));
      persistBioWrap(wrap);
      await biometric.storeSecret(key); // 更新系统密钥库中的 bioKEK（不变，但确保凭据一致）
      bioKEK = key;
    } catch (e) {
      if (typeof window !== 'undefined' && window.console) {
        // eslint-disable-next-line no-console
        console.warn('[时念·安全] 生物锁重封装失败，已清除生物锁:', e);
      }
      clearBioWrap();
      await biometric.deleteSecret().catch(function () {});
      bioKEK = null;
    }
  } else {
    clearBioWrap();
  }
}

export const SecureStore = {
  isAvailable,
  needsSetup,
  isReady,
  setup,
  unlock,
  unlockWithBiometric,
  lock,
  get,
  set,
  changePassword,
  KNOWN_KEYS,
  dataKeys, // v1.1.1（Q3）：实际持有加密数据的全键集（KNOWN_KEYS ∪ 存储密文键）
};
