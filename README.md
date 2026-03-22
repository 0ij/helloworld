# GitHub Engineering Notes

一个面向 GitHub Pages 的技术博客起步模板，使用 Astro 做静态生成，配套 GitHub Actions 完成 CI/CD。

## 本地开发

```bash
npm install
npm run dev
```

常用命令：

- `npm run dev`：启动本地开发服务
- `npm run check`：执行 Astro 类型和内容校验
- `npm run build`：构建生产产物到 `dist/`
- `npm run preview`：本地预览生产构建

## 内容维护

文章放在 `src/content/blog/` 下，使用 Markdown 或 MDX 均可。

当前 frontmatter 支持：

```yaml
title: 文章标题
description: 一句话摘要
pubDate: 2026-03-22
updatedDate: 2026-03-23 # 可选
tags:
  - Astro
  - CI/CD
draft: false # 可选，true 时不会出现在站点和 RSS
```

## GitHub Pages 发布

仓库中已经包含两个工作流：

- `.github/workflows/ci.yml`
  - 功能分支 push 和 pull request 时执行 `npm ci`、`npm run check`、`npm run build`
- `.github/workflows/deploy.yml`
  - `main` 分支 push 时自动发布到 GitHub Pages

### 仓库设置

1. 把仓库推到 GitHub，并确保默认分支是 `main`。
2. 进入 `Settings > Pages`。
3. 在 `Build and deployment` 中选择 `GitHub Actions`。

### 可选仓库变量

在 `Settings > Secrets and variables > Actions > Variables` 中可以添加：

- `SITE_URL`
  - 自定义站点地址，例如 `https://blog.example.com`
- `BASE_PATH`
  - 自定义子路径，例如 `/notes`

如果不设置：

- 用户/组织主页仓库（`<owner>.github.io`）会部署到根路径
- 普通仓库会自动按 `https://<owner>.github.io/<repo>` 计算站点路径

## 需要你手动替换的占位信息

以下常量目前还是占位值，建议尽快改掉：

- `src/consts.ts` 中的 `SITE_AUTHOR`
- `src/consts.ts` 中的 `SITE_GITHUB_URL`
- `src/consts.ts` 中的 `SITE_EMAIL`
