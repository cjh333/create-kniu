# KniuSystem 经验库（常错与共性问题）

## KniuSystem 框架守则

-	**面向用户的代码简洁**：页面/控制器是否有大量样板、重复劳动
-	**用户易上手**：API 一致性、文档与实现一致、坏味道误导
-	**代码性能优异**：运行时/渲染/内存/N+1
-	**框架防护等级安全**：注入、XSS、越权、敏感数据
-	**通用逻辑封装在核心库client/core内**：页面层是否在重复造轮子

> 只留「换个会话还会再犯」的稳定结论；过程叙事与验收数据见 `.workbuddy/memory/` 每日日志，规则化条目见工作区 MEMORY.md（编号引用）。

## 模板引擎与绑定层

- **模板内容文档的 upgrade 是 no-op**：`:for`/`:if` 从 `block.content` 克隆的节点属于独立 Document（注册表为空），`customElements.upgrade()` 静默跳过；在游离 frag 上先绑定后插入会让 `:option`/`:form` 全部落空。治本：升级前先 `document.adoptNode()`。排查指纹：`__kniuOptionsValue` 参数包存在 + `name` attribute 为 null + 自有 `value` 为 true = 绑定发生在未升级元素上。
- **指令处理顺序**：`:option`（配置）必须先于 `:form`（取值）——凡 value setter 依赖 options 语义的组件（date-picker、switch），配置先行取值在后，顺序颠倒会丢值。
- **deferred 条件渲染**：DocumentFragment 中创建的 `:if/:for` 节点必须延后到真实 DOM anchor 插入后激活；`:for` 克隆项内嵌套 `:if` 要递归激活后代节点，不能只处理循环根；keyed 与普通 `:for` 行为必须一致；deferred 激活函数禁自递归（路由渲染栈溢出）。
- **:for 逐项插入的兄弟判定**：本项 connectedCallback 执行时下一项尚未入 DOM，同步读 `nextElementSibling` 恒空——兄弟布局判断一律推微任务。
- **leaf-plan 快路径不变量**：`setupFor.update()` 与 `build()` 同闸——模板含 `:for/:if/:elseif/:else` 时禁走叶子计划快路，否则 `:if` 分支永不重建（详见工作区规则 #207）。
- **字段级订阅（P1 定稿）**：ITERATE（ownKeys）订阅必须挂响应式代理；整对象读取兜底 `subscribeWholeObject`；「遍历中间步 vs 整对象读取」按表达式文本静态判定（动态枚举会产出虚假路径）；`createView` 按作用域身份（item 代理同一性 + index）分流，身份未变直接 return 保住 per-node 订阅。
- **P2 代理缓存教训**：三级代理缓存命中完美（1000→1）但端到端零差异——**微基准占比 ≠ 端到端收益**，任何优化必须配对 A/B 验证后再合入。
- **三档调度**：`pre/render/post` 顺序 flush，`MAX_FLUSH_CYCLES=100` 兜底；用户 `watch` 回调走 post 档（执行时 DOM 已更新）；兜底轮打断自入队链后需显式 `flushJobs()` 排空，不能依赖已 resolve 的 nextTick。

## 组件

- **kniu-tab 两形态**：一体式（kniu-tab + panel）/ 解耦式（kniu-tab-head 的 `for` 指向 body 的 id）。active 优先级：options.active（受控）> attribute > 首面板；head 一次式配置 `:option="{{for,active,data:[{name,label}]}}"`，**点击后必须回写 `_options.active`**，否则 observer 会把选中项拉回初始页。页面零状态接线，面板常驻 DOM 仅 hidden 显隐。
- **::slotted 样式坑**：`::slotted(x){display:block}` 是作者样式，会压过 UA 的 `[hidden]{display:none}`——必须同时写 `::slotted(x[hidden]){display:none!important}`；`:host{display:inline-flex}+line-height:0` 会沿扁平树继承进 slot 内容，共享样式 `:host` 用 `display:block`，需要 inline-flex 的组件在自身 shadow 追加第二张 style 覆盖。
- **JS 基础坑**：class 是块级作用域，同类多注册类必须定义在 if 块外；connectedCallback 先于子元素解析，首渲染依赖 MutationObserver 异步补挂。
- **input/date-picker options 通道**：OPTION_ATTRIBUTES 白名单键反射为宿主 attribute（camelCase→kebab-case）；构造器须迁移自有 value/options；`'options' in node` 为 true 后 `:option` 走 own-setter 分支，与属性插值等价。
- **行编辑弹窗按列类型映射控件**：date/datetime/time→日期选择器（按粒度），长文本→富文本编辑器，json→源码模式编辑器，blob→textarea。载入值必须 `decodeHtmlEntities` 单轮解码——全站约定「写库 encodeFields / 读接口 decodeFields」，库内文本是实体形态；解码后保存原样入库，读取端幂等。
- **编辑器细节**：加粗输出 `<strong>`——`execCommand('bold')` 的标签由浏览器决定（生成 `<b>`），在工具栏命令出口与 Ctrl+B 快捷键统一走 `_normalizeBold()` 就地替换并还原选区；textarea 清除图标需避让滚动条（right:18px）；弹窗字段 margin 语义=「下一个兄弟是 form-cell/input-group 才设 margin-bottom」（末项不留边属预期）。

## 页面与鉴权

- **数据库页守卫只判登录态**：`onMounted` 仅 `AUTH.isLoggedIn()`；`AUTH.getUser()` 为 null ≠ 非超管；角色差异由导航渲染层收敛（`showDatabaseAdmin`），页面不重复判角色（用户拍板定案）。
- **登录失效链路**：restoreSession 在首路由渲染前完成，markLoggedOut 只复位本地态不跳转；后端 Base 对失效会话统一 401「登录已失效」，请求层 401/1001 自动登出跳登录。
- **后台系统信息**：sessionStorage 先渲染 + 挂载单次完整网络刷新，禁轮询完整快照；服务器 IP 展示口径=公网出口 IP（多 HTTPS 服务短超时 + 缓存，失败显示「—」，禁把内网/代理地址伪装为公网 IP）；上传上限唯一来源 `api/config/upload.php` 的 MAX_SIZE。

## 基准与优化方法学（长期有效）

- **基准方法学**：顺序测量被堆增长/GC 税污染（同一原语前半程 12ms 后半程 28ms）——必须轮询交错或独立进程；跨实现对比同机配对交替（单次波动可达 2 倍+）；对照线与分项同时测、分项之和 ≤ 对照线；挂载类基准注意口径偏差，结论按保守方向解读。
- **性能格局（O1-O13 收敛后定稿）**：更新热路径（细粒度文本/属性直写 DOM）显著快于对照框架；挂载/冷启动为「无编译步骤」运行时解释架构的固有成本，已从 9 倍差收敛到约 5.6 倍，日常数百行规模无感；列表「换数据」必须 `kniu:key`，大数据量列表用 kniu-table 行池。
- **选型终点**：前端目标优先级 = 易学 > 简单 > 不失性能；不为边际收益引入构建期预编译（破坏「零编译步骤」前提），运行时解释型优化 O1-O13 即合理终点（详见工作区规则 #205/#207）。