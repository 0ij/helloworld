---
title: 后续内容维护建议
description: 用最轻的方式维护博客内容，同时让文章组织结构可扩展。
pubDate: 2026-03-22
tags:
  - Writing
  - Content Ops
---

初始化之后，最值得尽快形成的是内容约定。

目前文章 schema 已经支持：

- `title`
- `description`
- `pubDate`
- `updatedDate`
- `tags`
- `draft`

建议后续这样用：

- 草稿文章先加 `draft: true`，避免出现在站点和 RSS 中。
- `description` 保持在一句话内，兼顾列表页摘要和社交卡片。
- `tags` 尽量控制在 2 到 4 个，方便后续加归档或标签页。
