---
title: 这条 GitHub Pages 发布流水线会做什么
description: pull request 先校验，main 分支再部署，把“能跑”和“能发”拆成两段。
pubDate: 2026-03-22
tags:
  - CI/CD
  - GitHub Actions
  - Deploy
---

这套流程把验证和发布分成了两部分：

- `ci.yml` 负责在功能分支 push 或 pull request 时执行 `npm ci`、`astro check` 和 `astro build`。
- `deploy.yml` 只在 `main` 分支 push 时触发，并将 `dist/` 发布到 GitHub Pages。

这样做的好处是很直接：

- PR 阶段就能发现内容 frontmatter、类型或构建问题。
- 发布动作只有主分支会执行，减少误发。
- 构建逻辑集中在仓库内，不需要额外平台。
