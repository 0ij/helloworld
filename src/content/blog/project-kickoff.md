---
title: 从空仓库开始搭一个 GitHub 技术博客
description: 先建立站点骨架、内容目录和最小发布链路，把后续写作流程稳定下来。
pubDate: 2026-03-22
tags:
  - Astro
  - GitHub Pages
  - Bootstrap
---

一个可持续维护的博客，重点不只是页面能打开，而是后续写作和发布成本要足够低。

这次初始化做了三件最关键的事：

1. 用 Astro 建一个静态站点骨架，保留 Markdown 内容集合。
2. 让构建默认兼容 GitHub Pages 的仓库子路径。
3. 预留 GitHub Actions 工作流，让 CI 和 CD 可以直接接上。

接下来只需要继续往 `src/content/blog/` 里写文章，就可以逐步把内容充实起来。
