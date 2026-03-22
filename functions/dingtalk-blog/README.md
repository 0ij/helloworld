# DingTalk Blog Function

这个目录提供一个最小可用的“钉钉聊天 -> DeepSeek 生成博客 -> 写入 GitHub 仓库”的后端骨架。

## 处理链路

1. `POST /dingtalk` 接收消息。
2. 普通文本会写入 GitHub 的草稿分支，按日期聚合。
3. `/publish` 会读取当天草稿，调用 DeepSeek 生成 Markdown。
4. 生成结果会写入 `src/content/blog/*.md`。
5. GitHub Pages 工作流检测到 `main` 分支更新后自动发布。

## 支持命令

- 普通文本：记录当天素材
- `/help`：查看帮助
- `/preview --title=标题 --tags=Astro,CI/CD`：只生成预览，不写入仓库
- `/publish --title=标题 --tags=Astro,CI/CD --style=偏实战`：生成并写入正式文章
- `/reset --date=2026-03-22`：清空某天素材

## 本地调试

```bash
npm run function:dev
```

示例请求：

```bash
curl -X POST http://127.0.0.1:9000/dingtalk \
  -H "content-type: application/json" \
  -d "{\"text\":{\"content\":\"今天研究了 Astro 的部署路径和 GitHub Pages 配置\"},\"senderNick\":\"heko\"}"
```

发布示例：

```bash
curl -X POST http://127.0.0.1:9000/dingtalk \
  -H "content-type: application/json" \
  -d "{\"text\":{\"content\":\"/publish --title=Astro 部署实践 --tags=Astro,GitHub Pages --style=偏实战，加入踩坑\"},\"senderNick\":\"heko\"}"
```

## 阿里云函数部署建议

- 运行时：Node.js 22
- Handler：`functions/dingtalk-blog/index.handler`
- 触发器：HTTP Trigger
- 环境变量：见根目录 `.env.example`

如果你的钉钉回调报文结构与这里提取字段的逻辑不一致，只需要调整 `extractIncomingMessage`。
