# Ease MD 更新部署方案（Tauri 2）

## 1. 目标
- 支持应用内「检查更新」和自动更新。
- 支持稳定版与开发版（pre-release）分流。
- 可先走免费方案（GitHub Releases），后续可切到自建源。

## 2. 推荐架构
- 客户端：`tauri-plugin-updater`。
- 发布源：GitHub Releases（免费）或自建静态源（Nginx/OSS）。
- 元数据：`latest.json`（稳定）和 `latest-beta.json`（开发）。
- 包签名：
  - Windows：建议 `signtool` 签名安装包与 exe（降低拦截概率）。
  - Tauri updater 签名：使用 Tauri updater key 对更新包签名。

## 3. 客户端接入步骤
1. Rust 侧增加 `tauri-plugin-updater` 依赖并在 `Builder` 注册插件。
2. `tauri.conf.json` 增加 `plugins.updater` 配置：
   - `endpoints`: 稳定源 URL。
   - `pubkey`: updater 公钥。
3. 前端「检查更新」按钮调用 updater API：
   - 手动检查：`check()`。
   - 下载并安装：`downloadAndInstall()`。
4. 勾选「自动检查更新」时，在启动后异步执行一次检查。
5. 勾选「更新至开发版」时，切换到 beta endpoint。

## 4. GitHub Releases 免费部署
1. 创建仓库 Release（Tag 例如 `v0.1.1`）。
2. 通过 `cargo tauri build` 产出安装包。
3. 用 `tauri signer sign` 对更新包签名，生成带签名元数据。
4. 生成并上传：
   - 安装包（`msi/nsis/dmg/appimage`）。
   - `latest.json`（稳定）或 `latest-beta.json`（开发）。
5. 客户端 endpoint 指向对应 raw 下载地址（可经 CDN）。

## 5. 自建源部署（可选）
- 目录示例：
  - `/updates/stable/latest.json`
  - `/updates/stable/*.msi`
  - `/updates/beta/latest-beta.json`
  - `/updates/beta/*.msi`
- Nginx 配置：
  - 开启 `application/json`、`application/octet-stream`。
  - 开启 `Accept-Ranges`。
  - 支持 HTTPS。

## 6. CI/CD 建议（GitHub Actions）
- Job 1：构建多平台包（Windows/macOS/Linux）。
- Job 2：签名（代码签名 + updater 签名）。
- Job 3：生成 `latest*.json`。
- Job 4：发布到 Release 或上传到静态源。

## 7. 安全与稳定性
- 更新包签名私钥仅放在 CI Secret，不入库。
- 每次发布先灰度（beta）再推稳定。
- 失败回滚：保留上一个 `latest.json` 和安装包，快速回指。

## 8. Windows 实操要点
- 强烈建议代码签名（OV/EV），可显著降低杀软和 SmartScreen 拦截。
- 避免使用 `cmd /c start` 等可疑行为链拉起进程。
- 打包后先做一次 `Defender/360` 误报提交流程，提升信誉。

## 9. 当前项目落地顺序
1. 先完成 GitHub Releases 方案（免费）。
2. 前端偏好页「自动检查更新 / 更新至开发版 / 检查更新」接入 updater API。
3. 验证 Windows 全流程（检查、下载、安装、重启）。
4. 视需要再迁移到自建更新源。
