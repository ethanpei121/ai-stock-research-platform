# 前端重设计基线报告

## 1. 报告目的

这份文档用于梳理当前 `frontend` 的真实实现方式、技术栈、页面结构、数据流和样式体系，帮助后续进行前端重设计规划。目标不是评价视觉好坏，而是明确：

- 当前前端是如何工作的
- 哪些设计与工程决策已经形成约束
- 哪些部分适合保留，哪些部分更适合重构
- 下一轮设计改版应如何拆阶段推进

---

## 2. 当前前端概览

当前前端是一个基于 **Next.js App Router + TypeScript** 的单页式研究面板，核心使用方式是：

- 首页承载主分析入口
- 用户输入股票代码后触发行情、新闻、AI 总结
- 页面下方还有一个推荐股票模块
- 推荐模块默认展示固定观察池，点击按钮后再切换到实时推荐

整体更接近“单页研究工作台”而不是多页面产品。

---

## 3. 技术栈

### 3.1 框架与运行时

- **Next.js 14.2.5**
- **React 18.3.1**
- **TypeScript 5.5.4**
- **App Router**

对应文件：

- [frontend/package.json](/d:/ai-stock-research-platform/frontend/package.json)
- [frontend/app/layout.tsx](/d:/ai-stock-research-platform/frontend/app/layout.tsx)

### 3.2 样式方案

当前没有使用 Tailwind、CSS Modules、styled-components 或组件库，样式全部集中在：

- [frontend/app/globals.css](/d:/ai-stock-research-platform/frontend/app/globals.css)

这意味着当前样式体系是：

- 全局 CSS 驱动
- 依赖 className 约定
- 视觉变量通过 CSS 自定义属性管理
- 页面和组件样式高度耦合在一个文件里

### 3.3 数据请求

当前没有引入 React Query、SWR、Apollo 这类数据层库，而是使用原生 `fetch` 封装：

- [frontend/lib/api.ts](/d:/ai-stock-research-platform/frontend/lib/api.ts)

数据请求方式的关键点：

- 浏览器不直接请求 Render 后端
- 浏览器请求 Vercel 同源的 `/api/v1/*`
- Next.js Route Handler 再转发到 Render 后端

这样做的核心目的是规避浏览器跨域和冷启动问题。

代理逻辑基础文件：

- [frontend/lib/backend-proxy.ts](/d:/ai-stock-research-platform/frontend/lib/backend-proxy.ts)

### 3.4 状态管理

当前没有 Redux、Zustand、Jotai 或 Context Store。状态全部保存在首页组件本地：

- [frontend/app/page.tsx](/d:/ai-stock-research-platform/frontend/app/page.tsx)

这是一种“轻量但集中”的实现方式，适合 MVP，但后续扩展会开始吃力。

---

## 4. 当前目录与职责划分

### 4.1 页面层

- [frontend/app/page.tsx](/d:/ai-stock-research-platform/frontend/app/page.tsx)

职责：

- 管理首页全部交互
- 管理股票代码输入
- 发起行情/新闻/总结/推荐请求
- 管理加载、错误、成功态
- 作为整个首页的 orchestration layer

### 4.2 组件层

- [frontend/components/InputPanel.tsx](/d:/ai-stock-research-platform/frontend/components/InputPanel.tsx)
  - 输入框、操作按钮、顶部状态信息
- [frontend/components/QuoteCard.tsx](/d:/ai-stock-research-platform/frontend/components/QuoteCard.tsx)
  - 行情卡片
- [frontend/components/NewsList.tsx](/d:/ai-stock-research-platform/frontend/components/NewsList.tsx)
  - 新闻列表卡片
- [frontend/components/SummaryCard.tsx](/d:/ai-stock-research-platform/frontend/components/SummaryCard.tsx)
  - AI 总结卡片
- [frontend/components/RecommendationsPanel.tsx](/d:/ai-stock-research-platform/frontend/components/RecommendationsPanel.tsx)
  - 推荐股票模块

这些组件基本都是“展示组件”，大部分业务逻辑仍然集中在 `page.tsx`。

### 4.3 数据与类型层

- [frontend/lib/api.ts](/d:/ai-stock-research-platform/frontend/lib/api.ts)
  - 请求封装、错误解析、响应 normalize
- [frontend/lib/types.ts](/d:/ai-stock-research-platform/frontend/lib/types.ts)
  - 前端业务类型定义
- [frontend/lib/default-recommendations.ts](/d:/ai-stock-research-platform/frontend/lib/default-recommendations.ts)
  - 固定推荐股票池
- [frontend/lib/formatters.ts](/d:/ai-stock-research-platform/frontend/lib/formatters.ts)
  - 时间、百分比、价格等格式化逻辑

### 4.4 API 代理层

- [frontend/app/api/v1/quote/route.ts](/d:/ai-stock-research-platform/frontend/app/api/v1/quote/route.ts)
- [frontend/app/api/v1/news/route.ts](/d:/ai-stock-research-platform/frontend/app/api/v1/news/route.ts)
- [frontend/app/api/v1/summary/route.ts](/d:/ai-stock-research-platform/frontend/app/api/v1/summary/route.ts)
- [frontend/app/api/v1/recommendations/route.ts](/d:/ai-stock-research-platform/frontend/app/api/v1/recommendations/route.ts)

职责：

- 作为前端和后端之间的中间层
- 屏蔽跨域问题
- 给浏览器提供统一的同源入口

---

## 5. 当前页面结构与交互逻辑

### 5.1 首页主要区域

当前首页大致由 3 层组成：

1. 顶部 Hero + 输入区域
2. 中部三张核心结果卡
3. 底部推荐股票模块

其中输入区域和状态说明由 `InputPanel` 承担，核心结果区由：

- `QuoteCard`
- `SummaryCard`
- `NewsList`

三者共同组成一个 research dashboard。

### 5.2 主分析流程

当前主分析流程定义在 [frontend/app/page.tsx](/d:/ai-stock-research-platform/frontend/app/page.tsx)。

流程如下：

1. 用户输入股票代码
2. 点击“重新分析”
3. 前端并发请求：
   - `GET /api/v1/quote`
   - `GET /api/v1/news`
4. 拿到 quote/news 后，再请求：
   - `POST /api/v1/summary`
5. 页面按模块分别更新状态

特点：

- 行情与新闻并发
- 总结后置
- 失败时按卡片粒度展示错误，不是整页报错

### 5.3 默认启动行为

首页当前会在首次进入时自动分析默认股票 `AAPL`。

这意味着：

- 首屏不是纯静态 landing
- 页面加载即触发真实接口请求
- 在冷启动或后端响应慢时，首屏先看到加载态

这对展示“产品可用性”有帮助，但对重设计有一个明显影响：

- 如果你想把首页改得更像品牌主页、研究入口页或多模块门户，就需要重新评估是否保留自动分析行为

### 5.4 推荐模块行为

推荐模块目前是“双模式”：

- **默认模式**：固定推荐股票池
- **点击按钮后**：真实数据实时推荐

对应文件：

- [frontend/lib/default-recommendations.ts](/d:/ai-stock-research-platform/frontend/lib/default-recommendations.ts)
- [frontend/components/RecommendationsPanel.tsx](/d:/ai-stock-research-platform/frontend/components/RecommendationsPanel.tsx)

这是当前前端里一个很值得保留的产品策略，因为它解决了两个问题：

- 首屏不依赖实时计算，也能有内容可看
- 用户需要时才进入高成本分析流程

---

## 6. 数据流与接口依赖关系

### 6.1 浏览器侧请求路径

当前浏览器请求的不是后端真实域名，而是：

- `/api/v1/quote`
- `/api/v1/news`
- `/api/v1/summary`
- `/api/v1/recommendations`

再由 Next.js Route Handler 转发到 Render。

### 6.2 API 封装特点

[frontend/lib/api.ts](/d:/ai-stock-research-platform/frontend/lib/api.ts) 目前承担了 3 类职责：

1. 统一请求封装
2. 错误信息提取
3. 响应结构 normalize

这里的 normalize 非常重要，因为它说明前端已经在兼容后端字段不稳定的问题，例如：

- `provider` 缺失时补默认值
- `providers` 缺失时补空数组
- `summary.meta` 缺失时补 fallback

这属于 MVP 阶段比较实用的“前端容错层”。

### 6.3 当前前端数据模型

[frontend/lib/types.ts](/d:/ai-stock-research-platform/frontend/lib/types.ts) 中最关键的抽象有：

- `Quote`
- `NewsResponse`
- `SummaryResponse`
- `RecommendationsResponse`
- `AsyncSection<T>`

其中 `AsyncSection<T>` 是当前页面状态管理的核心：

- `idle`
- `loading`
- `success`
- `error`

这套模式简单直接，适合当前规模，但如果未来页面继续扩展到多个 tab、多个区块、多个时间维度，建议升级为更明确的 state machine 或数据层方案。

---

## 7. 当前状态管理方式评估

### 7.1 优点

- 简单
- 易于理解
- 调试成本低
- 不需要额外依赖

### 7.2 局限

随着功能增加，当前状态管理会出现这些问题：

- `page.tsx` 变成“超级控制器”
- 不同模块的状态、依赖、重试逻辑都堆在一个页面组件中
- 很难复用分析流程到其他页面
- 后续如果增加“个股详情页 / 推荐详情页 / 行业页”，迁移成本会上升

### 7.3 结论

当前适合 MVP，但不适合继续无节制扩张。下一轮重设计时，建议至少拆成：

- 页面容器层
- 领域 hooks 层
- 展示组件层
- API client 层

例如：

- `useStockAnalysis(symbol)`
- `useRecommendations(filters)`

---

## 8. 当前样式体系分析

### 8.1 视觉方向

当前不是常规 SaaS 后台，而是有意做成“研究简报 / 编辑式仪表盘”的混合风格。主要特征：

- 大号 serif 标题
- 米白纸张底色
- 模糊光晕与细网格背景
- 信息卡片有 paper/glass 质感
- 强调“memo / market tape / closing note / event watch”这类投研语义

这是一个明确的视觉方向，不是纯模板化页面。

### 8.2 样式工程问题

当前样式虽然有方向，但工程上存在几个明显问题：

- 所有样式几乎都堆在 [frontend/app/globals.css](/d:/ai-stock-research-platform/frontend/app/globals.css)
- 页面级布局、组件级样式、状态样式、推荐模块样式混在同一个文件
- 命名虽然相对清晰，但文件规模变大后维护成本高
- 任何局部设计调整，都容易影响全局

### 8.3 当前样式适合度判断

如果你下一步是“小改 UI”，当前方案还能继续撑一段时间。  
如果你下一步是“重做品牌化视觉、模块重组、增加多页面”，那就不建议继续把所有样式留在一个 `globals.css` 里。

---

## 9. 当前实现的优点

以下部分建议优先保留，而不是推倒重来：

### 9.1 同源代理架构

前端通过 Next.js Route Handler 代理后端，这个方案是合理的，应当保留。

优点：

- 避免浏览器直接跨域请求后端
- 环境切换更稳定
- 可在前端侧加入统一鉴权、限流、日志、缓存策略

### 9.2 类型与 normalize 机制

当前前端对后端返回做了 normalize，这意味着系统已经吸收过“线上结构不一致”的实际问题。这层能力应当保留。

### 9.3 推荐模块的双模式设计

“固定观察池 + 手动实时分析” 是一个很好的产品结构，比一打开就全量实时计算更合理，也更适合演示和后续扩展。

### 9.4 组件边界初步清晰

虽然 orchestration 仍集中在 `page.tsx`，但展示组件边界已经形成，后续重构成本不算高。

---

## 10. 当前实现的主要问题

### 10.1 首页承担过多职责

当前首页同时负责：

- Hero 展示
- 输入交互
- 主分析调度
- 推荐模块调度
- 错误管理
- 各区块状态同步

这会导致：

- 页面文件越来越重
- 重设计时结构调整困难

### 10.2 视觉语言虽然有方向，但层次还不够稳定

目前页面已经摆脱了“普通 AI 面板”的模板感，但还存在这些问题：

- 信息密度分布不够均衡
- Hero、分析区、推荐区之间的视觉节奏还不够完整
- 局部区域仍然偏“卡片拼接”
- 缺少更明确的品牌层级与导航语言

### 10.3 缺少设计系统层

当前有颜色变量，但还没有真正的设计系统抽象，例如：

- 间距 token
- 字体层级 token
- 阴影 token
- radius token
- 交互状态 token
- 标准化卡片/按钮/标签组件规范

这意味着下一版改 UI 时，容易变成“局部修补”而不是“体系升级”。

### 10.4 可扩展性有限

如果后续要增加：

- 行业详情页
- 个股详情页
- 公告卡片
- 基本面卡片
- 历史趋势图
- 用户收藏/观察池

当前架构会很快变得拥挤。

---

## 11. 重设计时必须考虑的现有约束

### 11.1 不能破坏现有代理请求结构

前端目前依赖同源 `/api/v1/*` 代理，这层不要轻易取消。

### 11.2 推荐模块有两种内容来源

推荐模块不是单一接口渲染，而是：

- 静态默认池
- 实时计算结果

UI 设计必须同时容纳这两种状态。

### 11.3 A 股 / 美股混合输入场景要保留

输入框当前支持：

- `AAPL`
- `MSFT`
- `300750`
- `600519`

新的交互设计不能默认只面向某一个市场。

### 11.4 错误与空状态必须保留

当前 MVP 已经处理了：

- loading
- error
- empty
- success

改版时不能只做理想态视觉稿，必须给每个卡片设计异常态。

---

## 12. 建议的重设计方向

这里给出 3 条可以选的方向。

### 方向 A：研究终端型

适合目标：

- 强调专业感
- 更像投研工作台
- 面向“快速判断一只股票”

建议特征：

- 更强的数据层级
- 更少装饰性 Hero
- 更像 terminal / memo / blotter
- 加入时间、来源、可信度等信息权重

适合保留：

- 当前 `Market Tape / Closing Note / Event Watch` 这套语义

### 方向 B：研究简报型

适合目标：

- 强调品牌感与可演示性
- 更适合对外展示 MVP
- 更像“每日研究快报”

建议特征：

- 一屏一只股票
- 更强版面编排
- 更像 editorial layout
- 推荐模块更像“主题观察名单”

适合保留：

- 当前偏 editorial 的排版基础

### 方向 C：双层产品型

适合目标：

- 首页负责发现与推荐
- 个股页负责深度分析

建议结构：

- 首页：推荐池、热门主题、今日事件
- 个股页：行情、新闻、AI 总结、基本面、公告

如果你打算把产品长期做下去，我最推荐这个方向，因为它比“所有内容都堆首页”更健康。

---

## 13. 工程层重构建议

### 13.1 页面结构建议

建议把首页拆成：

- `HomeHero`
- `AnalysisWorkspace`
- `RecommendationsWorkspace`

让 `page.tsx` 只负责拼装，不再直接承担全部业务逻辑。

### 13.2 业务 hooks 建议

建议增加：

- `useStockAnalysis`
- `useRecommendations`

职责：

- 统一管理请求、错误、状态切换、重试
- 让组件只消费结果

### 13.3 样式体系建议

至少做以下 1 项：

1. 保留原生 CSS，但拆成模块化文件  
2. 引入 CSS Modules  
3. 引入 Tailwind + design tokens  

如果你下一轮主要目标是“高效重设计 + 快速试视觉”，我更建议：

- 使用 CSS Modules 或 Tailwind
- 同时建立 design tokens

### 13.4 设计系统建议

建议先抽出一层轻量 UI 规范：

- 按钮
- 标签
- 指标卡
- 状态 chip
- 区块标题
- 筛选 pill
- 数据表/列表项

不一定要立刻引入大组件库，但必须先有统一部件语言。

---

## 14. 推荐的前端重设计实施顺序

### 阶段 1：信息架构重排

先确定产品结构，而不是先改颜色。

需要先回答：

- 首页到底是“分析页”还是“发现页”
- 推荐模块是主角还是辅助入口
- 个股分析是否应该独立成一个 workspace

### 阶段 2：设计系统抽象

先统一：

- 色彩系统
- 字体层级
- spacing
- card / chip / button / section title 规范

### 阶段 3：代码结构调整

在视觉大改前先把结构理顺：

- 拆 hooks
- 拆 container
- 拆样式文件

### 阶段 4：逐块替换 UI

建议按这个顺序替换：

1. Hero / 输入区
2. 主分析三卡
3. 推荐模块
4. 全局背景和响应式细节

这样风险更低，不容易一次性把页面改崩。

---

## 15. 一个更适合当前项目的规划建议

结合这个项目已经有的功能，我建议下一轮前端规划优先采用：

**首页做“发现与推荐”，个股做“分析与研究”。**

原因：

- 当前首页信息已经比较多
- 推荐模块已经足够像入口，不适合永远放在分析页下面做配角
- 后端数据源正在变多，未来会有新闻、公告、基本面、推荐、总结等多个维度
- 如果继续单页堆叠，后续体验会越来越重

更具体一点：

- 首页：推荐股票、行业主题、今日事件、快速入口
- 个股页：行情、AI 总结、新闻、公告、基本面、估值、催化

这是最利于长期扩展的一种前端结构。

---

## 16. 结论

当前前端并不是“不能用”，而是已经完成了一个比较典型的 MVP 阶段：

- 有明确业务闭环
- 有清晰组件边界
- 有稳定的代理请求链路
- 有一定视觉方向

但它也已经到达一个明显节点：

- 再继续加功能，首页会越来越重
- 再继续在 `globals.css` 上补样式，维护成本会快速上升
- 如果下一步要做更成熟的前端体验，应该从“信息架构 + 设计系统 + 页面拆分”三个层面一起动手

因此，下一轮前端重设计不建议只做视觉换皮，而建议把以下三件事一起纳入规划：

- 信息架构重排
- 样式体系升级
- 页面与状态逻辑拆分

---

## 17. 建议你下一步直接产出的设计文档

为了真正进入设计规划阶段，建议你基于本报告继续产出 3 份文档：

1. **前端信息架构草案**
   - 首页有什么
   - 个股页有什么
   - 推荐模块放哪

2. **视觉系统规范草案**
   - 字体
   - 色板
   - 卡片体系
   - 按钮与标签体系

3. **前端重构任务拆解**
   - 先拆结构
   - 再换 UI
   - 最后补交互与响应式

如果你愿意，我下一步可以直接继续帮你输出第 2 份：  
**“AI Stock Research Platform 前端重设计方案（信息架构 + 视觉方向 + 页面线框建议）”**。
