# 教你如何把才华变成钱

**简体中文** | [English](README_EN.md)

一套可以真正动手完成的引导工具：用四周、28 个循序渐进的关卡，把脑子里模糊的能力，整理成别人看得懂、愿意相信、可以买到的服务或产品。

**在线使用：** [https://talent-to-value.github.io](https://talent-to-value.github.io)

**项目仓库：** [github.com/talent-to-value/talent-to-value.github.io](https://github.com/talent-to-value/talent-to-value.github.io)

本项目由雨眠根据书中方法独立整理为互动工具，并非作者官方产品。

## 四周计划

| 周次 | 关卡 | 主题 | 最终产出 |
| --- | --- | --- | --- |
| 第一周 | 1.1–1.7 | 说清你是谁、帮谁、为什么值钱 | 一份经过现实反馈的服务说明 |
| 第二周 | 2.1–2.5 | 整理证据、故事和代表作品 | 一页“为什么能信我” |
| 第三周 | 3.1–3.7 | 与用户产生连接 | 5 篇能够建立连接的内容 |
| 第四周 | 4.1–4.9 | 做出一个可以被购买的入口 | 一个可交付、可定价、可购买的最小产品 |

## 主要功能

- 按周、按关卡完成引导练习
- 自动调用前面关卡已经填写的内容
- 在当前浏览器中自动保存进度
- 保留最近的本机快照
- 支持将全部进度导出为 JSON 备份文件
- 支持在同一设备或其他设备导入备份继续填写
- 适配桌面端和手机端

## 数据保存与隐私

本工具不要求注册账号，填写内容不会上传到服务器。

进度主要保存在当前浏览器的 IndexedDB 中，同时在 `localStorage` 中保留一份兼容副本。工具会自动保存当前进度；有填写内容时，最多每 5 分钟生成一次自动快照，并保留最近 10 份。

请注意：

- 不同设备、不同浏览器之间不会自动同步数据。
- 无痕浏览中的数据通常会在关闭无痕窗口后被清除。
- 清理浏览器数据、更换设备或卸载浏览器前，请先使用页面中的“备份与恢复”功能下载 JSON 备份。
- 导入备份会用备份文件中的进度替换当前页面进度，操作前请确认文件正确。

## 开发与部署

项目使用 Next.js 16、React 19、TypeScript、Vinext 和 Vite，静态部署在 GitHub Pages。开发环境需要 Node.js 22.13.0 或更高版本。

```bash
npm ci
npm run dev
```

常用检查命令：

```bash
npm run lint
npm run build:pages
```

`npm run build:pages` 会生成用于静态部署的 `out/` 目录。
仓库中的 `main` 分支保存源码，`gh-pages` 分支保存静态站点。当前没有自动部署工作流；发布时将 `out/` 同步到 `gh-pages` 分支根目录，并保留 `.nojekyll` 文件。

## 主要目录

```text
app/
  curriculum.ts       四周课程与关卡配置
  local-progress.ts   本地保存、快照、导入与导出
  page.tsx            页面与主要交互
  globals.css         全局样式与响应式适配
  layout.tsx          站点元数据
public/
  fonts/              自托管字体
  favicon.png         网站图标
  og.png              社交分享图
```

## 内容来源与整理

- 内容参考：[《把才华变成钱》](https://haoshiyinli.com/book)
- 作者：王梦珂 Mengke
- 工具整理：雨眠
- 微信公众号：Yan yard

本仓库目前未附开源许可证。书籍内容、工具文案和项目代码的转载或再利用，请先取得相应权利人的许可。
