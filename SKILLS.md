# KniuSystem 长期协作规则

## 一、通用协作

1. 源码、注释、文档、测试、资源及构建产物只使用项目自身命名；外部参考仅吸收功能、状态和交互逻辑，不写入其品牌名称，也不照抄视觉样式。
2. 所有临时测试文件只放在根目录 `test/`，不允许创建其它测试文件目录，验证后删除；正式自动化测试可长期保留。
3. 每次修改后执行与风险匹配的语法、差异和构建检查；文本文件末尾不得保留空行，构建成功不能代替源码检查。
4. 架构、公共 API、接口或数据结构变化时，同步更新设计文档、接口文档、组件说明和必要注释。
5. `SKILLS.md` 只记录跨页面、可复用的长期约束；不记录一次性报错、临时路径和操作流水。新增规则前先检索并合并同义项，保持编号连续。
6. 修复问题时保留用户指定的标签、插槽和布局结构；公共能力不足应修复核心模块，不以业务页面补丁或不存在的属性绕过。

## 二、架构、环境与安全

7. 保持现有 MVVM 分层和数据驱动设计：公共能力归入核心模块，Controller 负责业务状态与请求，页面模板保持声明式简洁。
8. 浏览器与服务端共用模块访问 `process`、文件系统等能力前必须判断运行环境；环境变量读取集中到环境核心模块。
9. 同机多项目必须隔离前端/API 端口、数据库、Session Cookie 名称与目录、上传、缓存和日志目录；Cookie 不按端口隔离，数据库与上传目录必须配套。
10. 环境文件、默认配置、启动文档和实际端口保持一致；停止服务只终止当前项目进程，不能按进程名批量结束系统同类进程。
11. 敏感权限必须前后端双重校验，不能只隐藏菜单或按钮；服务端是最终权限边界，列表接口不得返回密码哈希等敏感字段。
12. 管理权限统一判定为 `role === 1 || role_auth === 1`；非管理账号后台只读，仅允许查询和修改本人密码，演示账号的额外限制仍需执行。
13. 非管理员修改本人密码必须依次输入旧密码、新密码和确认密码；后端验证旧密码和目标身份，成功后立即走统一退出流程。管理员修改他人密码可留空表示不修改，且不退出管理员会话。
14. 前台未接入真实 OAuth、短信或邮件服务时不得伪造第三方登录；访客身份使用浏览器随机令牌，服务端只保存其 SHA-256，并从数据库昵称写入评论，禁止信任客户端昵称。

## 三、样式与可访问性

15. CSS 禁止使用 `background` 简写：纯色或透明色用 `background-color`，图片或渐变用 `background-image`，动态样式用 `style.backgroundColor/style.backgroundImage`，过渡属性写 `background-color`。修改样式后用 `rg "background\\s*:"` 扫描相关源码；配置对象的 `background: true` 不是 CSS，不得误改。
16. 组件颜色、字体、间距、圆角、尺寸、悬停、聚焦、禁用、响应式和键盘交互保持统一；组件必须兼顾可访问性、可维护性和可测试性。
17. 所有 `kniu-*` 组件支持宿主 `style`；Shadow DOM 设置宽高时必须检查宿主到实际元素的完整尺寸参照链。
18. 原生 checkbox 使用统一自绘外观：选中为主题色方框和白色对号，并覆盖半选、键盘焦点及禁用状态；Shadow DOM 与普通页面分别提供样式。
19. `readonly` 输入框和文本域聚焦时不得显示蓝色边框、外框或阴影；`disabled` 上传组件清除宿主底色，但保留预览项底色。
20. 图片和上传预览默认 `object-fit:contain`，除非有效配置明确指定其他 fit，避免图片被裁切。
21. 组件内主按钮使用项目蓝色主题，次要按钮使用白底灰边框；同组按钮高度一致，禁止擅自引入非项目语义色。

## 四、自定义组件协议

22. 所有 `kniu-*` 组件仅从 `kniu:options` 读取功能配置，旧宿主配置属性不兼容；`ref`、`kniu:model`、模板指令、插槽和 `kniu@...` 事件仍有效。无实际配置时省略空 `kniu:options`。
23. 组件功能事件优先通过 options 的 `onXxx` 配置，并由统一事件桥触发一次；组件内部不得重复直接调用回调。
24. options 映射优先写入有 setter 或 writable descriptor 的 property，否则才内部反射 attribute；不能用 `key in element` 判断可写性，避免写入只读 getter。
25. 组件内部动态创建的子组件同样使用 options，不依赖已废弃 attribute；新增组件必须先接入统一 options 协议和中英文 `lang` 配置。
26. 内置文案经统一字典支持 `cn/en` 动态切换；显式配置文案优先。options 更新必须触发同步渲染，修改核心组件后重建 `dist`。
27. 组件插槽统一使用 `<template #name>`；输入类 `prepend/append` 的 `label-width` 以模板声明为唯一真值，并处理条件渲染导致的延迟插入。
28. 输入附加区按钮铺满完整宽高；相同 `label-width` 的 input、select、switch、radio 和 form-cell 最终宽度及标签视觉必须一致。
29. 所有组件建立开放 Shadow Root；声明型组件通过 `<slot>` 保存 Light DOM。带 `hidden` 的内部元素若另有 display 样式，必须显式添加 `[hidden]{display:none}`。
30. Shadow DOM 批量渲染应缓存静态模板，克隆 `DocumentFragment` 后一次挂载；同步更新用微任务合并，避免逐项挂载和重复解析。
31. 跨 Shadow DOM 的事件委托优先使用 `event.composedPath()`；连接与断开使用同一个具名处理器，防止事件重定向失效或重复监听。
32. `kniu-radio` 使用统一主题圆点外观，白点定位在 radio 自身包裹层；`kniu-radio-group` 支持 model、禁用、尺寸、键盘和 input/change。
33. `kniu-select` 是统一下拉能力，支持 model、禁用、必填、尺寸、键盘和 input/change；展开方向、箭头及 `aria-expanded` 必须同步，分页不得使用原生 select。
34. 全局 `kniu-loading` 固定覆盖视口并锁定 `html/body` 滚动；后台壳层使用 `contained` 只覆盖右侧工作区。

## 五、表格、条件渲染与分页

35. `kniu-table` 只声明 `ref` 和 options；cols、data、loading、列宽、编辑、开关、操作及回调全部进入 options。宿主、group、viewport 和 table 默认 `width:100%`，列宽总和只设 `min-width`。
36. 分页更新复用 thead，只替换 tbody；options 整体更新时同步 `data/loading/maxHeight`，确保大数据量在 viewport 内滚动且表头不抖动。
37. 表格插槽组件按当前行 `field`、`scope.row` 和 `scope.$index` 求值，并保留 class、fit、动态 type 和事件；不能提前把行级表达式移除或降级成文本。
38. 列级显示只用 `kniu-table-col` 支持的 `kniu:if`，按钮条件只用 `kniu:if`；不得使用不存在的 `visible/hidden` 属性。权限要求不渲染时，元素不得进入 Shadow DOM。
39. 列模板克隆必须保留声明式事件，使 `kniu@click/kniu@change` 可重新绑定；行级可见性与事件必须同时验证。
40. 表格操作委托通过 `composedPath()` 查找操作按钮宿主；单页动态加载时序问题优先提供无副作用的 `refreshColumns()`，不得破坏全局 data setter。
41. 纯展示派生值由 Controller 生成字段后让列直接读取；短标签用 `kniu-tag`，圆点加文字状态用 `kniu-status`，不能在纯文本插槽依赖未建立的 scope 表达式。
42. 同一 `field` 可被多个展示列复用；查找功能列必须按 `switch/status/actions` 等能力标志，不能假定字段唯一。
43. 表格编辑仅保留 `editable`：`true/'text'` 为文本，`'number'` 为数字，`false` 关闭；旧 `editType` 不兼容。
44. 分页的唯一初始条数来源是 `pageOptions.pageSize`；候选严格为初始值的 1～6 倍，选择候选不改变基数。`paginationState()` 已删除，状态由 `usePagination()` 集中初始化。
45. 分页 layout 按声明顺序支持中英文 token：首页/First、上一页/Prev、页码/Page、下一页/Next、末页/Last、总数/Total、条数/Rows、跳转/Jump/Jumper；英文 token 不区分大小写。
46. 中文跳转文案为“去 [页码] 页”；页码钳制在有效范围并复用 current-change。分页项间距只由容器 gap 控制，不给 total/sizes 追加左右 margin。
47. 排序箭头使用统一上下尖角 SVG，切换排序时同步激活状态；分页和排序更新不得重建无需变化的表头。

## 六、导航与浮层

48. 当前项目后台路由保持既有扁平结构；移植功能不得带入其他项目路由前缀。后台“前端首页”使用新标签页及 `noopener noreferrer`。
49. 移动端只有一个原头部；菜单面板从头部下方向左进出，导航项顶部排列，父级只展开收起，点击实际导航项才导航并关闭。按钮点击需阻止冒泡，动画支持 reduced-motion。
50. 导航支持三级嵌套：移动端按层级缩进，桌面子菜单从父项右侧展开；后台 side 导航不受前台移动动画影响。
51. 通用浮层通过独立 Shadow DOM Portal 挂到 `document.body`，以锚点 `getBoundingClientRect()` 定位；滚动或缩放时仅在矩形变化后更新，关闭时取消跟踪。
52. 下拉浮层默认在下方；仅下方不足且上方足够时切到上方，并匹配方向动画。Portal 主机保持零尺寸和 `pointer-events:none`，外部点击通过 window 捕获监听，不能遮挡面板按钮。

## 七、日期时间组件

53. `kniu-date-picker` 为自绘只读文本输入和浮层，不使用原生 date/time/select；所有配置进入 options，支持 date、time、datetime 和 range。
54. 年、月、日逐级选择，头部始终显示完整年月；中文“年 月”、英文“月 年”。年份显示以当前年居中的 15 年三列五行，月份三列四行，年/月/日内容区及总高度一致。
55. 单箭头始终切换月份，双箭头始终切换年份；切换时保留期望日号，目标月缺少该日则临时钳制到月末，之后遇到可用月份恢复原日号。
56. `options.weekStart`：0 为周日，1 为周一且默认；英文星期固定两字母。星期标题与日期网格之间不画线并留上下对称间距，头部与中部保留分隔线。
57. 日期标记由 `options.mark` 驱动，文字替换日期并显示右上圆点；日期被选中或位于范围高亮时隐藏圆点。范围模式展示相邻双月，先起点后终点，禁止选择早于起点的结束日期。
58. 面板默认最大宽度约 `230px`，可缩至 `218px`；范围双月在该宽度内纵向排列。底部左侧预览，右侧“重置、现在、确定”同尺寸紧邻；重置清空值并把草稿恢复当前时间，“现在”和空值“确定”均即时提交当前时间。
59. `datetime` 头部横跨日期与时间两列；左侧日期，右侧自绘时分秒滚动列，标题与星期等高，列表与六周日期等高。年/月层级隐藏时间内容但保留占位，避免高度跳动。
60. 时间滚动条默认隐藏、hover 时显示，但保留滚轮、键盘和触控；时间选择框四边完整，相邻列共用一根竖线，数字行之间无横线，并与底部及最右侧保留间距。
61. 时间列严格跟随 `options.format`，分别识别时、分、秒；缺失单位不渲染、不留空白并在提交时归零。格式字母对用户不区分大小写，但日期区的月与时间区的分必须按上下文区分，规范化不得修改原 options。
62. 第一可见时间列始终恢复左外框；一、二、三列时间区及总宽度随可见列数收缩。最终 `[hidden]{display:none!important}` 必须能覆盖 datetime 网格 display，确保关闭和确定有效。
63. 输入框展开时尾部日历图标保持更高层级且不拦截事件；面板内点击不触发外部关闭，页面空白点击必须关闭。

## 八、评论与文章互动

64. `kniu-comment` 的 `options.maxLength` 同时约束输入、表情插入、统计和提交；统计位于 textarea 内部右下角。`options.filter` 使用逗号分隔敏感词，提交事件派发前不区分大小写匹配，命中即提示并 return，不能发起接口请求。
65. 评论信息行左侧显示昵称、回复关系和时间，操作组同一行靠右；接口按身份返回 `userId/isOwn` 和真实 `replyTo`。本人评论只常驻显示删除按钮，不渲染回复及点赞；他人评论显示回复和点赞，不显示删除。旧评论或身份重建后按全站唯一昵称兼容识别本人。删除经 `options.onDelete` 确认后请求接口并刷新列表，服务端必须执行同等身份校验。
66. 评论提交默认 `is_show=0`，审核后才由 `/getComments` 返回；前台成功提示使用 `KniuUI.msg`。后台评论与回复分入口管理，共用状态圆点和审核开关，操作列只保留删除。
67. `kniu-like` 使用 `count/liked/loading/disabled/own/onChange`；组件始终显示，`own=true` 时只禁用按钮并保留点赞数，不能隐藏整个组件，服务端仍须拒绝作者本人点赞。按钮最小高度 `44px`、图标 `24px`、文字 `16px`；点击未点赞状态后立即向上飘出蓝色 `+1`，options 重渲染保留活动动画节点。业务以服务端计数更新 options。
68. `kniu-article-tab` 使用 `previous/next/previousLabel/nextLabel/onChange`；上一篇、下一篇上下排列，缺少某一篇时不渲染对应项，两项都缺少时隐藏整个组件，不显示“返回列表”占位。
69. 前台公共头部始终使用 `kniu-user-login`：未建立昵称时显示“你好，访客！”以及小尺寸箭头，点击展开仅含“登录”的菜单；建立昵称后显示头像、“你好，昵称”和箭头，菜单包含“个人中心”“后台管理”“退出”。前台点击退出必须先立即清除本地身份，再调用 `/frontProfileClear` 销毁前后台 Session，并用跨标签事件让已打开的后台页面立刻回到登录页；不得删除数据库账号或释放昵称。
70. 昵称只能在首次发表评论时设置，个人中心只读、不得提供设置或清除昵称入口。昵称保存成功后继续提交原评论；昵称必填、最多 30 字且全站唯一，重复提示固定为“该昵称已存在”，数据库唯一索引负责并发兜底。已绑定身份如经接口修改昵称，距离上次修改必须满一个月。
71. 昵称首字符必须统一转为小写，前端身份归一化、后端保存和接口输出均需执行，确保旧数据也不会显示大写首字母；昵称输入框在 `options` 中配置 `autocapitalize: 'none'`，前台账号信息统一使用 `14px` 字号。
72. 后台文章列表必须显示只读“点赞数”列，读取 `tb_article.likes`，支持排序且不进入文章编辑表单。
73. 后台登录有效期统一使用 `api/config/auth.php` 的 `LOGIN_EXPIRE_DAYS`（按天配置，默认 7）；Session Cookie、服务端 Session 回收期限和令牌过期时间必须一致。应用启动必须向服务端校验会话并恢复账号，已登录访问登录页直接进入后台，不能只依赖 `sessionStorage`。
74. 前台个人中心采用通用资料页布局，显示头像、昵称、获赞数、评论数、收藏数、账号信息和收藏文章列表。文章收藏使用 `tb_article_favorite` 的用户—文章唯一关系，详情页提供收藏/取消收藏入口；所有统计和列表必须来自数据库，不能使用静态占位。
75. 个人中心显示近一年浏览历史；访问文章时按用户与文章唯一关系更新最后浏览时间，读取或写入时清理一年前记录。浏览历史使用 `tb_article_history`，按 `last_view_time` 倒序展示。
76. 两个及以上按钮必须使用 `<kniu-btn-group>` 包裹；按钮组固定 `display:inline-flex; align-items:center; gap:10px`，不得用按钮自身 margin 模拟组间距。
77. 前台首次创建昵称身份必须填写算术验证码：仅评论昵称弹窗从 `/captcha` 加载图片，`/frontProfileSave` 在数据库不存在当前令牌时强制校验并一次性销毁验证码；个人中心只读，不提供昵称设置入口。
78. “关于我”内容统一存入 `tb_seo.about_content`：后台“网站信息”使用 `kniu-editor` 编辑并经 `/seo_update` 保存，前台 `/about` 通过公开接口 `/getAbout` 读取并按富文本安全渲染；无内容时显示空状态。
79. 前台未建立昵称时 `kniu-user-login` 显示“你好，访客！”。首次评论设置昵称必须在同一事务中创建同名 `tb_role` 后台账号，初始密码 `000000`，固定使用与 `test` 相同的普通用户查看权限（`role=2`、`role_auth=2`）；昵称变更同步后台用户名。只有管理员能更改角色权限，普通用户只能修改自己的密码。
80. `kniu-user-login` 的访客状态也必须保留下拉箭头和菜单，菜单提供登录入口；统一登录页可切换登录/注册。未登录评论或收藏时，本机已有账号标记则进入登录，否则进入注册，并在成功后回到原文章。普通用户后台不渲染“网站信息”和“每日一句”，但始终可进入“关于我”并无内容约束地维护自己的富文本。
81. 后台 `/logup` 登录成功必须同步建立前台会话并绑定当前浏览器身份，不能依赖登录后再调用第二个绑定接口；前台 `kniu-user-login` 初始化还必须调用 `/frontSessionSync`，以有效后台 Session 恢复前台身份，保证从后台新标签打开前端仍为登录状态。后台回复管理中管理员可看全部回复；普通用户只能看自己的回复，权限过滤须用 `tb_front_user.role_id` 将后台账号 ID 映射为 `tb_comment.user_id`，并按唯一昵称兼容历史数据。
82. 应用启动不得用受保护的 `/system` 探测后台登录态；统一调用公开 `/session_status`，未登录返回 HTTP 200 与 `loggedIn:false`，避免正常访客状态在浏览器控制台产生 401。
83. `<kniu-navbar>` 的同级导航项统一由 `<kniu-navbar-cells>` 包裹；该组件桌面横排、移动端纵排，固定使用 `gap:10px`，页面不得自行重复实现导航项间距。
84. 全项目样式统一采用移动优先：最小屏样式写在默认规则中，较宽屏幕仅用 `min-width` 按断点从小到大渐进增强；禁止再用 `max-width` 回补移动端样式。该顺序同时适用于 CSS 文件、模板内 `<style>` 与组件 Shadow DOM 样式。
85. 后台头部消息红点只表示当前账号收到其他前台用户的新回复：回复必须已审核、直接回复目标属于本人且回复者不是本人；无未读回复时不显示红点。读取状态按“回复 ID + 接收人 ID”逐条持久化，回复管理使用“已读/未读”开关并与红点共用状态；点击消息入口进入回复管理并批量标记当前回复已读，刷新或重新登录不能重复提示。
86. 后台管理页头部搜索区移动端占满可用宽度，`481px` 起搜索输入组件统一限制为 `280px`；样式必须同时命中实际使用的 `kniu-input` 与兼容的 `kniu-input-group`，不得因选择器写错被 flex 拉伸。普通用户与管理员均可保存本人“关于我”内容，提交函数不得再增加内容管理权限门禁。
87. 所有已登录后台账号不论角色和管理权限均可添加文章，并可使用文章编辑器媒体上传；新文章必须写入当前账号 `tb_role.id` 作为作者。该授权只覆盖新增流程，不得连带放开他人文章的编辑、删除、审核或显示状态管理。

## 九、修改前读规则、修改后提炼结论

88. 修改任何源码前先通读本 `SKILLS.md` 与 `.workbuddy/memory/MEMORY.md`，确认历史结论与既有约束，避免重复踩坑；已完成任务若在 `memory` 日志与 `MEMORY.md` 记录了可复用的范式，应同步提炼为一条长期规则写入本文件，而不是只留在日志里。

## 十、样式与组件易踩坑补充

89. `kniu-*` 组件是 Shadow DOM，宿主宽度不等于内部实际元素宽度。给 `kniu-btn` 设固定宽度必须同时 `block:true`（内部按钮才 `width:100%` 填满宿主）并用内联 `width`（优先级高于组件 `:host([block]){width:100%}`）固定宿主：`<kniu-btn style="width:120px" kniu:options="{block:true}">`。只写宿主的 `min-width/width` 不改变内部按钮。对照 `kniu-image`（内部 `<img>` 本就 `width:100%`，可用内联 min-width 控宽），修改前先确认目标元素在 Shadow 树中的实际尺寸参照链（呼应规则 17、28）。

90. `kniu:options` 内联对象字面量写法可省略外层圆括号：`kniu:options="{{name:'x',placeholder:'y'}}"`，无需写成 `{{({name:'x',...})}}`。模板引擎对含 `:` 的表达式先按对象字面量 `return ({expr})` 编译（`kniutemplate.mjs` 的 `compileExpression`）。仅当某键的值是引用 state 的取值（`src:(captchaImageUrl)`）或复合表达式（`disabled:(codeSending || codeCountdown>0)`）时为清晰保留内层括号，但非语法必需。

## 十一、kniu-form 表单与弹窗（由用户级技能合并而来）

91. `kniu-form` 的字段对象形如 `{ value, condition?, message? }`：`value` 既是默认值也是当前值，`kniu:model` 绑到字段对象本身时引擎自动读写其 `.value`，**无需在模板写 `.value`**；不参与验证的字段给普通标量默认值即可。表单级保留键 `labelPosition`/`labelWidth` 不当作字段、不参与取值与验证。
92. `condition` 支持正则 / 函数 / `true`（非空即通过）；函数入参为 `{ value, field, input, model, options, values, ...同表单其它字段值 }`（其余字段值直接平铺到入参，比较可用 `v.value === v.password`）。**正则存进响应式代理后不能直接 `.test()`（Proxy 上抛 incompatible receiver）**：组件内先取 `condition.source` 重建真实 `RegExp` 再 `.test()`。
93. 表单只验证**当前渲染出来**的字段：被 `kniu:if` 未渲染的控件不参与校验（条件表单天然按场景验证）。字段对象被整体替换（`state.userModel = createUserModel()`）即重置；控制器用 `assignOptionFields(model, row)` 把记录值写进各字段对象的 `.value`。
94. `kniu-form` 组件 API：`options` / `values`（把字段对象摊平成纯值对象） / `validate()` / `reset()`（回到首次传入的默认值）。**保存按钮放在 `<kniu-modal>` 的 footer（在 form 之外）时必须手动调 `validate()`**，不能依赖 form 的 submit：`if (userForm && typeof userForm.validate==='function' && !userForm.validate()) return;`，随后用 `userForm.values` 提交。
95. `kniu-modal` 的 ESC / 遮罩 / 关闭按钮走组件自身的 `close()`/`_requestClose()`，**不会回写 `state.showmodal`**；若控制器再次把 `showmodal` 设成同值，响应式 set 不通知订阅 → 弹窗再打不开。必须在 `<kniu-modal show="{{showmodal}}" kniu@close="closeDialog">` 绑定 close 事件把 state 同步回来。
96. 框架 ref 收集时序坑（2026-08-31 根因）：`kniueventer.loadHtmlTemplate` 先 `beginBindingCollection` 再 `mountController`，使 `setup()` 中首个 `reactive(state)` 触发的 auto-bind 走整树并把所有 `ref` 属性剥走；修复为 auto-bind 不再收集 ref、显式 controller bind 才收集。`kniu-modal` 内的 `ref="form"` 若取不到，应检查是否被 auto-bind 误剥、并通过 `this.root.querySelector('kniu-form')` 兜底。
97. puppeteer 校验表单：打开弹窗→在 `<kniu-input>` Shadow 内的原生 input 设值并派发 `input` 事件→点保存按钮→断言弱密码/两次不一致时 `data-invalid` 已设且不发 `/xxx_add` 请求、通过时才发。可 `setRequestInterception(true)` + `req.abort()` 拦截写入类请求，避免测试数据落库。关闭弹窗用真实路径 `m.close()`（会派发 `close`），勿用 `m.show=false`（绕过 state、复现用户不会遇到的失同步）。

## 十二、后台列表页 CRUD 交互复用工厂

98. 后台带分页表格的管理端控制器（daily/article/comment/users 等）里的「列表搜索」「is_show 开关」「删除行确认」三块交互已抽成 `client/core/kniuui.js` 的公共工厂（与 `usePagination` 同层、导出到默认对象，控制器经 `const { makeSwitchOptions, createSearchActions, createRowDeleteHandler } = KniuUI;` 解构使用，不再各自手写）。新写此类控制器应优先复用：`makeSwitchOptions(enabled)` 返回标准 is_show 开关 options（`disabled:!enabled`）；`createSearchActions(loadList[,250])` 返回 `{searchList,debouncedSearch}`；`createRowDeleteHandler({self,state,loadList,url,confirmMessage,gate?,getSuccessMessage?})` 返回 deleteRow（确认框→删接口→提示+刷新）。各控制器差异通过配置表达：`confirmMessage` 可传函数按行取文案（如 comment 按 parent_id）、`gate` 传函数做仅管理员门禁（users）、`getSuccessMessage` 传 `(res)=>res.msg` 改用服务端成功文案（默认固定「删除成功!」）。不要把行为不一致的开关更新（updateShow/toggleAudit 各自 reload/回执语义不同）强行并入同一工厂。

## 十三、静态资源 HTTP 缓存 + gzip（Node 静态服务）

99. 所有 Node 静态服务（`kniuserver.mjs` dev/prod、`kniupreview.mjs` 产 dist 预览）一律复用 `client/core/kniustatic.mjs` 的 `NO_CACHE`/`staticCacheHeaders(file,path,type)`/`sendStaticBody(res,headers,body)`，勿各自手写缓存头。约定：带哈希静态资源（`HASHED_ASSET` 正则 `\.[a-f0-9]{8,16}\.(?:js|mjs|css|svg|jpg|jpeg|png|gif|webp|eot|ttf|woff2?|mp3|mp4|webm|ogg)`）→ `Cache-Control: public, max-age=31536000, immutable`；HTML/模板（templates.js）→ no-cache；uploads → 短缓存（如 1 天）。gzip 仅 production 开、on-the-fly `zlib.gzip`。两坑：①压缩类型正则须匹配完整 token `text\/[a-z0-9.+-]+`（写成 `text/` 后紧跟 `;` 会漏掉 text/javascript 等，缩不缩）；②async 函数里 `gzip(cb)` 不 await 回调就 resolve 会先返回未压缩体——须 `await new Promise(resolve => gzip(..., ()=>{...; resolve()}))`。

## 十四、后端状态变更 → 前端实时通知（单向用 SSE）

100. 「后端某个动作完成后要通知在线前端刷新」（如审核通过一条回复→前端红点即时出现）的单向 nudge 场景用 SSE + EventSource，不上 WebSocket（无需回程、不带用户数据）。服务端：`client/core/kniussemitter.mjs`（subscribe/res → 返回 unsubscribe 的 Set 注册表 + broadcast + 25s `: ping` 心跳防代理断链）；Node 加 `GET /events`（SSE 头 + `retry: 5000`）+ 仅 loopback 可访问的 `POST/GET /__notify`（非回环 Host 一律 403）触发广播。客户端：`client/core/kniunotify.mjs`（默认导出单例，懒开一个 EventSource('/events')，无订阅自动 close，`subscribeReplyRefresh(handler)` 订阅事件自动重连）。PHP 侧在动作成功后 fire-and-forget 原生 socket GET 打到 `NOTIFY_URL`（放 `api/config/app.php`、env 可覆盖、默认 http://127.0.0.1:6987/__notify）即可，勿在 PHP 请求里阻塞等返回。SSE 只推「有更新」信号不推数据——真实数据客户端仍走各自已鉴权的接口重拉，故鉴权与数据仍在 PHP。
101. **凡会弹出的下拉/浮层（select、分页 page-size、日期选择器、账号登录菜单、密码 tip 等）一律用 date-picker 同款统一机制**：白色卡片（边框 `#e4e7ed`、圆角 4、`#fff` 底、阴影 `0 2px 12px rgba(0,0,0,.1)`）、`position:fixed`、自动判断上方/下方且**默认下方**、水平贴触发左缘并在超视口右缘时向左钳制。**关键陷阱**：`position:fixed` 元素只要仍挂在组件宿主 shadowRoot 内，就会被宿主（含 `:host{contain:layout}` 或任何建立 containing block 的祖先）当成相对定位参考、按宿主偏移——实测 fixed 探针渲染在 `host.top+N` 而非视口。故浮层面板**必须先 portal 到 `document.body` 下新建 span 的 shadowRoot**（span `position:fixed;inset:0;pointer-events:none`、面板自身 `pointer-events:auto`），fixed 才真正相对视口。已统一抽取共享原语放 `client/core/kniuui.js`：`mountPopoverPortal(panel, hostRoot, {zIndex, attribute})`（移入 body portal，卸载时把 panel 移回宿主 shadow、销毁 portal 壳，DOM 节点同一不克隆）+ `computePopoverLayout(panel, anchorRect, {offset,width,height})`（返回 `{placement,left,top}`，翻转到 top 仅当 `spaceBelow<panelHeight && spaceAbove>=panelHeight`）+ `trackPopoverPosition(anchor, apply)`（rAF 跟随滚动/resize，返回 dispose）。已迁移组件：kniu-date-picker、kniu-select（`data-kniu-select-popover`）、kniu-user-login（`.menu[data-open="true"]` 由面板自身控制显隐，`data-kniu-userlogin-popover`）、kniu-input 密码 tip（`.kniu_sys_input_tip`，`data-kniu-input-tip-popover`）。**写新含浮层组件**：展开时先 `mountPopoverPortal` 再定位、开 rAF 跟随；收起/断开时先 dispose 跟随再 `unmount()`；因 `_render()`/`innerHTML=` 重建会丢弃宿主内面板节点，重建前必须先卸载旧 portal 防残留。浮层可见性须由**面板自身** `data-open` 控制（宿主无关），不要依赖 `.host[data-open] .panel` 这类需 host 在场的后代选择器（portal 后 host 不在同一 shadow 会失效）。
102. 规则 #2 的「测试文件」**不限于浏览器探针**：凡是验证/调试配套的脚本都算——shell 探针（`.sh`）、PHP 会话伪造（forge_admin_session）、数据 seed/cleanup、数据查看辅助、一次性调试服务等，一律只放根目录 `test/`，项目根**禁止存在 `tmp/` 等任何第二个测试/脚本目录**（子目录只允许 `test/` 之下，如 `test/bench/` 放 puppeteer 探针）。历史遗留 `tmp/`（权限模型验证期的 `forge_admin_session.php`/`seed_user_pwd.php`/`probe_*.sh`/`cleanup_*.php`/`admin_row.php`/`select_test.php`）已全部迁入 `test/` 并删除 `tmp/`。**迁移两个坑**：①脚本之间互相引用的相对路径（如 `tmp/forge_admin_session.php`、`tmp/a1.jar`、`tmp/.sid_u`）必须同步改成 `test/`；②用 `__DIR__.'/../api/...'` 的 PHP 脚本必须放 `test/` **一级目录**——放进 `test/bench/` 会解析成 `test/api/...` 而失效。一次性诊断脚本（已查明根因、无回归价值）验证后即删，不要堆在 `test/` 里。
103. **Windows 版 PHP 发 HTTPS/SMTPS 前必须先确认有根证书包**：本机 `php.ini` 的 `openssl.cafile`、`openssl.capath`、`curl.cainfo` 全为空，此时 `stream_socket_client('ssl://host:465')` 会**静默失败**——返回 `false`、`errno=0`、`errstr` 为空字符串，报错只能是「无法连接」，极易误判为网络/防火墙问题（实测 `tcp://smtp.qq.com:465` 是通的，只有 `ssl://` 挂）。两步定位法：先用 `tcp://` 验网络层，再用 `verify_peer=false` 的 context 验 TLS 层——若后者能拿到 SMTP banner，则 100% 是缺 CA 证书。修法：`api/config/cert/cacert.pem` 存项目自带根证书包（用 PowerShell 从 `Cert:\LocalMachine\Root` + `Cert:\CurrentUser\Root` 导出全部证书，按 Thumbprint 去重，base64 每 64 字符换行拼 PEM），`api/config/mail.php` 加 `CAFILE`（默认该路径、`MAIL_CAFILE` 可覆盖），发信时用 `stream_context_create(['ssl'=>['cafile'=>..., 'verify_peer'=>true, 'verify_peer_name'=>true, 'SNI_enabled'=>true, 'peer_name'=>$host]])` 显式传入 `stream_socket_client` 第 6 参，且**不要**关 `verify_peer` 走捷径。证书包放 `api/config/` 而非 `api/runtime/`——后者被 `.gitignore` 忽略，换机部署会再次缺证书。
104. **本机验证后端接口的两个前置条件**：①服务跨会话会退出，开测前先 `netstat -ano | grep LISTENING | grep -E ':6987|:9900'` 确认在听——PHP 用 `cd api && php -S localhost:9900 -t .` 拉起、前端用 `npm run dev`；②**curl 必须加 `--noproxy '*'`**，否则系统代理会拦截 localhost 并返回 `HTTP 502` + `upstream connect failed ... (os error 10061)`，错误信息长得像后端崩了，实际是代理连不上，极易误判。另：`api/config/router.php` 里后台路由**全是 POST**，用 GET 打会得到 `{"status":0,"msg":"Route not found: /xxx"}` 的 404，别据此以为路由没配。
105. **PHP 类改名（PSR-4）四步清单**：①`git mv` 改文件名以保留跟踪历史；②文件内 `class 旧名` → `class 新名`；③全量替换引用（`use Core\旧名;` 与 `extends 旧名`，`sed` 里反斜杠须写成 `\\`）；④同步文档（README / `api/API.md` / 审计报告）与 `.workbuddy/memory/MEMORY.md` 长期索引，历史日志按 append-only 保留原名不回改。**通常无需 `composer dump-autoload`**——`api/composer.json` 是纯 PSR-4 目录映射（`Core\`→`core/`），改名自动生效；但若启用过 `--optimize-autoloader`/classmap（用 `grep -rn 旧类名 api/vendor/composer/` 判断）则必须 dump。验证法：未登录打后台接口应得 **401「登录已失效，请重新登录」**——该文案出自 `Base::__construct()`，等价于类已加载并实例化（命名不匹配会是 500 `Class not found`）；再用 `test/forge_admin_session.php <32位hex sid> admin 1 1 1` 伪造管理员会话打一次真实接口，确认返回 `status:1` 才算继承链与鉴权完整可用。
106. **改环境变量名的三处同步 + 一个搜索盲区**：把 `.env` 里 `MAIL_PASSWORD=` 这类键改名（如改成 `MAIL_AUTH_CODE=`）时须同步三处——①项目根 `.env` 的键名（值原样保留）及其上方说明注释；②`api/config/*.php` 里的 `getenv('旧名')`，注意 development 与 production **两个分支各有一份**，别只改一处；③`api/API.md` 的配置项表格与正文说明（「`MAIL_USERNAME` 或 `MAIL_PASSWORD` 为空时走兜底」这类行内引用最易漏）。**搜索盲区（本次踩坑）**：Grep 工具遵循 `.gitignore`，而 `.env` 是未跟踪文件，用它搜旧键名只会命中 `api/API.md` 与 `api/config/mail.php`，**`.env` 一个都搜不到**——改名后必须全目录复核：`grep -rn "旧名" --exclude-dir={vendor,node_modules,.git,dist,.workbuddy} .`，排除项带 `.workbuddy` 是因为历史日志按 append-only 保留原名、不回改。**最小改动原则**：只改 `getenv()` 读的环境变量名，config 数组内部键名（如 `'PASSWORD'`）保持不变，下游 `Mailer` 等按数组键取值处一律不动。验证两步：①`php -r 'require "api/core/Env.php"; Core\Env::load(".env"); $c=require "api/config/mail.php"; ...'` 打印各键，**敏感值只打 `strlen()` 与前 2 位脱敏**（授权码/密钥禁止打进终端与日志），并确认 `getenv('旧名')===false`、`getenv('新名')` 已设置；②打真实接口（如 `curl -s --noproxy '*' -m 45 -X POST http://localhost:9900/email_code -d "email=xxx&scene=register"`）看 `dev` 字段——**`dev:false` 才是真发信成功**，`dev:true` 说明仍走日志兜底（`api/runtime/mail/mail-YYYY-MM-DD.log`）等于没发出去。另：改写 `.env` 后必须 `Read` 一遍全文复核键名、注释与其他配置未被误删（本次改写曾连带丢掉邮件块两行说明注释）。
107. **`kniu:if` / `kniu:for` 分支内的自定义元素必须先插入文档、再 `applyBindings`（升级时序坑，2026-09-04）**：`kniutemplate.mjs` 的 `setupIf`（及 `setupFor`）render 里，`applyBindings(node, state, ...)` 必须放在 `anchor.parentNode.insertBefore(node, anchor)` **之后**。原因：分支内的 `<kniu-table>`/`<kniu-page>`/`<kniu-radio-group>` 等自定义元素在插入文档前**尚未连接升级**，此时 `'options' in node === false`，`kniu:options` 处理器会把值存进 `__kniuOptionsValue` expando 而非实例 `_config`，且**连接后永不回填** → 组件 options 恒空（表 0 行、页无数据、开关不渲染）。典型误判症状：`<template kniu:if="{{commentTable.data.length > 0}}">` 的 filter_bar 渲染了、接口也返回了 N 条数据、`kniu-empty` 也没显示，唯独 `kniu-table` 0 行——此时**不是 if 布尔条件错，是表没收到 options**。修复只在 `kniutemplate.mjs` 一处调整语句顺序，`kniu:if`/`kniu:for` 共享该 render 逻辑、全局生效。验证范式：探针里对比 `filterBar:1 / table:1 / empty:0 / tableRows>0`（未修复时 `tableRows` 为 0），并递归穿透 shadowRoot 取 `kniu-table._config.data.length`（未修复时表拿不到 options、长度为 0）与 `_table`（未修复时 false）。**坑**：kniu-table 渲染在 SPA 视图的 shadow root 内，`document.querySelector('kniu-table')` 会返回 null，探针必须用递归 `findAll`（遍历每个 nodeType===1 元素的 `el.shadowRoot`）才能触达 `_config`/`_table`，否则会误判成「`_config` 为 n/a、`_table` 为 false」——那不是修复失败，是 light-DOM 查询根本摸不到 shadow 内的表。兄弟页 `reply.html:68`、`article.html:74`（`div kniu:if` 直接挂元素 + 兄弟 `kniu-empty kniu:else`）走同一逻辑，改完必须一起回归。
108. **dev server（`kniuserver.mjs`）必须从项目根启动，禁止 `cd client` 后再启动**：`kniuserver.mjs` 用 `process.cwd()` 作 `ROOT`，`VIEW_INDEX = join(ROOT, 'client/views', 'index.html')`。若误在 `client/` 目录下跑 `node core/kniuserver.mjs`，`ROOT` 变成 `.../client`，`VIEW_INDEX` 解析成 `.../client/client/views/index.html`（不存在）→ `/` 返回 **404、整站不渲染**（浏览器探针会全 0 + 一堆 `404 (Not Found)`，极易误判成「改了核心文件导致回归」）。正确启动：在项目根 `PROCESS_ENV=development node client/core/kniuserver.mjs`。诊断第一步先 `curl -s -o /dev/null -w '%{http_code}' --noproxy '*' http://[::1]:6987/`，`200` 才说明 ROOT 正确、再跑探针。
109. **`usePagination` 的本地更新必须显式 `syncOptions()` 推送 options 引用**（2026-09-04，daily 列表保存后不变）：`kniu-table` 监听的是整个 options 对象引用变化（`set options` 内部对 `_table.setData` 的调用依赖新对象），**不是数组引用**。`usePagination` 内部用 `syncOptions()` 做「`state[tableKey] = { ...prev, data: state.list, loading }`」整体替换以触发组件刷新，但该函数原本**未暴露**在 `return` 里。控制器若想做本地补丁（`state.list = updateListRecord(state.list, form)` 或原地 `row.is_show = value`），仅改 `state.list` 不会让 `kniu-table` 重渲——表现为「保存后列表数据没变」「开关点了也没反应」。修法：①`usePagination` 把 `syncOptions` 加入 `return { loadList, changePage, changePageSize, syncOptions }`；②控制器从 `usePagination` 解构 `syncOptions`，在所有「仅本地改 state.list / 原地改 list 元素字段」的成功回调里**手动调一次 `syncOptions()`**（不要让 state 监听自动触发，因为响应式路径是 state[tableKey]，不是 state.list）。兄弟范式 `articleController.saveEdit` 是 `await loadList(state.currentPage)`（服务端全量重拉，自然调 `syncOptions`），本地补丁更省一次请求；选哪种看场景，但选了本地补丁**必须**配 `syncOptions()`。验证范式：探针先 `before` 抓首行 cn→点第一行「修改」→改 cn→点保存→`after` 再抓首行 cn 应等于新值；网络应仅有 `/daily_update` POST，**没有** `/daily_list` 重拉；DB 改回原值后端到端完成。

## 十五、SPA 路由与页内换参（2026-09-05）

110. **「同路径、只换 routeData」的页内跳转不会重新挂载组件，控制器必须订阅 `onRouteChange`**：详情页上一篇/下一篇走 `navigateTo('/detail', { id })`，hash 前后都是 `/detail`，`kniubase.mjs` 的 `_renderRoute` 按同视图去重（`existing.tagName===tag && currentViewTag===tag && hash===lastRenderedHash`）直接早退，组件**不销毁重建**；而控制器加载函数只在 `onMounted` 跑一次、`getRouteData()` 不会重读 → 表现为「点了下一篇，路由跳了但内容不变，必须刷新页面才生效」。修法（数据驱动，不重挂载）：控制器 setup 解构 `onRouteChange`/`onScopeDispose`（`buildKniuSystemScope` 已提供），订阅后三段式过滤——`prev === null` 的注册同步回调直接 return（首次加载交给 `onMounted`，避免双请求）；`hash.split('?')[0]` 非本页路径 return（跨页导航交给视图切换）；否则重调 `loadXxx()` 读最新 routeData。浏览器前进/后退（popstate → `handleBrowserNavigation`）同样经 `notifyRouteChange` 走该订阅，routeData 自动从 `history.state.kniuRoute.data` 恢复。并发竞态（快速连点）用 `loadSeq` 序号守卫：加载前 `const seq = ++loadSeq`，`/getDetail` 响应后 `if (seq !== loadSeq) return` 丢弃过期结果。**不要用强制重挂载修此问题**：组件销毁重建会闪 280ms 加载遮罩并丢滚动位置；admin 分支靠 URL 查询参数（hash 不同）区分导航，前台页用 routeData 传参时 hash 恒定，只能走控制器订阅。回归探针 `test/bench/probe_navigate_route.mjs`（首页→详情→返回→再进→下一篇，断言标题变化）。**探针坑**：`home.html` 的 `.index_item11` 存在无 `data-article-id` 的误匹配元素（每日一句区），选择器必须写 `.index_item11[data-article-id]`，否则点了没反应会误判成路由 bug。

## 十六、归属判定与会话校验（2026-09-05）

111. **`validateToken()` 只表示「后台会话有效」，绝不能当资源归属判定用**：`Core\Controller::validateToken()` 仅检查 `$_SESSION['admin_token']` 存在且未过期并返回 bool。历史上 `getDetail` 直接写 `$result[0]['isOwn'] = $this->validateToken()`、`likeArticle` 写 `if ($this->validateToken()) { 拒绝点赞 }` → **任何已登录后台的账号访问他人文章都被当成作者**：前端 `kniu-like` 收到 `own=true` 禁用按钮，`/likeArticle` 还一律返回「不能给自己的文章点赞」，症状就是「admin 不能给 test 发的文章点赞」。归属必须按 ID 比对：文章作者是 `tb_article.user_id`（坐标系 = `tb_role.id`），当前身份取「后台会话 `$_SESSION['admin_token']['id']` 优先，否则前台身份 `$frontUser['role_id']`」——**前台是 `tb_front_user.role_id`，不是 `tb_front_user.id`**（老代码 `(int)$article['user_id'] === (int)$frontUser['id']` 就是错的）；两者相等才是本人，`owner_id<=0`（历史数据）或游客（`roleId=0`）都不算本人、应允许点赞。修法：控制器内收口两个私有方法 `currentRoleId($frontUser)` 与 `isOwnedByCurrentUser($ownerId, $frontUser)`，`getDetail` 的 `isOwn` 与 `likeArticle` 的拒绝判定统一调用，禁止再散落写 `validateToken()`（顺带把 `likeArticle` 里重复的两次文章查询合并成一次）。验证范式：`test/forge_admin_session.php <32位hex sid> <name> <role> <auth> <role_id>` 伪造会话后 curl 打真实接口（**须 `--noproxy '*'`、路由全 POST**）——admin(role_id=1) 看 test 的文章应 `isOwn=false` 且点赞 `status:1`，admin 赞自己文章应 `status:0`；test(role_id=2) 反向同理；游客无会话 `isOwn=false` 且可点赞。验证后把 `tb_article.likes` 改回原值（真会落库）。


112. **`kniu:options` 组件的 `onXxx` 回调必须在「初始 options 对象字面量」里声明，事后 `state.xxxOptions.onXxx = fn` 原地赋值无效**：`core/kniuui.js` 的 `installOptionsOnlyProtocol` 只在 `set options`（即 options 引用变更 / 首次绑定）时调用 `bindCallbacks` 给元素 `addEventListener(eventName, handler)`；`kniu-like` 点击会 `dispatchEvent(new CustomEvent('change', {detail, bubbles, composed}))`，由该监听器转调 `options.onChange`。若 `onChange` 是组件首次 `set options` 之后才通过 `state.likeOptions.onChange = onLikeChange` 原地 mutate 加上的，**不会触发重绑**，元素上 `addEventListener` 从未注册 → 点击 dispatch 的 `change` 事件无人接收 → `onLikeChange` 永不执行 → `/likeArticle` 永不发出，**任何账号点任何文章都点不了赞**（`disabled` 状态正常、按钮可点，但点了毫无反应）。表现：puppeteer 读 `el.__kniuOptionListeners` 为空数组、`options.onChange` 却是 function、`onLikeChange` 内 `REQUEST` 从不被调用、DB `likes` 不变。修法：`likeOptions` 初始字面量直接写 `onChange: onLikeChange`（`onLikeChange` 是函数声明会被提升，可提前引用）；同类的 `commentOptions.onSubmit/onLike/onDelete`、`articleTabOptions.onChange` 一律在初始 options 或保证「每次 set options 都带回调」的前提下声明，禁止只靠事后 mutate。验证范式：`test/bench/probe_like_real.mjs`（伪造 admin 会话 → 首页点 test 文章 id=5 → 点赞）应见 `el.__kniuOptionListeners=["change"]` 且 `/likeArticle` 返回 `status:1`、`likes` 落库 +1；admin 点自己文章(id=1) 因 `isOwn=true` 按钮禁用不报错。
113. **让自定义元素（如 `kniu-btn`/`kniu-like`）并排且等大时，外部 CSS 高度/宽度会被组件内 `:host([attr])` 规则压过**：`kniu-btn` 加 `block:true` 后，组件内 `:host([block]){height:100%}`（特异性 0,2,0）会压过外部 `.detail_btn_group kniu-btn{height:44px}`（0,1,1）→ 外部锁定的 44px 失效、按钮回退成组件默认高度（32px），与旁边的 `kniu-like`（44px）不等大。修法：外部想锁定高度必须加 `!important`（`.detail_btn_group kniu-btn{height:44px!important}`），或干脆改组件自身 `:host`/内部 button 的尺寸（但 `kniu-like` 的 44px/24px/16px 受 #67 约束不可改小，故放大收藏侧去对齐它）。并排布局用 `.detail_btn_group{display:flex;gap;align-items:stretch}` + 两个按钮 `flex:1 1 0;min-width:0` 各占一半；`kniu-like` 内部 button 加 `width:100%` 填满其格，收藏 `kniu-btn` 用 `block:true` 填满其格（配合 `!important` 高度）。注意 `detail.html` 的 `<style scoped>` import 的是 `detail.min.css`，改 `detail.css`（源）后要**同步改 `detail.min.css`** 否则 dev 不生效。验证：puppeteer 量两个按钮 `getBoundingClientRect()`，断言 `y` 相同、`w/h` 相等。

114. **点赞操作必须具备双重去重**：控制器使用非响应式请求锁，组件 `kniu-like` 使用点击时间窗（至少 350ms）与动画锁，防止同一次点击因重渲染或重复事件监听导致多次 `/likeArticle` 请求和重复 `+1` 动画；请求完成后再释放锁。
115. **详情页点赞动画不得跨重渲染搬运**：`loadDetail()` 会串行请求 `/getDetail`、`/frontProfile`、`/getComments`，每个响应都可能更新响应式 options 并触发 `kniu-like._render()`。若 `_render()` 把旧的 `.like-plus` 节点移回新按钮，CSS 动画会被重新挂载/重播，表现为一次点击飘出两个 `+1`，即使接口请求实际只有一次。重渲染时应清理旧动画节点，不要复用；同时保留组件级点击时间窗与动画锁。排查时要区分“接口重复请求”和“同一动画节点被重渲染重播”两类问题。
116. **文章点赞频控**：需求为“每篇文章每天只能成功点赞一次，成功后锁定”。后端 `likeArticle` 必须以服务端会话按 `article_id + Ymd` 记录成功状态，重复点赞/取消点赞静默返回当前计数与 `locked:true`，避免前端错误提示；不能只依赖前端 disabled（可被请求工具绕过）。
117. **管理员评论免审核**：后台管理员通过前台身份发表评论时，`submitComment` 应直接写入 `is_show=1`，普通用户仍写入 `is_show=0` 等待审核；否则会出现管理员审核自己评论的不合理流程。判定统一复用 `Base::isAdmin()`，不要根据昵称或前端字段判断。
