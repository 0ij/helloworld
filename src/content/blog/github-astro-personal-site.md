---
title: 如何用 GitHub 和 Astro 搭建个人技术网站
description: 从空仓库开始，把 Astro、GitHub Actions 和 GitHub Pages 串成一条稳定可维护的发布链路。
pubDate: 2026-03-22T20:30:00+08:00
tags:
  - Astro
  - GitHub Pages
  - CI/CD
  - Blog
---

如果只看结果，个人技术网站往往像一件很轻的事情：创建仓库、写几篇文章、点一下部署，网站就上线了。

但真正决定这个网站能不能长期维护的，往往不是“第一次有没有跑起来”，而是下面这几个问题：

- 内容以后怎么持续写？
- 构建和部署会不会每次都要手动点很多地方？
- 仓库路径部署和自定义域名部署能不能同时兼容？
- 出问题的时候，能不能很快定位到是内容错误、配置错误还是 Pages 设置错误？

这篇文章就按照我这次真实搭建的顺序，把整个过程拆开。

## 1. 为什么选 Astro + GitHub

我的目标很明确：

- 博客应该尽量是静态站点，部署简单，稳定，便宜。
- 内容应该天然适合用 Markdown 管理。
- 发布链路最好全部放在 GitHub 内，避免多平台切换。

Astro 在这个场景下很合适：

- 默认就是静态站点思路，博客场景成熟。
- Content Collections 让 Markdown frontmatter 有类型约束。
- RSS、Sitemap、页面元信息这些博客常用能力都有现成方案。
- 最终产物是纯静态文件，和 GitHub Pages 很匹配。

GitHub 这边则提供了两块基础设施：

- `GitHub Pages` 负责托管静态文件。
- `GitHub Actions` 负责校验、构建和发布。

组合起来之后，仓库就不只是“存代码”，而是一条完整的内容生产和发布流水线。

## 2. 从空仓库初始化 Astro 博客

第一步不是手写目录结构，而是直接基于 Astro 官方 blog starter 起步。

典型命令类似这样：

```bash
npm create astro@latest . -- --template blog --install --no-git --yes
```

这样做的好处是，博客常见的骨架已经有了：

- 首页
- 文章列表页
- 文章详情页
- `src/content/blog/` 内容目录
- RSS / Sitemap 支持

初始化之后，我做的第一件事不是美化页面，而是确认项目的“结构边界”：

- 页面放在 `src/pages/`
- 可复用组件放在 `src/components/`
- 文章内容放在 `src/content/blog/`
- 站点级常量放在 `src/consts.ts`
- 站点部署行为由 `astro.config.mjs` 控制

这样后面改内容、改页面、改部署配置时，不会互相打架。

## 3. 先把内容模型定下来

博客最容易在后面变乱的地方，其实不是样式，而是文章 frontmatter。

我在 `src/content.config.ts` 里把博客文章 schema 明确成了：

```ts
title: string
description: string
pubDate: date
updatedDate?: date
tags: string[]
draft: boolean
heroImage?: image
```

这样做的意义有三个：

1. 列表页和详情页的字段可以稳定依赖。
2. 草稿文章可以通过 `draft: true` 从构建结果里排除。
3. `astro check` 能在 CI 阶段提前发现 frontmatter 写错的问题。

我对博客的理解是：越早把内容模型定清楚，后面写文章越顺手。

## 4. GitHub Pages 真正麻烦的点：仓库子路径

如果你的仓库是普通仓库，比如：

```text
0ij/helloworld
```

那 Pages 地址通常不是根路径，而是：

```text
https://0ij.github.io/helloworld/
```

这里最容易出错的，是 `base`。

很多本地看起来没问题的链接，一旦部署到 Pages，就会出现这种错误：

- `/blog/` 在本地能开
- 上线后却应该是 `/helloworld/blog/`

所以 `astro.config.mjs` 不能只写死一个 `site`，而要让它能根据仓库信息自动推导：

- 用户/组织主页仓库：根路径部署
- 普通仓库：自动加上 `/<repo>/`

我最后采用的是这个思路：

- 从 `GITHUB_REPOSITORY` 和 `GITHUB_REPOSITORY_OWNER` 推导仓库信息
- 如果是普通仓库，就生成 `base = /repo/`
- 如果配置了 `SITE_URL` / `BASE_PATH`，再允许它们覆盖默认值

这里有两个真实踩坑点：

### 4.1 空的 `SITE_URL` 不能直接信任

如果你在 GitHub 仓库变量里创建了 `SITE_URL`，但值是空字符串，Astro 会把它当成非法 URL，`astro check` 会直接报：

```text
Invalid URL
```

所以配置里要把“空字符串”和“未设置”都当成回退场景处理。

### 4.2 `base` 最好统一成带尾斜杠的形式

我在这次部署里还遇到过一个特别典型的坑：

- 错误链接：`/helloworldblog/`
- 正确链接：`/helloworld/blog/`

根因不是页面路由不存在，而是字符串拼接时 `base` 没有统一处理尾斜杠。  
所以这类配置最好在入口就标准化，而不是在每个页面里各自猜。

## 5. 页面和内容目录怎么组织

站点真正长期维护时，页面层我只保留三种核心入口：

- 首页：展示主题、最近文章、站点定位
- 文章列表页：作为内容归档入口
- 关于页：解释这个站点在写什么、怎么写

内容层则尽量简单：

```text
src/content/blog/
```

每篇文章一个 Markdown 文件，不引入复杂 CMS。

这样做的好处很直接：

- 文章和代码一起版本化
- 提交历史天然就是内容演进历史
- PR 可以同时审阅“文章内容”和“页面改动”

对个人博客来说，这种方式通常比单独上 CMS 更轻，也更稳。

## 6. CI 要做什么，CD 要做什么

我不希望每次合并主分支时才知道文章写坏了、配置写错了、构建挂了。

所以工作流拆成两条：

### CI

`pull_request` 和非 `main` 分支的 `push` 执行：

```bash
npm ci
npm run check
npm run build
```

这里 `check` 和 `build` 分工不同：

- `astro check` 更偏类型、schema、Astro 文件诊断
- `astro build` 更偏最终产物能不能生成

两者都过，才说明这次改动基本可发布。

### CD

`main` 分支 push 后自动执行：

```bash
npm ci
npm run check
npm run build
```

然后把 `dist/` 交给 GitHub Pages 发布。

这个阶段我尽量不用“神秘黑盒式”的部署动作，而是沿着官方 Pages 工作流来：

- `actions/configure-pages`
- `actions/upload-pages-artifact`
- `actions/deploy-pages`

这样出了问题，定位通常比较直接。

## 7. GitHub 仓库侧必须手动做的设置

第一次接通 Pages 时，仓库本身还要做两步设置：

### 7.1 启用 Pages

进入：

```text
Settings > Pages
```

然后把 `Build and deployment` 的 Source 选成：

```text
GitHub Actions
```

如果这一步没做，`actions/configure-pages` 往往会报找不到 Pages 站点。

### 7.2 注意旧运行记录和新提交不是一回事

这也是一个非常容易混淆的问题：

- 你修完配置后
- 如果只是对旧失败任务点 `Re-run`
- 它不一定会跑到你最新修复过的代码

更稳的方式通常是：

- 提交新修复
- `push origin main`
- 看最新自动触发的 workflow

这样可以避免一直盯着旧 run 误判。

## 8. 这套方案的优点到底是什么

走完一遍之后，我觉得这条方案最值钱的地方不在“便宜”，而在“简单且闭环”。

它解决的是下面这组问题：

- 写作和代码共存于同一个仓库
- 内容、配置、构建、部署都能被版本管理
- 本地和线上基本是同一套产物形态
- 出错点很容易归类到内容、配置、Actions 或 Pages 设置

对个人网站来说，这种闭环非常重要。因为个人项目最怕的不是功能不够，而是维护成本越来越高，最后不想动它。

## 9. 如果你现在也想照着搭，最小步骤是什么

我会建议按下面顺序来：

1. 用 Astro blog starter 初始化项目。
2. 先确定文章 schema 和内容目录。
3. 配好 `site` / `base`，优先解决 GitHub Pages 子路径问题。
4. 本地先跑通 `check` 和 `build`。
5. 再接入 GitHub Actions，把 CI 和 CD 分开。
6. 最后去 `Settings > Pages` 里把 Source 切到 `GitHub Actions`。

这个顺序的核心，是先解决“结构”，再解决“外观”。

## 10. 我对这套建站方式的结论

如果你想要的是一个长期可维护的个人技术网站，而不是一次性的展示页，那么：

- Astro 非常适合做博客骨架
- GitHub Pages 足够承担静态托管
- GitHub Actions 则刚好补齐校验与发布

真正需要重视的，不是“怎么把站点生成出来”，而是：

- 怎么让构建路径稳定
- 怎么让内容模型稳定
- 怎么让部署链路稳定

一旦这三件事稳定下来，后面写文章会变得非常轻。
