# KniuSystem 协作规范（精编版）

> 编号即稳定 ID，只按编号引用。细节见 `.workbuddy/memory/` 每日日志与 `test/` 探针。

## 1. 工作方式
1. 改前先检索现有实现；禁回滚/覆盖无关改动。
2. 功能/结构/接口变化同步 `api/API.md` 与 `!KniuProject/`（语义→KNIU-API-CONTRACT.md、表结构→kniusql/、Git→GIT.md）。
3. 临时文件只放 `test/` 验证完删；正式代码/文档/SQL 末尾不留空行。例外：常驻闸门 `test/probe_*.mjs`/`test/probe_*.php`/`test/check_*.mjs` 入库（`.gitignore` 写 `test/*`+`!` 反选）。审查报告等临时 md 一律放 `test/`，`!KniuProject/` 只放常驻正式文档。
4. 禁破坏性 Git 命令恢复用户文件。
5. 规则按功能归类，新增插末尾再编号，禁按时间混放。
112. 每轮修改把「改了什么/为什么/约束/回归手段」写入每日日志。

## 2. 架构与安全
6. 后端是权限边界；前端隐藏菜单/按钮/列不替代服务端授权。
7. 环境/端口/库/Session/上传/日志/缓存按项目隔离；禁终止其他项目进程。
8. 文本字段服务端单轮 HTML 编码入库、单轮解码返回；前端不重复编解码。
9. 排序字段白名单、方向仅 ASC/DESC；上传验扩展名+声明 MIME+真实 MIME+大小。
116. URL 协议判定唯一 `kniusanitizer.mjs::isDangerousUrl`（`data:` 仅放行 image/(png|jpe?g|gif|webp|bmp)）；srcset 逐候选用 `isDangerousSrcset()`。
117. 公共服务器逻辑放 kniuproxy.mjs/kniustatic.mjs；组件共享闭包经 `KNIU_COMPONENT_CONTEXT` 注入，组件禁反向 import kniuui.mjs。
180. 模板引擎：if/for 订阅注册到最近重渲染边界 cleanups；evalExpr 错误静默空串；异步钩子走 `runHook()`。
181. 动态 `kniu:style` 拒 expression()/危险 url()；退出登录先 markLoggedOut 清 identity 再发 /logout。

## 3. 身份、权限与数据归属
10. `tb_role.id` 唯一账号标识；name 登录、nickname 仅展示。
11. 管理员=role===1||role_auth===1；普通账号只操作自己的资源。
12. is_show=0 禁登录；comment_ban=1 禁言；comment_audit=1 先审后显。
13. 昵称一年一改，服务端以 issue_time 强制校验。
14. 删账号同一事务删其文章/关于我/评论回复/通知/收藏/浏览历史。
69. 免登录清单唯一来源 `api/config/auth.php` NO_AUTH；前台拒绝 HTTP200+{status:1001}、后台 401+1001。
70. 🔴 前端不鉴权（定稿口径）：跳转与否只由后端统一登录鉴权错误码（1001/HTTP401）决定，前端禁做路由级鉴权/守卫/豁免清单。`client/config/request.js`（原 redirect.js）定义 STATUS 码字典（职责=后端返码→前端相应操作）与 `REDIRECT:{trigger:[业务码], targets:[{route,tab,account?}]}`——触发码 + HTTP 401 恒触发，由 kniurequest 内置响应拦截器执行跳转；目标按「有无前台账号」选（account:true↔/login，其余↔/register）；client.mjs 是唯一注册点 `authRedirect(client, REQUEST_CONFIG.REDIRECT)`（字段名 **route**，漂移会 `pushState('#/')` 静默失效）。登录/注册页自身请求与探测类请求一律显式 `redirectOnUnauthorized:false`。
71. 探针 seed_front_account.php/forge_admin_session.php；Node 探针禁 execFileSync('php')（EBUSY）。
74. 业务码 4 位分段（ErrorCode 常量禁字面量）：1xxx 身份/2xxx 业务/3xxx 资源/4xxx 服务端；严禁与 HTTP 同值。
120. 会话点赞键按日清理（写入口顺带清非当日同类键）。
124. 邮箱验证码 fail_count≥5 写 lock_until+600s。
125. 找回密码按「账号+邮箱」双条件定位。
131. 改密码成功即作废被改账号全部会话：唯一实现 `Core\Controller::revokeIdentityToken()+destroySessionsOfUser()`（扫 session 文件 admin_token+front_token 双键）；RoleController 与 passwordReset 共用，禁再写私有副本。
155. 唯一 admin 超管闭环：新增/提权/降级 role=1 拒、删 role=1 拒；降级是删除前置。
216. 🔴 前台登录态唯一真相=后端 session：kniubase 启动固定 `AUTH.syncFrontIdentity()`→`restoreSession()`（会话优先、identity_token 兜底，幽灵会话即毁）；退出双通道吊销（销毁会话前摘 identity_token/token_expire_time）；请求层 1001 同轮 `IDENTITY.clearIdentity()`；detail/profile 按后端判定渲染，网络失败不清缓存。

## 4. 数据库与 SQL
15. 建表基线 `!KniuProject/kniusql/kniu_create_tb_*.sql` 唯一；只留业务字段。
17. tb_comment parent_id=0 评论/>0 回复；回复已读以 reply_id+recipient_user_id。
18-19. tb_about 按 role_id 一对一；SEO 不存关于我内容。
20. 删库/重建/迁移前确认目标、备份或验证数据量，完成后报告影响。
112(库). 列表接口禁 N+1：主键去重→whereIn 批量查→内存映射。
114. 查询只取必要列（longtext 用 field 裁剪）——收窄 field 前必须核对行数据全部消费方（编辑弹窗等直接复用行数据的路径）；password/identity_token 禁返回前端。
115. 禁运行时 schema 探测与迁移；字段/索引变更改基线 SQL 重初始化。
118. 模糊搜索统一 likeEncodedPattern() 转义；禁 LOWER(col)；原始条件 Db::escape()。
119. 读接口禁夹带全表清理。
123. 个人聚合列表必须 LIMIT 100；api/ 全部函数带类型信息。
126. PHPDoc 全局类引用加 `\` 前缀。
166. 库/表不存在回 3001 非 HTTP500：requireTable() 先库后表。
208. 批量更新一条 `WHERE id IN(...)`；批量勾选收口 Base::applySelectallBatch；前台登录收口 finishFrontAuth。

## 5. 前端组件与模板
21. 组件配置唯一入口 `kniu:option`；双向绑定只用 `kniu:form`。
22. kniu-table 只收 `<kniu-table-col>` 子标签。
29. 禁退回废弃写法；usePagination 只管分页列表；请求参数禁随机时间戳。
30. 事件 on 开头 camelCase；未知 camelCase 转 data-*。
59/81/83. 尺寸下限铁律：`max(下限px, calc(N/var(--kniu_vw)))`；可视最小元素禁裸 px。
62. 控件绝对下限：page_btn/select/jumper≥28、switch≥18、table th/td≥38。
113. Shadow DOM：adoptSharedStyle 唯一注入；adoptedStyleSheets 微任务合并；模板缓存上限 200。
209. Shadow 盒模型：`:host` padding/margin/border 必被外部 reset 清零——放 shadow 内层；尺寸下限预写 max()。
210. 🔴 kniu-table editable 列回调：引擎走 `node.options=`，列回调统一经 `element.options?.onChange` 读；视图侧必须显式 `onChange:(fn)` 否则只本地保存不落库。
211. 🔴 usePagination.loadList 局部保存后重拉必须 `{silent:true}`（否则 loading 遮罩盖住整表「闪一下」）；探针须 patch kniu-table options setter 记录 {loading,rows}（盯遮罩节点会假阴性）。
127-130. 核心模块目录化；CSS 外置验收=语义等价+运行时层叠实测；探针禁写死 px；宿主定高内层 height:100%+min-height:0。
134. 探针 baseUrl 禁尾斜杠；dist 探针起 kniupreview.mjs。
215. 真机探针：Chrome `--headless=new --remote-debugging-port=9222 --user-data-dir=<绝对路径>` + connectOverCDP（Node 22 全局 WebSocket 可零依赖手写 CDP 客户端；Edge `--headless` 秒退不可用）。🔴 `--user-data-dir` 必须**绝对路径**：相对路径会被 Chrome 回退默认 profile，用户 Chrome 在跑时直接退出码 21、DevTools 不监听。入口必须 hash 路由；伪造会话 cookie 名取 `.env` SESSION_NAME、值=session id（forge 脚本须在**非沙箱**命令里跑——沙箱化 bash 的 CLI 文件写会进 overlay、下条命令即消失）；`page.evaluate` 不穿透 shadow 须 findDeep；弹层面板经 mountPopoverPortal 迁到 body 下 `[data-kniu-*-portal]` 的 shadowRoot；fixed 内锚点「跟随」断言用「transform 位移锚点+dispatchEvent(scroll)」；自测断言禁用 `cmd | tail; echo $?`（$? 是 tail 的退出码，管道掩码故障）。
154. useViews() 只认扁平「区域/名称」键（=视图相对 views/ 路径，如 'admin/common/main'，派生函数 kniumajviewkey.mjs::toCommonKey 与框架查找、闸门三方共用）；值是控制器相对 client/controller/ 基目录的真实文件路径（基目录不写入，如 'admin/mainController.js'，即 client/views/admin/common/main.html ↔ client/controller/admin/mainController.js），经 loadControllerFile 装载（导出名=文件名、default 兜底）；路由侧 loadController 紧凑式（`admin/loginController`，自动补后缀）不动，两套口径禁混。
158/167. 🔴 kniu:/kniu@ 写错字被静默摘除；改完视图必须重建 dist。
159. 嵌套 Shadow 树 document.querySelector 恒 null——递归 findDeep。
160. 操作列写视图模板静态声明；程序化只增纯数据列。
161. 列元信息唯一真源 state.columns。
162. 列内按行条件必须 `{{scope.row.<字段>}}`；守卫 check_row_scope_expr.mjs。
164. 数据库三层独立路由页；navigateTo(path,data)+getRouteData()。
165. 🔴 client/ 下 import 必须单行（builder 行锚定）。
169. 模态框统一规范：头部×关闭钮+每字段 kniu-form-cell+#prepend（闸门待补）。
170. 🔴 options-only 组件 onXxx 双链绑定⇒回调执行两次；取值读 `host.options`。
171. 新建组件四件套：CSS 外置 ?module/attachComponentShadow/options accessor/installOptionsOnlyProtocol。
176. kniu-page 渲染顺序严格=layout 声明顺序。
178/179. 🔴 UI.use 是全局配置唯一写法；声明式 UI.useComponent(spec)、低级 UI.defineComponent。
199-200/207. 🔴 leaf-plan 不变量：setupFor.update() 与 build() 同闸；根节点 :if 产物连 anchor 纳入 next；（回归探针待补）。
213. 🔴 弹层定位唯一入口 `kniuui.mjs::trackPopoverPosition`（scroll capture+passive+resize+rAF 同帧合并+key 去重；禁每帧强制布局）；`apply._alive` 停止协议与 dispose 幂等契约不得破坏。scroll composed:false 不穿 shadow 边界——监听必须经 `anchorScrollRoots(anchorEl)` 沿 composed 祖先链逐级挂 capture。
214. 🔴 编辑器链接/媒体 URL 校验必须走 `isDangerousUrl`（规则 116 执行面）；evalExpr catch 参数禁与外层表达式串同名（遮蔽后 dev 告警对 Error 调 .slice 自抛）。

## 6. 交互与样式
30(式). CSS 禁 background: 简写；下拉面板白底/1px #e4e7ed/圆角4px。
31(式). textarea 默认 min-height 120px；表格 th/td padding 5px 10px。
32(式). 宿主宽高传进 Shadow 实际元素；图片默认 object-fit:contain。
33-36. 评论/点赞：未登录不渲染输入区；本人判断只用 role_id；头像优先 tb_about.avatar。
54-56. 移动端固定列退化只写 `td.`；偏移写 CSS 变量禁内联。
76-84. editor/input prepend 高度 max(28px,calc(40/vw))；kniu-icon 禁 width/height:100%；固定列阴影同源实测列宽。
88. 组件内部 DOM 类名 kniu_sys_ 前缀。
97. 根滚动锁唯一入口 lockDocumentScroll/unlockDocumentScroll(owner)。
98. 空属性必须删属性本身：pruneEmptyAttribute*。
133/135-137. 构建压缩定稿：CSS squeezeCss；npm run build=--env=production；产物哈希可复现。
142. /api 全红先分层定位 probe_api_health.mjs；路由全 POST，GET 打路由 404 正常。
144-148. 后台按钮等高：默认 btn.size='small'、同排主按钮 'default'；视图 `<style>` 禁注释。
151. 🔴 手搓 `const self = {...}` 必须全量转发框架服务。
175. 组件共用样式唯一入口 UI.use({theme})；组件 CSS 禁写死色值。

## 7. 接口与文档
37. 统一响应 {status,msg,data}；HTTP 状态码仍表达鉴权/参数/服务器错误。
38-39. 新改接口同步 router.php/API.md/KNIU-API-CONTRACT.md；运行时异常统一 JSON。
43. 项目 Markdown 以源码为基线，漂移同轮修正。
44. 前台 SEO 走公开 /getInfo；/seo_list 仅后台。
67. client/config 与 api/config 一律扁平单层；改配置重建 dist。client/config/ 三文件：redirect.js（跳转目标清单）/ ui.js（全局组件默认值+主题）/ viewer.js（常驻视图映射），另有 builder.js/logger.js/router.js/server.js；client.mjs 只剩纯装配启动（use/useViews/UI.use/authRedirect/mount）禁再写内联手调项。
68. 路由唯一写法 ROUTER.add(路径, Controller)。
101. 分页/搜索/删除确认统一 usePage()；增删成功后局部更新或显式 loadList。
102. REQUEST 默认 mutation:true；纯查询显式 mutation:false。
104. Controller 请求一律用注入 request()；REQUEST() 只许 client/core/。
105. Controller 统一 controller(({...}) => {}) 箭头+显式解构禁 this。
121. 请求层默认 15s 超时；FormData 上传默认不超时。
140. 文档漂移靠脚本发现：三路 diff（路由↔契约、check_schema_vs_sql.php、关键字段 grep）。
206. 控制器复用薄函数（adminShared.js/databaseShared.js）。
196-205. 选型铁律：易学>简单>不失性能；纯 HTML {{}}+kniu: 指令、禁 AOT。

## 8. 数据库管理模块
212. 🔴 库列表排序外置：information_schema 无排序字段，档案存系统库 `tb_database_sort`（profile_id+db_name 唯一；空=系统连接）；读写经 `Db::managedConnection()` 保存现场→`useManaged(null)` 切系统连接→finally 还原；`/db_list` 合并后按 sid 重排并重编展示 id；删库/删档案连带清理。
217. 🔴 连接档案/数据表排序外置（212 同构）：`tb_database_connect_sort`（connect_id 唯一）与 `tb_database_table_sort`（profile_id+db_name+table_name 唯一）落系统库；连接档案存系统库 `tb_database_profile`（id 主键+name 唯一+is_active 至多一行 1，随行删除=清空当前连接；runtime/db-connections.json 已废弃）。
218. 🔴 后台页「浏览器无滚动条」口径：列表页=表格内滚（maxHeight: adminTableMaxHeight() 数字快照）；表单页=编辑器动态高度（adminEditorMaxHeight()=adminTableMaxHeight()-410）+ 卡片内滚兜底；页面级 .kniu_web_aside_view 永不滚动。

## 9. 模板引擎与富文本清洗
219. 🔴 kniutemplate.mjs 必须单文件禁拆分。递归驱动唯一入口 setupNestedFor/setupNestedIf + materializeRoots；根级 template:for 嵌套依赖 build 的 rootFor 分支（setupFor 必须返回 anchor）；kniu:[name] 由 DATA_ATTR_RE=(?:kniu:|:)\[ 匹配；闸门 probe_template_core.mjs（24 断言）。写法家当（改引擎优先复用，禁再手写）：directiveAttr/removeDirectiveAttrs（双前缀 `kniu:x`/`:x`）、selfAndDescendants、collectSinceBaseline、cacheSetLimited、findUnknownModifiers、LOADING_* 属性名表、bindRender、parseBindingSegments/stripBraces/extractBracedExpr（分段/脱壳/抓首值，语义不同勿混用）。
220. 🔴 组件 CSS 裸 px 被 `kniuui.mjs::normalizeComponentCss` 运行时改写为 calc(N/var(--kniu_vw))（无下限缩水；font-size 例外带 max(12px,…) 地板；含 var(--kniu_vw) 整条跳过）。跨列对齐/尺寸敏感样式必须手写 max(下限px, calc(N/var(--kniu_vw)))。
221. 🔴 模板引擎探针边界：kniu:loading-text 按表达式求值（文档 §6.5），裸文案静默空串，必须 ={{tip}} 或 ={{'加载中'}}；探针页不注册自定义元素，只能断言引擎自有属性（mask.show/mask.text），禁穿透 shadow；PAGE 两层字符串嵌套——页内禁单引号、禁闭合 script 字面量（否则脚本块被掐断、表现为无 PAGEERROR 的 waitForFunction 超时）。
222. 富文本清洗无需为 MathML 设单独黑名单：isDangerousAttribute 已覆盖所有节点 on*/URL/srcset，MathML 被通用清洗覆盖；SMIL activation 节点（animate/animateTransform/animateMotion/set）另有专属移除规则（attributeName 命中 on* 或 to/values 命中 javascript:/vbscript:/data:text 即整节点删除）。
223. 🔴 模板表达式作用域不回退 globalThis：makeScope Proxy get 未命中一律 return undefined（旧代码回退读 globalThis 构成隐式可达面）。{{ }} 内禁出现全局名，需要请在 controller 算好入 state。守卫 check_scope_globals.mjs + 探针 R14a/R14b。
224. 🔴 SMIL 清洗三处口径：①values 分号分隔多候选必须逐候选判危险（`values="http://ok;javascript:alert(1)"` 旧代码漏放）；②from 必须与 to 同权检查；③removeDangerousSmilNodes(content) 供 sync/async 共用。回归：每 payload sync/async 断言逐字相等。

## 10. 安全闸门与分页口径
225. 🔴 SQL 高危闸门唯一入口 `DatabaseController::sqlHighRiskReason`，三段式剥离：①普通块注释 `(?!\!)` 整剥；②版本注释只剥首分隔符 `/\/\*![0-9]*/` **保留内容**（执行型 `/*!` 剥掉内容反而制造绕过）；③尾 `/\*\//` 换空格还原邻接。`--` 三规则：`--[ \t][^\n]*`、`--\r?\n`、`--$/m`——禁写 `--[ \t\r\n][^\n]*`（\n 作开启符后吞下一行）。探针 probe_sql_gate.php（23 断言）。
226. clientIp 只在 REMOTE_ADDR 命中 `api/config/proxy.php` TRUSTED_PROXIES（精确 IP/IPv4 CIDR）时采信 CF-Connecting-IP，非受信一律 REMOTE_ADDR；CF 部署须配回源网段；探针 probe_client_ip.php。
227. 分页夹取唯一入口 `Db::clampPage/clampPageRows`（rows∈[1,200]=PAGE_ROWS_MAX，前后端同源）；探针 probe_db_page_clamp.php。
228. 🔴 LIKE 通配符消毒 `escapeLikeWildcards()`（Controller 层）必须在 `Db::escape`/`htmlspecialchars` **之后**调用——先消毒再转义会双转义失效。baseUrl() HTTP_HOST 仅接受 `/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i`，非法回 localhost（防 Host 投毒）。
229. /system 非超管分层输出：剥离 platform/arch/server/ip/rootDir/mysqlVer 六键（直接限 role=1 会破坏后台首页登录态回显）。
230. 🔴 编辑器行号缓存 key 用 `_lineContentVersion` 版本号，禁 scrollHeight:clientHeight:childElementCount（强制布局）；富文本清洗只挂 `_afterContentInsert()` 插入路径，text/html 原生粘贴必须 setTimeout(0) 异步补扫。
254. 编辑器行号的内容版本缓存不得吞掉几何变化：ResizeObserver、maxHeight/最大化切换必须 `force` 重测；rAF 合批用 pending force 累积，确保空内容的行号按最终 clientHeight 补满。
255. 生产 public Web 根的 `/static/...` 资源路径，开发与 dist 预览服务器必须显式映射到各自的 public/static；仅映射 `/upload` 会令接口默认头像等资源本地 404。
256. `client/config/server.js` 的 `SERVER.PUBLIC` 是公共资源目录唯一配置源；所有核心路径（别名、构建器 docs/复制、开发服务器、预览服务器）必须引用该字段，禁硬编码 `public`。
231. 🔴 withSubmitting 唯一来源 kniupage.mjs（adminShared re-export 兼容）；布尔锁≠单飞锁，index 层单飞（共享在途 Promise）不可机械替换。收口薄函数：createSortUpdateHandler / createRowDeleteHandler（idOf/buildData/reload/confirmTitle/confirmButtonText）/ createTableLoader / applyNavFlags / createSqlConsoleModel+openSqlConsole / createRequestActions；PHP 侧 sortUpdateGuard + Base::updateSortField(table)。
232. 🔴 默认字体 `KniuSans`、辅助 `KniuHei`（public/static/font/ 子目录各 7 字重 woff2）；@font-face 在 shadow 内不生效，document 级唯一生效点 = `public/static/css/web(.min).css` + `public/static/plugin/kniu/kniu(.min).css`，`kniu-font-face.css` 为 shadow 侧同构冗余；编辑器字体下拉 value 必须命中真实注册 family 名（`KniuSans_Regular`/`KniuHei_Regular`）；组件默认字体三常量在 kniui.mjs KNIU_FONT_FAMILY/MONO/SERIF + client.mjs theme，改默认字体两处同轮。真机字体断言用 fonts.load()（fonts.check 对未触发请求恒 false）。
233. 🔴 控制器从 kniui.mjs 具名 import 的唯一通道 = 文件末尾 `export const X = KniuUI.X;`（KniuUI 主体在 IIFE 闭包内，顶层 `export {}` 引不到闭包内函数；现仅 createRowDeleteHandler，新收口函数需同轮补）。`node --check` 不查 ESM 链接——具名导入断链运行时才炸；闸门 check_named_imports.mjs 必须随构建前跑。闸门反向自测铁律：注入故障必须 FAIL；文本分析必须先去注释（注释行会造成假阴性）。
234. 🔴 构建器 importBinding 分流：纯 default import 不再恒编译 `__live(id,'default')`——__live 是函数 Proxy，`Array.isArray`/ownKeys/展开对数组与对象 default 全部失真（redirect.js 清单失效、viewer.js 映射丢失的教训）。现按依赖源码 `export default` 形态分流：`{`/`[` 字面量 → `__require(id)["default"]` 直接取值；函数/类/调用表达式维持 __live（保循环依赖惰性取值与 this 绑定）。改 import 机制必须真机回归「数据型配置 + 函数型模块」两条路径。
235. 🔴 前端「1001 已返回却不跳转」类故障排障四件套（Chrome headless CDP 零依赖）：①addScriptToEvaluateOnNewDocument 注入全量 console hook（静默 catch/吞错现形）；②hook history.pushState + hashchange 拍 hash 变迁史（pushState('#/')=navigateTo(undefined) 指纹）；③Network.getResponseBody 抓实际响应 body；④源码临时埋点（探完必须拔净，grep 验证 0 残留）。手动 location.hash 赋值是路由二分基准（正常=问题在调用链，异常=问题在路由本身）。
236. 🔴 表格开关列/可编辑列回调必须「回传保存结果」：框架判定 `saved = await onChange(...) !== false`（kniuui.mjs 开关列 ~1328 / 可编辑列 ~1825），返回 undefined 被判「已保存」→ 请求失败时开关停在错误状态且无报错。被视图 `@change`/`onChange` 绑定的方法须 `return await actions.updateRow(...)` 或 `const res=await…; return !!res`。闸门 check_switch_callback_return.mjs（判据：最后一个 await 之后必须有带值 return；无 await 的同步回调跳过）。
237. 🔴 后台页面控制器统一前置 `requireLogin(AUTH, {$msg, navigateTo})`（adminShared.js），禁自造谓词（如 userController.canAccessUsers 只判本地缓存 name 非空）+ 手写 `navigateTo('/admin')`——那是「前端判定替代服务端鉴权」。登录页自身请求（含 `/captcha`）一律显式 `redirectOnUnauthorized:false`。
238. 🔴 跨标签登出/跳转禁复刻路由豁免清单：kniuauth.mjs 原 `/^#\/(admin|home|seo|…)/` 硬编码正则已删，改调 `REQUEST.notifyAuthExpired()` 统一走 1001/401 驱动；现存唯一路由字面量是 kniurequest.mjs:152 的幂等防线（`#/login`/`#/register` 前缀直接 return），属防重复跳转、非豁免清单，禁在此新增路由分支。
239. 🔴 组件 option 属性名错字=静默失效（规则158 执行面，已抓到 `row:'6'` 应为 rows）：`kniu:option` 键不在组件 OPTION_ATTRIBUTES/observedAttributes 即不反射、无告警；函数型 option（列 formatter/sortMethod/selectable）经 reflectOptions 被丢弃——新增函数型配置必须显式从 `element.options` 读。
240. 🔴 线上「全部查库接口 500」远程判别（无服务器权限）：①按「查库前返回 vs 查库后返回」切接口集合——前者正常（1001/2001/200）后者全炸（500 {status:4001}）= DB 层故障，与前端包无关；②空值 vs 合法格式值（如 64hex identity_token）二分触发深层路径；③响应 cookie/.env 派生值（如 SESSION_NAME）与本地逐字比对，验证生产配置已加载；④耗时差判别「挂起/丢包」vs「快速失败（拒连/表不存在）」；⑤500 体 {status:4001} 来自 Router.php invokeControllerAction 的 catch(\Throwable)，真实异常在 PHP error_log 的 `[Router] 服务器处理失败` 行；控制器内部 try/catch 挡不住路由层 requireLogin() 的登录态查库异常（有意 fail-closed）。
241. 🔴 请求层统一拦截器（kniurequest.mjs）：`interceptors={request:[],response:[]}` + `useRequestInterceptor/useResponseInterceptor`（返回注销函数）。请求拦截器 `(config)=>config|false`——返回 false 中止请求（不发网络，结果 `{status:0,msg:'请求已被拦截'}` 仍走完整回调与响应链）；响应拦截器 `(result)=>result` 可改/换结果。执行序：请求链 → performRequest → 响应链；**每个最终结果（含被拦截、网络失败、超时）都过响应链**。内置「鉴权跳转」响应拦截器注册在首位（先于业务拦截器）：HTTP 401 恒触发 + 业务码命中 authRedirectCodes（来自 request.js 的 REDIRECT.trigger，默认 [1001]）；`redirectOnUnauthorized:false` 豁免；拦截器自身异常按请求失败上抛（allSettled 兜底），不静默。结果对象仍为 `{status,msg,data,httpStatus,request}`（status=业务码），改判据用 result.status/httpStatus，勿加冗余别名字段。
242. 🔴 client/config/ 命名规范（用户定稿）：第一层字段 KEY 全大写、内部（嵌套）字段全小写（server.js PROXY 嵌套 url/change_origin 为范例）。豁免：CSS 变量 `--kniu-*`、路径别名 `@*`、代理前缀 `/api`、数字状态码、整文件路径映射（viewer.js 键为「区域/名称」）。闸门 `test/check_config_key_case.mjs`（状态机只在键位置取键，防三元 `'a':'b'` 误判）。🔴 配置改名必须同轮改消费方——已连踩两处静默断裂：server.js 改小写后 kniuproxy 仍读 cfg.URL（/api 全 502）；ui.js 大写 COMPONENTS/THEME  vs kniuui.mjs::use() 读小写 components/theme（组件默认值与整站 THEME 自三拆起就被静默丢弃）。use() 现读 config.COMPONENTS/config.THEME。
243. 🔴 viewer.js（静态非路由页面映射，与 router 的路由跳转不同）：键=视图相对 views/ 路径（与 kniumajviewkey.mjs::toCommonKey 派生值逐字一致，如 'admin/common/main'），值=控制器相对 client/controller/ 基目录的真实文件路径（控制器强制在该目录，基目录不写入，如 'admin/mainController.js'）。装载链：kniubase.mjs::useViews → kniumvvm.mjs::loadControllerFile（导出名=文件名）→ kniubuilder 第二锚点把 `import(\`../controller/${normalized}\`)` 换成 `__kniuLoadControllerFile`（bundle 运行时 `__require('client/controller/'+path)`）。闸门 test/check_viewer_paths.mjs（键=toCommonKey 派生值 + 视图存在 + 控制器存在 + 导出名匹配）。🔴 事故档案：三拆时 viewer 键写成 'admin/common/aside' 而框架 toCommonKey 按 'admin/aside' 查 → 全部公共视图控制器静默丢失、模板原样输出（{{ }} 不解析的字面形态）——键派生逻辑已提取 kniumajviewkey.mjs 单一真相源，框架查找与闸门共用，禁再各写一份。
244. 🔴 身份态动作请求（点赞/收藏/关注/删除等）禁带 `redirectOnUnauthorized:false`——该 flag 只属于读请求与登录页自身请求。带 flag 会抑掉内置鉴权拦截器的 1001 跳转，若处理器又是 `if (result.status === STATUS_UNAUTHORIZED) return;` 静默守卫（防重复 toast 用），组合结果=点击无任何反应（2026-10-20 故障：detailController 点赞/收藏/评论点赞）。正解：动作请求不设 flag，1001 交拦截器统一跳转（游客按 hasAccount 落 /login 或 /register，payload 带 redirect+id 可回跳），静默守卫保留。特例：submitComment 有 pending 评论流（savePendingComment+登录后补交）必须保留 flag。旧式「flag + 处理器内显式 navigateTo('/login')」（aboutController.toggleFollow）待迁统一路径。
245. 🔴「上一次页面」记忆=client/core/kniulastroute.mjs（可复用核心库，项目无关）：kniubase 路由变迁时经 notifyRouteChange 自动 rememberLastRoute(currentRoute)（state.currentRoute 在三个渲染分支成功末更新；首帧 null 不记）。存 sessionStorage（键 `KNIU_SYSTEM_LAST_ROUTE`，已导出）；读取时剥 # 前缀与查询串。**鉴权中转页清单不可硬编码进核心库**——库内 `let JUMP_ROUTES=[]` 默认空，由使用方经 `setAuthRoutes(routes)` 注入（`getAuthRoutes()` 可查）；本项目在 client.mjs 启动装配时**从 `REQUEST_CONFIG.REDIRECT.map(r=>r.route)` 派生**注入（REDIRECT 为单一真相源，不另设字段）。消费：/about、/profile 的 toBack（禁回自身、无记录回落 '/'）与 loginController.redirectTarget 的无 payload 回落。loginController 的 redirectTarget 必须读**实时** getRouteData()；toLogin/toRegister 须携带 routeData 切 tab 保 redirect 来源。闸门 test/check_last_route.mjs（注入 AUTH 路由后验过滤）。
246. 🔴 登录/注册页「返 回」按钮=loginController.toBack（原 toHome 硬编码 '/'，已更名改走 last-route 记忆：有记录回来源页含数据、无记录回落 '/'）；login.html 两处绑定（登录 tab、注册 tab）。reset tab 的「返 回」走 toLogin（tab 切换非页面返回）。注册提交与登录共用 finishAuth 出口（redirectTarget：payload 三 Case 优先 → last-route 回落 → /admin）。
247. 🔴 鉴权三页拆独立：/login→loginController、/register→registerController、/forgot→forgotController（原单文件 tab 判断已废除）；forgot 无图形验证码。共享逻辑 client/controller/admin/adminShared.js：clearCodeTimer/startCodeCountdown/quickValidateEmail/sendEmailCode、buildRedirectTarget（redirect 三 Case→last-route→null）、toBackRoute（last-route 回落 '/'）。kniubase.isLoginRoute 含 '/forgot'。request.js REDIRECT 为扁平数组（含 /login account:true、/register、/forgot，trigger 取默认 [1001]），**是鉴权中转页唯一清单**：kniulastroute 的过滤路由由 client.mjs 从 REDIRECT.route 派生，不在 request.js 另设 AUTH_ROUTES 字段、不在核心库硬编码。kniurequest/requireLogin/aboutController/profileController 均移除 tab 字段（按 IDENTITY.hasAccount() 选 /login 或 /register）；重定向仅经 routeData.redirect 传递。
248. 🔴 CSRF 双层防线（M1）：index.php 会话生成 $_SESSION['_csrf'] + 全响应 X-CSRF-Token 下发（时区/error ini 必须先于 Seo 钩子；logMessage/maskSensitiveParams 定义在 try 之前——catch 兜底不得自炸；error 级日志不随 log.ENABLE=false 丢弃）。Router::validateCsrf() 对 authRequired=true 的写请求 hash_equals 校验（HTTP403+1008，ErrorCode::CSRF_INVALID=1008），免登录写接口靠 Origin+频控兜底。前端 kniurequest：任意响应读头存 sessionStorage(KNIU_CSRF_TOKEN)、写请求自动带 X-CSRF-Token、403+1008 且未携带时自动重试一次。authRedirect 只接受 REDIRECT 扁平数组（用户定稿：不做旧形态兼容）；免跳转白名单/isLoginRoute/JUMP_ROUTES 三方同源 getAuthRoutes()。
249. 🔴 修复组口径（审查落地）：Seo.php JSON-LD 必走 jsonLd()（JSON_HEX_* 四开关）+ stripTagsStable 幂等去标签；kniutemplate 清洗走共享 removeDangerousSmilNodes（kniusanitizer 唯一实现）；DatabaseController 错误一律 dbFail()（固定文案+error_log 原文），SQL 控制台调试消息除外；likeEncodedPattern 已合并 %/_ 消毒（ORM 用），原始 SQL 拼接必须 escapeLikeWildcards(Db::escape(htmlspecialchars())) 顺序；文章点赞幂等唯一真相 tb_article_like 表（session 键已废）；DbProfile 密码 enc:v1: AES-256-GCM（.env DB_PROFILE_KEY，未配明文透传）。kniutemplate 快路径每段查 DANGEROUS_SCOPE_KEYS；非keyed for 收缩必须执行 viewCleanups；options-only 组件模板侧跳过 eventDescriptor（防双绑定）。
250. 🔴 自研 dev 代理（kniuproxy.mjs）响应转发是白名单制：新增自定义响应头（如 X-CSRF-Token）必须同步加白名单，否则前端拿不到头导致 CSRF 全线 403；改 kniuproxy 后 dev server 必须重启（Node ESM import 缓存）。CSRF 前端重试不设 token 存在性前置条件（403+1008 即重试一次，__csrfRetried 限次）。
251. kniu-tab-head hash 锚点模式：option.type==='hash' 时点击切换经 history.replaceState 写 URL 尾锚（#/路由#锚，不触发 hashchange/不进历史）；初始选中声明在 data 项内（{name,label,active:true}），优先级=命中配置项的尾锚 > data 项 active:true > 首项（顶层 options.active 声明写法已废弃不兜底；_selectItem 运行时回写 this._options.active 保留作去重状态）——尾锚必须命中配置项才采纳（乱写/过期锚视为无效回落声明默认）；默认 'default' 行为不变。kniubase._renderRoute 的 pathOnly 必须经 routePathFromHash（剥 ? 与尾锚）——tab 锚点刷新不得影响路由匹配；新增自定义响应头/URL 形态时同步核查 kniubase 全部 hash 消费点（split('?') 处未必 split('#')）。
252. 兼容层定稿（用户裁定）：kniu: 指令长前缀永久保留（规则 219 双前缀口径不动，即使视图 0 处使用）；数据迁移类兼容（密码 hash 长度/会话 id 字符串/DbProfile 存量明文/旧前台用户 ID 昵称回查/frontUserIdByRoleId）一律保留；代码级死兼容可删需经用户确认。kniurequest 参数名唯一口径 dataType（responseType 旧名已删）。
253. 🔴 验证码实例 token 绑定（防多标签错配）：答案存 $_SESSION['captcha_'.token]（16 hex），响应头 X-Captcha-Token 下发，提交回传 post.captcha_token；保留最近 8 个未消费实例（多标签互不失效+防膨胀）；verifyArithmeticCaptcha 无 token/不命中即失败（无旧单键兼容）。前端 kniurequest result.headers 透出响应头，login/registerController 存 captchaToken 随提交带；kniuproxy 响应白名单必须含 x-captcha-token（同 X-CSRF-Token 教训：白名单制代理新增下发头必须同步）。编辑器 _buildEditorLineNumbers 的 total 必须取 max(内容高, 可视区高)——空 contenteditable 时否则行号不铺满。
254. 🔴 核心库去项目化：`client/core` 禁止固定项目路由、接口、认证字段/存储键、控制器目录、视图壳层和业务上传端点。统一由 `client/config/app.js`（目录/标签/壳层）、`auth.js`（认证协议）、`request.js`（请求与 CSRF）、`server.js`（代理）和 `ui.js`（组件端点）注入；代理必须按 `SERVER.PROXY` 最长前缀匹配，不能特判 `/api`。
253. 🔴 验证码实例 token 绑定（防多标签错配）：答案存 $_SESSION['captcha_'.token]（16 hex），响应头 X-Captcha-Token 下发，提交回传 post.captcha_token；保留最近 8 个未消费实例（多标签互不失效+防膨胀）；verifyArithmeticCaptcha 无 token/不命中即失败（无旧单键兼容）。前端 kniurequest result.headers 透出响应头，login/registerController 存 captchaToken 随提交带；kniuproxy 响应白名单必须含 x-captcha-token（同 X-CSRF-Token 教训：白名单制代理新增下发头必须同步）。编辑器 _buildEditorLineNumbers 的 total 必须取 max(内容高, 可视区高)——空 contenteditable 时否则行号不铺满。
