/**
 * 时念 ShiNian · B2 生物锁原生桥接（平台抽象层）
 *
 * 职责边界：本文件不直接持有 DEK，只负责「安全地存 / 取一段对称密钥（bioKEK）」。
 *   - Android：bioKEK 由系统 Keystore 以「需生物认证」的密钥加密存储（硬件密钥封装 DEK 的实现）；
 *   - iOS：由 Keychain 以生物访问约束保护；
 *   - Web / file://（无 Capacitor 原生壳）：插件不存在 → supported=false，生物锁不可用，自动降级主密码。
 *
 * 选用插件：@bytetrade/capacitor-native-biometric（Capacitor 8 维护版，是 capacitor-native-biometric
 * 的延续；其 setCredentials/getCredentials 在 Android 走 BiometricPrompt + Keystore 硬件密钥）。
 * 接入方式：运行时经 window.Capacitor.Plugins.NativeBiometric 取用（插件标准自注册），不硬 import，
 * 以保证纯 Web 构建 / 单测零原生依赖。APK 构建由 `npx cap sync android` 注入原生实现。
 *
 * 安全边界（务必读）：
 *   - 取回的 bioKEK 仅在会话内存中短暂停留（secure-store 内），用于解开 DEK；DEK 本身永不落盘。
 *   - 凭据以 server 别名 'com.shinian.app.vault' 存储；username 固定 'dek'，password = base64(bioKEK)。
 *   - 生物锁是「主密码」的便捷解锁通道，不是替代：改密 / 极端情况下仍可用主密码解锁。
 */

const PLUGIN_NAME = 'NativeBiometric';
const SERVER = 'com.shinian.app.vault';
const USERNAME = 'dek';

interface NativeBioPlugin {
  isAvailable(opts?: { useFallback?: boolean }): Promise<{
    isAvailable: boolean;
    biometryType?: string;
    deviceIsSecure?: boolean;
  }>;
  verifyIdentity(opts?: Record<string, unknown>): Promise<unknown>;
  setCredentials(opts: { username: string; password: string; server: string }): Promise<unknown>;
  getCredentials(opts: { server: string }): Promise<{ username: string; password: string }>;
  deleteCredentials(opts: { server: string }): Promise<unknown>;
  isCredentialsSaved?(opts: { server: string }): Promise<{ isSaved: boolean }>;
}

/** 取插件实例（运行时）。Web 下 Capacitor 不存在 → 返回 null。 */
function getPlugin(): NativeBioPlugin | null {
  const g = globalThis as unknown as { Capacitor?: { Plugins?: Record<string, NativeBioPlugin> } };
  if (!g.Capacitor || !g.Capacitor.Plugins) return null;
  return g.Capacitor.Plugins[PLUGIN_NAME] || null;
}

// 模块加载即自检能力（Web 下 plugin 为 null → supported=false，自动降级主密码）。
let supported = false;
let enrolled = false;

async function detect(): Promise<void> {
  const p = getPlugin();
  if (!p) { supported = false; enrolled = false; return; }
  try {
    const r = await p.isAvailable({ useFallback: true });
    supported = !!(r && r.isAvailable);
    if (supported && p.isCredentialsSaved) {
      try {
        const s = await p.isCredentialsSaved({ server: SERVER });
        enrolled = !!s.isSaved;
      } catch {
        enrolled = false;
      }
    } else {
      enrolled = false;
    }
  } catch {
    supported = false;
    enrolled = false;
  }
}

void detect(); // 加载即异步自检

export function isSupported(): boolean { return supported; }
export function isEnrolled(): boolean { return enrolled; }

/**
 * 把 bioKEK（原始字节）存入系统密钥库（Android：Keystore 硬件密钥封装 + 生物认证门控）。
 * 先弹一次生物验证确认可用，再上架；失败则抛错，由 secure-store 降级主密码。
 */
export async function storeSecret(bytes: Uint8Array): Promise<void> {
  const p = getPlugin();
  if (!p) throw new Error('ShiNian.Biometric: 当前环境不支持生物锁（非原生壳）');
  if (!supported) {
    const r = await p.isAvailable({ useFallback: true });
    if (!r.isAvailable) throw new Error('ShiNian.Biometric: 设备未启用生物认证');
  }
  await p.verifyIdentity({ title: '时念', subtitle: '验证生物特征以启用生物锁', description: '用于解锁你的念想' });
  const b64 = bytesToB64(bytes);
  await p.setCredentials({ username: USERNAME, password: b64, server: SERVER });
  enrolled = true;
}

/** 取出 bioKEK：触发生物认证，认证通过后由系统密钥库解开并返回明文字节。 */
export async function getSecret(): Promise<Uint8Array> {
  const p = getPlugin();
  if (!p) throw new Error('ShiNian.Biometric: 当前环境不支持生物锁（非原生壳）');
  await p.verifyIdentity({ title: '时念', subtitle: '验证生物特征以解锁', description: '用于解锁你的念想' });
  const creds = await p.getCredentials({ server: SERVER });
  return bytesFromB64(creds.password);
}

/** 删除生物锁凭据（改密失败时清理，避免脏凭据）。 */
export async function deleteSecret(): Promise<void> {
  const p = getPlugin();
  if (!p) return;
  try { await p.deleteCredentials({ server: SERVER }); } catch { /* 已无凭据 */ }
  enrolled = false;
}

export async function init(): Promise<void> { await detect(); }

export const Biometric = {
  init,
  isSupported,
  isEnrolled,
  storeSecret,
  getSecret,
  deleteSecret,
  SERVER,
};

// ---- 字节 <-> base64（不依赖 Node Buffer，浏览器 / WebView 通用） ----
function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function bytesFromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
