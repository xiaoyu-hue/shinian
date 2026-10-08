# 时念 ShiNian · OWASP MASVS v2.1 安全自审报告（v1.0.0）

- **版本**：v1.0.0（对齐 `1.0.0-alpha.5` 收尾）
- **评估日期**：2026-10-08
- **评估范围**：网页版（零构建 `file://` + 发布态 `www/`）与 Android APK（Capacitor 6 壳）
- **方法论**：基于 **OWASP MASVS v2.1** 八类做静态自审 + 自动化单元测试验证；不替代第三方渗透测试。
- **等级约定**：✅ Met（已满足）／🟡 Partial（部分满足，有残余风险）／➖ N/A（不适用）

> 说明：本仓库既有代码以「本地优先、零后端」为核心，故大量 MASVS 条目天然 N/A；自审聚焦 B 系列安全专项（加密保险库 / 生物锁 / 反逆向 / WebView 硬化）的真实落地。

---

## 1. 评估结论总览

| MASVS 类别 | 等级 | 一句话结论 |
|---|---|---|
| MASVS-STORAGE（存储） | ✅ Met | DEK 永不落盘；仅存「主密码信封 + 生物封装」，明文数据全加密 |
| MASVS-CRYPTO（密码学） | ✅ Met | AES-GCM-256 + PBKDF2-SHA256(210k)，随机 salt/IV，无硬编码密钥 |
| MASVS-AUTH（认证） | ✅ Met | 主密码 + 生物锁（Keystore）+ 应用锁（回前台重验）三重解锁 |
| MASVS-NETWORK（网络） | ✅ Met | 仅 HTTPS 天气 API；明文流量禁用、拒用户证书；CSP 收紧 |
| MASVS-PLATFORM（平台） | 🟡 Partial | 备份/调试/明文已禁；WebView 文件访问依赖 Capacitor 默认，待真机复核 |
| MASVS-RESILIENCE（抗逆向） | 🟡 Partial | 混淆 + WebView 层 RASP 已最大化（注入/hook 痕迹、核心完整性、调试探针、自动化、非原生、DevTools）；原生级 Root/重打包检测经评估未引入（见下） |
| MASVS-CODE（代码质量） | ✅ Met | 动态文本走 `textContent`、无 `eval`、依赖锁定、测试覆盖 145+ |
| MASVS-PRIVACY（隐私） | ✅ Met | 用户数据不出端；仅城市名发往天气 API；权限最小（仅生物锁） |

---

## 2. 逐类评估

### 2.1 MASVS-STORAGE · ✅ Met
**要求要点**：敏感数据不以明文落盘；密钥材料受保护。

- **实现**：`secure-store.ts` 把 4 类业务数据（items/wishes/city/settings）以 `<key>__enc` 存「AES-GCM 密文 JSON」；会话内 DEK 仅在内存，落盘的只有 `shinian.vault.v1`（主密码信封）与 `shinian.vault.bio.v1`（DEK 的生物封装）。主密码与 DEK 均**永不持久化**。
- **证据**：
  - `src/secure-store.ts` — `persist()` 仅写密文；`lock()` 清空内存 `dek/bioKEK/cache`。
  - `src/crypto-vault.ts:36-43` — `VaultEnvelope` 仅含 `salt/iterations/encDek`，无密码/DEK。
- **残余风险**：设备已解锁且 App 处于解锁态时，内存 DEK 可被内存 dump 提取——属本地加密的固有边界，由「应用锁回前台重验 + 生物锁」缩短暴露窗口缓解。

### 2.2 MASVS-CRYPTO · ✅ Met
**要求要点**：使用平台强密码原语；足够迭代；随机盐/IV；无硬编码密钥。

- **实现**：
  - AES-GCM **256-bit**（`crypto-vault.ts:71,124`）。
  - PBKDF2-SHA256 **210,000 次迭代**（OWASP 推荐量级，`crypto-vault.ts:46`）。
  - DEK 为随机 32 字节（`generateDek`，`crypto-vault.ts:49-53`）；salt 16 字节随机、IV 12 字节每密文随机（`gcmEncrypt`，`crypto-vault.ts:82-83`）。
  - 无硬编码密钥/盐；全部依赖 `crypto.subtle`（Web Crypto）。
- **残余风险**：PBKDF2 属 OWASP 达标线但未用 Argon2id；210k 迭代在低端设备解锁略慢（<300ms 量级），属权衡取舍，已在文档标注。

### 2.3 MASVS-AUTH · ✅ Met
**要求要点**：本地认证机制、再认证、生物绑定。

- **实现（三重解锁）**：
  1. **主密码**：`secure-store.setup/unlock`，错误密码因 GCM 认证失败抛错（`test_secure_store.js` 已验证）。
  2. **生物锁**：`biometric.ts` 经 `@bytetrade/capacitor-native-biometric` 把 `bioKEK` 存入系统 **Keystore（Android）/Keychain（iOS）**，`secure-store.unlockWithBiometric()` 认证后取回 `bioKEK` 解开 DEK；DEK 永不落盘。
  3. **应用锁**：`assets/app.js` 的 `VaultCtl` 在 `visibilitychange`（回前台）时重新上锁并弹解锁框（`booted && isReady → lock + open('unlock')`）。
- **证据**：`src/biometric.ts`、`src/secure-store.ts:unlockWithBiometric/reWrapBio`、`assets/app.js` VaultCtl。
- **残余风险**：生物锁是主密码的便捷通道而非替代；改密后仍可用主密码解锁。符合设计预期。

### 2.4 MASVS-NETWORK · ✅ Met
**要求要点**：仅安全通道；防降级；证书校验。

- **实现**：
  - `index.html:12` CSP：`connect-src 'self' https://api.open-meteo.com` + `block-all-mixed-content`。
  - `_cfg/build-apk.yml` 注入 `network_security_config.xml`：`cleartextTrafficPermitted=false`、仅信任系统 CA（**拒绝用户证书**，缓解 MITM）。
  - `usesCleartextTraffic=false`（清单注入）。
- **残余风险**：**未做证书锁定（certificate pinning）**——依赖系统 CA 体系；发布态拒绝用户 CA 已降低 MITM 风险，但严格锁定建议后续以原生网络安全配置补充。

### 2.5 MASVS-PLATFORM · 🟡 Partial
**要求要点**：WebView 配置安全；备份禁用；调试关闭。

- **实现（CI 注入，`_cfg/build-apk.yml`）**：
  - `android:allowBackup="false"` — 禁止 `adb backup` 导出应用私有数据（含保险库密文）。
  - `android:debuggable="false"`、`android:usesCleartextTraffic="false"`。
  - `WebView.EnableSafeBrowsing=true`、`networkSecurityConfig` 绑定。
  - CSP `object-src 'none'`、`base-uri 'self'`、`frame-ancestors 'none'`。
- **残余风险（需真机复核）**：
  - **WebView 文件 访问**：Capacitor 6 的 BridgeWebView 默认 `setAllowFileAccess(false)`、`setAllowFileAccessFromFileURLs(false)`，但本仓未在原生侧显式断言；建议真机出包后校验 `WebView.getSettings()`。
  - 上述清单加固在 CI 的 `cap sync` 之后由 Python 注入，依赖生成后的 `AndroidManifest.xml` 结构；已在 yml 内加存在性判断与日志。

### 2.6 MASVS-RESILIENCE · 🟡 Partial
**要求要点**：抗逆向、反调试、完整性校验。

- **实现（已就位）**：
  - **代码混淆**：`tools/build-www.js` 用 `javascript-obfuscator`（控制流扁平化、死代码注入、字符串数组、自保护）混淆发布产物，`renameGlobals:false` 保全局符号（`ShiNianCore` 等）。
  - **WebView 层 RASP 自检**：`anti-tamper.ts` 的 `detectThreats/guard` 检测六类信号——非原生壳（`NOT_NATIVE`）、自动化驱动（`WEBDRIVER`）、DevTools 尺寸差（`DEVTOOLS`）、debugger 多重探针（`DEBUGGER`）、注入/hook 框架痕迹（`INJECTION`：Frida/Xposed/Il2Cpp 等全局标记）、核心层 `ShiNianCore` 形态完整性（`CORE_TAMPERED`：检测被替换/注入），并给风险评分（`blockOnHighRisk` 可开启强制拦截，`test_antitamper.js` 13 项已验证）。
- **残余风险（明确差距）**：
  - **原生级 Root / 模拟器 / 重打包 / 签名校验检测未引入**——评估后**主动未引入**原生 RASP SDK（真实包名 `capacitor-freerasp`）。理由：① 本项目为零后端、零账户、单机模型，RASP 边际收益低；② Free-RASP 的 weekly report 存在威胁/设备数据上报，与本项目「零采集、零上报」隐私承诺冲突；③ `android/` 不入库、构建环境不编原生，引入后无法本地验证真机行为。WebView 层能力范围内的 RASP 已最大化覆盖本项目实际威胁模型（代码被搬出 App、自动化驱动、调试、注入框架、核心被篡改）。
  - 混淆仅提高门槛，不能阻止有决心的逆向；属行业共性，非缺陷。

### 2.7 MASVS-CODE · ✅ Met
**要求要点**：安全编码、输入校验、依赖卫生。

- **实现**：
  - 全部动态文本经 `textContent` / `createElement` 渲染，无 `innerHTML` 拼接用户输入 → XSS 面极窄。
  - 无 `eval` / `Function()` 动态执行。
  - 依赖锁定：`@bytetrade/capacitor-native-biometric` 精确 `6.0.5`（与 `@capacitor/core ^6` 对齐，已 `npm view` 校验 peer）。
  - 自动化测试覆盖 145+（含 `test_crypto.js` / `test_secure_store.js` / `test_biometric.js` / `test_antitamper.js`）。
- **残余风险**：WebView 内联脚本（`local-notifications` 条件注入）保留 `unsafe-inline`，为插件加载所需；去除后可升级为 nonce/hash。

### 2.8 MASVS-PRIVACY · ✅ Met
**要求要点**：数据处理最小化、透明。

- **实现**：用户念想/倒数日/许愿全部本地存储，**不上传任何服务器**；唯一网络外联是「城市名 → Open-Meteo 天气」，不含个人身份数据。权限仅申请生物锁（`USE_BIOMETRIC`）。
- **残余风险**：天气请求含城市名（粗略位置），属功能必需；可在隐私说明中明示。

---

## 3. 关键残余风险与路线图

| 风险 | 严重度 | 现状 | 建议 |
|---|---|---|---|
| 原生级 Root/Hook/重打包检测缺失 | 低 | 评估后主动未引入（隐私 / 单机模型 / 无法本地验证） | 接受；WebView 层 RASP 已覆盖实际威胁，且数据保密由 B1/B2 锁死，不依赖 RASP |
| 证书锁定未做 | 低-中 | 系统 CA + 拒用户 CA | 后续原生网络安全配置补 pinning |
| WebView 文件访问未显式断言 | 低 | 依赖 Capacitor 默认 | 真机出包后校验 `getSettings()` |
| 混淆可逆向 | 低 | 行业共性 | 接受；结合原生 RASP 提升门槛 |

---

## 4. 验证与测试覆盖

- `npm test`：全量 145+ 断言，含安全专项
  - `test_crypto.js`（8）：AES-GCM / PBKDF2 加解密闭环。
  - `test_secure_store.js`（18）：加密存储、锁态、错误密码、改密。
  - `test_biometric.js`（19）：setup 登记 / 生物解锁 / 主密码仍可用 / 改密重封装 / **Web 降级**。
  - `test_antitamper.js`（8）：四类威胁信号检测。
- `npm run typecheck`：TS 全量类型检查通过。
- `npm run build:release`：esbuild 编译 + 混淆，release `index.html` 自检（core+bundle 引用、无残留散 script）通过。

> 注：Android 原生构建（混淆后的 `www/` 经 `cap sync` 进入 APK、清单硬化、签名出包）由 `_cfg/build-apk.yml` 在 CI 执行；本环境不编译原生，故原生侧（Keystore 实测、WebView 设置）以代码审计 + CI 注入为准，建议首次真机出包后做一次人工复核。
