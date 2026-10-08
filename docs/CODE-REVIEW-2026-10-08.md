# 时念 ShiNian · 第二次全方位代码审查报告（v1.1.0+）
> 审查对象：commit af09598（v1.1.0 + dependabot 分组补丁）· 审查人：小余
> 审查日期：2026-10-08 · 与上次（v0.7.3，2026-10-07）对照增量审查 + 全量复检
> 方法：npm ci 实装依赖 + 13 套测试实跑 3 轮 + typecheck 实跑 + 全模块精读 + git 历史追溯

---

## 〇、总评

| 维度 | 上次(v0.7.3) | 本次(v1.1.0) | 一句话 |
|---|---|---|---|
| 代码质量 | 8 | **8.5** | TS 严格模式分层干净，但迁移竞态是新雷 |
| 测试覆盖 | **2** | **7.5** | 幽灵测试→13 套 210 项真实存在，唯余一条 flaky |
| UI/UX 代码 | 8.5 | **8** | 锁屏完整，但应用锁无宽限期是体验灾难 |
| 代码规范 | 9 | **8.5** | TS/vanilla 分层纪律明确，jsdom 放错位置 |
| 文档同步 | 7 | **8** | CHANGELOG/审计报告与代码对得上，数字小打架 |
| 安全 | 8.5 | **8.5** | 加密设计教科书级，迁移窗口是唯一硬伤 |
| "服务端" | 8 | **8.5** | CI 五件套 + SECURITY.md + MobSF，到位 |

**一句话总评：昨天我说"代码 9 分、测试是皇帝的新衣"；今天测试是真的了（我亲手跑了 3 轮），加密层设计是教科书级的——但新引入的两个 P1（迁移竞态、应用锁无宽限）恰好都在"最信任安全的用户"路径上，值得优先修。**

---

## 一、测试覆盖与质量审查（实测）

**实跑结果（npm ci 后 3 轮）：**

| 套件 | 结果 |
|---|---|
| test_wish | 30 ✓ |
| test_notif_s5 | 全过 |
| test_autorefresh / intro / sunmoon / meteor / form | 7+6+23+13+7 ✓ |
| test_crypto / antitamper / secure_store / biometric / crypto_backup | 8+13+18+19+7 ✓ |
| **test_clouds** | **52✓/1✗ → 53✓/0 → 53✓/0（flaky 实锤）** |

**T1 · P2 · test_clouds 云量断言 flaky（负载敏感）**
`密 > auto` 断言实测出现过 9.6% > 9.7% 翻转。根因：60 帧平均依赖 jsdom `pretendToBeVisual` 的**真实时钟**，机器负载高时风场推进不足。且暴露更深问题：dense 乘率 1.6 倍，覆盖率却只差 0.1%——**引擎的侵蚀阈值抵消了密度乘率**，注释声称的"严格单调"在引擎层面就不成立。修法：固定虚拟时钟 + 把断言改为对乘率参数的直查（或提高帧数+放宽阈值带）。

**T2 · 测试退出码机制验证通过**（撤销昨天一个存疑点）
`ok()` 计数与 `process.exit(fail ? 1 : 0)` 实现正确；52/1 那轮 `&&` 链确实中断了。测试门是真的。

**T3 · 测试内容质量高**（加分项）
- 断言 PBKDF2 迭代数 = 210000（OWASP 量级）
- 改密全链路：旧密码失效 / bioWrap 重封装 / 生物解锁数据一致
- 生物锁 Web 降级路径全覆盖（isSupported=false / 不创建 bioWrap / unlock 抛错）
- 同明文两次密文不同（salt/iv 随机性断言）——这个意识很难得

---

## 二、代码质量（重点：src/ 新模块）

**Q1 · P1 · 明文→加密迁移的丢数据窗口**（`app.js` migratePlaintextToEncrypted）
`S.set(k, v)` 的落盘是**异步**的（内部 await 加密），但代码紧接着**同步** `localStorage.removeItem(k)` 删明文。若加密落盘失败（`persist()` 内部 catch **静默吞掉**仅打 warn），明文已删、密文未落 → **该键数据永久丢失**。修法：迁移改为 `await` 确认密文落盘后再删明文；或 persist 失败时把明文写回。

**Q2 · P1 · 应用锁无宽限期、无开关**（`app.js` visibilitychange）
网页版**每次**切回标签页立即锁 + 要密码；手机回个微信回来也锁。无 30s~几分钟宽限期、设置里无开关。安全设计过严会**逼用户关掉加密存储**（设置里就有这个开关）——安全劝退安全。修法：加可配置宽限期（默认 60s）+ 设置开关。

**Q3 · P2 · KNOWN_KEYS 硬编码 4 键**（`secure-store.ts`）
未来新增业务键忘记登记 → 该键不参与 prime/改密重加密 → **改密后重启该键数据无法解密**。建议键注册表机制（业务模块注册自己的键）。

**Q4 · P2 · 异步落盘竞态**（`secure-store.ts` set）
连续两次 set 同键，若先发请求的加密后完成，旧值会覆盖新值落盘（内存 cache 正确、重启后读到旧值）。单用户交互下概率低，但 Q1 的迁移路径会放大它。

**Q5 · P3 · 生物锁检测竞态**（`biometric.ts` void detect() 异步自检）
冷启动 1-2 秒内 setup 会误判"不支持生物锁"而漏登记。建议 boot 前显式 `await biometric.init()`。

**Q6 · P3 · _cfg/build-apk.yml 旧拷贝误入库**（209 行旧版，正式文件 108 行）
Semgrep 昨日报的 shell 注入**真相在此**：注入面在旧拷贝里，正式工作流是干净的。该目录属构建/审计中间产物，建议删除并加 .gitignore（删文件，等你点头）。

**亮点**：crypto-vault 双层密钥设计（DEK/KEK、主密码永不落盘、GCM 认证失败即错密验证）、anti-tamper 边界声明（原生 RASP 不引入 vs 零采集承诺冲突的理由诚实成立）、secure-store 降级策略明文清晰、代码注释依旧资产级。

---

## 三、UI/UX 交互代码

✅ 锁屏 modal 四模式文案区分清晰、生物按钮条件显示、错误反馈到位、Enter 提交、焦点管理
✅ 加密开关三态（网页可开关 / 移动强制置灰 / file:// 隐藏）的 UI 逻辑严密
❌ Q2 应用锁体验（见上）
❌ P3 · 密码输入无 `autocomplete="new-password"/"current-password"`，密码管理器无法正确配合
❌ P3 · 锁屏出现时无 `aria-modal` / 焦点陷阱，键盘用户可 Tab 到锁屏背后的内容

---

## 四、代码规范

✅ 新代码 TS strict（noImplicitAny）、老 vanilla 不动——分层纪律写进了 PRD 且执行到位
✅ typecheck 实跑通过；esbuild/obfuscator 管线参数均有取舍注释（selfDefending/debugProtection 关的理由）
❌ P3 · `jsdom` 在 `dependencies`（应 devDependencies）——生产 npm ci 多装 ~30MB
❌ P3 · `shinian-core.ts` 注释笔误"限制在 in, max]"（缺 mi）
✅ 撤销昨天 `_cfg` 相关的"笔误"误判：`branches: [main]` 本就正确（显示层吃字符）

---

## 五、文档同步与质量

✅ CHANGELOG v1.0.0/1.0.1/1.1.0 与代码逐条对得上（PBKDF2 21 万轮、6 类 RASP、三重解锁——全部实锤存在）
✅ SECURITY-AUDIT-v1.0.0.md 诚实标注原生 RASP"评估后主动未引入"——审计文档敢写"没做"，难得
✅ 测试数字真实：声称 13 套 204/210 项，实测 ~210 项吻合（对照昨日幽灵测试，天壤之别）
❌ P3 · README 依赖表写"12 套 197 项" vs CHANGELOG"13 套 210 项"——数字打架
❌ P3 · CHANGELOG 有**两条 v1.1.0 条目**，违反它自己定的"一个版本号只打一次"纪律
❌ P3 · PRD 状态表停在 v0.7.4，v1.x 里程碑未回写
❌ P3 · CHANGELOG 交付版本链接列表停在 v0.7.4

---

## 六、安全审查（客户端）

✅ 加密算法与参数全部对齐 OWASP：AES-GCM-256 / PBKDF2-SHA256 210,000 / 16B salt / 12B IV / DEK-KEK 信封
✅ 主密码与 DEK 永不落盘；生物锁 bioKEK 经 Android Keystore 封装（插件桥接零硬依赖设计聪明）
✅ 用户输入全走 textContent；加密备份信封格式校验 + 错误密码抛错
✅ RASP 六类检测默认仅告警不阻断（误报不锁门），零上报承诺贯彻（连 RASP 都为它让路）
✅ CSP / WebView 硬化（CI 注入 allowBackup=false / debuggable=false / 拒用户证书）
❌ Q1 迁移窗口（见上）是唯一数据级硬伤
❌ P3 · `document.write` 注入插件脚本（硬编码串，无实际 XSS 面）——建议换 createElement，顺带解锁 CSP nonce 收紧（昨天已提，仍然有效）

## 七、"服务端"安全审查

✅ 无后端无可攻击面（静态托管 + Open-Meteo 唯一外联 + 无密钥可泄）
✅ CI 五件套：CodeQL / Dependabot / Secret Scanning / Gitleaks / Semgrep + MobSF（APK）+ SECURITY.md 披露政策
✅ 签名密钥走 GitHub Secrets；混内容禁止；无远程 WebView 覆盖
✅ dependabot 已驯服：分组 + 冷却 7 天 + 自动合并（本次审查期间实测首单自动合并成功）
❌ P3 · Semgrep 首扫 21 条已逐条定性（17 条锁 SHA 建议 + 2 条误报 + 2 条 cooldown 建议）——治理项：CI action 建议逐步 pin 到 commit SHA

---

## 八、修复优先级

| 优先级 | 事项 | 工作量 |
|---|---|---|
| **P1** | Q1 迁移竞态（await 确认落盘再删明文 + persist 失败回写） | ~40min |
| **P1** | Q2 应用锁宽限期 + 设置开关 | ~40min |
| P2 | T1 flaky 测试修稳（虚拟时钟 + 断言改直查乘率） | ~30min |
| P2 | Q3 键注册表 + Q4 落盘序列号 | ~1h |
| P3 | Q5/Q6、UI 细节、文档数字同步、jsdom 归位 | ~1h |

## 九、结语（大白话）

跟昨天比，这个仓库从"单科状元"变成了"全优生"：测试从零到 210 项且真实有效，加密层是教科书设计，连审计报告都敢写"这个我没做因为理由是 XXX"。

但两个 P1 都有个共同气质：**都发生在"最信任你、开了加密的用户"身上**——开加密的用户可能因迁移竞态丢数据，开锁的用户可能因应用锁烦到关加密。安全功能的价值取决于它对最忠实用户的善待程度。

建议下一步：修 Q1 + Q2（约 1.5 小时），然后这仓库就真的是"银行级配置 + 人性化体验"了。
