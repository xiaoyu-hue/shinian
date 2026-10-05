# 时念 · v0.5.5 实施计划：季节彩蛋系列

> 版本：**v0.5.5**　状态：待开工（计划已确认）
> 上游依赖：v0.5.0 季节层（已完成，提供 `data-season` 季节判定与季节染色）

---

## 一、目标与范围

把"季节层"从**色调滤镜**升级为**有生命力的季节叙事**：在正确季节，天空随机浮现一次应景的彩蛋装饰。

| 季节 | 彩蛋 | 视觉描述 | 时段 |
|---|---|---|---|
| 春 | 樱花飘落 | 粉色花瓣旋转飘落，带风场摆动 | 白天 / 黄昏 |
| 夏 | 萤火虫 | 夜空中光点随机游走，呼吸式明灭 | 夜间 |
| 秋 | 黄叶飘落 | 琥珀色叶片翻转飘落，色泽渐变 | 白天 / 黄昏 |
| 冬 | 极光 | 夜空流动渐变光波，缓慢漂移 | 夜间 |

**不在本版范围**：彩蛋音效、交互（点击花瓣）、第五种彩蛋、天气层重构。

---

## 二、已确认的产品规则

| 规则 | 决策 |
|---|---|
| **触发机制** | 概率触发 + 短时持续：每次进入页面按概率（默认 30%）触发一次，持续 20–40 秒后淡出；同一会话内设冷却，避免频繁打扰 |
| **时段限制** | 樱花、黄叶限**白天与黄昏**（约 07:00–19:00，夜间不可见故不触发）；萤火虫、极光限**夜间** |
| **与天气共存** | 当 `data-weather` 为 `rain` / `drizzle` / `snow` / `thunderstorm` 时，**抑制飘落类彩蛋**（樱花、黄叶），避免与天气雨雪层视觉打架；萤火虫、极光不受影响 |
| **用户开关** | 设置面板新增「季节彩蛋」开关，**默认开启**；关闭后所有彩蛋不再触发 |

---

## 三、开源调研结论

| 参考项目 | 可借鉴点 |
|---|---|
| [natural-falling-effect](https://github.com/qtqz/natural-falling-effect) | 整合落花/落叶/下雨/下雪四季的 canvas 粒子架构；支持淡入淡出与定时关闭 |
| [minz71/sakura-rain](https://github.com/minz71/sakura-rain) | **delta time 驱动**（120Hz 高刷屏速度一致）、**HiDPI 适配**、尊重 `prefers-reduced-motion` |
| [chaerry-js](https://github.com/jhin102/chaerry-js) | 轻量零依赖，主题同时含 cherry 与 autumn |
| [auroraborealisj](https://github.com/auroraborealisj/auroraborealisj.github.io) | 单文件 canvas 极光，流动渐变波，无构建无依赖 |

**选型：参考算法思路，自研实现（零依赖）**。理由：
1. 本项目为**零构建、零运行时依赖**；上述库多数需 bundler 或引入较大体积；
2. 第三方库不会适配本项目已有的三个降级钩子（`data-no-motion` / `data-low-perf` / `data-no-decor`）；
3. 第三方库不知道天气雨雪层存在，无法实现"雨雪抑制飘落彩蛋"规则；
4. 四季彩蛋共享 canvas、生命周期与降级策略，自研约 500 行即可，比引入四个库更省体积、更可控。

---

## 四、现状与接入点（已读代码核实）

| 项 | 现状 |
|---|---|
| DOM 结构 | `.sky`（`z-index:-1`，fixed 全屏）内含 `.orb-a`、`.orb-b`、`#stars`；同级另有 `#rainCanvas`、`#snowCanvas`（天气雨雪层，同样 `z-index:-1`） |
| 季节判定 | ✅ v0.5.0 已落地：`sky.js` 的 `paint()` 写入 `data-season`（spring/summer/autumn/winter） |
| 夜段判定 | ✅ `--stars-o`（夜≈1、昼≈0）与时刻 `nowHours()` 可复用 |
| 减弱动态 | ✅ `data-no-motion`（设置项 `settings.motion` 驱动；CSS 已有 `:root[data-no-motion] .stars i` 规则） |
| 低帧率降级 | ✅ `data-low-perf`（`app.js` 采样 FPS，**连续 3 个采样窗口**低于阈值才置位，误判风险低） |
| 装饰开关 | ✅ `data-no-decor`（现有，控制雨雪层显隐） |
| 天气状态 | ✅ `data-weather`（rain / drizzle / snow / thunderstorm 等） |

**彩蛋层挂载点**：在 `.sky` 内、`#stars` 之后新增
`<canvas class="decor-canvas" id="decorCanvas" aria-hidden="true"></canvas>`
——位于星空之上、内容层（z-index 10+）之下。

---

## 五、架构设计

单一模块 `assets/decor.js`，暴露 `window.ShiNianDecor`：

```
ShiNianDecor
├── effects          效果注册表：{ spring: sakura, summer: firefly,
│                                 autumn: leaf,   winter: aurora }
│                    每个效果器实现 init(ctx,w,h) / draw(ctx,dt,t) / destroy()
├── maybeTrigger()   概率触发：按季节取效果器 + 校验时段/天气/降级 → start()
├── start() / stop() 生命周期：淡入 → 持续 20–40s → 淡出 → 释放粒子
├── 降级守卫         data-no-motion / data-low-perf / 设置开关 / 页面不可见
└── 调试             ?decor=sakura|firefly|leaf|aurora|off 强制效果或关闭
```

**共用能力**（四个效果共享，不重复实现）：
- delta time 驱动（保证高刷屏速度一致）
- HiDPI 适配（`devicePixelRatio` **上限 2**，避免 3x 屏过度绘制）
- 淡入淡出（避免突兀出现/消失）
- 生命周期与冷却（防止频繁触发）

---

## 六、分步交付（每步可独立验证）

| 步 | 内容 | 验证点 |
|---|---|---|
| **S1** | `decor.js` 骨架 + **春樱**效果 + 设置开关 + 调试参数 | 架构跑通：概率触发、时段/天气/降级守卫生效、`?decor=sakura` 可强制、开关可关 |
| **S2** | **夏 · 萤火虫**（随机游走 + 呼吸明灭） | 仅夜段触发；游走自然不机械；帧率达标 |
| **S3** | **秋 · 黄叶**（翻转 + 色泽渐变） | 与樱花视觉区分明显，不雷同 |
| **S4** | **冬 · 极光**（流动渐变波） | 叠加夜空自然；`data-low-perf` 下自动关停 |
| **S5** | 文档同步（PRD / CHANGELOG / README）+ 打 `v0.5.5` 标签与 Release | 文档与代码一致 |

---

## 七、性能与降级策略

| 风险 | 缓解措施 |
|---|---|
| Canvas 每帧动画与项目"低重绘"基调冲突 | 仅彩蛋激活期间绘制；结束即停；页面不可见（`visibilitychange`）暂停 |
| 高刷/高分屏过度绘制 | delta time 驱动 + DPR 上限 2 |
| 低端机掉帧 | 粒子数保守（樱花 ~30 / 黄叶 ~25 / 萤火虫 ~20 / 极光 4–6 条光带）；`data-low-perf` 置位时**整层关停** |
| 彩蛋喧宾夺主 | 低透明度、短时持续（20–40s）、绝不覆盖时钟与念想内容 |

---

## 八、验收标准

1. 四个彩蛋在对应季节可触发，视觉符合描述且**不遮挡主内容**；
2. 时段、天气、降级三条守卫规则行为正确（可用调试参数逐项验证）；
3. 设置开关可完全关闭彩蛋；
4. `node --check` 通过；关键逻辑（触发判定、时段/天气守卫）有单测覆盖；
5. 桌面浏览器实机验收通过；**安卓真机性能验收留待后续 B 阶段**（v0.4 遗留项，彩蛋更吃 GPU，真机验证必要性更高）。

---

## 九、风险登记

| 风险 | 说明 |
|---|---|
| 真机性能未验 | v0.4 起遗留；彩蛋为动画，真机掉帧风险高于静态天空，需 B 阶段补验 |
| 极光视觉上限 | Canvas 2D 极光逼真度低于 WebGL；当前选择 2D 以控性能与体积 |
| 随机性导致复现困难 | 已提供 `?decor=` 强制参数，保证调试可复现 |
| 樱花与黄叶易雷同 | S3 需通过形状（花瓣 vs 叶片）、翻转方式、色泽变化做出区分 |
