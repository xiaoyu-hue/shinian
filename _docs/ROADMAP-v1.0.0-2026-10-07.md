# 时念 v1.0.0 里程碑路线图（混合架构 + 安全加固 APK）

> **单一权威方案文档**。本文件取代并整合此前 `shinian-architecture-plan.md`（架构计划）、`shinian-ai-agent-instructions.md`（AI 协作规范）、`RESEARCH-APK-SECURITY-2026-10-07.md`（APK 安全调研）、`RESEARCH-ARCHITECTURE-2026-10-07.md`（架构专项调研）的全部有效结论。其余文档本地留存作参考，**不重复入仓**。

## 0. 已定决策（基线）

1. **混合架构（最终方案）**：新代码 / 安全关键代码用 **TypeScript** 编写，`esbuild` 编译为 JS 进 `www/`；既有 vanilla 文件**保持不动**。开发态**零构建**、`file://` 双击照常可开（保留 v0.7.5 F3 修复价值）；仅发布态跑 esbuild 做 bundle + minify + 轻混淆。**不引入 Vite**（Vite 是 dev-server 型工具链，对零构建项目是负担；且最大卖点 HMR 热更新是给人手敲代码用的，本项目由 AI 全程写码，几乎无收益）。
2. **v1.0.0 双半场**：上半场 = 架构升级；下半场 = 安全加固 APK。
3. **里程碑终点**：完整签名 APK 经 GitHub Release 发布 **且** 架构升级落地 = v1.0.0 正式结束（届时打 `v1.0.0` tag + Release）。
4. **文档策略**：仅本路线图一份入仓；其余调研/审计文档本地留存。

## 1. 上半场 · 架构升级

目标：在不破坏零构建与现有核心视觉算法的前提下，为长期可维护性切第一刀，并为下半场安全层提供干净基座。

| 编号 | 内容 | 交付物 | 验证 |
|---|---|---|---|
| **A1** | 接入 Capacitor（出包地基）：`capacitor.config.ts`（`appId=com.shinian.app`、`webDir=www`、`androidScheme=https`）+ 加 `@capacitor/core`、`@capacitor/android`，`@capacitor/cli` 依赖。当前仓库**零 Capacitor**，这是出 APK 的硬前置 | `capacitor.config.ts` + 依赖 + `android/` 脚手架 | CI 能 `cap add/sync` |
| **A2** | 引入 esbuild 发布管线：加 `esbuild` 依赖与脚本 `build:release`（把 `index.html` + `assets/*` 打包进 `www/`）。`dev` 仍零构建 | `npm run build:release` | 产出 `www/` 可被 Capacitor 加载 |
| **A3** | Storage 适配层（安全层雏形）：抽 `secure-store.js` 作统一读写入口——先纯明文透传，下半场 B1 直接在其内接加密，安全投入不浪费 | `secure-store.js` | 纯 Web 单测：读写的透明封装 |
| **A4** | 新模块 TS + JSDoc 网关：新增/安全关键模块用 TS 写；既有 JS 顶部加 `// @ts-check` 逐步获得编辑器红线，CI 加 `tsc --noEmit` 质量门（零编译产物，比真 TS 弱但零负担） | TS 配置 + CI 门 | `tsc --noEmit` 通过 |
| **A5** | 分层仅约束新增代码：按 DDD 粗略分层（domain / infra / ui），**不强行重写旧文件**。保留核心视觉算法（clouds fBm、sky 引擎写 CSS 变量、decor 流星）原样 | 新模块落位 | 旧功能回归测试绿 |

> 关键事实：Capacitor 在手机里用 `https://localhost`（native scheme handler，**不是** `file://`，无真实端口），所以 ES 模块在 APK 内本就能跑；当前用 IIFE/全局变量**纯粹为让你 `file://` 双击也能开**。结论：源文件保持经典脚本，让 esbuild 在发布态打包——`file://` 与 APK 两约束同时保住。

## 2. 下半场 · 安全加固 APK

**攻击面前提（本地优先 / 离线 / 无后端 / 无账号）**：设备丢失 → 明文数据被直接读（离线无法靠服务端兜底）；APK 解包 → JS 逻辑被抄/改；自有渠道分发 → 重打包风险。**"服务器端安全"在本项目不成立（无后端、无账号、不上传），已如实降级，不编造风险。**

| 编号 | 内容 | 开源方案 | 解决诉求 |
|---|---|---|---|
| **B1** | 密码防线：`secure-store.js` 内用 **Web Crypto**（AES-GCM + PBKDF2，主密码派生密钥）加密 countdowns/wishes/settings/city；明文→密文；unlock/lock/changePassword。**零依赖**，不引 `crypto-js`（CBC/维护停滞/已知 bug） | `sapthesh/offline-vault`（PBKDF2 10 万轮+AES-GCM）、`TolinSimpson/PWA-Template` | 防数据泄露、防暴力破解（**唯一能挡"手机丢了"**） |
| **B2** | 三重解锁（密码+设备密钥+生物锁）：AndroidKeyStore 硬件绑定密钥封装 DEK + `@capgo/capacitor-native-biometric` 生物锁；解锁可任一路（密码 or 生物）；**切后台回前台需重新验证**（应用锁）。Web 降级为密码-only | `capacitor-native-biometric` + AndroidKeyStore | 你定的"三重防线" |
| **B3** | 反逆向：`talsec/Free-RASP-Capacitor`（免费 RASP：root/Frida/重打包/调试/完整性检测，触发锁定或告警）+ 发布态 `javascript-obfuscator` 混淆 `www` JS（仅打包态，不破坏零构建开发态） | `talsec/Free-RASP-Capacitor`、`javascript-obfuscator` | 反防逆向、防篡改 |
| **B4** | WebView 硬化 + 签名出包：`debuggable=false`、关 `webContentsDebugging`、禁 `file` access、CSP 收紧；Release 签名密钥**仅走 GitHub Secrets（KEYSTORE_BASE64 等），绝不落盘/硬编码**（你已授权 AI 生成仅存 Secret）；APK 自动挂 GitHub Release | Capacitor 原生配置 + GitHub Actions Secrets | 专业安全构建 |
| **B5** | 安全自审：按 OWASP MASVS v2.1 八类（存储/密码学/认证/网络/平台/反逆向/代码质量）逐条对照，列已覆盖/部分/未覆盖与剩余风险 | OWASP MASVS | 验证加固是否真生效 |

## 3. 技术选型与开源参考（自包含摘要）

- **打包/构建**：`esbuild`（单依赖、无配置、比 Vite 轻一个量级，**仅发布态**）。
- **加密范本**：`sapthesh/offline-vault`、`TolinSimpson/PWA-Template`（均零依赖 Web Crypto）；**明确不引 `crypto-js`**。
- **反逆向**：`talsec/Free-RASP-Capacitor`；`javascript-obfuscator`。
- **原生构建/发布 Skill**：`capawesome-team/skills`（37 个、MIT，含 `capacitor-app-creation`/`capacitor-plugins`/`capawesome-cloud` 原生构建+发布）；`vanilla-js-architect`（零框架 + JSDoc + DDD 规范）。均遵循开放 Agent Skills 规范，适配 AI 全程协作模式。
- **签名**：GitHub Release 自签名（KEYSTORE 走 Secret）；若日后上 Google Play 再接 App Signing 双密钥。
- **构建位置**：本地**无 Android SDK**，APK 编译全在 **GitHub Actions**（`workflow_dispatch`，手机用 GitHub App 触发 → 下载 APK）。

## 4. 风险与权衡（如实列）

- **esbuild 发布态 ≠ dev 态**：需在 CI 验证打包产物与开发态行为一致，避免"发布才暴露"的 bug。
- **JSDoc `@ts-check` 弱于真 TS**：靠约定，旧文件仍可能膨胀；若项目未来长大到多人长期维护，可能仍需真 TS（届时 A4 已铺好迁移路径）。
- **hybrid 比纯 vanilla 多一个编译步骤**：但非 dev-server，CI 一行命令，可接受。
- **生物锁上限**：Android 生物锁依赖设备硬件与系统设置，部分老旧设备不可用，必须有密码兜底（B2 已含）。
- **密钥库**：授权 AI 生成仅存 Secret，泄露风险由 GitHub 权限模型兜底；建议 Release 后轮换。

## 5. 里程碑终点与收尾

1. 完成 A1–A5（架构升级）+ B1–B5（安全加固 APK）。
2. 完整签名 APK 挂 GitHub Release。
3. 打 `v1.0.0` tag + Release = **正式结束**。
4. 收尾同步文档（README / CHANGELOG 对齐混合架构与 v1.0.0），届时再单独征求公开发布确认。

> 本路线图即 v1.0.0 实施基准；未启动时一行产品代码都不写，待你审完拍板后按 A→B 重拆为可执行小步逐一交付。
