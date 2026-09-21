# KniuSystem 协作规范

## 1. 工作方式

1. 修改前先检索现有实现；工作树可能包含用户未提交的改动，禁止回滚或覆盖无关内容。
2. 每次功能、数据结构、接口或组件行为变化，都同步更新本文件、`api/API.md` 与 `!kniu_project/KNIU-API-CONTRACT.md`；涉及已有说明时，同时检查所有项目 Markdown，不能只更新单一文件；前端构建、PHP 语法或差异检查按风险执行。
3. 临时验证文件仅可放入 `test/`，验证完成后删除。正式代码、文档和 SQL 文件末尾不保留空行。
4. 所有本地文本改动使用 `apply_patch`；禁止用破坏性 Git 命令恢复用户文件。
5. 本文件的规则必须按实际功能归类：数据表与 SQL 归入“数据库与 SQL”，组件协议、组件属性和模板语法归入“前端组件与模板”，页面交互与 CSS 归入“交互与样式”，接口、路由和接口文档归入“接口与文档”；禁止按修改时间或文件位置混放。

## 2. 架构与安全

5. 保持 MVVM 分层：核心能力放 `client/core/`，Controller 管理状态、请求和业务，HTML 只保留声明式布局。
6. 后端是权限边界。隐藏菜单、按钮或列不能替代服务端授权；列表、详情和删除都必须再次校验身份与归属。
7. 环境、端口、数据库、Session Cookie、上传、日志与缓存目录必须按项目隔离；不得终止其他项目的进程。
8. 文本字段只在服务端单轮 HTML 编码后入库、单轮解码后返回；前端不重复编解码。
9. 排序字段必须来自白名单，排序方向只允许 `ASC` 或 `DESC`；上传必须同时验证扩展名、声明 MIME、真实 MIME 和大小。

## 3. 身份、权限与数据归属

10. `tb_role.id` 是唯一且稳定的账号标识。所有业务表中的 `role_id` 都关联 `tb_role.id`；`name` 用于登录，`nickname` 仅用于展示，不能用昵称或用户名判断归属。
11. 管理员判定统一为 `role === 1 || role_auth === 1`。普通账号只能操作自己的文章、评论、回复和资料；管理员可管理全部。
12. `tb_role.is_show=0` 表示禁用，禁止登录；`comment_ban=1` 表示禁言，只禁止评论与回复；`comment_audit=1` 表示评论和回复先审核。开关右侧为“是/绿色”，左侧为“否/红色”。
13. 昵称一年只能修改一次，服务端以 `tb_role.issue_time` 强制校验，前端仅做同样的体验限制。
14. 删除账号必须在同一事务删除其文章、关于我、评论和回复、通知状态、收藏、浏览历史，以及其文章被收藏和浏览的关联数据。

## 4. 数据库与 SQL

15. 初始化结构以 `!kniu_project/kniusql/kniu_create_tb_*.sql` 为唯一基线，初始化数据以对应 `kniu_insert_tb_*.sql` 为准；字段、索引与代码读写必须一致。`tb_role.name` 必须唯一且作为登录账号，`tb_role.email` 允许重复并统一转小写后存储。
16. 建表 SQL 只保留当前业务字段、关联字段、状态字段、时间字段和明确的扩展字段；禁止保留无业务归属的通用模板字段。`tb_seo` 的ICP备案字段唯一命名为 `icp`，不得保留或读写旧字段 `record`。
17. `tb_comment` 同时保存顶层评论和回复：`parent_id=0` 为评论，`parent_id>0` 为回复。`tb_comment_reply_status` 以 `reply_id + recipient_user_id` 保存回复已读状态，`recipient_user_id` 关联 `tb_role.id`，时间字段为 `issue_time`。
18. `tb_about` 按 `role_id` 一对一保存 `avatar`、`summary`、`content`；建表基线不得再出现旧字段名。
19. 网站 SEO 设置不保存“关于我”内容；前台关于页只读取当前账号的 `tb_about.content`。
20. 实际数据库的删除、重建、迁移或列类型收缩前，必须先确认目标、备份或验证数据量，并在完成后报告影响范围。

## 5. 前端组件与模板

当前移动端固定尺寸保底规则：使用 `max(28px, calc(数值 / var(--kniu_vw)))`，保底值必须写在逗号前；`kniu_sys_button`、`kniu_sys_input` 和普通下拉选项的移动端尺寸不得小于 `28px`。



组件与项目字号兼容规则：所有 `kniu-*` 组件的 Shadow DOM 样式必须通过统一样式入口做 vw 兼容处理；固定尺寸使用 `calc(数值 / var(--kniu_vw))`，例如 `220 / var(--kniu_vw)`；`font-size` 和 `font` 简写转换后必须使用 `max(12px,calc(数值 / var(--kniu_vw)))`，移动端最终字号不得小于 `12px`；需要移动端保底的固定尺寸必须先提供明确的像素值，再在桌面端使用 `calc(数值 / var(--kniu_vw))` 增强，`kniu_sys_input` 的移动端高度和最小高度不得低于 `28px`，不能把移动端保底值写成 `calc(28 / var(--kniu_vw))`；项目普通页面必须引入 `web.min.css`，由 `@media (max-width:calc(1280px - 60px))` 将 `html/body` 正文基准设为 `14px` 且不低于 `12px`，不得使用 `1em` 把字号锁回浏览器默认的 `16px`，也不得用通配符强制覆盖所有子元素的字号层级；移动端到桌面端的统一断点为 `calc(1280px - 60px)`，媒体查询断点不得使用 `721px`、`720px`、`851px`、`561px` 或 `calc(1024px - 60px)`。

21. 所有 `kniu-*` 组件只从 `kniu:option` 读取功能配置；对象字面量直接写为 `kniu:option="{{...}}"`，不使用额外括号包装；不支持把 `options` 当模板 attribute 使用。双向表单绑定只使用 `kniu:form`。
22. `kniu-table` 只支持 `<kniu-table><kniu-table-col ...>` 的 HTML 子标签列布局；表格 options 不接收列数组。行级条件与事件必须留在列模板中。
23. `kniu-editor.toolbar` 只支持扁平命令数组，并使用 `'|'` 分组；所有编辑器使用同一媒体大小限制配置。编辑器字体、字号、颜色、表格和表情等普通下拉面板必须纳入全局下拉样式约定；链接、图片、媒体编辑表单属于弹窗，不按下拉处理。
24. 所有 `kniu-*` 组件和项目页面统一只使用 `public/static/font/` 内现有的 `KniuHei` 字体文件，并按声明的权重映射到 ExtraLight(200)、Light(300)、Regular(400)、Normal(450)、Medium(500)、Bold(700)、Heavy(900)；禁止依赖浏览器合成粗细或引用 Noto/思源、微软雅黑、宋体、黑体、Arial、Georgia、Consolas、Robot 等系统字体。图标仍使用独立的 `kniu_iconfont`；`kniu-editor` 字体菜单只提供项目 `KniuHei`，不得再提供旧字体或通用字体选项。
25. `kniu-form` 字段可为标量或 `{ value, condition, message }`；提交时取值，只有字段对象参与验证。
26. `kniu-upload` 的空状态文案使用 `kniu:option.note`；上传文件走 multipart，数据库只保存服务端生成的 URL，不能保存浏览器 `File` 或 `blob:` 地址。
27. `kniu-image` 宿主的 `class` 或 `style` 样式优先于组件默认值；组件默认背景色为 `#f5f7fa`，Shadow DOM 内部背景必须继承宿主背景。组件被放入其他组件插槽时，插槽样式不得用 `max-height` 等约束覆盖宿主显式宽高；没有 `src` 时不渲染 `.kniu_sys_image`，有有效 `src` 时再创建图片元素。前台公共头部品牌图从后台 SEO 的 `/seo_list` 返回字段 `logo` 读取；数据为空或请求失败时才回退至 `/public/static/img/logo01.png`，不得从登录身份对象读取不存在的 `logo` 字段，也不得使用无效的 `src:()` 插值语法。
28. 组件插槽统一写作 `<template #name>`；`kniu-navbar` 宿主布局必须由组件内部 `:host` 提供 `display:flex;justify-content:space-between;align-items:center;width:100%;height:inherit`，页面模板不得重复声明 `kniu-navbar` 布局；导航菜单、`kniu-navbar-cells`、`kniu-navbar-cell`、`kniu-sub-navbar` 和 `kniu-user-login` 统一继承 `--kniu-navbar-font-size`，普通导航文案不再各自设置字号，品牌字号可以单独放大；`.kniu_sys_head_placeholder` 由组件生成并由组件统一注入 `z-index:-999;position:relative;display:block;width:100%;height:100%` 的样式，页面不得另行维护占位样式；`.kniu_sys_navbar_bar` 必须删除原有 `padding` 和 `margin:0 auto`，基础样式使用 `margin-right:auto;margin-left:auto;width:calc(100vw - 30 / var(--kniu_vw) * 2);height:inherit`，并在 `@media (min-width:calc(1280px - 60px))` 下使用 `width:calc(100vw - 220 / var(--kniu_vw) * 2)` 和 `min-height:72px`；`fixed` 表示 `top` / `bottom` 悬浮位置，存在 `fixed` 时默认启用 `placeholder`，`placeholder:true` 必须在组件后生成 `.kniu_sys_head_placeholder` 并按导航实际高度占位；桌面端 `name="default"` 的插槽必须位于 `.menu` 外并排在 `.menu` 前面，`name="append"` 位于 `.menu` 内，移动端再将 `default` 投影回 `.menu` 并排在 `append` 前；移动菜单 `.menu` 的 `top` 必须使用外层 `.kniu_web_head` 的实际高度并随头部尺寸同步，禁止写死 `60px` 等固定头部高度；`kniu-navbar-cell` 使用语义化的 `route` 配置匹配当前路由，不再使用 `index`，并使用 `href` 配置导航地址；导航 active/side 状态同步必须使用原生 `toggleAttribute`，不得调用不存在的自定义属性切换方法；移动菜单打开时必须将根元素 `html` 设置为 `overflow:hidden`，关闭或卸载后恢复原值；`kniu-user-login` 移动端 `.user` 必须使用 `padding: 0 16px 0 calc(16px + var(--kniu-navbar-level, 0) * 16px)`，桌面端恢复无内边距；移动导航收起时同步关闭用户下拉菜单，所有 portal 浮层关闭后恢复原始节点位置、清除 `data-open`、`position`、`left`、`top`、`right`、`bottom`、`transform`、`visibility` 等临时状态；用户下拉菜单每次打开必须在下一帧重新测量触发按钮，且在导航动画期间持续跟随锚点，重复开闭不得复用失效坐标；默认插槽改为 `append` 时，附加按钮应无边框、无圆角。
29. 不支持的组件属性和事件必须修复核心解析器或组件协议，不能在页面退回已废弃写法。业务 Controller 统一 `import MVVM from '../../core/kniumvvm.mjs'`，UI 统一 `import UI from '../../core/kniuui.js'`；应用入口统一 `import CREATEAPP from './core/kniubase.mjs'` 并调用 `CREATEAPP()`；路由入口统一使用 `EVENTER`、`LOGGER` 和 `ROUTER.add(path, controller)`；前端第三方包在源码中使用包名导入，开发/预览直加载模式必须通过 Import Map 提供浏览器可解析地址，生产构建仍由构建器打包。`usePagination` 已通过 `SYNC.autoSync` 自动响应服务端数据变更，新增、修改、审核或删除成功回调不得再手动刷新同一页，避免列表接口重复请求；搜索、分页和每页条数切换等用户主动操作仍可调用 `loadList`。使用 `createRowDeleteHandler` 时默认也不手动刷新，只有静默表才显式开启 `reloadOnSuccess`。详情页等会因查询参数重新挂载的页面，不得再让旧实例通过路由监听重复加载；同一接口请求参数不得加入随机时间戳来绕过 `REQUEST` 的并发去重。
30. `kniu:style` 支持 CSS 字符串和对象两种绑定形式；对象键可使用 camelCase（如 `marginTop`）或 CSS 自定义属性，值可直接使用 `calc()`、`var()` 等 CSS 函数。绑定更新只能清理由该指令上次写入的属性，不得覆盖元素原有静态内联样式或 class 样式，也不得把对象转换为 `[object Object]`。
31. 所有原生 HTML 标签和 `kniu-*` 组件都支持 `kniu:option`。组件继续写入自身 `options` 协议，同时必须将 `on*` 函数绑定到组件宿主事件；`kniu:option` 内的所有事件字段必须以 `on` 开头并使用 camelCase（如 `onClick`、`onInput`），禁止 `click`、`input` 等旧写法。事件修饰符统一拼接为大驼峰且禁止含点：`onKeydownEnter` 等价于 `kniu@keydown.enter`，`onClickPrevent` 等价于 `kniu@click.prevent`；全部事件及修饰符规则与对应 `kniu@事件.修饰符` 一致，包含键盘、鼠标、系统键、`self/exact/prevent/stop` 与 `capture/once/passive/native`。原生标签的普通标准字段写入对应属性，未知 camelCase 字段转为 `data-*`（如 `articleId` 转 `data-article-id`），可从 `event.currentTarget.dataset` 读取；`onClick` 默认阻止链接默认跳转，业务导航由处理函数执行。
32. 前台首页文章标题搜索使用已加载的可见文章列表进行本地、大小写不敏感的筛选；输入事件必须防抖，点击搜索或按 Enter 必须携带关键词跳转首页后立即筛选。筛选不能重新请求首页文章接口，也不能丢失自动同步刷新后的完整原始列表。
45. `kniu-editor` 代码模式美化（`_beautifyHtml`）必须对**行内型正文**同样产生行结构：正文实际靠 `<br>` 分行（区块标签很少）时，每个 `<br>` 之后按当前层级断行+缩进，紧随其后的文本丢掉行首缩进以保持幂等；`<br>` 紧跟块级闭合标签（如 `<p>文字<br></p>`）时不落断行、不改原样。整篇**没有任何标签**时（纯文本 / Markdown / 被转义过的正文）禁止走空白折叠分支，只统一 `CRLF`，否则整篇会被压成一行。`tb_article` 正文的真实形态即「Markdown 纯文本 + `<br>` + `CRLF`」（`&lt;br&gt;` 是服务端 `htmlspecialchars` 的存储态，返回前端由 `decodeFields` 解回），只有按块级标签断行的实现会把它压成一行。美化逻辑的每次改动都必须跑 `test/beautify_probe.mjs`：该探针断言「同一输入连跑两遍 `v1 === v2`」「行数 ≥ 正文 `<br>` 个数」，并内置真实正文用例。
46. Markdown 文章由 `client/core/kniucode.mjs` 以 CommonMark 块级语法解析，表格与删除线仅作为 GFM 扩展处理；列表必须忠实保留 `- `、`+ `、`* ` 的 `<ul><li>` 语义，不能因为项目内容含行内代码、占位符或中文而转成段落、`<br>` 或其他特例；段落中行尾两个及以上空格或反斜杠必须输出 CommonMark 硬换行 `<br>`。修改 Markdown 解析后必须运行 `test/detail_code_fence_probe.mjs`。
47. 控制器需要在模板绑定、页面加载或 `onMounted` 前执行的工作，统一使用 `onBeforeMount`；不得将这类初始化前操作延后到接口完成或内容渲染之后。

## 6. 交互与样式

30. CSS 禁止 `background:` 简写；分别使用 `background-color`、`background-image`。所有组件普通下拉面板统一为白底、`1px solid #e4e7ed`、`border-radius:4px`、`box-shadow:0 2px 12px rgba(0,0,0,.1)`；普通选项统一使用 `min-height:32px;padding:0 12px`，不得把该样式应用到模态框或移动端全屏导航。修改样式后检索相关源码确认。
31. `textarea.kniu_sys_input` 默认最小高度为 `120px`；表格 `th/td` 默认 `padding: 5px 10px`。
32. 组件宿主的宽高必须传递到 Shadow DOM 实际元素；图片默认 `object-fit: contain`，除非明确配置。
33. 未登录时不渲染评论输入区、回复操作和登录后资料区；点赞、收藏等需要登录的操作应引导到登录页。评论点赞仍展示，但未登录不可执行。
34. 评论、文章点赞和收藏都以当前账号 ID 判断状态；点赞与收藏可反选，按当天 00:00 重置的逻辑必须由服务端保障。成功后局部异步更新，避免整页刷新或跳动；点赞状态重渲染不得遗留动画播放锁，每次服务端确认成功点赞都必须重新触发对应的上漂反馈，取消点赞及旧反馈重渲染不得播放动画；动画判断必须使用服务端返回的最新 `liked` 状态，不能使用请求前的旧状态。评论红心反馈必须按“评论 ID + 反馈标记”仅消费一次，某条评论点赞后的列表重渲染不得触发其它评论或此前点赞评论的动画；控制器更新目标评论后必须清除其它行的旧 `likeFeedback`。评论红心反馈保留评论按钮独立的 `left:50%` 与负 `margin-left` 水平居中方式，垂直位移保持原有 `-4px`、`-18px` 起点和中间点，仅将终点从 `-48px` 小幅缩短为 `-42px`；插入节点后先强制建立首帧再启动动画，避免评论按钮的 flex 布局或同帧渲染导致红心不移动。组件 CSS 负 px 值必须转换为 `calc(-数值 / var(--kniu_vw))`，不能生成 `-calc(...)`。
35. 评论本人内容显示在右侧、他人内容显示在左侧，判断仅使用 `role_id`。头像优先使用该账号 `tb_about.avatar`，无头像才使用默认头像。
36. 前台头部占位由 `kniu-navbar` 的 `fixed` / `placeholder` 配置统一管理；`fixed` 存在时默认启用 `placeholder`，组件后生成并维护 `.kniu_sys_head_placeholder`，不得再使用页面手写的旧占位类，页面切换不得移除固定导航占位。

## 7. 接口与文档

列表数据变更后禁止同时保留“成功回调手动刷新”和 `SYNC.autoSync` 自动刷新；内容表删除由自动同步负责，静默表优先在成功回调内局部更新。所有前台初始加载器也必须复用当前进行中的请求；自动同步在加载期间只登记一次待刷新，待当前请求结束后最多补刷一次，不能在请求边界并发或重复触发。详情页跨页面切换时旧实例不得通过路由监听重复加载；同一路径仅更新文章参数时，当前实例可以按文章 ID 变化加载一次。详情请求参数不得加入随机时间戳来绕过 `REQUEST` 的并发去重。

37. 所有 API 使用统一响应：`{ status, msg, data }`，其中 `status=1` 成功、`status=0` 失败。HTTP 状态码仍表达鉴权、参数和服务器错误。
38. 新增或修改接口时，必须更新 `api/config/router.php`、`api/API.md`（当前 PHP 实现说明）和 `!kniu_project/KNIU-API-CONTRACT.md`（语言无关契约）；注册、登录等接口必须捕获可预期的运行时异常并返回统一 JSON，不得把异常泄露为 HTML 500。解绑可重复绑定的身份令牌时必须写入 SQL `NULL`，不能传被 ORM 过滤的 PHP `null`。接口说明中的字段、路由和错误语义必须以当前路由与 SQL 基线复核。
39. `!kniu_project/KNIU-API-CONTRACT.md` 是跨语言后端实现的权威行为规范：替换后端语言时必须保持路径、请求字段、响应字段、权限、错误语义、时间规则和数据归属不变；`/getDetail` 成功读取文章时必须原子递增并返回最新 `hits`。
40. 高频私有状态（浏览历史、收藏、验证码、身份令牌、回复已读状态）不得触发全站数据刷新；内容变更使用数据版本或通知信号做增量刷新。
41. 恢复或迁移后端文件时必须先查阅 `!kniu_project/KNIU-API-CONTRACT.md` 的目录职责表：业务归入 `app/`、公共能力归入 `core/`、配置归入 `config/`、数据库基线归入 `!kniu_project/kniusql/`、可再生数据归入 `runtime/`，不得混放。旧的 API 契约路径和旧 SQL 目录不是当前文档或基线位置。
42. 开发服务器与预览服务器都必须为 `/events` 返回 `text/event-stream`；预览环境缺少 SSE 路由时不得将该请求回退为 HTML，否则 EventSource 会持续报 MIME 错误。
43. 所有项目 Markdown 都必须以当前源码、`client/config/router.js`、`api/config/router.php` 和 `!kniu_project/kniusql/` 为基线；发现导入别名、路由方法、组件写法、字段名、接口路径或目录路径过期时，必须在同一轮修正相关说明，并运行关键字残留检查与 `git diff --check`。日期选择器的普通日历和范围日历必须使用各自 `_render` 作用域内已声明的 `weekLabels`，禁止引用不存在的全局变量。
44. 前台公共头部和页脚通过公开 `/getInfo` 获取 SEO 的 `title`、`logo`、`copyright`、`icp`；`/seo_list` 仅供后台 SEO 管理使用，不得由前台直接调用。
