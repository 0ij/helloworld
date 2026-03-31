---
title: 前端基础调试手册：Chrome DevTools、macOS 进程排查与常用终端工具
description: 把前端最常用的基础调试方法整理成一篇入门手册，包括 Chrome DevTools 的基本使用、macOS 下查包路径与进程状态、端口占用排查，以及值得长期使用的终端工具。
pubDate: 2026-03-27T21:00:00+08:00
tags:
  - Frontend
  - Debugging
  - Chrome DevTools
  - macOS
  - Terminal
---

我越来越觉得，工程里最有价值的能力之一，其实不是“会搭很多炫技工具链”，而是出了问题以后，能不能很快定位到问题到底发生在哪一层。

很多新手刚开始接触调试时，容易把“调试”理解成很高级、很复杂的事情，好像一定要等到线上事故、性能瓶颈或者奇怪崩溃时才会遇到。

但真实开发里，最常见的调试场景其实非常基础：

- 页面为什么没有按预期渲染
- 这个接口为什么没有发出去
- 这个请求为什么是 404 / 500
- 某个环境变量为什么没有生效
- 某个包明明装了，为什么命令找不到
- 某个服务明明关掉了，为什么端口还在占用

所以这篇文章我想把最常用、也最容易在工作里立刻派上用场的一组基础调试方法整理出来。

我会分成三部分讲：

- 浏览器里的 Chrome DevTools 怎么用
- macOS 里最常用的进程、端口和路径排查命令
- 如果你长期在终端里工作，哪些终端工具值得上手

需要先说明一下：虽然标题里写了 Bash 指令，但 macOS 现在默认 shell 一般是 `zsh`。这篇文章里的命令在 `bash` 和 `zsh` 里基本都可以直接用。

## 1. 前端调试的第一现场：Chrome DevTools

对前端来说，浏览器就是第一现场。

页面有没有渲染出来、脚本有没有报错、请求有没有发出去、资源有没有加载成功、某段样式为什么被覆盖，这些事情都不应该先靠猜，而应该先回到 DevTools。

Chrome DevTools 官方文档入口在这里：

- [Chrome DevTools Overview](https://developer.chrome.com/docs/devtools/overview/)

如果你刚开始用，我建议先只熟悉下面这几个面板，不用一上来把所有功能都学完。

### 1.1 Elements：看 DOM 和 CSS 到底发生了什么

`Elements` 面板是前端最常用的入口。

它主要解决两类问题：

- 页面结构是不是你以为的那样
- 某个样式为什么没有生效

常用操作包括：

- 右键页面元素，点 `Inspect`
- 在左侧查看 DOM 结构
- 在右侧看 `Styles`、`Computed`、`Layout`
- 临时改 class、改 style、改文案，快速验证思路

在 macOS 上，常用快捷键是：

```bash
Command + Option + C
```

我自己最常用的调试路径是：

1. 先选中有问题的元素。
2. 看实际渲染出来的 class 和 DOM 层级。
3. 在 `Styles` 里看哪条规则被覆盖了。
4. 再去 `Computed` 里确认最终生效值。

很多“样式没生效”的问题，最后都不是框架问题，而是：

- 选择器没命中
- 优先级不够
- 被后面的样式覆盖
- 元素尺寸是 0
- 父元素布局约束导致结果和预期不同

### 1.2 Console：先看报错，再看输出

`Console` 是第二个必须熟悉的地方。

它最直接解决的是：

- JavaScript 报错
- 运行时警告
- 自己打的日志输出
- 临时执行一段脚本验证想法

快速打开：

```bash
Command + Option + J
```

我很建议养成一个顺序：

> 页面不对劲时，先开 Console，看有没有明确报错，再决定要不要继续往 Network 或 Sources 深挖。

很多问题其实 Console 已经直接告诉你了，比如：

- `undefined is not a function`
- `Cannot read properties of null`
- 某个资源跨域失败
- 某个模块加载失败

除了看日志，Console 还很适合做一些现场验证，比如：

```js
document.querySelector('#app')
localStorage.getItem('token')
window.location.href
```

这类小验证比盲猜快得多。

### 1.3 Sources：断点调试是最稳定的“看见真相”的方法

如果 Console 只能告诉你“报错了”，那 `Sources` 才是真正帮你看代码是怎么一步一步跑下去的地方。

它最适合处理：

- 某个函数为什么没有进入
- 某个变量为什么变成了意料之外的值
- 某段逻辑到底是在哪一步分叉了

最基础的用法就是打断点：

1. 打开 `Sources`
2. 找到对应文件
3. 点击行号打断点
4. 刷新页面或再次触发操作
5. 用 `Step over / Step into / Step out` 看执行过程

断点调试最重要的价值不是“高级”，而是它能把“我以为代码会这样执行”变成“代码实际上就是这样执行的”。

如果你刚开始用，可以优先掌握这几类断点：

- 普通行断点
- `XHR / Fetch` 断点
- 异常断点
- `Event Listener` 断点

### 1.4 Network：接口问题、资源问题，先来这里

`Network` 面板几乎是接口联调时的主战场。

它解决的是：

- 请求到底发没发
- 请求地址是不是对的
- 请求头、请求参数是不是对的
- 返回状态码是什么
- 返回体里到底是什么
- 某个脚本、图片、字体、样式文件有没有加载成功

我自己排查接口问题时，基本就是这个顺序：

1. 打开 `Network`
2. 勾上 `Preserve log`
3. 重新触发页面操作
4. 找目标请求
5. 看 `Headers`、`Payload`、`Preview`、`Response`

这里最容易省下时间的是先区分问题归属：

- 请求没发出去：多半是前端逻辑问题
- 发出去了但地址不对：多半是配置问题
- 状态码异常：多半要继续看服务端
- 返回对了但页面没更新：再回到前端状态流

只要这个归因路径清楚，联调效率会高很多。

### 1.5 Performance：页面卡顿时，不要只靠感觉

页面“有点卡”是一个很模糊的描述。

真正有用的问题应该是：

- 是脚本执行太久？
- 是布局和重绘太重？
- 是某次渲染触发太频繁？
- 是主线程被长任务卡住了？

这时候就要看 `Performance` 面板。

基础做法很简单：

1. 打开 `Performance`
2. 点录制
3. 重现卡顿操作
4. 停止录制
5. 看主线程时间线和长任务

一开始不用追求把火焰图看得特别细，先学会识别几件事：

- 哪一段明显特别长
- 是脚本、样式计算还是布局占主导
- 卡顿发生时页面在做什么

这比“感觉可能是 React 慢”或者“感觉可能是浏览器抽风”要可靠得多。

### 1.6 Application：本地存储、Cookie、缓存问题，经常在这里

很多登录态、缓存、PWA 或离线相关问题，最后都要落到 `Application` 面板。

它常用来检查：

- `Local Storage`
- `Session Storage`
- `Cookies`
- `Service Workers`
- 缓存存储

比如你怀疑 token 没写进去，就不要只在代码里打日志，直接来这里看浏览器里实际存了什么。

### 1.7 一个适合新手的 DevTools 最小工作流

如果你对 DevTools 还不熟，我建议先把自己的调试顺序固定下来：

1. 页面不对，先看 `Console`
2. 元素不对，去 `Elements`
3. 请求不对，去 `Network`
4. 逻辑不对，去 `Sources`
5. 性能不对，去 `Performance`
6. 存储或登录态不对，去 `Application`

只要先把这条路径跑熟，大多数前端基础问题都能明显更快地定位。

## 2. macOS 下最常用的基础排查命令

浏览器之外，很多问题其实发生在本地开发环境。

比如：

- 命令为什么找不到
- 装好的包到底装到哪里去了
- 服务到底启没启动
- 某个进程明明杀掉了，为什么又起来了
- 某个端口为什么一直被占着

这类问题的关键不是记住很多命令，而是形成一套稳定的排查顺序。

## 3. 先查“这个命令到底从哪里来的”

如果你怀疑一个包安装路径不对，最先做的不是重装，而是先确认你现在执行的到底是哪一个命令。

最常用的几个命令：

```bash
which node
command -v node
type -a node
```

它们的用途可以这样理解：

- `which`：看当前命令解析到哪个路径
- `command -v`：更适合脚本里用，也能看命令位置
- `type -a`：能看到 alias、shell builtin 和多个同名可执行路径

比如：

```bash
type -a python
type -a node
type -a pnpm
```

这个阶段的目标不是“修”，而是先确认你运行的是不是你以为的那个版本。

如果你装的是 Homebrew 包，还可以继续看：

```bash
brew --prefix
brew --prefix node
brew list --versions node
```

这些命令很适合确认：

- Homebrew 的安装前缀在哪里
- 某个 formula 的实际安装位置
- 当前装了哪个版本

如果你在排查全局 Node 包，也经常会用到：

```bash
npm root -g
npm list -g --depth=0
pnpm root -g
pnpm bin -g
```

它们可以帮助你回答：

- 全局依赖目录在哪
- 全局装了哪些包
- 全局可执行文件目录在哪

很多“明明装了，但命令找不到”的问题，最后根因其实是：

- 包确实装了，但全局 bin 目录没进 `PATH`
- 你装到了另一个 Node 版本对应的目录
- 机器上同时存在多个包管理器和多个 Node 版本

## 4. 再查“这个东西现在到底有没有在运行”

如果你怀疑某个服务已经启动，或者某个程序根本没起来，可以先查进程。

最基础的方式：

```bash
ps aux | grep nginx
ps aux | grep node
```

但更推荐的方式通常是：

```bash
pgrep -fl nginx
pgrep -fl node
pgrep -fl vite
```

因为 `pgrep -fl` 会直接列出匹配的 PID 和命令行，比 `grep` 看起来更干净。

如果你已经知道 PID，也可以进一步看：

```bash
ps -fp 12345
```

这个命令适合确认：

- 进程是谁启动的
- 运行用户是谁
- 命令行参数是什么

## 5. 端口占用怎么查

本地开发里最常见的问题之一就是：

- `3000` 端口被占了
- `5173` 端口被占了
- 服务关了但端口还在

在 macOS 上最常用的命令是：

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

这个命令的意思大概是：

- `lsof`：列出打开的文件和网络连接
- `-nP`：不要做 DNS 和端口名解析，输出更直接
- `-iTCP:3000`：只看 TCP 3000 端口
- `-sTCP:LISTEN`：只看处于监听状态的进程

如果你只想看看某个端口被谁占着，这个命令非常高频。

比如开发时常用：

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:5173 -sTCP:LISTEN
lsof -nP -iTCP:8080 -sTCP:LISTEN
```

查到 PID 之后，可以继续看：

```bash
ps -fp <PID>
```

然后再决定该不该结束它。

结束进程常用：

```bash
kill <PID>
kill -9 <PID>
```

通常我建议先用普通 `kill`，实在不退出再考虑 `kill -9`。

因为 `kill -9` 是强制终止，不给程序清理资源的机会。

## 6. 为什么进程杀掉以后又起来了

这类情况非常常见，而且很容易误判成“命令没生效”。

真实原因往往是：**这个进程背后有守护者在拉起它。**

最常见的几种来源包括：

- `brew services`
- `launchd`
- `pm2`
- Docker 容器
- 开发工具自己的 watcher

如果是 Homebrew 管理的服务，先看：

```bash
brew services list
```

然后停掉它：

```bash
brew services stop mysql
brew services stop redis
```

如果你怀疑是 `launchd` 拉起来的，可以查：

```bash
launchctl list | grep -i redis
launchctl list | grep -i mysql
```

如果你在用 `pm2` 管理 Node 进程，就看：

```bash
pm2 list
pm2 stop <app-name>
pm2 delete <app-name>
```

如果你怀疑是 Docker 占了端口：

```bash
docker ps
```

这一步非常重要，因为很多人会停掉最表层的进程，却没停掉真正的守护源头，于是服务很快又会被重新拉起。

## 7. 一个很好用的排查顺序

如果你遇到“端口一直被占、服务关不掉”的问题，我建议按这个顺序来：

1. 先查端口是谁占的

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

2. 拿到 PID，再看进程详情

```bash
ps -fp <PID>
```

3. 先正常结束进程

```bash
kill <PID>
```

4. 如果它又起来了，再查是不是被守护

```bash
brew services list
launchctl list | grep -i <name>
docker ps
pm2 list
```

这样排查的好处是：你不会一上来就乱删配置，也不会把“被守护自动拉起”误判成“进程杀不掉”。

## 8. 这些基础命令我自己最常用

如果让我只留下最常用的一小组，我会选这些：

```bash
command -v <cmd>
type -a <cmd>
brew --prefix <formula>
npm root -g
pgrep -fl <keyword>
ps -fp <PID>
lsof -nP -iTCP:<port> -sTCP:LISTEN
kill <PID>
brew services list
launchctl list | grep -i <keyword>
docker ps
```

它们覆盖的其实就是三类基础问题：

- 这个命令从哪里来
- 这个服务现在在不在运行
- 这个端口到底被谁占着

只要这三件事能很快回答，大部分本地环境问题都会清晰很多。

## 9. 值得长期使用的终端工具

如果你每天都在终端里工作，终端本身也是生产力工具。

我自己的建议是，不用为了“折腾配置”去换终端，但如果你已经明显感觉系统自带终端不够顺手，那换一个更适合长期工作的终端是很值得的。

这里我比较推荐三个方向。

### 9.1 iTerm2：macOS 上依然很稳的经典选择

[iTerm2](https://iterm2.com/) 现在依然是很多 macOS 开发者的默认答案。

它的优点很明确：

- 功能成熟
- 配置项丰富
- 多分屏和多标签体验稳定
- 有 Hotkey Window
- Shell Integration 做得很完整

官方特性页在这里：

- [iTerm2 Features](https://iterm2.com/features.html)

如果你想要的是“成熟、稳定、资料多、社区经验多”，它依然是一个很难出错的选择。

### 9.2 Ghostty：很现代、很顺滑的新一代终端

[Ghostty](https://ghostty.org/) 这两年非常值得关注。

它给我的感觉是：

- 很现代
- 在 macOS 上体验很轻快
- GPU 渲染带来的交互感受不错
- 原生支持 tabs 和 splits

Ghostty 官方特性页：

- [Ghostty Features](https://ghostty.org/docs/features)

如果你喜欢更现代、更轻、更接近“新工具体验”的终端，Ghostty 很值得试一下。

### 9.3 WezTerm：如果你希望跨平台且可定制

[WezTerm](https://wezterm.org/) 是我会给“需要跨平台一致体验”的人推荐的备选。

它的特点是：

- macOS、Linux、Windows 都能用
- 多窗口、tabs、splits 很完整
- 配置可定制性很强
- 对远程和多会话场景支持很好

官方入口：

- [WezTerm](https://wezterm.org/)
- [WezTerm Features](https://wezterm.org/features.html)

如果你经常在多台机器之间切换，或者希望同一套终端习惯横跨多个系统，它会比只盯着 macOS 单平台的工具更合适。

## 10. 如果你现在要选，我会怎么建议

如果只是给一个很务实的建议，我会这样分：

- 想稳一点：选 `iTerm2`
- 想要现代体验：试 `Ghostty`
- 想跨平台统一：看 `WezTerm`

它们并不是谁绝对更强，而是取向不同。

我觉得真正重要的是，你的终端应该至少满足这几件事：

- 多标签和多分屏好用
- 搜索历史输出方便
- 字体和配色舒服
- 快捷键不拧巴
- 对长时间开发工作足够稳定

## 11. 最后收一下：基础调试能力，是非常划算的投资

很多工程能力的提升，前期需要很长时间才会显现效果。

但调试不是。

你只要把下面这些最基础的路径练熟，几乎立刻就能在日常开发里省下很多时间：

- 页面问题先回到 DevTools
- 包路径问题先查命令解析结果
- 服务问题先看进程
- 端口问题先看监听者
- 杀不掉的问题先怀疑有守护进程

这些能力听起来不“高级”，但它们非常接近真实工作里的高频问题。

而且很多时候，工程效率的差距，恰恰就来自这种基础能力是否稳定。

真正成熟的调试，不是“会很多神秘技巧”，而是你能不能在问题出现时，很快把它缩小到正确的范围里。
