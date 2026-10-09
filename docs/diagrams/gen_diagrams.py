#!/usr/bin/env python3
# 生成 ARCHITECTURE.md 引用的 5 张 SVG 架构图（替代 Mermaid，确保 GitHub 100% 渲染）。
# 用法：python3 docs/diagrams/gen_diagrams.py（产物写入本目录）
# 依赖：仅标准库。改图后重跑即可，无需第三方库。
# -*- coding: utf-8 -*-
"""生成时念架构文档的 5 张 SVG 图（替代 Mermaid，确保 GitHub 100% 渲染）。"""
import os, html

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(OUT, exist_ok=True)
FONT = "'PingFang SC','Microsoft YaHei','Noto Sans CJK SC','Hiragino Sans GB',sans-serif"

def esc(s): return html.escape(str(s), quote=True)
def bg(W, H): return f'<rect x="0" y="0" width="{W}" height="{H}" fill="#ffffff"/>'
def rrect(x, y, w, h, r, fill, stroke="#cbd5e1", sw=1.5, opacity=1.0):
    return (f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{r}" ry="{r}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}" opacity="{opacity}"/>')
def txt(x, y, s, size=13, color="#0f172a", bold=False, anchor="start"):
    w = "700" if bold else "400"
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{w}" fill="{color}" '
            f'text-anchor="{anchor}" font-family="{FONT}">{esc(s)}</text>')
def arrow(x1, y1, x2, y2, color="#475569", dash=False, marker="arrow"):
    d = ' stroke-dasharray="6 4"' if dash else ''
    return (f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{color}" '
            f'stroke-width="1.8"{d} marker-end="url(#{marker})"/>')
def curve(x1, y1, x2, y2, cy, color="#475569", marker="arrow"):
    d = f"M{x1:.1f},{y1:.1f} C {x1:.1f},{cy:.1f} {x2:.1f},{cy:.1f} {x2:.1f},{y2:.1f}"
    return (f'<path d="{d}" fill="none" stroke="{color}" stroke-width="1.8" marker-end="url(#{marker})"/>')
def polyarrow(pts, color="#475569", marker="arrow"):
    d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    return (f'<path d="{d}" fill="none" stroke="{color}" stroke-width="1.8" marker-end="url(#{marker})"/>')
def defs():
    return ('<defs>'
            '<marker id="arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
            '<path d="M0,0 L10,5 L0,10 z" fill="#475569"/></marker>'
            '<marker id="arrowR" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
            '<path d="M0,0 L10,5 L0,10 z" fill="#ef4444"/></marker>'
            '<marker id="arrowG" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
            '<path d="M0,0 L10,5 L0,10 z" fill="#10b981"/></marker>'
            '<marker id="arrowA" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
            '<path d="M0,0 L10,5 L0,10 z" fill="#f59e0b"/></marker>'
            '</defs>')
def node(cx, cy, w, h, lines, accent="#3b82f6", fs=12):
    s = rrect(cx-w/2, cy-h/2, w, h, 8, "#ffffff", accent, 1.6)
    n = len(lines)
    for i, ln in enumerate(lines):
        ty = cy - (n-1)*fs*1.28/2 + i*fs*1.28 + fs*0.35
        s += txt(cx, ty, ln, size=fs, bold=(i == 0), anchor="middle",
                 color=accent if i == 0 else "#334155")
    return s
def save(name, W, H, body):
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">\n'
           f'{bg(W,H)}\n{defs()}\n{body}\n</svg>\n')
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(svg)
    print("wrote", name)

# ───────────────────────── D1 分层架构 ─────────────────────────
def d1():
    W, H = 1200, 660
    bands = [
        ("视觉引擎层", "Visual Engine", "#8b5cf6", "#ede9fe",
         ["sky.js", "clouds.js", "sunmoon.js", "decor.js", "intro.js", "season.js", "weather.js"]),
        ("业务层", "Business", "#3b82f6", "#dbeafe",
         ["boot 启动编排", "Store 双通道", "VaultCtl 守卫", "业务 UI"]),
        ("安全核心层", "Security Core", "#ef4444", "#fee2e2",
         ["index.ts", "crypto-vault", "secure-store", "biometric", "anti-tamper"]),
        ("数据层", "Data", "#10b981", "#d1fae5", ["localStorage", "Android Keystore"]),
        ("平台层", "Platform", "#f59e0b", "#fef3c7", ["Capacitor 6", "Native 插件"]),
    ]
    x0, band_w, bh, gap, top = 20, 860, 96, 14, 70
    body = ""
    yb = []
    for i, (cn, en, col, tint, chips) in enumerate(bands):
        y = top + i*(bh+gap)
        yb.append(y)
        body += rrect(x0, y, band_w, bh, 10, tint, col, 1.8)
        body += rrect(x0, y, 8, bh, 4, col, col, 1.8)
        body += txt(x0+24, y+30, cn, size=16, bold=True, color=col)
        body += txt(x0+24, y+50, en, size=11, color="#475569")
        area_x, area_w = x0+170, band_w-190
        n = len(chips)
        cw = min(130, (area_w-(n-1)*10)/n)
        total = n*cw+(n-1)*10
        sx = area_x+(area_w-total)/2
        cy = y+bh/2
        for j, c in enumerate(chips):
            cx = sx+j*(cw+10)+cw/2
            body += rrect(cx-cw/2, cy-16, cw, 32, 7, "#ffffff", col, 1.3)
            body += txt(cx, cy+5, c, size=11.5, bold=True, anchor="middle", color="#1e293b")
    # 依赖箭头（右侧 rail：主干 x=900，平台 x=1015/1055，标签错列避免穿线/重叠）
    deps = [
        (0, 1, "CSS 变量 / 事件", 900, 909, 173),
        (1, 2, "Store 调用", 900, 909, 283),
        (2, 3, "crypto.subtle", 900, 909, 402),
        (1, 4, "isNativePlatform", 1015, 1024, 372),
        (2, 4, "原生加密 / 生物", 1055, 1064, 452),
    ]
    for si, ti, label, rx, lx, ly in deps:
        y1 = yb[si]+bh-6
        y2 = yb[ti]+6
        body += arrow(rx, y1, rx, y2)
        body += txt(lx, ly+4, label, size=10.5, color="#475569")
    body += txt(x0, top-26, "图 3-1  时念系统分层架构（自上而下为依赖方向：上层依赖下层）", size=14, bold=True)
    save("architecture-layers.svg", W, H, body)

# ───────────────────────── D2 构建管线 ─────────────────────────
def d2():
    W, H = 1060, 700
    A = (500, 110, 200, 60, ["index.html", "(dev 模板)"], "#64748b")
    B = (230, 275, 210, 66, ["按序拼接", "12 个 assets/*.js"], "#0ea5e9")
    D = (790, 275, 190, 60, ["src/index.ts"], "#6366f1")
    C = (230, 435, 210, 66, ["www/assets/", "bundle.min.js", "(minify)"], "#0ea5e9")
    E = (790, 435, 210, 66, ["www/assets/", "shinian-core.min.js", "(IIFE)"], "#6366f1")
    F = (430, 575, 200, 56, ["混淆后 bundle"], "#f97316")
    G = (790, 575, 200, 56, ["混淆后 core"], "#f97316")
    HN = (430, 668, 220, 52, ["www/index.html"], "#10b981")
    body = ""
    for nd in (A, B, D, C, E, F, G, HN):
        body += node(*nd)
    # 主干边
    body += arrow(A[0]-40, A[1]+A[3]/2, B[0]+B[2]/2-30, B[1]-B[3]/2)
    body += txt((A[0]+B[0])/2, A[1]+A[3]/2+22, "读取 script 顺序", size=10.5, anchor="middle", color="#475569")
    body += arrow(A[0]+40, A[1]+A[3]/2, D[0]-D[2]/2+30, D[1]-D[3]/2)
    body += txt((A[0]+D[0])/2, A[1]+A[3]/2+22, "TypeScript 源", size=10.5, anchor="middle", color="#475569")
    body += arrow(B[0], B[1]+B[3]/2, C[0], C[1]-C[3]/2)
    body += txt(B[0]+12, (B[1]+C[1])/2+4, "esbuild transform", size=10.5, color="#475569")
    body += arrow(D[0], D[1]+D[3]/2, E[0], E[1]-E[3]/2)
    body += txt(D[0]+12, (D[1]+E[1])/2+4, "esbuild build (IIFE)", size=10.5, color="#475569")
    body += arrow(C[0], C[1]+C[3]/2, F[0]-F[2]/2+20, F[1]-F[3]/2)
    body += txt((C[0]+F[0])/2, (C[1]+F[1])/2, "obfuscator", size=10.5, anchor="middle", color="#475569")
    body += arrow(E[0], E[1]+E[3]/2, G[0], G[1]-G[3]/2)
    body += txt(E[0]+12, (E[1]+G[1])/2+4, "obfuscator", size=10.5, color="#475569")
    body += arrow(F[0], F[1]+F[3]/2, HN[0], HN[1]-HN[3]/2)
    body += arrow(G[0]-60, G[1]+G[3]/2, HN[0]+HN[2]/2-30, HN[1]-HN[3]/2+6)
    # A → www/index.html：右侧正交绕行，避免穿越中部节点
    body += polyarrow([(A[0]+A[2]/2, A[1]-6), (1000, A[1]-6), (1000, HN[1]), (HN[0]+HN[2]/2, HN[1])])
    body += txt(620, A[1]+2, "正则替换 / 注入版本号", size=10.5, color="#475569")
    # 体积参考
    body += txt(C[0], C[1]+C[3]/2+16, "体积 603KB→433KB→2.07MB", size=10, anchor="middle", color="#94a3b8")
    body += txt(E[0], E[1]+E[3]/2+16, "体积 11.4KB→56.9KB", size=10, anchor="middle", color="#94a3b8")
    body += txt(20, 40, "图 5-2  发布态构建管线（npm run build:release）", size=14, bold=True)
    save("build-pipeline.svg", W, H, body)

# ───────────────────────── D3 启动时序 ─────────────────────────
def d3():
    W, H = 1050, 800
    P = ["用户 U", "index.html H", "ShiNianCore S", "app.js A", "VaultCtl V"]
    px = [90, 250, 410, 570, 730]
    bot_y = 765
    body = ""
    for i, name in enumerate(P):
        x = px[i]
        body += rrect(x-55, 30, 110, 44, 8, "#1e293b" if i else "#0f766e", "#1e293b", 1.5)
        body += txt(x, 58, name, size=12.5, bold=True, anchor="middle", color="#ffffff")
        body += f'<line x1="{x}" y1="74" x2="{x}" y2="{bot_y}" stroke="#94a3b8" stroke-width="1.4" stroke-dasharray="4 4"/>'
    msgs = [
        (0, 1, "打开页面", "msg"),
        (1, 2, "shinian-core.min.js (defer)", "msg"),
        (1, 3, "bundle.min.js (defer)", "msg"),
        (3, 3, "DOMContentLoaded → startupSequence()", "self"),
        (3, 3, "initSplash() 播开场动画 ≈2.7s", "self"),
        (3, 3, "boot() 业务初始化（并行）", "self"),
        (3, 4, "动画收尾 → vaultGate()", "msg"),
        (4, 4, "file://：booted=true 直接进主界面", "self"),
        (4, 0, "移动端(Capacitor)：强制弹 setup/unlock", "msg"),
        (4, 4, "网页版：读 shinian.enc.enabled；='1' 才弹框", "self"),
        (0, 4, "输入主密码 / 生物验证", "msg"),
        (4, 3, "onSuccess() → boot()（若未 boot）", "msg"),
    ]
    y = 120
    step = 50
    for src, dst, label, kind in msgs:
        if kind == "self":
            x = px[src]
            body += (f'<path d="M{x+50},{y} h30 v18 h-30" fill="none" stroke="#475569" '
                     f'stroke-width="1.6" marker-end="url(#arrow)"/>')
            body += txt(x+56, y-6, label, size=10.5, color="#334155")
        else:
            x1, x2 = px[src], px[dst]
            body += arrow(x1+(28 if x1 < x2 else -28), y, x2+(-28 if x1 < x2 else 28), y)
            body += txt((x1+x2)/2, y-6, label, size=10.5, anchor="middle", color="#334155")
        y += step
    body += txt(px[4]-130, 462, "alt", size=12, bold=True, color="#ef4444")
    body += txt(px[3]-115, 322, "par", size=11, bold=True, color="#ef4444")
    body += txt(20, 30, "图 6-1  启动时序（defer 加载 → startupSequence → 解锁守卫）", size=14, bold=True)
    save("startup-sequence.svg", W, H, body)

# ───────────────────────── D4 双通道存储 ─────────────────────────
def d4():
    W, H = 940, 580
    body = ""
    N1 = (110, 120, 180, 56, ["app.js 业务代码"], "#64748b")
    N2 = (110, 250, 180, 56, ["Store.get / Store.set"], "#0ea5e9")
    Dc = (110, 380, 200, 66, ["判断", "window.ShiNianCore", ".secureStore.isReady()?"], "#a855f7")
    E = (540, 330, 240, 84, ["加密态（SecureStore）", "内存 cache 同步读写", "→ 队列化异步加密落盘"], "#ef4444")
    P = (540, 475, 240, 64, ["明文态", "localStorage 直接 JSON"], "#10b981")
    LSE = (850, 330, 180, 70, ["localStorage", "key + '__enc'"], "#ef4444")
    LSP = (850, 475, 180, 64, ["localStorage", "key"], "#10b981")
    for nd in (N1, N2, Dc, E, P, LSE, LSP):
        body += node(*nd)
    body += arrow(N1[0], N1[1]+N1[3]/2, N2[0], N2[1]+N2[3]/2)
    body += arrow(N2[0], N2[1]+N2[3]/2, Dc[0], Dc[1]+Dc[3]/2)
    body += arrow(Dc[0]+Dc[2]/2, Dc[1]-8, E[0]-E[2]/2, E[1]+E[3]/2, color="#ef4444", marker="arrowR")
    body += txt((Dc[0]+Dc[2]/2+E[0]-E[2]/2)/2, Dc[1]-14, "是（加密态）", size=10.5, anchor="middle", color="#ef4444")
    body += arrow(Dc[0]+Dc[2]/2, Dc[1]+8, P[0]-P[2]/2, P[1]+P[3]/2, color="#10b981", marker="arrowG")
    body += txt((Dc[0]+Dc[2]/2+P[0]-P[2]/2)/2, Dc[1]+Dc[3]/2+2, "否（明文态）", size=10.5, anchor="middle", color="#10b981")
    body += arrow(E[0]+E[2]/2, E[1]+E[3]/2, LSE[0]-LSE[2]/2, LSE[1]+LSE[3]/2, color="#ef4444", marker="arrowR")
    body += arrow(P[0]+P[2]/2, P[1]+P[3]/2, LSP[0]-LSP[2]/2, LSP[1]+LSP[3]/2, color="#10b981", marker="arrowG")
    body += txt(20, 40, "图 6-3  数据存储双通道（加密态 / 明文态）", size=14, bold=True)
    save("data-storage.svg", W, H, body)

# ───────────────────────── D5 密钥体系 ─────────────────────────
def d5():
    W, H = 1040, 640
    body = ""
    PWD = (120, 110, 170, 52, ["用户主密码"], "#ef4444")
    RND = (120, 250, 170, 52, ["随机数"], "#64748b")
    KEK = (380, 110, 200, 56, ["KEK 密钥加密密钥", "PBKDF2-SHA256 210,000 轮"], "#ef4444")
    DEK = (380, 250, 200, 56, ["DEK 数据密钥", "256-bit，仅内存"], "#ef4444")
    ENV = (700, 130, 230, 76, ["shinian.vault.v1", "信封：salt+迭代+encDek", "AES-GCM 封装"], "#ef4444")
    DATA = (700, 275, 230, 52, ["items / wishes / city / settings"], "#0f172a")
    BIO = (120, 420, 170, 56, ["bioKEK 生物密钥"], "#f59e0b")
    KS = (380, 420, 190, 56, ["系统密钥库", "Android Keystore"], "#64748b")
    BIOW = (790, 420, 190, 56, ["shinian.vault.bio.v1", "封装 DEK 副本"], "#f59e0b")
    PWD2 = (120, 545, 170, 52, ["主密码（备份）"], "#10b981")
    BKEK = (380, 545, 200, 56, ["备份 KEK", "PBKDF2 独立 salt"], "#10b981")
    BKUP = (700, 545, 230, 56, [".enc.json 备份文件"], "#10b981")
    for nd in (PWD, RND, KEK, DEK, ENV, DATA, BIO, KS, BIOW, PWD2, BKEK, BKUP):
        body += node(*nd)
    body += arrow(PWD[0]+PWD[2]/2, PWD[1], KEK[0]-KEK[2]/2, KEK[1], color="#ef4444", marker="arrowR")
    body += arrow(RND[0]+RND[2]/2, RND[1], DEK[0]-DEK[2]/2, DEK[1])
    body += arrow(KEK[0]+KEK[2]/2, KEK[1], ENV[0]-ENV[2]/2, ENV[1]-14, color="#ef4444", marker="arrowR")
    body += arrow(DEK[0]+DEK[2]/2, DEK[1]-8, ENV[0]-ENV[2]/2, ENV[1]+16, color="#ef4444", marker="arrowR")
    body += arrow(DEK[0]+DEK[2]/2, DEK[1]+10, DATA[0]-DATA[2]/2, DATA[1]+10, color="#ef4444", marker="arrowR")
    body += txt((DEK[0]+DEK[2]/2 + DATA[0]-DATA[2]/2)/2, DATA[1]-24, "加密业务数据", size=10, anchor="middle", color="#475569")
    body += arrow(BIO[0]+BIO[2]/2, BIO[1], KS[0]-KS[2]/2, KS[1], color="#f59e0b", marker="arrowA")
    body += txt((BIO[0]+BIO[2]/2 + KS[0]-KS[2]/2)/2, BIO[1]-8, "生物认证门控", size=10, anchor="middle", color="#475569")
    # bioKEK → bio.v1：上拱曲线，避开中间「系统密钥库」节点
    body += curve(BIO[0]+BIO[2]/2, BIO[1]+6, BIOW[0]-BIOW[2]/2, BIOW[1]+6, 350, color="#f59e0b", marker="arrowA")
    body += txt((BIO[0]+BIO[2]/2 + BIOW[0]-BIOW[2]/2)/2, 344, "封装 DEK 副本", size=10, anchor="middle", color="#475569")
    body += arrow(PWD2[0]+PWD2[2]/2, PWD2[1], BKEK[0]-BKEK[2]/2, BKEK[1], color="#10b981", marker="arrowG")
    body += arrow(BKEK[0]+BKEK[2]/2, BKEK[1], BKUP[0]-BKUP[2]/2, BKUP[1], color="#10b981", marker="arrowG")
    body += txt(20, 40, "图 6-4  加密密钥体系（主密码 / 生物 / 备份三条独立链路）", size=14, bold=True)
    save("crypto-keys.svg", W, H, body)

d1(); d2(); d3(); d4(); d5()
print("DONE")
