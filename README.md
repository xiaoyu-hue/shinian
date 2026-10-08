# 时念 · ShiNian

> 当前版本 **v1.1.0** · [版本历史与规范](./CHANGELOG.md) · [主站](https://shinian520.pages.dev/)

> 一款装在手机里的「活着的窗景」时间工具——天空随真实时刻、四季与天气流动，
> 时钟、倒数日、提醒以液态玻璃卡片悬浮其上。**天空是主角，玻璃是舞台。**

<p align="center">
  <em>打开它，看到的不只是时刻与日期，而是一方正在流动的天空。</em>
</p>

---

## ✨ 功能（v1.1.0 当前版本）

- **天空引擎 · 天文驱动**：黎明 / 清晨 / 正午 / 午后 / 日落 / 暮色 / 深夜，七时段色阶分钟级连续插值。锚点由**真实日出日落时间**动态计算——同一时刻，冬天和夏天看到的是不一样的天
- **液态玻璃 UI**：玻璃配方随天空亮度自动切换（亮天空 → 磨砂白玻璃深色字；暗天空 → 深海玻璃浅色字），对比度全程满足 WCAG AA
- **时钟**：大字时刻 + 秒针呼吸节奏，与系统时间同步
- **倒数日**：纪念日 / 倒计时管理，增删改查，「今天 / 还有 N 天 / 已过 N 天」三种状态，数据本地持久化
- **许愿池**：备忘录式清单 + 开放氛围合二为一——写下小愿望（如「明天去吃蛋糕」），实现就打勾、未完成留着下次；可选日期仅标注不倒计时；填了日期且未完成的心愿，到期当天 09:00 一次性系统提醒（可关、可调时间）；数据独立存储（与念想分开），上限 100 条
- **实时天气**：手动选城市（57 个中国主要城市，支持中文 / 拼音搜索），Open-Meteo 免密钥直连；晴 / 阴 / 雨 / 雪 / 雾 / 雷 对应不同天空装饰层
- **温度自动刷新**（v0.6.2）：设置里可选自动刷新间隔（关闭 / 每 5 / 10 / 15 / 30 分钟，**默认 5 分钟**），按间隔自动拉取最新温度；切到后台自动暂停、回到前台立即刷新一次；失败静默降级，不影响时钟与倒数日。手动 ↻ 刷新始终可用。**v0.6.3 修复**：自动刷新失败时不再清空温度，而是保留上一次有效温度（避免移动端慢网周期性「温度闪没」）
- **断网自动降级**：无网络时不报错、不白屏，天空自动回退纯时间模式；网络恢复自动重试，也可点 ↻ 手动刷新
- **全机型适配**：从 280px 折叠屏外屏、各类刘海/灵动岛机型，到平板与横屏自动切换排版；触控目标 ≥44px；状态栏颜色跟随天空
- **微交互**：卡片按压弹簧回弹、天数立体翻转、左滑删除、记下念想时的轻震动、光晕随时刻漂移、星空视差——**全部零依赖原生实现**，不引入任何动画库
- **设置与数据**：玻璃配方手动锁定（跟随天空 / 亮 / 暗）、微交互与天气装饰开关；念想一键备份（复制文本 / 下载 JSON）、导入恢复（自动合并去重）、二次确认清空
- **提醒**：喝水提醒与倒数日提醒（**提前一天**提醒「明天是…」+ **当天**提醒「今天是…」），主页面独立模块；通过系统通知送达（需安装安卓 App；纯网页版仅保存设置）
- **季节层**：春樱 / 夏青 / 秋琥珀 / 冬青灰 四套色调滤镜，以「四立」节气为切换点（非公历季度），切换前后 ±7 天平滑过渡
- **季节彩蛋**：春樱飘落 / 夏夜萤火虫 / 秋黄叶飘落 / 冬夜极光，在对应季节随机浮现一次（可在设置的「天空装饰层」中关闭）
- **常驻流星**：任何季节的夜晚，天空不时会划过流星；常驻运行，等待期间**零绘制、零耗电**。**v0.7.3 可调**：设置新增「流星」区块——开关 + 出现间隔（真实 40–90 秒随机 / 常见约 30 秒 / 频繁约 12 秒 / 自定义 5–300 秒），实际间隔在设定值上下浮动 ±30% 以保留偶遇感；进入夜间后 8–15 秒先来一颗（保证「必遇一次」）；点击判定放宽到 70px，便于手指点中「点流星 → 展开许愿池」彩蛋
- **启动画面与开场动画**（v0.6.5）：双层接棒、零新依赖——冷启动先用系统图标占位防白屏，Web 覆盖层「接棒」播放实时天空（随 `sky.js` 昼/夜变化）+ 云彩飘移 + 多流星引路 + 玻璃卡浮起的开场动画，与主界面形成明确开幕仪式感、揭示平滑；系统「减少动态」时自动跳过动画。v0.6.1 修复了 v0.6.0「开场仅闪现 0.46s 感知不到」的时序 bug；**v0.6.4 升级**：星场改为 canvas 分层辉光（亮星带柔光晕 + 呼吸闪烁）、流星改为多颗带渐变拖尾与头部辉光，原生→Web 接棒改用双 `requestAnimationFrame` 更顺滑；**v0.6.5 升级**：开场改用 `sky.js` 实时天色（白天蓝天白云 / 深夜星海，星点随昼夜隐显），新增 `assets/clouds.js` 云彩体系（柔边圆堆叠、随机大小/数量/形态、噪声漂移、时刻染色、天气联动），主天空同步接入实现「同一片天」，文案新增随时刻的相位副标题与城市·天气·温度环境微行；**v0.6.6 升级**：云彩体系深度重写——真实云物理（多层视差 + 积云/层云/风暴/雾/卷云真实云型 + 太阳方位光照明暗）+ 移动/桌面深度分级（移动端 2 层 DPR1.5/0.62×/24fps，桌面端 3 层 DPR2/1.0×/30fps）；**v0.6.7 升级**：基于用户反馈「云太多太大太黑」做纯调参精修——天气浓度/设备基础朵数整体下调（雷暴 1.95→0.98、桌面朵数 7→5、移动 4→3）、低层云半径收紧（130→68px）、风暴亮度大幅上调（雷暴 0.48→0.82、雨 0.58→0.84）、层叠与单 blob 透明度调透，观感显著疏淡透亮；**v0.6.8 热修**：修复纯黑云与夜间暖棕两个着色缺陷；**v0.7.0 重构**：云彩引擎换核为 fBm 噪声场（网格留空根治「聚成一坨」、平底积云、丝缕侵蚀、流动变形、火烧云 + 银边效应），并新增日月体系（SunCalc 真实天文：东升西落轨迹、月相盈亏、日月交替、云遮日月）；**v0.7.1 可调**：设置面板新增「云彩」区块——开关、云量（跟随天气/疏/适中/密）、空窗期（连续有云/短/中/长，云飘过后留一段澄澈天空），流动提速约 2.3 倍
- **提醒模块折叠**（v0.6.1）：提醒区块默认折叠，摘要行显示「已开启 N 项」，点击展开/收起详细设置，状态记住；页面更简洁
- **隐私**：不申请定位权限，不采集、不上传任何个人信息，数据只存在你的设备里
- **免费安全审计（v1.1.0）**：接入 GitHub 原生三件套（CodeQL / Dependabot / Secret Scanning）+ 开源静态扫描 **Gitleaks**（密钥泄漏）、**Semgrep**（语义规则，含 OWASP Top-10）、**MobSF**（安卓 APK 动静态混合分析，覆盖 OWASP MASVS）。全部经 GitHub Actions 免费额度运行，零上云、贴合「零采集」隐私基调
- **网页端加密存储开关（v1.1.0 · 方案 A）**：设置新增「加密存储」开关，**默认关**——网页端关闭时直接明文启动（与双击版一致、零门槛）；开启后设主密码并把现有明文数据迁为 **AES-GCM-256 + PBKDF2-SHA256（21 万轮）** 加密、删除明文副本；**移动端（Capacitor）强制开启且不可关闭**；`file://` 双击版无加密层自动隐藏开关
- **加密备份导出 / 导入（v1.1.0）**：备份新增「下载加密备份」（`.enc.json`，主密码派生 KEK 加密，与明文备份并存；导入自动识别并解密），独立于存储层保险库，仅部署版 / App 可用
- **本地加密保险库（v1.0.0）**：首次打开设置主密码，念想 / 倒数日 / 许愿 / 城市 / 设置全部以 **AES-GCM-256 + PBKDF2-SHA256（21 万轮）** 加密存储，主密码与数据密钥永不落盘——设备丢失也无法读取。**生物锁**（Android Keystore 硬件密钥封装，可选）与**应用锁**（切后台回前台重新验证）提供三重解锁；纯网页 `file://` 自动降级为明文（无加密层）。**v1.0.1 加固**：运行时反篡改自检——注入 / hook 框架痕迹检测、核心层 `ShiNianCore` 完整性校验、调试器三重探针阻断。详见 [安全自审报告](./docs/SECURITY-AUDIT-v1.0.0.md)
- **加密备份（v1.1.0）**：备份新增「下载加密备份」——用主密码以 **AES-GCM-256** 加密导出（`.enc.json`），即使同步到云盘也不泄露；导入时输入同一主密码解密还原。与明文备份并存，部署版 / App 可用（`file://` 双击版无加密层自动隐藏该按钮）
- **网页端加密存储开关（v1.1.0）**：设置新增「加密存储」开关（默认关）——开启后用主密码加密本地存储（与移动端一致），并自动把现有明文数据迁为加密；移动端始终强制开启。仅部署版 / App 可见（`file://` 双击版无加密层自动隐藏）
- **免费安全审计（v1.1.0）**：接入 GitHub 原生三件套（CodeQL 语义扫描 / Secret Scanning + Push Protection / Dependabot）+ Gitleaks 密钥扫描 + Semgrep SAST + MobSF 安卓静态分析，全部接入 CI 与 Security 面板，仅报警不阻塞。详见 [SECURITY.md](./.github/SECURITY.md)

## 🚀 本地运行

无需安装任何东西：

1. 下载本仓库，**双击 `index.html`**（任意现代浏览器），全部功能开箱即用（v0.3.1 起城市列表已内联，`file://` 下 57 城照常可用）
2. 调试彩蛋：地址后加 `?t=HH:MM` 可模拟任意时刻的天空，例如 `index.html?t=18:30`（日落）、`?t=23:50`（深夜星空）；`?season=spring|summer|autumn|winter` 强制季节滤镜，`?decor=sakura|firefly|leaf|aurora|meteor` 强制季节彩蛋或流星

## 🌐 在线体验

| 站点 | 地址 | 说明 |
|---|---|---|
| **主站** | [shinian520.pages.dev](https://shinian520.pages.dev/) | 正式服务地址，**日常请使用这一个** |
| **备用副站**（镜像） | [xiaoyu-hue.github.io/shinian](https://xiaoyu-hue.github.io/shinian/) | GitHub Pages 自动部署，仅用于主站不可达时应急 |

> ⚠️ **两个站的数据不互通**：你的念想存在设备浏览器里，且**按网址分开存放**。
> 在主站记下的念想，打开备用站是看不到的（反之亦然）——这不是数据丢失，回到原来那个网址就能看到。
> 建议固定用主站，只在主站打不开时才临时用备用站。

## 🎨 设计语言：液态玻璃 × 四季 × 时刻

视觉主体延续自作者的[个人主站](https://xiaoyu-hue.github.io)液态玻璃体系，并升级为「流动」形态：

| 层 | 职责 | 状态 |
|---|---|---|
| 底层 · 时刻 | 七时段天空渐变，分钟级插值，锚点由真实日出日落驱动 | ✅ v0.2 |
| 叠加 · 天气 | 晴 / 阴 / 雨 / 雪 / 雾 / 雷 六类装饰层（雨丝、雪花、雾霭） | ✅ v0.2 |
| 中层 · 季节 | 春樱 / 夏青 / 秋琥珀 / 冬青灰 四套色调滤镜，以「四立」节气为切换点 | ✅ v0.5.0 |
| 顶层 · 夜间 | 星空常态 | ✅ v0.2 |
| 彩蛋 · 季节 | 春樱飘落 / 夏夜萤火虫 / 秋黄叶飘落 / 冬夜极光，随机触发 | ✅ v0.5.5 |
| 常驻 · 流星 | 四季夜间通用，间歇划过（40–90 秒一颗），空闲时零耗电 | ✅ v0.5.6 |
| 承载 · 玻璃 | 更薄、更透的液态玻璃信息卡 | ✅ v0.1 |

总工作量 7 + 4 + 2 = 13 组参数，覆盖 28 种「季节 × 时段」组合。

## 🙏 致敬开源与依赖

**《时念》站在开源社区的肩膀上。** 以下按重要程度致敬：

### 运行时依赖

| 依赖 | 用途 | 协议 |
|---|---|---|
| [Open-Meteo](https://open-meteo.com) | 免密钥免费天气 API（v0.2 已接入，含日出日落） | CC BY 4.0 |
| 系统字体栈（`'PingFang SC'`, `'Microsoft YaHei'`, `system-ui`） | 实际使用的字体——**未引入任何 Web 字体**（v0.7.2 修正：此前 README 误列 Noto Sans SC / Inter，二者并未被引用，当前为纯系统字体栈，零字体请求） | — |
| [lunar-javascript](https://github.com/6tail/lunar-javascript) | 二十四节气 / 农历计算（v0.5 接入，季节切换点以「四立」节气为准） | MIT |
| [@capacitor/android](https://capacitorjs.com) | 将网页封装为真实安卓 App（已集成，v0.6 真机化） | MIT |
| [@bytetrade/capacitor-native-biometric](https://github.com/Above-Os/capacitor-native-biometric) | 生物锁原生桥接（v1.0.0 接入，Android Keystore 硬件密钥封装 DEK，系统级指纹 / 面容验证；Web 端自动降级为密码解锁） | MIT |
| [@capacitor/local-notifications](https://capacitorjs.com) | 本地通知（v0.4 接入，喝水 / 倒数日提醒） | MIT |
| [@capacitor/splash-screen](https://capacitorjs.com) | 启动画面原生层（v0.6.0 接入，launchAutoHide:false + 深蓝背景，由 Web 开场覆盖层接棒） | MIT |
| [SunCalc](https://github.com/mourner/suncalc) | 太阳/月亮**高度角与方位角**、月相盈亏、月升月落、黄金时刻（v0.7.0 接入，已 vendored 至 `assets/suncalc.js`，BSD-2 许可头完整保留） | BSD-2-Clause |

### 开发 / 测试 / 构建依赖（不进入网页运行时）

| 依赖 | 用途 | 协议 |
|---|---|---|
| [jsdom](https://github.com/jsdom/jsdom) | 自动化测试环境（13 套共 211 项断言在无浏览器环境跑通：念想 / 提醒 / 自动刷新 / 开场 / 云彩 v3 / 日月 / 流星 / 倒数日表单校验 / 加密算法(crypto-vault) / 反篡改 RASP / 加密保险库 / 生物锁 / 加密备份） | MIT |
| [Node.js](https://nodejs.org) | 仅用于本地跑测试与发布脚本，网页本身不需要 | MIT |
| [Capacitor CLI / Android](https://capacitorjs.com) | 安卓 APK 构建链（`_cfg/build-apk.yml`，签名密钥走 GitHub Secrets） | MIT |
| [GitHub Actions](https://github.com/actions)（`actions/checkout`、`setup-node`、`setup-java`） | CI：自动构建与发布 | MIT |
| Gradle / Android SDK | APK 打包（由 CI 提供，不入库） | 各自协议 |
| [esbuild](https://esbuild.github.io) | 发布态打包（IIFE + `globalName=ShiNianCore` 编译 `src/`，生成 `www/` 加密层与混淆入口） | MIT |
| [javascript-obfuscator](https://obfuscator.io) | 发布态代码混淆（变量名混淆、字符串加密、控制流扁平化，`renameGlobals:false` 保留全局符号） | BSD-2-Clause |
| [TypeScript](https://www.typescriptlang.org/) | 新代码（`src/` 加密层与生物锁桥接）的类型检查与编译（不影响零构建的网页本体） | Apache-2.0 |

### 数据与标准

| 来源 | 用途 | 协议 / 说明 |
|---|---|---|
| [Open-Meteo](https://open-meteo.com) 天气数据 | 温度、天气码、日出日落 | CC BY 4.0 |
| WMO 4677 天气代码 | Open-Meteo 返回的天气码语义（晴 / 阴 / 雨 / 雪 / 雾 / 雷）映射 | 国际标准（WMO） |
| 城市坐标（57 个中国主要城市） | `cities.js` 内联城市列表 | **自整理**（公开地理坐标数据；内联以支持 `file://` 双击打开） |
| Web Crypto API（浏览器原生） | AES-GCM-256 加解密 + PBKDF2-SHA256 密钥派生（21 万轮，达 OWASP 量级）；不引入任何加密库 | W3C 标准 |
| OWASP MASVS v2.1 | 移动应用安全验证标准，B 系列安全自审基准（详见 [安全自审报告](./docs/SECURITY-AUDIT-v1.0.0.md)） | 开放标准（OWASP） |

**Vendored（随仓库分发，非 npm 依赖）**：`assets/lunar.js`（lunar-javascript，MIT）与 `assets/suncalc.js`（SunCalc，BSD-2）均为「零构建、双击即用」目标而随仓库分发，二者均**保留原始许可与归属头**。

**运行时零框架依赖**——不引入任何前端框架、不引入构建工具。v0.1 时期零网络请求；v0.2 起仅新增一个 Open-Meteo 天气请求（免密钥、不含任何个人信息），且失败时静默降级，不影响时钟与倒数日。

### 参考借鉴（v0.5.5 季节彩蛋 / v0.5.6 流星 / v0.5.9 许愿池）

四季彩蛋为**自研实现**，以下项目**并未被引入**（本仓库保持运行时零依赖），但它们的思路给了直接启发，一并致谢：

| 项目 | 借鉴点 |
|---|---|
| [natural-falling-effect](https://github.com/qtqz/natural-falling-effect) | 落花 / 落叶 / 下雨 / 下雪整合进同一套 canvas 粒子架构，并支持淡入淡出与定时关闭 |
| [minz71/sakura-rain](https://github.com/minz71/sakura-rain) | **delta time 驱动**（120Hz 高刷屏速度一致）、**HiDPI 适配**、尊重 `prefers-reduced-motion` |
| [chaerry-js](https://github.com/jhin102/chaerry-js) | 轻量零依赖的花瓣效果参数化组织（主题 / 风场 / 密度） |
| [auroraborealisj](https://github.com/auroraborealisj/auroraborealisj.github.io) | 单文件 canvas 极光，流动渐变波，无构建无依赖 |
| [spacebg](https://github.com/Anish-Reddy-K/spacebg) | 轻量星空 + 流星：渐变拖尾（trail）与光晕的绘制思路 |
| [noahziheng/starfield](https://github.com/noahziheng/starfield) | 随机流星的触发概率与最大并发数控制 |
| [Fumi-no（Happiness Jar）](https://github.com/lauslim12/fumi-no) | 每日一条本地记录 + 自带备份恢复 + 隐私优先的理念，与许愿池「本地清单」定位一致 |
| [wallwish 许愿墙](https://github.com/hiszm/wallwish) | CRUD + 事件委托 + 删除二次确认等工程细节 |
| [Android SplashScreen API](https://developer.android.com/develop/ui/views/launch/splash-screen) | v0.6.0 启动画面「双层接棒」架构的第 0 层：系统免费提供的冷启动图标占位，避免白屏 |

> **为什么自研而不直接引入**：本项目为**零构建**结构（无打包器，`index.html` 双击即用）；且这些库不会适配本仓库已有的降级钩子（`data-no-motion` / `data-low-perf` / `data-no-decor`）与「雨雪天气抑制飘落彩蛋」的天气层共存规则。

### 参考借鉴（v0.6.5 云彩体系初版 · v0.6.6 深度优化）

v0.6.5 首版云彩采用「柔边圆堆叠」，v0.7.0 已换核为 fBm 噪声场，但下列来源曾给过直接启发，一并致谢（**均未被引入**）：

| 项目 / 来源 | 借鉴点 |
|---|---|
| [Cloudgen.js](https://github.com/avinashbot/Cloudgen.js) | 柔边圆堆叠生成云形的思路（v0.6.5 渲染内核参考；v0.7.0 因其"天然抱团"的 metaball 特性而换核） |
| [kevinbadi/claude-motion-skills · javascript-animation-skills](https://github.com/kevinbadi/claude-motion-skills) | 零素材 canvas 逐帧动画工艺 |
| [anthropics/skills · canvas-design](https://github.com/anthropics/skills) | Canvas 2D / SVG / WebGL 选型与动画循环模式 |
| Perlin / Simplex 噪声（多家公开实现） | 噪声驱动漂移以避免机械直线（v0.7.0 改为自研 value noise + fBm） |
| Three.js 体积云方案 | **评估后排除**：需 WebGL 与 3D 噪声贴图，违反本项目零依赖与移动端性能约束 |

### 参考借鉴（v0.7 天穹重构：云彩引擎 v3 + 日月体系）

v0.7 的云与日月同样为**自研实现**，下列项目**未被引入**（保持运行时零依赖），但其思路与工艺给了直接启发，一并致谢：

| 项目 / 来源 | 借鉴点 |
|---|---|
| **Inigo Quilez · Domain Warping / fBm** | 云形态的核心数学模型：`fbm(p + fbm(p))` 域翘曲产生有机形态，`smoothstep` 密度阈值清出「云之间的蓝天」——这是根治「云聚成一坨」的关键 |
| [Cloud Sky（originkit）](https://www.originkit.dev/components/cloud-sky) | 网格放置且多数格子留空、积云「中心以上更高以下更平」的平底、双层 fBm 侵蚀（粗层裂片 / 细层丝缕）、自阴影、远层向天空色混合的雾霭感 |
| [MiniMax-AI/skills · procedural-noise](https://github.com/MiniMax-AI/skills) | hash → value noise → fBm → 域翘曲 的系统化工艺参考（含公式与逐步实现） |
| [NousResearch/hermes-agent · p5js skill](https://github.com/NousResearch/hermes-agent) | 逐像素 fBm 的**性能预算表**，用于校准本项目低分辨率云场的目标开销 |
| [kevinbadi/claude-motion-skills](https://github.com/kevinbadi/claude-motion-skills) | 「渲染 → 截图 → 自检」的交付闭环（本项目据此建立了出图目视验证环节） |
| [mourner/suncalc](https://github.com/mourner/suncalc) | 日月位置算法（基于 Jean Meeus《Astronomical Algorithms》），东升西落轨迹与月相盈亏的来源 |
| [MDN · Optimizing canvas](https://developer.mozilla.org/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) | 离屏预渲染、整数坐标、低分辨率放大等性能守则 |

> **火烧云的物理依据**：低角度阳光穿过厚大气层后蓝光被散射，剩余红橙光自下方/侧面打在云底，形成「云底橙红 → 中部粉 → 顶部紫蓝」的高度渐变；薄云迎光边缘因强光穿透而发亮（银边效应 / silver lining）。本项目的着色逻辑据此建立。

### 深深致敬

- **[Open-Meteo](https://open-meteo.com) 团队**：让「没有服务器的个人开发者」也能做天气产品，本项目的零后端路线因你们而成立
- **[6tail / lunar-javascript](https://github.com/6tail/lunar-javascript)**：把二十四节气算得清清楚楚，「四季的中文逻辑」得以落地
- **[Ionic / Capacitor](https://capacitorjs.com) 团队**：给网页开发者留了一扇通往真机的大门
- **[Vladimir Agafonkin / SunCalc](https://github.com/mourner/suncalc) 与 Inigo Quilez**：前者让「日月该在天上哪个位置」变成几行代码，后者让「云该长什么样」有据可依——v0.7 的天穹由此成立
- **[霞鹜文楷 LXGW WenKai](https://github.com/lxgw/LxgwWenKai) 与 [中文网字计划](https://github.com/Konghayao/cn-font-split)**：姊妹项目主站在用，中文字体网页化的铺路人
- **每一位为设计系统、无障碍实践与 Web 平台原生能力（CSS 自定义属性、prefers-reduced-motion、backdrop-filter）撰写文档的人**
- **[OWASP](https://owasp.org) 与 Web Crypto 社区**：加密实现的工程实践来源——PBKDF2 迭代强度、AES-GCM 使用范式、MASVS 自审框架，让「本地加密保险库」有据可依

如果本项目对你有启发，欢迎按各自协议引用——这也正是开源的本意。

## 🔒 数据与隐私

- 所有用户数据（倒数日 / 许愿池条目）**仅存储在你的设备本地**
- 不采集、不上传、不同步任何信息
- v0.2 起的天气查询采用**手动选择城市**方式，不申请定位权限

## 📄 License

本项目采用双许可证：

- **代码**（`*.html`、`*.css`、`*.js` 等）使用 [MIT](./LICENSE) 许可证
- **文档**（`docs/` 目录、`README.md`）使用 [CC BY-NC-SA 4.0](./LICENSE-DOCS) 许可证——可自由分享与演绎，但禁止商用，且需署名并以相同方式共享

© 2026 xiaoyu-hue

> 「时念」——时间之内，念想之上。
