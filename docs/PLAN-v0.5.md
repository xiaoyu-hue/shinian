# 实施计划 · v0.5 季节层 + 节气 + 冬夜极光

> 文档版本：v0.5.0-draft · 关联：[PRD](./PRD.md)（路线 v0.5）、[CHANGELOG](../CHANGELOG.md)（版本规范）
> 状态：方案已定，待逐步入库实现

## 0. 目标与范围

- 新增能力维度（升次版本 **v0.5**）：
  1. **季节层**：春樱 / 夏青 / 秋琥珀 / 冬青灰 四套色调滤镜，轻量叠加于天空。
  2. **节气切换**：季节以「二十四节气」的「四立」（立春 / 立夏 / 立秋 / 立冬）为切换点，**非**公历季度。
  3. **冬夜极光彩蛋**：冬季深夜自动呈现流动极光装饰层。
- 约束：不改 `localStorage` 数据结构；不新增打包器 / 框架（保持零构建）；接入既有降级与无障碍钩子。
- 真机实测：与 v0.4 一致，本次纯代码开发，真机视觉验收留待 B 阶段。

## 1. 调研结论（2026-10-05，实证）

| 项目 | 结论 |
|---|---|
| lunar-javascript | 纯 JS、零依赖、MIT；24 节气用真实天文算法（太阳黄经）。PRD 已纳入 v0.5 依赖。提供浏览器全局 `Lunar` / `Solar`（需 vendor 其 dist；**第一天先用小测确认全局名与「取当年四立日期」API，不猜**） |
| 极光实现对比 | 纯 CSS：合成线程跑、零每帧 JS、低端机 60fps，但视觉上限有限；Canvas：更逼真流动，但需每帧绘制、有性能 / 耗电代价。**决策：Canvas + 既有降级钩子自动关停**（见 §3③），兼顾「最美观」与「最适配」 |
| 季节过渡 | 用 `@property` 注册季节染色的 CSS 变量，使跨季切换可被 CSS `transition` 平滑过渡；不支持 `@property` 的浏览器回退为瞬时切换（仍正确） |

## 2. 现状与接入点（已读 `assets/sky.js` 8KB 核实）

- `paint()`：按 24h 的 10 个锚点插值出 `top / bottom / glow / stars / name`，写入 CSS 变量 `--sky-top / --sky-bottom / --sky-glow / --stars-o / --phase-name`，并据亮度设 `data-recipe`（玻璃配方）。
- **接入点 A（季节滤镜）**：在 `paint()` 写入 CSS 变量**之前**，对插值出的 `top / bottom / glow` 施加季节调色，再 `setProperty`。
- **接入点 B（极光）**：`index.html` 已有 `#stars` 夜空层；极光作为其上（或下）的装饰层，由「季节 = 冬 + 夜段 + 非减弱动态」控制显隐。
- 既有钩子：`data-no-motion`（减弱动态）、`data-low-perf`（低帧率降级）、`prefers-reduced-motion` —— 极光与过渡都必须尊重。

## 3. 技术选型与理由（已与用户拍板）

### ① 节气 / 农历库：vendor `lunar-javascript` 浏览器包

- 集成：拷贝 dist 到 `assets/lunar.js`，`<script>` 引入（同 `assets/plugins/local-notifications.js` 思路，零构建）。
- 季节判定：`current()` 取当年四立精确日期 → 比对今天 → 春 / 夏 / 秋 / 冬（含起点）。
- 降级：库未加载 / 异常 → 回退公历月份近似（3–5 春 / 6–8 夏 / 9–10 秋 / 11–2 冬）。

### ② 季节滤镜：独立 `assets/season.js` + `paint()` 调用

- 接口：`window.ShiNianSeason.current()` → 季节；`window.ShiNianSeason.filter(top, bottom, glow, season)` → 调色后色值（纯函数，可单测）。
- `paint()` 增加：

  ```js
  if (window.ShiNianSeason) {
    var season = window.ShiNianSeason.current();
    root.setProperty('--season', season);            // 供过渡 / 极光读取
    var f = window.ShiNianSeason.filter(top, bottom, glow, season);
    top = f.top; bottom = f.bottom; glow = f.glow;
  }
  ```

- 滤镜实现（轻量）：每季一个染 target + 低 α（≈0.14）混合；冬额外降饱和偏冷灰。**不改原有 7 段锚点配色**，安全可回退。
- 四套染 target（向基础天空色混合的目标色）：
  - 春（樱）`#f2c2d6` · 夏（青）`#bfeae3` · 秋（琥珀）`#eab46a` · 冬（青灰）`#aebfce`

### ③ 冬夜极光：**Canvas + 既有降级钩子自动关停**（用户拍板：最美观且最适配）

- 实现：`assets/aurora.js` 用 `<canvas>` 绘制 3–5 条流动光带（多层正弦叠加 + 绿 / 青 / 紫渐变 + 顶部柔光），`requestAnimationFrame` 驱动。
- 显隐：仅当 `data-season=winter` 且当前为夜段（`--stars-o`≈1）时启动 rAF 循环；`data-no-motion` 或 `data-low-perf` 时停止循环（释放 CPU / GPU）。
- **最适配保障**：本项目 `data-low-perf` 由帧率监测在持续 <30fps 时置位 → 极光自动关停，不会拖垮整体体验；此即「最优 / 最适配」的安全网。
- 兜底：若后续真机发现耗电不可接受，可一行切换到纯 CSS 极光层（结构已预留 `.aurora` 容器）。

### ④ 季节切换过渡（用户拍板：加过渡）

- `@property --season-tint` 注册为 `<color>`，`season.js` 写入当季染值，`sky.js` 用其做混合；CSS `transition: --season-tint 2.4s ease` 实现跨季平滑。
- 不支持 `@property` 的浏览器：自动回退瞬时切换（行为正确，仅无动画）。

## 4. 分步交付（每步可单独回归）

| 步 | 内容 | 验证 |
|---|---|---|
| **S1** | vendor `assets/lunar.js`；`season.js` 实现 `current()`（四立判定 + 公历回退）；小测确认全局 API | 四季节点日期单测通过；缺失库时回退正确 |
| **S2** | `filter()` 四套调色板接入 `paint()`；`@property --season-tint` + 过渡；调参到「可感知不喧宾」 | 滤镜后玻璃字 WCAG AA 仍达标；跨季过渡平滑 |
| **S3** | `assets/aurora.js` Canvas 极光 + 显隐 / 降级钩子 + `?aurora=1` 调试 | `data-no-motion` / `data-low-perf` 正确关停；冬夜叠加自然 |
| **S4** | 文档与发布：PRD（v0.5 ✅）/ CHANGELOG（v0.5.0 行 + 明细）/ README（设计表 季节层、夜间层极光 状态更新） | 文档与代码一致 |
| **S5（留待真机）** | 安卓 APK 真机视觉验收（极光性能 / 耗电、季节手感） | B 阶段，本次纯代码 |

## 5. 风险与权衡

- 季节强度是红线：低 α 混合 + 可关，避免「滤镜 App」。
- lunar-javascript API 待小测确认（S1 第一步），不阻塞。
- Canvas 极光有耗电代价：由 `data-low-perf` 安全网兜底；真机若不可接受，一行切纯 CSS。
- 节气边界（立春当天算春 / 冬）：按「含起点」处理，注释写明。

## 6. 验收标准（AC）

- **AC1**：四立当天及区间内，天空染色正确切换为当季色调，过渡平滑（支持 `@property` 浏览器）。
- **AC2**：无网络 / 库缺失时，季节回退公历近似，不白屏、不报错。
- **AC3**：冬季深夜出现极光；`data-no-motion` 或低帧率下极光自动关闭，页面其余功能帧率不受影响。
- **AC4**：季节滤镜后，玻璃卡文字对比度全程 ≥ WCAG AA。
- **AC5**：纯网页（`file://` / Pages）下季节与极光逻辑照常运行（极光在网页也可见，仅原生 App 有系统通知）。
