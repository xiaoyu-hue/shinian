/**
 * 时念 ShiNian · 本地数据加密保险库（B1：防数据泄露）
 *
 * 双层密钥设计：
 *   - DEK（数据加密密钥）：随机 256-bit，AES-GCM 加密本地明文数据。
 *   - KEK（密钥加密密钥）：由用户主密码经 PBKDF2-SHA256（21 万迭代）派生，加密 DEK。
 *   - 落盘：salt + 迭代次数 + KEK 加密的 DEK 密文 + 各条数据密文；主密码永不落盘。
 *
 * 用途：设备被 root / 文件被导出时，无主密码无法还原数据（防泄露 + 高迭代抗离线爆破）。
 * 依赖：浏览器 / WebView / Node18+ 的 Web Crypto（crypto.subtle），无需第三方库。
 */

const textEnc = new TextEncoder();
const textDec = new TextDecoder();

/** base64（URL 无关，标准 btoa/atob）。 */
function toB64(buf: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin);
}
function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** AES-GCM 密文块（iv + ct 均为 base64）。 */
export interface EncryptedBlob {
  iv: string;
  ct: string;
}

/** 保险库信封：唯一持久化的密钥材料（不含主密码）。 */
export interface VaultEnvelope {
  v: 1;
  kdf: 'PBKDF2';
  hash: 'SHA-256';
  iterations: number;
  salt: string; // base64
  encDek: EncryptedBlob; // KEK 加密的 DEK
}

/** OWASP 推荐量级：PBKDF2-SHA256 ≥ 210,000 次迭代。 */
export const PBKDF2_ITERATIONS = 210_000;

/** 生成随机 256-bit 数据密钥。 */
export function generateDek(): Uint8Array {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  return raw;
}

/** 由主密码 + salt 派生 KEK（AES-GCM 256 CryptoKey）。 */
export async function deriveKek(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    textEnc.encode(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function importAes(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function gcmEncrypt(key: CryptoKey, data: Uint8Array): Promise<EncryptedBlob> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource);
  return { iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
}

async function gcmDecrypt(key: CryptoKey, blob: EncryptedBlob): Promise<Uint8Array> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(blob.iv) as BufferSource },
    key,
    fromB64(blob.ct) as BufferSource,
  );
  return new Uint8Array(pt);
}

/** 用 KEK 加密 DEK（返回密文块）。 */
export async function wrapDek(kek: CryptoKey, dek: Uint8Array): Promise<EncryptedBlob> {
  return gcmEncrypt(kek, dek);
}

/** 用 KEK 解密 DEK。 */
export async function unwrapDek(kek: CryptoKey, blob: EncryptedBlob): Promise<Uint8Array> {
  return gcmDecrypt(kek, blob);
}

/** 用 DEK 加密明文（如 JSON 字符串）。 */
export async function aesEncrypt(dek: Uint8Array, plaintext: string): Promise<EncryptedBlob> {
  return gcmEncrypt(await importAes(dek), textEnc.encode(plaintext));
}

/** 用 DEK 解密。 */
export async function aesDecrypt(dek: Uint8Array, blob: EncryptedBlob): Promise<string> {
  return textDec.decode(await gcmDecrypt(await importAes(dek), blob));
}

/** 创建新保险库：返回信封（持久化）与会话 DEK（内存）。 */
export async function createVault(
  password: string,
): Promise<{ envelope: VaultEnvelope; dek: Uint8Array }> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const kek = await deriveKek(password, salt, PBKDF2_ITERATIONS);
  const dek = generateDek();
  const encDek = await wrapDek(kek, dek);
  const envelope: VaultEnvelope = {
    v: 1,
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    iterations: PBKDF2_ITERATIONS,
    salt: toB64(salt),
    encDek,
  };
  return { envelope, dek };
}

/** 用主密码解锁：校验并还原会话 DEK（密码错误会因 GCM 认证失败抛错）。 */
export async function unlockVault(password: string, envelope: VaultEnvelope): Promise<Uint8Array> {
  const salt = fromB64(envelope.salt);
  const kek = await deriveKek(password, salt, envelope.iterations);
  return unwrapDek(kek, envelope.encDek);
}
