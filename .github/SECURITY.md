# 安全政策（Security Policy）

时念 ShiNian 是一款**本地优先、零后端、零采集**的隐私工具。本文件说明如何负责任地报告漏洞，以及本仓库已启用的自动化安全审计。

## 支持的版本

| 版本 | 状态 |
|---|---|
| **v1.1.x**（最新） | ✅ 安全更新中 |
| v1.0.x | 仅关键修复 |

## 报告漏洞

请通过 **GitHub Security Advisories**（仓库 `Security` → `Report a vulnerability`）私下提交，不要公开提 issue。

我们会：
1. 48 小时内确认收到；
2. 评估影响并给出修复时间线；
3. 修复后通过 Release 说明致谢（经你同意）。

本应用无服务端、无账户、无付费逻辑，绝大多数攻击面在**本地设备与导出的备份文件**——请重点说明：明文备份泄露、主密码强度、生物锁绕过、WebView 注入等本地威胁模型。

## 本仓库已启用的免费安全审计

| 审计层 | 工具 | 触发 | 说明 |
|---|---|---|---|
| 密钥扫描 | **Gitleaks**（`.github/workflows/gitleaks.yml`） | push/PR | 扫完整 git 历史 + 工作树，防凭证泄露推上仓库 |
| 代码 SAST | **Semgrep**（`semgrep.yml`） | push/PR | 扫 JS/TS 的 XSS/注入/弱加密等 OWASP Top 10 模式 |
| 语义 SAST | **GitHub CodeQL**（`codeql.yml`） | push/PR | 公开仓库免费，数据流分析，结果进 Security 面板 |
| 依赖审计 | **Dependabot**（`dependabot.yml`） | 每周 | 自动提交依赖/Action 升级 PR |
| 移动端审计 | **MobSF**（`_cfg/build-apk.yml` 出包后） | 手动出包 | 扫 APK 的 manifest/硬编码/弱加密/WebView 配置，产出报告 artifact |

### 需在仓库 Settings 手动启用的项（无法用文件配置）

以下为 GitHub 原生能力，**请在仓库 `Settings → Security` 中开启**（公开仓库均免费）：

- **Secret Scanning**：自动识别推送中的密钥（含此前曾误推的 GitHub Token）。
- **Push Protection**：推送含疑似密钥时**阻断并提示**，从源头防止泄露。
- **Code scanning** 若不使用独立 workflow，也可在此开启 Default setup。

> 这些设置项与上面的 workflow 互补：Secret Scanning + Push Protection 在**推送瞬间**拦截，Gitleaks 在 **CI** 复查历史与全量文件，形成双保险。

## 范围外

- 动态渗透（DAST）、红队演练不在本仓库自动化范围内；
- 原生级 Root/Frida/重打包检测（Free-RASP）经评估未引入，详见 `SECURITY-AUDIT-v1.0.0.md`。
