---
title: 从 JS 执行原理到页面监控：前端性能优化怎么落地
description: 把 JavaScript 执行原理、前端常用性能指标的计算口径与获取方式，以及卡顿和白屏监控工具的设计串成一条线。
pubDate: 2026-03-23T10:00:00+08:00
tags:
  - Frontend
  - Performance
  - JavaScript
  - Monitoring
  - WebVitals
---

性能优化这个话题很容易越聊越散：一会儿在讲资源加载，一会儿在讲渲染，一会儿又在讲监控平台。

如果只记一条主线，我会选这一条：

> 大多数前端性能问题，最后都会落回到“主线程什么时候忙、什么时候空、浏览器什么时候有机会真正把页面画出来”。

所以这篇文章不打算只罗列指标，而是按下面的顺序展开：

1. 先讲 `JavaScript` 的执行原理，明确页面为什么会卡、为什么会白
2. 再讲常用性能指标，它们到底在量什么、怎么算、怎么拿
3. 最后设计一个可以自己落地的监控工具，用执行原理来解释为什么这样设计

## 1. JS 的执行原理：为什么性能问题本质上是“主线程调度问题”

### 1.1 浏览器里的 JS 不是单独运行的

浏览器里一段前端代码的执行，至少涉及这几个角色：

- `Call Stack`：调用栈，当前正在执行的同步代码
- `Heap`：堆，对象、闭包、函数上下文等内存数据
- `Web APIs`：浏览器提供的能力，比如定时器、网络请求、DOM 事件、`requestAnimationFrame`
- `Task Queue`：任务队列，等待进入主线程执行的任务
- `Render Pipeline`：样式计算、布局、绘制、合成

真正决定页面体感的，不是“JS 执行了没有”，而是：

- 主线程是不是被长时间占住了
- 微任务是不是一直刷不完
- 浏览器有没有机会开始下一帧渲染

### 1.2 一次页面更新大致发生了什么

可以把浏览器主线程理解成一个不断循环的执行器：

1. 取出一个宏任务，比如用户点击、定时器回调、脚本执行
2. 执行这段同步代码
3. 清空当前产生的微任务，比如 `Promise.then`、`queueMicrotask`
4. 如果主线程空出来了，浏览器才有机会做样式计算、布局和绘制
5. 进入下一轮事件循环

这里最关键的一点是：

> 渲染不是和当前这段同步 JS 并行发生的，而是要等这段任务和它带出来的微任务都执行完。

这句话直接解释了很多现象。

### 1.3 为什么会卡顿

页面卡顿，本质上就是主线程太久没有把控制权还给浏览器。

典型场景有三类：

- 一段同步计算太重，比如大循环、深度递归、JSON 大对象处理
- 微任务过多，比如不断链式 `Promise.then`，导致渲染一直拿不到机会
- 频繁触发布局和重绘，比如读写 DOM 交替、强制同步布局

例如下面这段代码，即使没有显式操作 DOM，也足以让页面掉帧：

```js
button.addEventListener('click', () => {
  const start = performance.now();
  while (performance.now() - start < 180) {
    // 模拟 180ms 的同步阻塞
  }
});
```

只要这 180ms 没结束，浏览器就不能开始下一帧绘制。用户感受到的就是：

- 点击后没有及时反馈
- 动画暂停
- 滚动不跟手
- 输入延迟变大

### 1.4 为什么会白屏

白屏常见，但成因并不只有一种。

从执行原理看，常见来源包括：

- 首屏渲染依赖的 JS 太大，主线程长期被初始化逻辑占住
- 同步脚本阻塞了解析，浏览器迟迟拿不到可绘制内容
- 页面虽然有 DOM，但没有真正形成可见内容，比如只剩骨架、容器、高度为 0 的节点
- 前端框架在 hydration 或首次 render 前报错，导致根节点没有渲染结果

白屏不是单纯“DOM 少”，而是：

> 在某个用户可接受的时间窗口内，页面没有出现有效可见内容。

这个定义很重要，因为它决定了白屏监控不能只看 `document.body.innerHTML.length`，还要结合绘制时机和可见元素采样。

### 1.5 一个必须记住的结论

如果只保留一句话，我建议记住这个：

> JavaScript、事件循环和渲染时机共同决定了“页面有没有机会被画出来”，而性能监控工具的本质，就是在这些关键节点上取样。

后面讲指标和监控方案，都会围绕这个结论展开。

## 2. 前端常用性能指标：计算口径、获取方式、适用场景

性能指标可以分成两类：

- 标准指标：浏览器和 Web Vitals 已经定义好的口径
- 工程指标：为了排查问题，业务自己补充的口径，比如卡顿率、白屏时长、接口瀑布、首屏关键模块渲染时间

先看标准指标。

### 2.1 TTFB

`TTFB` 表示首字节到达时间，反映服务端响应和网络链路的基础速度。

计算口径：

```text
TTFB = responseStart - requestStart
```

在页面导航场景下，也常见直接理解为：

```text
TTFB = responseStart
```

因为 `PerformanceNavigationTiming` 里的时间基准本身就是本次导航开始时刻。

获取方式：

```js
const nav = performance.getEntriesByType('navigation')[0];
const ttfb = nav ? nav.responseStart : 0;
```

适用场景：

- 判断服务端慢不慢
- 和前端渲染指标拆开看，避免把后端慢误判成前端慢

### 2.2 FP 和 FCP

`FP` 是首次绘制，表示浏览器第一次往屏幕上画了东西。

`FCP` 是首次内容绘制，表示第一次画出文本、图片、`svg`、非白色 `canvas` 等内容。

计算口径：

- `FP = first-paint.startTime`
- `FCP = first-contentful-paint.startTime`

获取方式：

```js
const paintEntries = performance.getEntriesByType('paint');

const fp = paintEntries.find((item) => item.name === 'first-paint')?.startTime ?? 0;
const fcp =
  paintEntries.find((item) => item.name === 'first-contentful-paint')?.startTime ?? 0;
```

适用场景：

- 判断“页面开始有反应了没有”
- 白屏分析中的关键锚点

局限也很明显：

- 有 `FCP` 不代表页面可用
- 只出现一个骨架屏，也可能让 `FCP` 很好看

### 2.3 LCP

`LCP` 是最大内容绘制时间，关注首屏中最大可见内容什么时候真正出现。

它更接近用户对“页面主体终于出来了”的感受，所以通常比 `FCP` 更能反映首屏体验。

计算口径：

- 取页面生命周期内，视口中最大内容元素对应的最后一个有效候选时间
- 一般在首次输入或页面隐藏前停止更新

获取方式：

```js
let lcp = 0;

const lcpObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1];
  if (lastEntry) lcp = lastEntry.startTime;
});

lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
```

适用场景：

- 评估首页、落地页、详情页的首屏主体渲染速度
- 判断资源优化、SSR、图片优化、分包是否有效

### 2.4 DOMContentLoaded 和 Load

这两个是老指标，但在工程排查里仍然有价值。

计算口径：

- `DOMContentLoaded = domContentLoadedEventEnd`
- `Load = loadEventEnd`

获取方式：

```js
const nav = performance.getEntriesByType('navigation')[0];

const dcl = nav ? nav.domContentLoadedEventEnd : 0;
const load = nav ? nav.loadEventEnd : 0;
```

适用场景：

- 观察 HTML 解析和资源完成时机
- 分析“文档好了但页面还不可用”的问题

它们不能代表真实用户体验，但可以帮助拆分阶段。

### 2.5 CLS

`CLS` 表示累计布局偏移，用来衡量页面在加载过程中有没有乱跳。

计算口径：

- 统计非用户主动触发的布局偏移
- 把有效偏移值按会话窗口累计

简化理解可以记成：

```text
CLS = sum(layoutShift.value)
```

但要注意，真实标准口径会排除部分带近期用户输入的偏移。

获取方式：

```js
let cls = 0;

const clsObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (!entry.hadRecentInput) {
      cls += entry.value;
    }
  }
});

clsObserver.observe({ type: 'layout-shift', buffered: true });
```

适用场景：

- 图片没有预留尺寸
- 异步插入广告、弹窗、推荐位
- 字体切换导致文字重排

### 2.6 INP

`INP` 表示交互到下一次绘制之间的延迟，核心关注“用户操作后多久看到反馈”。

它比只看首次交互更贴近真实产品体验，因为很多页面不是打开时卡，而是“用起来卡”。

简化口径可以理解为：

```text
INP = 一段页面生命周期内，交互延迟的高位值
```

工程上通常会把它拆成三段理解：

- 输入延迟：事件多久才开始执行
- 处理耗时：事件回调自身执行了多久
- 展示延迟：处理完后多久才真正绘制到屏幕

获取方式可以基于 `PerformanceObserver` 监听 `event`：

```js
const eventObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // duration 可以作为交互耗时观测基础
    console.log(entry.name, entry.duration);
  }
});

eventObserver.observe({ type: 'event', buffered: true, durationThreshold: 16 });
```

适用场景：

- 输入框联想
- 筛选、搜索、拖拽、切换 Tab
- 列表滚动和复杂组件交互

### 2.7 Long Task 和 TBT

`Long Task` 不是 Web Vitals 主指标，但它对解释卡顿非常重要。

浏览器把单次主线程任务执行时间超过 `50ms` 的任务视为长任务。

计算口径：

```text
Long Task: duration > 50ms
TBT = sum(max(duration - 50ms, 0))
```

`TBT` 一般看的是 `FCP` 到可交互阶段之间，主线程被长任务额外阻塞了多少时间。

获取方式：

```js
const longTaskObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('longtask', entry.startTime, entry.duration);
  }
});

longTaskObserver.observe({ type: 'longtask', buffered: true });
```

适用场景：

- 分析卡顿
- 分析首屏 JS 包过大
- 分析脚本初始化、数据处理、模板渲染导致的主线程阻塞

### 2.8 工程上常补充的三个指标

除了标准指标，我通常还会补三类工程指标。

#### 1. 卡顿次数 / 卡顿率

标准指标能告诉你“慢”，但不能直接告诉你“卡了几次”。  
工程上可以自己定义：

- 单帧间隔超过 `100ms` 记一次重度卡顿
- 单帧间隔超过 `50ms` 记一次轻度卡顿

#### 2. 事件循环延迟

它可以反映主线程调度压力：

```text
eventLoopLag = 实际触发时间 - 理论触发时间
```

这个指标很适合发现：

- 长同步任务
- 微任务堆积
- 第三方脚本抢占主线程

#### 3. 白屏时长

白屏时长不是浏览器内置指标，通常需要业务自定义：

```text
whiteScreenDuration = firstMeaningfulVisibleTime - navigationStart
```

关键难点不在于减法，而在于：

> 你如何定义“firstMeaningfulVisibleTime”。

这就进入第三部分。

## 3. 如何自己设计一个工具，获取页面是否卡顿、白屏等性能指标

如果让我从零设计一个前端性能采集 SDK，我会把它拆成四层：

1. 标准指标采集层：负责 `TTFB`、`FCP`、`LCP`、`CLS`、`INP`
2. 主线程压力采集层：负责 `Long Task`、事件循环延迟、掉帧
3. 可见内容检测层：负责判断白屏、骨架屏超时、关键区域未渲染
4. 上报与归因层：负责采样、聚合、`sendBeacon` 上报、错误上下文关联

### 3.1 先定目标：工具到底要回答什么问题

不要一上来就写 SDK，先把问题问清楚。

这个工具至少要回答下面四个问题：

- 当前页面首屏慢，是网络慢、资源慢还是主线程阻塞
- 当前页面有没有明显卡顿，卡顿发生在什么时候
- 当前页面有没有白屏，白屏持续多久
- 当卡顿和白屏发生时，页面当时在执行什么

注意最后一个问题最重要。  
因为监控不是为了“知道它慢了”，而是为了“知道它为什么慢”。

### 3.2 为什么这个工具必须从 JS 执行原理来设计

因为卡顿和白屏都不是静态状态，而是时间上的现象。

比如：

- 白屏，本质上是某段时间内没有有效绘制
- 卡顿，本质上是某段时间内主线程没有按帧节奏释放给渲染

所以工具必须在这些关键时机取样：

- 任务何时开始、何时结束
- 浏览器多久没拿到下一帧机会
- 首次可见内容何时出现
- 页面视口里到底是不是已经有业务内容

这就是为什么光收一个 `window.onload` 完全不够。

### 3.3 卡顿监控方案：Long Task + RAF 掉帧 + Event Loop Lag

只用一种手段不够，我建议组合三种信号。

#### 信号 1：Long Task

优点：

- 浏览器标准能力
- 能直接反映主线程被连续占用太久

缺点：

- 只能告诉你“有长任务”，不一定能完整描述掉帧程度

示例：

```js
const state = {
  longTasks: [],
};

const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    state.longTasks.push({
      start: entry.startTime,
      duration: entry.duration,
      name: entry.name,
    });
  }
});

observer.observe({ type: 'longtask', buffered: true });
```

#### 信号 2：`requestAnimationFrame` 检测掉帧

`requestAnimationFrame` 会在浏览器准备绘制下一帧前触发。  
如果两次回调的间隔明显超过屏幕刷新节奏，就说明中间发生了卡顿。

示例：

```js
const frameState = {
  last: 0,
  droppedFrames: 0,
  jankCount: 0,
};

function loop(now) {
  if (frameState.last) {
    const delta = now - frameState.last;

    if (delta > 50) {
      frameState.jankCount += 1;
      frameState.droppedFrames += Math.max(1, Math.round(delta / 16.7) - 1);
    }
  }

  frameState.last = now;
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
```

优点：

- 更接近用户实际看到的掉帧

缺点：

- 页面后台、标签页隐藏、低电量模式下会受到干扰
- 需要结合 `document.visibilityState` 过滤噪音

#### 信号 3：事件循环延迟

原理很简单：理论上一个定时器应该在预期时间附近触发，如果实际晚了很多，说明主线程没空。

示例：

```js
const lagState = {
  maxLag: 0,
  samples: [],
};

let expected = performance.now() + 1000;

setInterval(() => {
  const now = performance.now();
  const lag = Math.max(0, now - expected);

  lagState.maxLag = Math.max(lagState.maxLag, lag);
  lagState.samples.push({ time: now, lag });

  expected = now + 1000;
}, 1000);
```

优点：

- 能捕捉长任务之外的调度压力
- 实现简单，兼容性好

缺点：

- 精度不如 `longtask`
- 容易受页面节流策略影响

#### 一个更实用的卡顿判断口径

工程里我会这样定义：

- `longtask.duration > 100ms`：记一次重卡顿
- 连续两帧 `delta > 50ms`：记一次渲染卡顿
- `eventLoopLag > 200ms`：记一次调度阻塞

然后按页面会话聚合出：

- 卡顿总次数
- 最大卡顿时长
- 首屏阶段卡顿次数
- 用户交互后 3 秒内卡顿次数

这样数据才对排查有用。

### 3.4 白屏监控方案：绘制时机 + 视口采样 + 业务根节点判断

白屏监控最容易做错，因为只看 DOM 数量会产生大量误报。

我更推荐三段式判断。

#### 第一步：先看浏览器有没有真正开始绘制

最基础的信号是：

- 有没有 `FCP`
- 有没有 `LCP`
- 根容器是否已经挂载

如果页面加载超过一个阈值，比如 `3000ms`，依然没有 `FCP`，就已经很可疑。

#### 第二步：采样视口中的真实元素

可以在视口内取若干采样点，用 `document.elementFromPoint` 看当前点位上的元素是什么。

如果大部分点位拿到的都是：

- `html`
- `body`
- 根容器空壳
- 骨架占位层

那就说明用户视口里很可能还没有真实内容。

示例：

```js
function isMeaningfulElement(el, options = {}) {
  if (!el) return false;

  const ignoreSelectors = options.ignoreSelectors ?? ['html', 'body', '#root', '#app'];

  return !ignoreSelectors.some((selector) => {
    try {
      return el.matches(selector) || el.closest(selector);
    } catch {
      return false;
    }
  });
}

function detectWhiteScreen(options = {}) {
  const points = [
    [window.innerWidth * 0.5, window.innerHeight * 0.2],
    [window.innerWidth * 0.2, window.innerHeight * 0.5],
    [window.innerWidth * 0.5, window.innerHeight * 0.5],
    [window.innerWidth * 0.8, window.innerHeight * 0.5],
    [window.innerWidth * 0.5, window.innerHeight * 0.8],
  ];

  let meaningfulCount = 0;

  for (const [x, y] of points) {
    const el = document.elementFromPoint(x, y);
    if (isMeaningfulElement(el, options)) {
      meaningfulCount += 1;
    }
  }

  return meaningfulCount === 0;
}
```

#### 第三步：结合业务语义过滤误报

业务上通常还要加几个配置项：

- `rootSelector`：业务根节点
- `skeletonSelector`：骨架屏选择器
- `ignoreSelectors`：加载层、蒙层、播放器壳子等
- `meaningfulSelectors`：文章正文、商品卡片、标题、首图等关键内容

最终判断不要写成“只要没内容就白屏”，而应该写成：

> 在约定时间内，没有出现标准绘制信号，且视口采样没有拿到有效业务节点，且页面仍停留在空壳或占位态，则判定为白屏。

### 3.5 用执行原理解释：为什么这套白屏方案更靠谱

因为白屏本质上是“可绘制结果迟迟没有出现”，而不是“DOM 没有生成”。

举几个例子：

- JS 阻塞时：DOM 可能还没来得及生成，`FCP` 也不会出现
- CSS 阻塞时：DOM 可能已经有了，但还没形成用户看到的内容
- 骨架屏兜底时：`FCP` 已经出现，但真实业务内容还没出现
- 首屏报错时：根容器存在，但有效子节点没有挂载

所以最稳妥的方式不是盯一个值，而是同时观测：

- 主线程是否长期阻塞
- 浏览器是否产生了首次绘制
- 视口里是否已经出现有效业务元素

这三者合起来，才接近用户真实看到的“白屏”。

### 3.6 一个可落地的 SDK 结构

下面是我更推荐的实现结构：

```js
class PerfMonitor {
  constructor(options = {}) {
    this.options = options;
    this.metrics = {
      ttfb: 0,
      fp: 0,
      fcp: 0,
      lcp: 0,
      cls: 0,
      inp: 0,
      longTasks: [],
      jankCount: 0,
      droppedFrames: 0,
      maxEventLoopLag: 0,
      whiteScreen: false,
      whiteScreenTime: 0,
    };
  }

  start() {
    this.collectNavigation();
    this.collectPaintMetrics();
    this.collectLayoutShift();
    this.collectLongTasks();
    this.collectFrameDrops();
    this.collectEventLoopLag();
    this.detectWhiteScreen();
    this.bindUnloadReport();
  }

  report(payload) {
    navigator.sendBeacon(this.options.reportUrl, JSON.stringify(payload));
  }
}
```

各模块职责可以明确拆开：

- `collectNavigation`：采集导航与网络阶段
- `collectPaintMetrics`：采集 `FP/FCP/LCP`
- `collectLayoutShift`：采集 `CLS`
- `collectLongTasks`：采集长任务
- `collectFrameDrops`：采集 `RAF` 掉帧
- `collectEventLoopLag`：采集事件循环延迟
- `detectWhiteScreen`：定时检测白屏
- `report`：在页面隐藏、卸载、路由切换时上报

### 3.7 上报时不要只报“结果”，还要报“上下文”

如果只上报一个 `LCP = 4200ms`，排查价值其实很低。

更有价值的上下文包括：

- 页面 URL、路由、首屏模块标识
- 用户设备信息、网络类型、内存等级
- 首屏阶段是否有长任务
- 最大长任务发生时间和持续时间
- 首次交互前后是否发生异常
- JS 错误、资源加载错误、接口错误

性能和稳定性数据结合起来，定位速度会快很多。

## 4. 写在最后：指标不是目的，解释力才是目的

做前端性能优化，最怕的是“只会看数，不知道为什么”。

如果把这篇文章压缩成一个最小结论，就是下面三句：

- 页面卡顿，是因为主线程太久没有把执行权还给浏览器
- 页面白屏，是因为在用户可接受时间内没有出现有效可见内容
- 监控工具要有价值，就必须沿着“任务执行 -> 渲染机会 -> 可见结果”这条链路采集

所以无论你是在看 `FCP`、`LCP`，还是在做卡顿和白屏监控，底层都绕不开一件事：

> 理解 JS 是怎么执行的，浏览器又是在什么时候真正开始绘制的。

把这条主线吃透，性能指标就不再只是报表里的数字，而会变成你定位问题、设计工具、验证优化是否生效的一套坐标系。
