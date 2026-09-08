# 部署指南 · 数字文娱实时情报与数字文化政策智库

把"只跑在你本地"的站点，搬进"公共酒馆"（公网服务器），让微信好友能打开、且只有登记的 10 个 ID 能进、被分享者也能实时看到最新情报。

---

## 一、部署后，你的三个硬需求如何被满足

| 你的要求 | 实现方式 |
|---|---|
| 微信好友能打开 | 站点跑在**公网服务器**（不是你本机的 127.0.0.1），得到一个 `https://xxx` 网址，谁都能访问 |
| 只有登记的 10 个 ID 能进 | `server.js` 的 `/api/join` 接口**硬卡总上限 10**，已登记名单持久化在 `users.json`；第 11 人会被拒绝（返回 409） |
| 被分享者也能实时更新数据 | 前端每 **60 秒**比对 `data.js` 顶部的 `window.DATA_VERSION`，版本变化即自动刷新页面；10 人读的是**同一份数据**，天然一致 |

> 关键认知：之前打不开，**不是微信的锅**，是站点地址只指向"你自己的电脑"。搬到公网后，问题消失。

---

## 二、本地自测（部署前先验证）

```bash
cd 项目目录
node server.js
# 浏览器打开 http://localhost:9123
```

打开后：输入一个 2–20 位 ID（中英文/数字/下划线）即可登记进入；连续登记第 11 个会被提示"ID 名额已满"。

---

## 三、部署到 Node 云主机（任选其一）

本项目**零依赖**（只用 Node 内置模块），`server.js` 已监听 `0.0.0.0` 并读取 `process.env.PORT`，开箱即可上云。

### 路线 A：Railway（推荐，最省心）
1. 注册 https://railway.app （可用 GitHub 登录）。
2. 把本项目推到你的 GitHub 仓库（见第五节命令）。
3. Railway 控制台 → **New Project → Deploy from GitHub Repo**，选中仓库。
4. Railway 会自动识别 `package.json` 的 `start` 脚本并运行 `node server.js`。
5. 部署完成后，Railway 分配一个 `https://xxx.up.railway.app` 域名 → 这就是你要发给微信好友的网址。

### 路线 B：Render（免费额度也够）
1. 注册 https://render.com （可用 GitHub 登录）。
2. 把本项目推到 GitHub 仓库（见第五节命令）。
3. Render 控制台 → **New → Web Service**，连接仓库。
4. 配置：`Build Command: npm install`，`Start Command: node server.js`，`Plan: Free`。仓库里已附 `render.yaml` 可自动套用。
5. 部署完成得到 `https://digital-culture-intel.onrender.com` → 发给微信好友。

> 两条路线都能直接用，无需改任何代码。

---

## 四、更新情报（让 10 个人实时看到）

1. 改 `assets/js/data.js`（增删热点 / 政策 / 项目等，全部 24 个可追踪项都带 `updatedAt`）。
2. **把 `window.DATA_VERSION` 末位 +1**（如 `2026-09-08.1` → `2026-09-08.2`）。这一步是"发信号"给前端。
3. `git push` 触发平台重新部署。
4. 所有在线页面在 **60 秒内自动刷新**到最新情报（正在看详情抽屉的人会在关掉抽屉后刷新，不打断阅读）。

---

## 五、推送到 GitHub 的命令

```bash
git init
git add .
git commit -m "数字文娱智库 v1.0 · 多人共享 + 10人门禁"
git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

---

## ⚠️ 重要：注册名单的持久化（务必看）

免费实例的磁盘通常是**临时性**的——每次重新部署或重启，`users.json` 会被重置，已登记的 10 个 ID 会清空，需重新登记一次。

两种解法：
- **想要长期稳定**：用支持持久磁盘的平台（Render 挂载 Disk / Railway Volume），并把 `users.json` 放到挂载目录（需改 `server.js` 里的 `USERS_FILE` 路径指向挂载点）。
- **可接受偶尔重登**：保持现状，重新部署后大家再登一次即可（对 10 人小圈子基本无感）。

> 本仓库默认把 `users.json` 写在项目根目录，并已加入 `.gitignore`，**不会进版本库**，避免把运行态提交上去。

---

## 六、安全说明

当前门禁只校验 ID 格式（2–20 位中英文/数字/下划线），**不含密码**。适合 10 人小圈子的信任场景。若要更强控制，可在 `/api/join` 增加共享邀请码校验（`body.invite`），需要的话我可以直接帮你加上。

---

## 七、文件清单

| 文件 | 作用 |
|---|---|
| `server.js` | 零依赖 Node 后端：静态托管 + 10 人门禁 + 在线心跳 |
| `index.html` | 前端入口 |
| `assets/js/data.js` | 情报数据（顶部 `window.DATA_VERSION` 控制实时同步） |
| `assets/js/app.js` | 路由 / 视图 / 协作门禁 / 数据轮询 |
| `assets/js/charts.js` | 零依赖 SVG 图表 |
| `assets/css/style.css` | 暗色驾驶舱主题 |
| `package.json` / `Procfile` / `render.yaml` | 云部署配置 |
| `users.json` | 运行时生成的登记名单（被 .gitignore 忽略） |
