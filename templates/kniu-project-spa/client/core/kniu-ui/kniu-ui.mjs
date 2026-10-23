import TEMPLATE from '../kniu-template.mjs';
import REQUEST from '../kniu-request.mjs';
import IDENTITY from '../kniu-identity-service.mjs';
import { getResponseRecords, debounce } from '../kniu-util.mjs';
import { sanitizeRichHtml, sanitizeRichHtmlAsync } from '../kniu-sanitizer.mjs';
import { KNIU_TABLE_CLASS, KNIU_TABLE_WRAP_CLASS, unwrapTablesIn, wrapTablesIn } from '../kniu-code.mjs';
import { KNIU_ICON_NAMES, KNIU_ICONS } from '../kniu-icons.mjs';
import KNIU_BASE_RESET_CSS from './kniu-other/kniu-base.css?module';
import KNIU_BASE_CONTAIN_CSS from './kniu-other/kniu-contain.css?module';
import KNIU_CONTENT_TABLE_CSS from './kniu-other/kniu-content-table.css?module';
import KNIU_DROPDOWN_CSS from './kniu-other/kniu-dropdown.css?module';
import KNIU_DROPDOWN_OPTION_CSS from './kniu-other/kniu-dropdown.option.css?module';
import KNIU_FONT_FACE_CSS from './kniu-other/kniu-font-face.css?module';
import KNIU_MARKDOWN_CSS from './kniu-other/kniu-markdown.css?module';
import KNIU_RICHTEXT_CSS from './kniu-other/kniu-richtext.css?module';
import KNIU_EDITOR_CSS from './kniu-editor/kniu-editor.css?module';
import KNIU_EDITOR_OVERRIDE_CSS from './kniu-editor/kniu-editor.overrides.css?module';
import KNIU_BTN_CSS from './kniu-btn/kniu-btn.css?module';
import KNIU_BTN_METRICS_CSS from './kniu-btn/kniu-btn.metrics.css?module';
import KNIU_BTN_OVERRIDES_CSS from './kniu-btn/kniu-btn.overrides.css?module';
import KNIU_BTN_GROUP_CSS from './kniu-btn-group/kniu-btn-group.css?module';
import KNIU_SWITCH_CSS from './kniu-switch/kniu-switch.css?module';
import KNIU_MODAL_CSS from './kniu-modal/kniu-modal.css?module';
import KNIU_MODAL_CONFIRM_CSS from './kniu-modal/kniu-modal.confirm.css?module';
import KNIU_TABLE_COL_CSS from './kniu-table/kniu-table-col.css?module';
import KNIU_LOADING_CSS from './kniu-loading/kniu-loading.css?module';
import KNIU_MSG_CSS from './kniu-msg/kniu-msg.css?module';
import KNIU_SELECT_CSS from './kniu-select/kniu-select.css?module';
import KNIU_RADIO_GROUP_CSS from './kniu-radio-group/kniu-radio-group.css?module';
import KNIU_PAGE_CSS from './kniu-page/kniu-page.css?module';
import KNIU_IMAGE_CSS from './kniu-image/kniu-image.css?module';
import KNIU_IMAGE_OVERRIDES_CSS from './kniu-image/kniu-image.overrides.css?module';
import KNIU_INPUT_CSS from './kniu-input/kniu-input.css?module';
import KNIU_INPUT_STATES_CSS from './kniu-input/kniu-input.states.css?module';
import KNIU_INPUT_AFFIX_CSS from './kniu-input/kniu-input.affix.css?module';
import KNIU_INPUT_PASSWORD_CSS from './kniu-input/kniu-input.password.css?module';
import KNIU_INPUT_TEXTAREA_CSS from './kniu-input/kniu-input.textarea.css?module';
import KNIU_INPUT_METRICS_CSS from './kniu-input/kniu-input.metrics.css?module';
import KNIU_INPUT_GROUP_CSS from './kniu-input/kniu-input-group.css?module';
import KNIU_DATE_PICKER_CSS from './kniu-date-picker/kniu-date-picker.css?module';
import KNIU_DATE_PICKER_OVERRIDES_CSS from './kniu-date-picker/kniu-date-picker.overrides.css?module';
import KNIU_UPLOAD_CSS from './kniu-upload/kniu-upload.css?module';
import KNIU_ICON_CSS from './kniu-icon/kniu-icon.css?module';
import KNIU_BADGE_CSS from './kniu-badge/kniu-badge.css?module';
import KNIU_TAG_CSS from './kniu-tag/kniu-tag.css?module';
import KNIU_STATUS_CSS from './kniu-status/kniu-status.css?module';
import KNIU_TAB_CSS from './kniu-tab/kniu-tab.css?module';
import KNIU_EMPTY_CSS from './kniu-empty/kniu-empty.css?module';
import KNIU_EDITOR_PRINT_CSS from './kniu-editor/kniu-editor.print.css?module';
import KNIU_NAVBAR_CELLS_CSS from './kniu-navbar/kniu-navbar-cells.css?module';
import KNIU_NAVBAR_CELL_CSS from './kniu-navbar/kniu-navbar-cell.css?module';
import KNIU_SUB_NAVBAR_CSS from './kniu-navbar/kniu-sub-navbar.css?module';
import KNIU_SUB_NAVBAR_OVERRIDES_CSS from './kniu-navbar/kniu-sub-navbar.overrides.css?module';
import KNIU_NAVBAR_CSS from './kniu-navbar/kniu-navbar.css?module';
import KNIU_BACKTOP_CSS from './kniu-backtop/kniu-backtop.css?module';
import KNIU_LIKE_CSS from './kniu-like/kniu-like.css?module';
import KNIU_USER_LOGIN_CSS from './kniu-user-login/kniu-user-login.css?module';
import KNIU_USER_LOGIN_OVERRIDES_CSS from './kniu-user-login/kniu-user-login.overrides.css?module';
import { registerArticleTab as registerArticleTabComponent } from './kniu-article-tab/kniu-article-tab.mjs';
import KNIU_COMMENT_CSS from './kniu-comment/kniu-comment.css?module';
import KNIU_TABLE_CSS from './kniu-table/kniu-table.css?module';
import KNIU_INPUT_PASSWORD_ACTIONS_CSS from './kniu-input/kniu-input.password-actions.css?module';
import KNIU_INPUT_TIP_CSS from './kniu-input/kniu-input.tip.css?module';
import KNIU_NAVBAR_PLACEHOLDER_CSS from './kniu-navbar/kniu-navbar.placeholder.css?module';
import { registerButton } from './kniu-btn/kniu-btn.mjs';
import { registerButtonGroup } from './kniu-btn-group/kniu-btn-group.mjs';
import { registerSwitch } from './kniu-switch/kniu-switch.mjs';
import { registerModal } from './kniu-modal/kniu-modal.mjs';
import { registerTable } from './kniu-table/kniu-table.mjs';
import { registerLoading } from './kniu-loading/kniu-loading.mjs';
import { registerMsg } from './kniu-msg/kniu-msg.mjs';
import { registerSelect } from './kniu-select/kniu-select.mjs';
import { registerRadioGroup } from './kniu-radio-group/kniu-radio-group.mjs';
import { registerPage } from './kniu-page/kniu-page.mjs';
import { registerPageMore } from './kniu-page-more/kniu-page-more.mjs';
import { registerImage } from './kniu-image/kniu-image.mjs';
import { registerInput } from './kniu-input/kniu-input.mjs';
import { registerDatePicker } from './kniu-date-picker/kniu-date-picker.mjs';
import { registerForm } from './kniu-form/kniu-form.mjs';
import { registerUpload } from './kniu-upload/kniu-upload.mjs';
import { registerIcon } from './kniu-icon/kniu-icon.mjs';
import { registerBadge } from './kniu-badge/kniu-badge.mjs';
import { registerTag } from './kniu-tag/kniu-tag.mjs';
import { registerStatus } from './kniu-status/kniu-status.mjs';
import { registerTab } from './kniu-tab/kniu-tab.mjs';
import { registerEmpty } from './kniu-empty/kniu-empty.mjs';
import { registerEditor } from './kniu-editor/kniu-editor.mjs';
import { registerNavbar } from './kniu-navbar/kniu-navbar.mjs';
import { registerBacktop } from './kniu-backtop/kniu-backtop.mjs';
import { registerComment } from './kniu-comment/kniu-comment.mjs';
import { registerLike } from './kniu-like/kniu-like.mjs';
import { registerUserLogin } from './kniu-user-login/kniu-user-login.mjs';

const { reactive, compileExpression } = TEMPLATE;

var KniuUI = (function () {
  var state = reactive({
    loading: false
  });
  var componentDefaults = {};
  var toastTimer = null;
  var toastInstance = null;
  var SCROLL_LOCK_FLAG = 'kniuScrollLock';
  var scrollLockOwners = new Set();
  var scrollLockOriginals = null;
  var shadowTemplateCache = new Map();
  var shadowStyleSheetCache = new Map();
  var normalizedCssCache = new Map();
  var SHADOW_TEMPLATE_CACHE_LIMIT = 200;
  var tableTemplateCache = new Map();
  var shadowInnerHTMLDescriptor = null;
  var pendingAdoptedSheets = new Map();
  var adoptedSheetsFlushScheduled = false;

  var KNIU_FONT_FAMILY = 'KniuSans_Regular';
  var KNIU_FONT_MONO_FAMILY = 'KniuSans_Regular';
  var KNIU_FONT_SERIF_FAMILY = 'KniuSans_Regular';

  var KNIU_BASE_FONT_CSS = KNIU_FONT_FACE_CSS + ':host{--kniu-font-family:' + KNIU_FONT_FAMILY + ';--kniu-font-mono-family:' + KNIU_FONT_MONO_FAMILY + ';--kniu-font-serif-family:' + KNIU_FONT_SERIF_FAMILY + ';--kniu-navbar-font-size:max(12px,calc(14 / var(--kniu_vw)));font-family:var(--kniu-font-family)}';
  var KNIU_THEME_HOST_CSS = '';
  var KNIU_CONTAIN_EXCLUDE_TAGS = { 'KNIU-TABLE': 1, 'KNIU-NAVBAR': 1, 'KNIU-MODAL': 1, 'KNIU-DATE-PICKER': 1, 'KNIU-SELECT': 1, 'KNIU-USER-LOGIN': 1, 'KNIU-INPUT': 1, 'KNIU-COMMENT': 1, 'KNIU-EDITOR': 1 };
  var RICH_TEXT_LITERAL_TAG_RE = /<(\/?)(script|iframe|object|embed|link|meta|style|base|form)(?=\s|\/?>)/gi;

  function hasRichTextLiteralTag(value) {
    RICH_TEXT_LITERAL_TAG_RE.lastIndex = 0;
    return RICH_TEXT_LITERAL_TAG_RE.test(String(value || ''));
  }

  function shouldContainHost(tag) { return !KNIU_CONTAIN_EXCLUDE_TAGS[String(tag || '').toUpperCase()]; }

  function use(config = {}) {
    // 配置口径（client/config/ 命名规范）：第一层字段 KEY 大写、内部字段小写。
    const components = config.COMPONENTS && typeof config.COMPONENTS === 'object' ? config.COMPONENTS : {};
    Object.keys(components).forEach(function (name) {
      const tag = String(name).toLowerCase().startsWith('kniu-') ? String(name).toLowerCase() : 'kniu-' + String(name).toLowerCase();
      componentDefaults[tag] = { ...(componentDefaults[tag] || {}), ...(components[name] || {}) };
    });
    globalThis.__KNIU_UI_DEFAULTS__ = componentDefaults;
    const theme = config.THEME && typeof config.THEME === 'object' ? config.THEME : {};
    const themeEntries = Object.entries(theme).filter(function (entry) {
      return String(entry[0]).startsWith('--kniu-');
    });
    KNIU_THEME_HOST_CSS = themeEntries.length
      ? ':host{' + themeEntries.map(function (entry) { return entry[0] + ':' + String(entry[1]); }).join(';') + '}'
      : '';
    if (themeEntries.length) {
      const globalThemeCSS = ':root {\n' +
        themeEntries
          .map(function (entry) { return '  ' + entry[0] + ': ' + String(entry[1]); })
          .join(';\n') + '\n}';
      const globalRoot = globalThis.document;
      if (supportsAdoptedStyleSheets(globalRoot)) {
        adoptSharedStyle(globalRoot, globalThemeCSS, true);
      } else {
        const styleEl = document.createElement('style');
        styleEl.textContent = globalThemeCSS;
        globalRoot.appendChild(styleEl);
      }
    }
    return Object.freeze({ components: { ...componentDefaults }, theme: { ...theme } });
  }

  var KNIU_I18N = {
    cn: {
      'common.ok': '确定',
      'common.cancel': '取消',
      'common.delete': '删除',
      'common.back': '返回',
      'common.submit': '提交',
      'common.search': '搜索',
      'common.confirm': '确认',
      'common.save': '保存',
      'common.loading': '加载中...',
      'common.empty': '暂无数据',
      'common.noMore': '没有更多了',
      'common.auto': '自动',
      'common.rows': '行',
      'common.cols': '列',
      'common.width': '宽度',
      'common.height': '高度',
      'common.sourceType': '来源类型',
      'common.cloud': '云媒体',
      'common.localUpload': '本地上传',
      'common.mediaName': '媒体名称',
      'common.mediaUrl': '媒体地址',
      'common.localFile': '本地文件',
      'common.lockRatio': '锁定宽高比',
      'common.scale': '缩放',
      'common.chooseLocalFile': '请选择需要上传的本地文件',
      'editor.undo': '撤销',
      'editor.redo': '重做',
      'editor.preview': '预览',
      'editor.print': '打印',
      'editor.codeMode': '代码模式',
      'editor.maximize': '最大化/还原',
      'editor.bold': '加粗',
      'editor.italic': '斜体',
      'editor.underline': '下划线',
      'editor.strikeThrough': '删除线',
      'editor.subscript': '下标',
      'editor.superscript': '上标',
      'editor.justifyLeft': '左对齐',
      'editor.justifyCenter': '居中',
      'editor.justifyRight': '右对齐',
      'editor.justifyFull': '两端对齐',
      'editor.indent': '增加缩进',
      'editor.outdent': '减少缩进',
      'editor.insertOrderedList': '有序列表',
      'editor.insertUnorderedList': '无序列表',
      'editor.lineheight': '行距',
      'editor.h1': '标题1',
      'editor.h2': '标题2',
      'editor.h3': '标题3',
      'editor.p': '段落',
      'editor.blockquote': '引用',
      'editor.pre': '代码块',
      'editor.inlineCode': '行内代码',
      'editor.hr': '分割线',
      'editor.table': '表格',
      'editor.fontname': '字体',
      'editor.fontsize': '字号',
      'editor.forecolor': '文字颜色',
      'editor.hilitecolor': '文字背景',
      'editor.link': '链接',
      'editor.unlink': '取消链接',
      'editor.image': '插入图片',
      'editor.media': '插入音视频',
      'editor.emoticons': '表情',
      'editor.removeFormat': '清除格式',
      'editor.clearhtml': '清理HTML',
      'editor.selectAll': '全选',
      'editor.chooseFont': '选择字体',
      'editor.chooseSize': '选择字号',
      'editor.heading': '标题',
      'editor.chooseHeading': '选择标题',
      'editor.chooseLineHeight': '选择行距',
      'editor.spacing': '字距',
      'editor.chooseLetterSpacing': '选择字距',
      'editor.insertTable': '插入表格',
      'editor.tableRows': '行数',
      'editor.tableCols': '列数',
      'editor.insertLink': '插入链接',
      'editor.linkUrl': '链接地址',
      'editor.linkText': '链接文字',
      'editor.enterLinkText': '请输入链接文字',
      'editor.enterLinkUrl': '请输入链接地址',
      'editor.enterLinkUrlSafe': '请输入安全有效的链接地址',
      'editor.widthHeightRange': '宽度和高度必须在 1 至 5000px 之间',
      'editor.insertImage': '插入图片',
      'editor.imageUrl': '图片地址',
      'editor.localImage': '本地图片',
      'editor.insertMedia': '插入音视频',
      'editor.mediaType': '媒体类型',
      'editor.video': '视频',
      'editor.audio': '音频',
      'editor.editImage': '编辑图片',
      'editor.editVideo': '编辑视频',
      'editor.editAudio': '编辑音频',
      'editor.deleteImage': '删除图片',
      'editor.deleteVideo': '删除视频',
      'editor.deleteAudio': '删除音频',
      'editor.deleteConfirm': '确定要从文章正文中删除当前{1}吗？',
      'editor.deleteMediaBtn': '确定删除',
      'editor.enterMediaUrl': '请输入媒体地址',
      'editor.enterMediaName': '请输入媒体名称',
      'editor.enterImageUrl': '请输入安全有效的图片地址',
      'editor.enterMediaUrlSafe': '请输入安全有效的媒体地址',
      'editor.mediaUploadFail': '媒体文件上传失败',
      'editor.mediaUploadRetry': '媒体文件上传失败，请稍后重试',

      'modal.title': '提示',
      'modal.close': '关闭',
      'modal.cancel': '取消',
      'modal.ok': '确定',

      'table.actions': '操作',
      'table.empty': '暂无数据',

      'loading.aria': '加载中',

      'pagination.error': '加载失败',

      'image.loading': '加载中…',
      'image.error': '加载失败',
      'image.empty': '暂无图片',

      'input.clear': '清空输入内容',
      'input.hidePassword': '隐藏密码',
      'input.showPassword': '显示密码',

      'upload.select': '选择图片',
      'upload.empty': '暂无图片',
      'upload.uploaded': '已上传图片',
      'upload.deleteAria': '删除 {1}',
      'upload.tooLarge': '{1} 超过单张 {2}M 的限制',
      'upload.selectedCount': '已选择 {1} 张图片',
      'upload.selectedFileCount': '已选择 {1} 个文件',
      'upload.selectPreview': '选择图片可以预览（最多 {1} 张）',
      'upload.selectPreviewSingle': '选择图片可以预览',
      'upload.selectFile': '请选择文件（最多 {1} 个）',
      'upload.selectFileSingle': '请选择文件',
      'upload.maxCount': '最多只能选择 {1} 张图片',

      'navbar.menu': '菜单',
      'navbar.primary': '主导航',
      'navbar.expand': '展开导航',
      'navbar.collapse': '收起导航',
      'navbar.home': '首页',

      'backtop.aria': '返回顶部',

      'comment.title': '评论',
      'comment.empty': '暂无评论，快来抢沙发吧！',
      'comment.replyTo': '回复 ',
      'comment.cancelReply': '取消回复',
      'comment.emoji': '表情',
      'comment.anonymous': '匿名',
      'comment.reply': '回复',
      'comment.delete': '删除评论',
      'userLogin.profile': '个人中心',
      'userLogin.hello': '你好，',
      'userLogin.guest': '你好，访客！',
      'userLogin.login': '登录',
      'userLogin.register': '注册',
      'userLogin.admin': '后台管理',
      'userLogin.logout': '退出',
      'userLogin.logoutFail': '退出失败',
      'userLogin.feedback': '反馈问题'
    },
    en: {
      'common.ok': 'OK',
      'common.cancel': 'Cancel',
      'common.delete': 'Delete',
      'common.back': 'Back',
      'common.submit': 'Submit',
      'common.search': 'Search',
      'common.confirm': 'Confirm',
      'common.save': 'Save',
      'common.loading': 'Loading...',
      'common.empty': 'No data',
      'common.noMore': 'No more',
      'common.auto': 'Auto',
      'common.rows': 'Rows',
      'common.cols': 'Columns',
      'common.width': 'Width',
      'common.height': 'Height',
      'common.sourceType': 'Source',
      'common.cloud': 'Cloud',
      'common.localUpload': 'Local upload',
      'common.mediaName': 'Media name',
      'common.mediaUrl': 'Media URL',
      'common.localFile': 'Local file',
      'common.lockRatio': 'Lock aspect ratio',
      'common.scale': 'Scale',
      'common.chooseLocalFile': 'Please choose a local file to upload',
      'editor.undo': 'Undo',
      'editor.redo': 'Redo',
      'editor.preview': 'Preview',
      'editor.print': 'Print',
      'editor.codeMode': 'Code mode',
      'editor.maximize': 'Maximize / Restore',
      'editor.bold': 'Bold',
      'editor.italic': 'Italic',
      'editor.underline': 'Underline',
      'editor.strikeThrough': 'Strikethrough',
      'editor.subscript': 'Subscript',
      'editor.superscript': 'Superscript',
      'editor.justifyLeft': 'Align left',
      'editor.justifyCenter': 'Align center',
      'editor.justifyRight': 'Align right',
      'editor.justifyFull': 'Justify',
      'editor.indent': 'Increase indent',
      'editor.outdent': 'Decrease indent',
      'editor.insertOrderedList': 'Ordered list',
      'editor.insertUnorderedList': 'Unordered list',
      'editor.lineheight': 'Line height',
      'editor.h1': 'Heading 1',
      'editor.h2': 'Heading 2',
      'editor.h3': 'Heading 3',
      'editor.p': 'Paragraph',
      'editor.blockquote': 'Quote',
      'editor.pre': 'Code block',
      'editor.inlineCode': 'Inline code',
      'editor.hr': 'Divider',
      'editor.table': 'Table',
      'editor.fontname': 'Font',
      'editor.fontsize': 'Font size',
      'editor.forecolor': 'Text color',
      'editor.hilitecolor': 'Text highlight',
      'editor.link': 'Link',
      'editor.unlink': 'Unlink',
      'editor.image': 'Insert image',
      'editor.media': 'Insert media',
      'editor.emoticons': 'Emoticons',
      'editor.removeFormat': 'Clear format',
      'editor.clearhtml': 'Clean HTML',
      'editor.selectAll': 'Select all',
      'editor.chooseFont': 'Choose font',
      'editor.chooseSize': 'Choose font size',
      'editor.heading': 'Heading',
      'editor.chooseHeading': 'Choose heading',
      'editor.chooseLineHeight': 'Choose line height',
      'editor.spacing': 'Letter spacing',
      'editor.chooseLetterSpacing': 'Choose letter spacing',
      'editor.insertTable': 'Insert table',
      'editor.tableRows': 'Rows',
      'editor.tableCols': 'Columns',
      'editor.insertLink': 'Insert link',
      'editor.linkUrl': 'Link URL',
      'editor.linkText': 'Link text',
      'editor.enterLinkText': 'Enter link text',
      'editor.enterLinkUrl': 'Enter a link URL',
      'editor.enterLinkUrlSafe': 'Enter a safe valid link URL',
      'editor.widthHeightRange': 'Width and height must be between 1 and 5000px',
      'editor.insertImage': 'Insert image',
      'editor.imageUrl': 'Image URL',
      'editor.localImage': 'Local image',
      'editor.insertMedia': 'Insert media',
      'editor.mediaType': 'Media type',
      'editor.video': 'Video',
      'editor.audio': 'Audio',
      'editor.editImage': 'Edit image',
      'editor.editVideo': 'Edit video',
      'editor.editAudio': 'Edit audio',
      'editor.deleteImage': 'Delete image',
      'editor.deleteVideo': 'Delete video',
      'editor.deleteAudio': 'Delete audio',
      'editor.deleteConfirm': 'Remove this {1} from the article body?',
      'editor.deleteMediaBtn': 'Delete',
      'editor.enterMediaUrl': 'Enter media URL',
      'editor.enterMediaName': 'Enter media name',
      'editor.enterImageUrl': 'Enter a safe valid image URL',
      'editor.enterMediaUrlSafe': 'Enter a safe valid media URL',
      'editor.mediaUploadFail': 'Media upload failed',
      'editor.mediaUploadRetry': 'Media upload failed, please try again later',

      'modal.title': 'Notice',
      'modal.close': 'Close',
      'modal.cancel': 'Cancel',
      'modal.ok': 'OK',

      'table.actions': 'Actions',
      'table.empty': 'No data',

      'loading.aria': 'Loading',

      'pagination.error': 'Failed to load',

      'image.loading': 'Loading...',
      'image.error': 'Failed to load',
      'image.empty': 'No image',

      'input.clear': 'Clear input',
      'input.hidePassword': 'Hide password',
      'input.showPassword': 'Show password',

      'upload.select': 'Select image',
      'upload.empty': 'No image',
      'upload.uploaded': 'Uploaded image',
      'upload.deleteAria': 'Delete {1}',
      'upload.tooLarge': '{1} exceeds the {2}M limit',
      'upload.selectedCount': '{1} image(s) selected',
      'upload.selectedFileCount': '{1} file(s) selected',
      'upload.selectPreview': 'Select images to preview (up to {1})',
      'upload.selectPreviewSingle': 'Select an image to preview',
      'upload.selectFile': 'Select files (up to {1})',
      'upload.selectFileSingle': 'Select a file',
      'upload.maxCount': 'You can select at most {1} image(s)',

      'navbar.menu': 'Menu',
      'navbar.primary': 'Primary nav',
      'navbar.expand': 'Expand nav',
      'navbar.collapse': 'Collapse nav',
      'navbar.home': 'Home',

      'backtop.aria': 'Back to top',

      'comment.title': 'Comments',
      'comment.empty': 'No comments yet, be the first to comment!',
      'comment.replyTo': 'Reply to ',
      'comment.cancelReply': 'Cancel reply',
      'comment.emoji': 'Emoticons',
      'comment.anonymous': 'Anonymous',
      'comment.reply': 'Reply',
      'comment.delete': 'Delete comment',
      'userLogin.profile': 'Profile',
      'userLogin.hello': 'Hello, ',
      'userLogin.guest': 'Hello, guest!',
      'userLogin.login': 'Sign in',
      'userLogin.register': 'Sign up',
      'userLogin.admin': 'Admin',
      'userLogin.logout': 'Logout',
      'userLogin.logoutFail': 'Logout failed',
      'userLogin.feedback': 'Feedback'
    }
  };

  function componentLang(options) {
    var v = options && options.lang != null ? options.lang : 'cn';
    return String(v).toLowerCase() === 'en' ? 'en' : 'cn';
  }

  function componentText(lang, key, params) {
    var dict = KNIU_I18N[lang] || KNIU_I18N.cn;
    var text = dict[key];
    if (text == null) text = KNIU_I18N.cn[key] != null ? KNIU_I18N.cn[key] : key;
    if (params && Object.keys(params).length) {
      for (var k in params) text = String(text).replace(new RegExp('\\{' + k + '\\}', 'g'), String(params[k]));
    }
    return text;
  }

  function supportsAdoptedStyleSheets(root) {
    if (globalThis.__KNIU_NO_SHARED_SHEETS) return false;
    return typeof CSSStyleSheet === 'function'
      && Array.isArray(root.adoptedStyleSheets)
      && typeof root.adoptedStyleSheets !== 'string';
  }

  function getSharedStyleSheet(cssText) {
    let sheet = shadowStyleSheetCache.get(cssText);
    if (!sheet) {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(cssText);
      shadowStyleSheetCache.set(cssText, sheet);
    }
    return sheet;
  }

  function normalizeComponentCss(cssText) {
    const source = String(cssText == null ? '' : cssText);
    let cached = normalizedCssCache.get(source);
    if (cached !== undefined) return cached;
    cached = source.replace(/(^|[;{}])([^{};]+):([^{};]+)/g, function (full, prefix, property, value) {
      const name = property.replace(/\/\*[\s\S]*?\*\//g, '').trim().toLowerCase();
      if (name.startsWith('@')) return full;
      if (/var\(\s*--kniu_vw\s*\)/.test(value)) return full;
      const isFont = name === 'font' || name === 'font-size';
      const converted = value.replace(/(-?)(\d+(?:\.\d+)?)px\b/g, function (_, sign, number) {
        if (number === '0') return '0';
        const signedNumber = sign === '-' ? '-' + number : number;
        return isFont
          ? 'max(12px,calc(' + signedNumber + ' / var(--kniu_vw)))'
          : 'calc(' + signedNumber + ' / var(--kniu_vw))';
      });
      return prefix + property + ':' + converted;
    });
    normalizedCssCache.set(source, cached);
    return cached;
  }

  function flushPendingAdoptedSheets() {
    adoptedSheetsFlushScheduled = false;
    const map = pendingAdoptedSheets;
    pendingAdoptedSheets = new Map();
    map.forEach(function (sheetSet, root) {
      if (!root || !Array.isArray(root.adoptedStyleSheets)) return;
      const existing = root.adoptedStyleSheets;
      let changed = false;
      const merged = existing.slice();
      sheetSet.forEach(function (sheet) {
        if (merged.indexOf(sheet) === -1) { merged.push(sheet); changed = true; }
      });
      if (changed) root.adoptedStyleSheets = merged;
    });
  }

  function scheduleAdoptedSheetsFlush() {
    if (adoptedSheetsFlushScheduled) return;
    adoptedSheetsFlushScheduled = true;
    if (typeof queueMicrotask === 'function') queueMicrotask(flushPendingAdoptedSheets);
    else Promise.resolve().then(flushPendingAdoptedSheets);
  }

  function adoptSharedStyle(root, cssText, raw) {
    if (!root || !cssText) return null;
    const css = raw ? String(cssText) : normalizeComponentCss(cssText);
    if (!css) return null;
    if (supportsAdoptedStyleSheets(root)) {
      const sheet = getSharedStyleSheet(css);
      let set = pendingAdoptedSheets.get(root);
      if (!set) { set = new Set(); pendingAdoptedSheets.set(root, set); }
      set.add(sheet);
      scheduleAdoptedSheetsFlush();
      return null;
    }
    const documentRef = root.ownerDocument || (root.host && root.host.ownerDocument) || document;
    const element = documentRef.createElement('style');
    const nonce = globalThis.__KNIU_CSP_NONCE__;
    if (nonce) element.setAttribute('nonce', String(nonce));
    element.textContent = css;
    root.appendChild(element);
    return element;
  }

  function appendRawStyle(root, cssText) {
    return adoptSharedStyle(root, cssText, true);
  }

  function adoptDropdownStyle(root) {
    adoptSharedStyle(root, KNIU_DROPDOWN_CSS);
    appendRawStyle(root, KNIU_DROPDOWN_OPTION_CSS);
  }

  var KNIU_CONTENT_TABLE_DOC_CSS = KNIU_CONTENT_TABLE_CSS + '.kniu_richtext_table_wrap{margin:10px 0 20px}';

  function getShadowInnerHTMLDescriptor() {
    if (shadowInnerHTMLDescriptor !== null) return shadowInnerHTMLDescriptor || null;
    if (typeof ShadowRoot === 'undefined') { shadowInnerHTMLDescriptor = false; return null; }
    let prototype = ShadowRoot.prototype;
    let descriptor = null;
    while (prototype && !descriptor) {
      descriptor = Object.getOwnPropertyDescriptor(prototype, 'innerHTML');
      prototype = Object.getPrototypeOf(prototype);
    }
    shadowInnerHTMLDescriptor = descriptor || false;
    return descriptor;
  }

  function attachComponentShadow(host) {
    const root = host.attachShadow({ mode: 'open' });
    if (typeof ShadowRoot === 'undefined') return root;
    adoptSharedStyle(root, KNIU_BASE_FONT_CSS);
    if (KNIU_THEME_HOST_CSS) adoptSharedStyle(root, KNIU_THEME_HOST_CSS, true);
    adoptSharedStyle(root, KNIU_BASE_RESET_CSS);
    if (shouldContainHost(host.tagName)) adoptSharedStyle(root, KNIU_BASE_CONTAIN_CSS);
    const descriptor = getShadowInnerHTMLDescriptor();
    if (!descriptor || typeof descriptor.get !== 'function') return root;
    Object.defineProperty(root, 'innerHTML', {
      configurable: true,
      get: function () { return descriptor.get.call(root); },
      set: function (markup) {
        const html = String(markup == null ? '' : markup);
        // 无 adoptedStyleSheets 支持时，回退路径注入的 <style> 不在 template.content 内，
        // replaceChildren 清不掉——先移除上一次注入的样式节点，避免每次赋值累积。
        const staleStyles = root.__kniuFallbackStyles;
        if (staleStyles) {
          staleStyles.forEach(function (element) { element.remove(); });
          root.__kniuFallbackStyles = null;
        }
        let styleText = '';
        const structure = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, function (_, css) {
          styleText += css + '\n';
          return '';
        });
        let template = shadowTemplateCache.get(structure);
        if (!template) {
          if (shadowTemplateCache.size >= SHADOW_TEMPLATE_CACHE_LIMIT) shadowTemplateCache.clear();
          template = (host.ownerDocument || document).createElement('template');
          template.innerHTML = structure;
          shadowTemplateCache.set(structure, template);
        }
        root.replaceChildren(template.content.cloneNode(true));
        if (styleText) {
          if (supportsAdoptedStyleSheets(root)) {
            adoptSharedStyle(root, styleText);
          } else {
            const injectedStyles = [];
            const resetBase = (root.ownerDocument || (root.host && root.host.ownerDocument) || document).createElement('style');
            resetBase.textContent = KNIU_BASE_RESET_CSS;
            root.appendChild(resetBase);
            injectedStyles.push(resetBase);
            if (shouldContainHost(host.tagName)) {
              const containBase = (root.ownerDocument || (root.host && root.host.ownerDocument) || document).createElement('style');
              containBase.textContent = KNIU_BASE_CONTAIN_CSS;
              root.appendChild(containBase);
              injectedStyles.push(containBase);
            }
            const fontBase = (root.ownerDocument || (root.host && root.host.ownerDocument) || document).createElement('style');
            fontBase.textContent = KNIU_BASE_FONT_CSS + KNIU_THEME_HOST_CSS;
            root.appendChild(fontBase);
            injectedStyles.push(fontBase);
            const componentStyle = adoptSharedStyle(root, styleText);
            if (componentStyle) injectedStyles.push(componentStyle);
            root.__kniuFallbackStyles = injectedStyles;
          }
        }
      }
    });
    return root;
  }

  function replaceChildrenWithFragment(target, nodes) {
    const documentRef = target.ownerDocument || document;
    const fragment = documentRef.createDocumentFragment();
    Array.from(nodes || []).forEach(function (node) {
      if (node) fragment.appendChild(node);
    });
    target.replaceChildren(fragment);
  }

  function computePopoverLayout(panel, anchorRect, opts) {
    const cfg = opts || {};
    const offset = cfg.offset == null ? 6 : cfg.offset;
    const measureWidth = (panel && panel.offsetWidth) || cfg.width || 0;
    const viewportWidth = Math.max(0, Number(globalThis.innerWidth) || document.documentElement?.clientWidth || 0);
    const viewportHeight = Math.max(0, Number(globalThis.innerHeight) || document.documentElement?.clientHeight || 0);
    const width = Math.min(measureWidth, Math.max(0, viewportWidth - 16));
    let left = Math.min(anchorRect.left, viewportWidth - width - 8);
    left = Math.max(8, left);
    const panelHeight = (panel && panel.offsetHeight) || cfg.height || 0;
    const spaceBelow = viewportHeight - anchorRect.bottom - 8;
    const spaceAbove = anchorRect.top - 8;
    const placement = spaceBelow < panelHeight && spaceAbove >= panelHeight ? 'top' : 'bottom';
    const top = placement === 'top' ? anchorRect.top - panelHeight - offset : anchorRect.bottom + offset;
    return { placement: placement, left: left, top: top, width: width, height: panelHeight };
  }

  function anchorScrollRoots(el) {
    const roots = [];
    const parentOf = function (n) {
      if (n.assignedSlot) return n.assignedSlot;
      const p = n.parentNode;
      if (p) return p.nodeType === 11 ? p.host : p;
      return n.host || null;
    };
    let node = el;
    while (node) {
      const root = node.getRootNode ? node.getRootNode() : null;
      if (!root) break;
      if (roots.indexOf(root) === -1) roots.push(root);
      if (root === document) break;
      node = parentOf(node);
    }
    return roots;
  }

  function trackPopoverPosition(anchor, apply, onDone, anchorEl) {
    let scheduled = false;
    let alive = true;
    let lastKey = '';
    const state = { alive: true };
    apply._alive = state;
    const measure = function () {
      if (!alive || !apply._alive) return;
      const rect = anchor();
      if (!rect) return;
      const key = rect.left + ',' + rect.top + ',' + rect.right + ',' + rect.bottom + ',' + globalThis.innerWidth + ',' + globalThis.innerHeight;
      if (key !== lastKey) {
        lastKey = key;
        apply(rect);
      }
    };
    const schedule = function () {
      if (scheduled || !alive) return;
      scheduled = true;
      if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(function () { scheduled = false; measure(); });
      else { scheduled = false; measure(); }
    };
    const rootTargets = anchorScrollRoots(anchorEl);
    const detachRoots = function () {
      rootTargets.forEach(function (root) {
        root.removeEventListener('scroll', schedule, true);
      });
    };
    const dispose = function () {
      if (!alive) return;
      alive = false;
      state.alive = false;
      apply._alive = null;
      scheduled = false;
      detachRoots();
      globalThis.removeEventListener('scroll', schedule, true);
      globalThis.removeEventListener('resize', schedule);
    };
    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('scroll', schedule, { capture: true, passive: true });
      globalThis.addEventListener('resize', schedule, { passive: true });
      rootTargets.forEach(function (root) {
        root.addEventListener('scroll', schedule, { capture: true, passive: true });
      });
    }
    measure();
    if (onDone) onDone(dispose);
    return dispose;
  }

  function mountPopoverPortal(panel, hostRoot, opts) {
    const cfg = opts || {};
    if (typeof document === 'undefined' || !panel || !hostRoot) return null;
    if (panel.__kniuPortalState) {
      if (panel.__kniuPortalState.portal?.isConnected) return panel.__kniuPortalState;
      panel.__kniuPortalState.unmount();
    }
    const portal = document.createElement('span');
    const homeParent = panel.parentNode;
    const homeMarker = document.createComment('kniu-popover-home');
    if (homeParent) homeParent.insertBefore(homeMarker, panel);
    portal.setAttribute(cfg.attribute || 'data-kniu-popover', '');
    const zIndex = cfg.zIndex == null ? 10030 : cfg.zIndex;
    portal.style.cssText = 'position:fixed;inset:0;display:block;width:0;height:0;pointer-events:none;z-index:' + zIndex;
    const root = portal.attachShadow({ mode: 'open' });
    flushPendingAdoptedSheets();
    if (typeof CSSStyleSheet !== 'undefined' && hostRoot.adoptedStyleSheets?.length && typeof root.adoptedStyleSheets !== 'undefined') {
      root.adoptedStyleSheets = hostRoot.adoptedStyleSheets.slice();
    } else {
      hostRoot.querySelectorAll('style').forEach(function (style) {
        root.appendChild(style.cloneNode(true));
      });
    }
    panel.style.pointerEvents = 'auto';
    root.appendChild(panel);
    document.body.appendChild(portal);
    const state = {
      portal: portal,
      root: root,
      panel: panel,
      unmount: function () {
        if (homeMarker.parentNode) homeMarker.parentNode.insertBefore(panel, homeMarker);
        else if (homeParent && homeParent.isConnected) homeParent.appendChild(panel);
        else hostRoot.appendChild(panel);
        homeMarker.remove();
        portal.remove();
        if (panel.__kniuPortalState === state) panel.__kniuPortalState = null;
      }
    };
    panel.__kniuPortalState = state;
    return state;
  }

  var TABLE_TEMPLATE_CACHE_LIMIT = 200;
  var TABLE_TEMPLATE_RE = /\{\{\s*([\s\S]*?)\s*\}\}/g;

  function compileTableRowTemplate(template) {
    const matches = [...template.matchAll(TABLE_TEMPLATE_RE)];
    if (!matches.length) return null;
    return {
      evaluators: matches.map(function (match) { return compileExpression(match[1]); }),
      whole: matches.length === 1 && matches[0][0] === template.trim(),
    };
  }

  function resolveTableRowTemplate(template, row, rowIndex) {
    if (typeof template === 'function') return template(row, rowIndex);
    if (typeof template !== 'string' || !template.includes('{{')) return template;
    let compiled = tableTemplateCache.get(template);
    if (compiled === undefined) {
      compiled = compileTableRowTemplate(template);
      if (tableTemplateCache.size >= TABLE_TEMPLATE_CACHE_LIMIT) tableTemplateCache.clear();
      tableTemplateCache.set(template, compiled);
    }
    if (!compiled) return template;

    const scope = { scope: { row: row, $index: rowIndex } };
    const evaluate = function (evaluator) {
      if (!evaluator) return '';
      try { return evaluator(scope); } catch { return ''; }
    };
    if (compiled.whole) return evaluate(compiled.evaluators[0]);
    let cursor = 0;
    return template.replace(TABLE_TEMPLATE_RE, function () {
      const value = evaluate(compiled.evaluators[cursor++]);
      return value == null ? '' : String(value);
    });
  }

  function scrollLockNodes() {
    if (typeof document === 'undefined' || !document.documentElement || !document.body) return null;
    return { root: document.documentElement, body: document.body };
  }

  function readScrollLockOriginals(nodes) {
    var leftOver = nodes.root.dataset[SCROLL_LOCK_FLAG] === '1';
    var props = ['overflow', 'overflowX', 'overflowY'];
    var originals = { root: {}, body: {} };
    props.forEach(function (prop) {
      originals.root[prop] = leftOver ? '' : (nodes.root.style[prop] || '');
      originals.body[prop] = leftOver ? '' : (nodes.body.style[prop] || '');
    });
    return originals;
  }

  function applyScrollLock(nodes) {
    nodes.root.dataset[SCROLL_LOCK_FLAG] = '1';
    nodes.root.style.setProperty('overflow', 'hidden');
    nodes.root.style.setProperty('overflow-x', 'hidden');
    nodes.root.style.setProperty('overflow-y', 'hidden');
    nodes.body.style.setProperty('overflow', 'hidden');
    nodes.body.style.setProperty('overflow-x', 'hidden');
    nodes.body.style.setProperty('overflow-y', 'hidden');
  }

  function writeScrollLockOriginals(nodes, originals) {
    if (!originals) return;
    ['overflow', 'overflowX', 'overflowY'].forEach(function (prop) {
      nodes.root.style[prop] = originals.root[prop] || '';
      nodes.body.style[prop] = originals.body[prop] || '';
    });
    pruneEmptyAttributes(nodes.root);
    pruneEmptyAttributes(nodes.body);
  }

  function releaseScrollLock(nodes) {
    var originals = scrollLockOriginals;
    var leftOver = !!nodes && nodes.root.dataset[SCROLL_LOCK_FLAG] === '1';
    scrollLockOriginals = null;
    scrollLockOwners.clear();
    if (!nodes) return false;
    writeScrollLockOriginals(nodes, originals);
    delete nodes.root.dataset[SCROLL_LOCK_FLAG];
    return leftOver || !!originals;
  }

  function lockDocumentScroll(owner) {
    var nodes = scrollLockNodes();
    if (!nodes) return false;
    var key = owner || 'anonymous';
    if (scrollLockOwners.has(key)) { applyScrollLock(nodes); return true; }
    if (scrollLockOwners.size === 0) scrollLockOriginals = readScrollLockOriginals(nodes);
    scrollLockOwners.add(key);
    applyScrollLock(nodes);
    return true;
  }

  function unlockDocumentScroll(owner) {
    var key = owner || 'anonymous';
    if (!scrollLockOwners.has(key)) return false;
    scrollLockOwners.delete(key);
    if (scrollLockOwners.size > 0) return true;
    releaseScrollLock(scrollLockNodes());
    return true;
  }

  function reconcileDocumentScrollLock() {
    var nodes = scrollLockNodes();
    if (!nodes) return false;
    if (scrollLockOwners.size > 0) return false;
    var marked = nodes.root.dataset[SCROLL_LOCK_FLAG] === '1';
    var stuck = nodes.root.style.overflow === 'hidden' || nodes.body.style.overflow === 'hidden';
    if (!marked && !stuck) return false;
    scrollLockOriginals = null;
    writeScrollLockOriginals(nodes, { root: {}, body: {} });
    delete nodes.root.dataset[SCROLL_LOCK_FLAG];
    return true;
  }

  var BOOLEAN_ATTRIBUTES = new Set([
    'allowfullscreen', 'async', 'autofocus', 'autoplay', 'checked', 'controls', 'default',
    'defer', 'disabled', 'formnovalidate', 'hidden', 'inert', 'ismap', 'itemscope', 'loop',
    'multiple', 'muted', 'nomodule', 'novalidate', 'open', 'playsinline', 'readonly',
    'required', 'reversed', 'selected'
  ]);
  var SEMANTIC_EMPTY_ATTRIBUTES = new Set(['value', 'alt', 'title', 'placeholder', 'name', 'label']);
  var PRUNABLE_ATTRIBUTE_NAMES = ['style', 'class', 'id'];

  function isEmptyAttributeValue(value) {
    return value == null || String(value).trim() === '';
  }

  function pruneEmptyAttribute(element, name) {
    if (!element || element.nodeType !== 1 || !name) return false;
    var attr = String(name).toLowerCase();
    if (BOOLEAN_ATTRIBUTES.has(attr) || SEMANTIC_EMPTY_ATTRIBUTES.has(attr)) return false;
    if (!element.hasAttribute(attr)) return false;
    if (!isEmptyAttributeValue(element.getAttribute(attr))) return false;
    element.removeAttribute(attr);
    return true;
  }

  function pruneEmptyAttributes(element, names) {
    if (!element || element.nodeType !== 1) return 0;
    var list = (names && names.length) ? names : PRUNABLE_ATTRIBUTE_NAMES;
    var removed = 0;
    for (var i = 0; i < list.length; i++) {
      if (pruneEmptyAttribute(element, list[i])) removed++;
    }
    return removed;
  }

  function pruneEmptyAttributeTree(root, names) {
    if (!root || root.nodeType !== 1) return 0;
    var removed = 0;
    var stack = [root];
    while (stack.length) {
      var node = stack.pop();
      removed += pruneEmptyAttributes(node, names);
      if (node.shadowRoot) {
        var shadowChildren = node.shadowRoot.children;
        for (var i = 0; i < shadowChildren.length; i++) stack.push(shadowChildren[i]);
      }
      var children = node.children;
      for (var j = 0; j < children.length; j++) stack.push(children[j]);
    }
    return removed;
  }

  function pruneEmptyRootAttributes() {
    if (typeof document === 'undefined' || !document.documentElement) return 0;
    var removed = pruneEmptyAttributes(document.documentElement);
    if (document.body) removed += pruneEmptyAttributes(document.body);
    return removed;
  }

  var loadingMaskInstance = null;

  function ensureLoadingMask() {
    if (loadingMaskInstance && loadingMaskInstance.isConnected) return loadingMaskInstance;
    if (typeof customElements === 'undefined' || typeof document === 'undefined' || !document.body) return null;
    if (!customElements.get('kniu-loading')) return null;
    loadingMaskInstance = document.createElement('kniu-loading');
    document.body.appendChild(loadingMaskInstance);
    return loadingMaskInstance;
  }

  function setLoading(value) {
    const next = !!value;
    if (state.loading === next) return;
    state.loading = next;
    const mask = ensureLoadingMask();
    if (mask) mask.show = next;
    if (next) lockDocumentScroll('loading');
    else unlockDocumentScroll('loading');
  }

  function msg(options) {
    const config = options && typeof options === 'object'
      ? options
      : { content: options };
    const content = config.content;
    const type = ['success', 'warning', 'info', 'error'].includes(config.type)
      ? config.type
      : 'info';
    if (typeof document === 'undefined' || !document.body) return { close: function () { } };
    if (toastTimer) clearTimeout(toastTimer);
    if (toastInstance) toastInstance.remove();
    const toast = document.createElement('kniu-msg');
    toast.message = content == null ? '' : String(content);
    toast.type = type;
    toast.visible = false;
    document.body.append(toast);
    toastInstance = toast;
    requestAnimationFrame(function () { toast.visible = true; });
    const close = function () {
      if (toastInstance !== toast) return;
      toast.visible = false;
      toastInstance = null;
      setTimeout(function () { toast.remove(); }, 250);
    };
    const configuredDuration = Number(config.duration);
    const duration = config.duration == null || !Number.isFinite(configuredDuration)
      ? 2600
      : Math.max(0, configuredDuration);
    if (duration > 0) {
      toastTimer = setTimeout(close, duration);
    }
    return { close: close };
  }

  function createTable(options = {}) {
    const target = options.el;
    if (!target || typeof target.replaceChildren !== 'function') {
      throw new TypeError('[KniuUI] createTable() requires a el element');
    }
    function readColumns() {
      return Array.isArray(options.cols)
        ? options.cols.filter(function (column) {
          return column.condition == null || !!resolveTableRowTemplate(column.condition, {}, 0);
        })
        : [];
    }
    const columns = readColumns();
    if (!columns.length) {
      throw new TypeError('[KniuUI] createTable() requires at least one column');
    }
    const documentRef = target.ownerDocument || document;
    const maxHeight = Number.parseInt(options.maxHeight, 10) || 0;
    const height = Number.parseInt(options.height, 10) || 0;
    let rows = Array.isArray(options.data) ? options.data : [];
    let initialRows = rows;
    let sortState = { field: '', order: '' };
    let currentRow = null;
    const selectedRows = new Set();
    let disposed = false;
    let fixedLeftWidth = 0;
    let fixedRightWidth = 0;
    let lastFixedOffsets = { left: new Map(), right: new Map() };
    let pendingEdit = null;
    let rendering = false;
    let headElement = null;
    let bodyElement = null;
    let rowPool = [];
    let rowPoolColumnSignature = '';
    let measuredColumnWidths = null;
    let shadowVisibilityFrame = 0;
    let viewportResizeObserver = null;

    const style = supportsAdoptedStyleSheets(target)
      ? (adoptSharedStyle(target, KNIU_TABLE_CSS), null)
      : (function () {
        const element = documentRef.createElement('style');
        element.textContent = normalizeComponentCss(KNIU_TABLE_CSS);
        return element;
      })();
    const group = documentRef.createElement('div');
    group.className = 'kniu_sys_table_group';
    const viewport = documentRef.createElement('div');
    viewport.className = 'kniu_sys_table_viewport';
    if (maxHeight) viewport.style.maxHeight = `${Math.max(40, maxHeight)}px`;
    if (height) viewport.style.height = `${Math.max(40, height)}px`;
    const table = documentRef.createElement('table');
    table.className = 'kniu_sys_table';
    let deskViewportMql = null;
    function isDeskViewport() {
      if (!deskViewportMql && typeof globalThis.matchMedia === 'function') {
        deskViewportMql = globalThis.matchMedia('(min-width: calc(1280px - 60px))');
      }
      return deskViewportMql ? deskViewportMql.matches : true;
    }
    let columnPlan = null;
    function refreshColumnPlan() {
      const explicitWidths = columns.map(function (column) {
        const w = Number.parseInt(column.width, 10);
        if (Number.isFinite(w) && w > 0) return w;
        const m = Number.parseInt(column.minWidth, 10);
        return Number.isFinite(m) && m > 0 ? m : 0;
      });
      let explicitTotal = 0;
      let defaultColumnWidth = 0;
      let autoCount = 0;
      explicitWidths.forEach(function (w) {
        if (w > 0) {
          explicitTotal += w;
          if (w > defaultColumnWidth) defaultColumnWidth = w;
        } else {
          autoCount += 1;
        }
      });
      const isMobile = !isDeskViewport();
      columnPlan = {
        explicitWidths: explicitWidths,
        defaultColumnWidth: defaultColumnWidth,
        isMobile: isMobile,
        minTotalWidth: explicitTotal + (isMobile ? autoCount * defaultColumnWidth : 0)
      };
      return columnPlan;
    }
    function applyTableMinWidth() {
      const plan = columnPlan || refreshColumnPlan();
      table.style.minWidth = options.fit !== false ? `${plan.minTotalWidth}px` : '0';
    }
    const leftFixedShadow = documentRef.createElement('div');
    leftFixedShadow.className = 'kniu_sys_table_fixed_shadow kniu_sys_table_fixed_shadow_left';
    leftFixedShadow.setAttribute('aria-hidden', 'true');
    const rightFixedShadow = documentRef.createElement('div');
    rightFixedShadow.className = 'kniu_sys_table_fixed_shadow kniu_sys_table_fixed_shadow_right';
    rightFixedShadow.setAttribute('aria-hidden', 'true');
    const loadingMask = documentRef.createElement('div');
    loadingMask.className = 'kniu_sys_table_loading';
    loadingMask.setAttribute('data-active', String(!!options.loading));
    loadingMask.setAttribute('role', 'status');
    loadingMask.setAttribute('aria-label', componentText(componentLang(options), 'loading.aria'));
    const loadingSpinner = documentRef.createElement('span');
    loadingSpinner.className = 'kniu_sys_table_loading_spinner';
    loadingMask.appendChild(loadingSpinner);
    const loadingTextEl = documentRef.createElement('span');
    loadingTextEl.className = 'kniu_sys_table_loading_text';
    loadingMask.appendChild(loadingTextEl);
    viewport.append(table);
    group.append(viewport, leftFixedShadow, rightFixedShadow, loadingMask);
    group.dataset.stripe = String(!!options.stripe);
    group.dataset.border = String(!!options.border);
    group.dataset.size = ['large', 'small'].includes(options.size) ? options.size : 'default';
    group.dataset.highlightCurrentRow = String(!!options.highlightCurrentRow);
    const tooltip = documentRef.createElement('div');
    tooltip.className = 'kniu_sys_table_tooltip';
    tooltip.hidden = true;
    tooltip.setAttribute('role', 'tooltip');
    replaceChildrenWithFragment(target, [style, group, tooltip]);

    function columnWidth(column) {
      return Math.max(40, Number.parseInt(column.width, 10) || Number.parseInt(column.minWidth, 10) || 120);
    }

    function fixedOffsets() {
      const left = new Map();
      const right = new Map();
      let offset = 0;
      columns.forEach(function (column, index) {
        if (column.fixed === true || column.fixed === 'left') {
          left.set(index, offset);
          offset += columnWidth(column);
        }
      });
      offset = 0;
      for (let index = columns.length - 1; index >= 0; index--) {
        const column = columns[index];
        if (column.fixed === 'right') {
          right.set(index, offset);
          offset += columnWidth(column);
        }
      }
      return { left: left, right: right };
    }

    function applyColumnLayout(cell, column, index, offsets) {
      const explicitWidth = Number.parseInt(column.width, 10);
      const hasWidth = Number.isFinite(explicitWidth) && explicitWidth > 0;
      const minWidth = Number.parseInt(column.minWidth, 10);
      const hasMinWidth = Number.isFinite(minWidth) && minWidth > 0;
      if (hasWidth) {
        cell.style.width = `${explicitWidth}px`;
        cell.style.minWidth = `${explicitWidth}px`;
        cell.style.maxWidth = `${explicitWidth}px`;
      } else if (hasMinWidth) {
        cell.style.minWidth = `${minWidth}px`;
      } else if (columnPlan && columnPlan.isMobile && columnPlan.defaultColumnWidth > 0) {
        cell.style.minWidth = `${columnPlan.defaultColumnWidth}px`;
      }
      cell.style.textAlign = column.align || 'left';
      if (offsets.left.has(index)) {
        cell.classList.add('kniu_sys_table_fixed_left');
        cell.style.setProperty('--kniu-fixed-left', `${offsets.left.get(index)}px`);
      }
      if (offsets.right.has(index)) {
        cell.classList.add('kniu_sys_table_fixed_right');
        cell.style.setProperty('--kniu-fixed-right', `${offsets.right.get(index)}px`);
      }
    }

    function showCellTooltip(cell) {
      if (!cell._tooltipText) return;
      if (cell.scrollWidth <= cell.clientWidth + 1) return;
      tooltip.textContent = cell._tooltipText;
      tooltip.hidden = false;
      const rect = cell.getBoundingClientRect();
      const tw = tooltip.offsetWidth;
      const th = tooltip.offsetHeight;
      const vGap = 6;
      const hMargin = 8;
      let top;
      let placement = 'top';
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceAbove >= th + vGap) {
        top = rect.top - th - vGap;
      } else if (spaceBelow >= th + vGap) {
        top = rect.bottom + vGap;
        placement = 'bottom';
      } else {
        if (spaceAbove >= spaceBelow) {
          top = rect.top - th - vGap;
        } else {
          top = rect.bottom + vGap;
          placement = 'bottom';
        }
      }
      let left = rect.left + rect.width / 2 - tw / 2;
      if (left < hMargin) left = rect.left;                                       // 左避让
      if (left + tw > window.innerWidth - hMargin) left = rect.right - tw;        // 右避让
      left = Math.max(hMargin, Math.min(left, window.innerWidth - tw - hMargin)); // 视口兜底
      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
      tooltip.dataset.placement = placement;
      const cellCenterX = rect.left + rect.width / 2 - left;
      const arrowX = Math.max(10, Math.min(cellCenterX, tw - 10));
      tooltip.style.setProperty('--kniu_tip_arrow_x', `${arrowX}px`);
    }
    function hideTooltip() { tooltip.hidden = true; }

    function appendCellContent(cell, column, row, rowIndex) {
      if (column.type === 'index') {
        cell.textContent = typeof column.index === 'function' ? column.index(rowIndex) : String(rowIndex + (Number(column.index) || 1));
        return;
      }
      if (column.type === 'checkbox') {
        const checkbox = documentRef.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'kniu_sys_table_selection';
        checkbox.dataset.rowIndex = String(rowIndex);
        checkbox.checked = selectedRows.has(row);
        checkbox.disabled = typeof column.selectable === 'function' && !column.selectable(row, rowIndex);
        checkbox.addEventListener('click', function (event) { event.stopPropagation(); });
        checkbox.addEventListener('change', function () {
          const currentIndex = Number.parseInt(checkbox.dataset.rowIndex, 10);
          const currentRowData = Number.isFinite(currentIndex) ? rows[currentIndex] : row;
          if (currentRowData === undefined) return;
          if (checkbox.checked) selectedRows.add(currentRowData);
          else selectedRows.delete(currentRowData);
          options.host?.dispatchEvent(new CustomEvent('selection-change', { detail: [...selectedRows], bubbles: true, composed: true }));
          render();
        });
        cell.append(checkbox);
        return;
      }
      if (column.image) {
        const image = documentRef.createElement('kniu-image');
        image.options = { ...(column.image.options || column.image.attributes || {}), src: column.field == null ? '' : row?.[column.field] };
        image.style.width = column.image.width;
        image.style.height = column.image.height;
        cell.append(image);
        return;
      }
      if (column.switch) {
        const switchElement = documentRef.createElement('kniu-switch');
        if (column.switch.options && typeof column.switch.options === 'object') {
          switchElement.options = column.switch.options;
        }
        switchElement.value = column.field == null ? false : row?.[column.field];
        switchElement.dataset.rowIndex = String(rowIndex);
        switchElement._saveQueue = Promise.resolve();
        switchElement._changeVersion = 0;
        switchElement.addEventListener('change', async function (event) {
          const currentIndex = Number.parseInt(switchElement.dataset.rowIndex, 10);
          const currentRowData = Number.isFinite(currentIndex) ? rows[currentIndex] : row;
          if (currentRowData === undefined) return;
          const previousValue = column.field == null ? undefined : currentRowData[column.field];
          const requestedValue = event.detail;
          if (column.field != null) currentRowData[column.field] = requestedValue;
          if (typeof column.switch.onChange !== 'function') return;
          const changeVersion = ++switchElement._changeVersion;
          const saveTask = switchElement._saveQueue.then(function () {
            return column.switch.onChange(currentIndex, rows, requestedValue);
          });
          switchElement._saveQueue = saveTask.catch(function () { return false; });
          const saved = await saveTask.catch(function () { return false; }) !== false;
          if (!saved && column.field != null && switchElement._changeVersion === changeVersion) {
            currentRowData[column.field] = previousValue;
            switchElement.value = previousValue;
          }
        });
        cell.append(switchElement);
        return;
      }
      if (column.tag) {
        const tag = documentRef.createElement('kniu-tag');
        tag.options = Object.fromEntries(Object.entries(column.tag.options || column.tag.attributes || {}).map(function ([name, value]) {
          return [name, resolveTableRowTemplate(value, row, rowIndex)];
        }));
        const rawValue = column.field == null ? '' : row?.[column.field];
        tag.textContent = rawValue == null ? '' : String(rawValue);
        cell.append(tag);
        return;
      }
      if (column.status) {
        const status = documentRef.createElement('kniu-status');
        status.options = Object.fromEntries(Object.entries(column.status.options || column.status.attributes || {}).map(function ([name, value]) {
          return [name, resolveTableRowTemplate(value, row, rowIndex)];
        }));
        const rawValue = column.field == null ? '' : row?.[column.field];
        status.textContent = rawValue == null ? '' : String(rawValue);
        cell.append(status);
        return;
      }
      if (column.radio) {
        const radioGroup = documentRef.createElement('kniu-radio-group');
        radioGroup._saveQueue = Promise.resolve();
        radioGroup._changeVersion = 0;
        (column.radio.options || []).forEach(function (opt) {
          const radio = documentRef.createElement('kniu-radio');
          if (opt.value !== '' && opt.value != null) radio.setAttribute('value', String(opt.value));
          radio.setAttribute('label', opt.label == null ? '' : String(opt.label));
          radioGroup.appendChild(radio);
        });
        radioGroup.value = column.field == null ? '' : String(row?.[column.field]);
        radioGroup.dataset.rowIndex = String(rowIndex);
        radioGroup.addEventListener('change', async function (event) {
          const currentIndex = Number.parseInt(radioGroup.dataset.rowIndex, 10);
          const currentRowData = Number.isFinite(currentIndex) ? rows[currentIndex] : row;
          if (currentRowData === undefined) return;
          const previousValue = column.field == null ? undefined : currentRowData[column.field];
          const requestedValue = event.detail;
          if (column.field != null) currentRowData[column.field] = requestedValue;
          if (typeof column.radio.onChange !== 'function') return;
          const changeVersion = ++radioGroup._changeVersion;
          const saveTask = radioGroup._saveQueue.then(function () {
            return column.radio.onChange(currentIndex, rows, requestedValue);
          });
          radioGroup._saveQueue = saveTask.catch(function () { return false; });
          const saved = await saveTask.catch(function () { return false; }) !== false;
          if (!saved && column.field != null && radioGroup._changeVersion === changeVersion) {
            currentRowData[column.field] = previousValue;
            radioGroup.value = previousValue;
          }
        });
        cell.append(radioGroup);
        return;
      }
      if (Array.isArray(column.actions)) {
        column.actions.forEach(function (action, actionIndex) {
          if (action.condition != null && !resolveTableRowTemplate(action.condition, row, rowIndex)) return;
          const button = documentRef.createElement('kniu-btn');
          button.className = `kniu_sys_table_action${action.className ? ` ${action.className}` : ''}`;
          button.options = {
            nativeType: 'button', type: action.type, size: action.size, plain: action.plain,
            text: action.text, bg: action.bg, link: action.link, round: action.round, circle: action.circle,
            disabled: action.disabled, icon: action.icon
          };
          button.dataset.rowIndex = String(rowIndex);
          button.dataset.columnIndex = String(columns.indexOf(column));
          button.dataset.actionIndex = String(actionIndex);
          button.textContent = typeof action.title === 'function'
            ? String(action.title(row, rowIndex))
            : String(action.title || componentText(componentLang(options), 'table.actions'));
          cell.append(button);
        });
        return;
      }
      const rawValue = column.field == null ? '' : row?.[column.field];
      const value = typeof column.formatter === 'function'
        ? column.formatter(row, column, rawValue, rowIndex)
        : rawValue;
      const text = value == null ? '' : String(value);
      cell.textContent = text;
      if (column.showOverflowTooltip) {
        cell.classList.add('kniu_sys_table_cell_tooltip');
        cell._tooltipText = text;
        cell.addEventListener('mouseenter', function () { showCellTooltip(cell); });
        cell.addEventListener('mouseleave', function () { hideTooltip(); });
      }
    }

    function isPlainTextColumn(column) {
      return column.type !== 'checkbox'
        && !column.image
        && !column.switch
        && !column.radio
        && !column.tag
        && !column.status
        && !Array.isArray(column.actions);
    }

    function updateCellWidget(cell, column, row, rowIndex) {
      const child = cell.firstElementChild;
      if (column.type === 'checkbox') {
        if (!child || child.tagName !== 'INPUT') return false;
        child.dataset.rowIndex = String(rowIndex);
        child.checked = selectedRows.has(row);
        child.disabled = typeof column.selectable === 'function' && !column.selectable(row, rowIndex);
        return true;
      }
      if (column.image) {
        if (!child || child.tagName !== 'KNIU-IMAGE') return false;
        child.options = { ...(column.image.options || column.image.attributes || {}), src: column.field == null ? '' : row?.[column.field] };
        return true;
      }
      if (column.switch) {
        if (!child || child.tagName !== 'KNIU-SWITCH') return false;
        if (column.switch.options && typeof column.switch.options === 'object'
          && child.options !== column.switch.options) {
          child.options = column.switch.options;
        }
        child.value = column.field == null ? false : row?.[column.field];
        child.dataset.rowIndex = String(rowIndex);
        return true;
      }
      if (column.radio) {
        if (!child || child.tagName !== 'KNIU-RADIO-GROUP') return false;
        child.value = column.field == null ? '' : String(row?.[column.field]);
        child.dataset.rowIndex = String(rowIndex);
        return true;
      }
      if (column.tag || column.status) {
        const tagName = column.tag ? 'KNIU-TAG' : 'KNIU-STATUS';
        if (!child || child.tagName !== tagName) return false;
        const config = column.tag || column.status;
        child.options = Object.fromEntries(Object.entries(config.options || config.attributes || {}).map(function ([name, value]) {
          return [name, resolveTableRowTemplate(value, row, rowIndex)];
        }));
        const rawValue = column.field == null ? '' : row?.[column.field];
        child.textContent = rawValue == null ? '' : String(rawValue);
        return true;
      }
      if (Array.isArray(column.actions)) return updateActionButtons(cell, column, row, rowIndex);
      return false;
    }

    function updateActionButtons(cell, column, row, rowIndex) {
      const existing = [...cell.children];
      let cursor = 0;
      column.actions.forEach(function (action, actionIndex) {
        if (action.condition != null && !resolveTableRowTemplate(action.condition, row, rowIndex)) return;
        let button = existing[cursor];
        if (!button || button.tagName !== 'KNIU-BTN') {
          button = documentRef.createElement('kniu-btn');
          cell.appendChild(button);
        }
        button.className = `kniu_sys_table_action${action.className ? ` ${action.className}` : ''}`;
        button.style.display = '';
        button.options = {
          nativeType: 'button', type: action.type, size: action.size, plain: action.plain,
          text: action.text, bg: action.bg, link: action.link, round: action.round, circle: action.circle,
          disabled: action.disabled, icon: action.icon
        };
        button.dataset.rowIndex = String(rowIndex);
        button.dataset.columnIndex = String(columns.indexOf(column));
        button.dataset.actionIndex = String(actionIndex);
        const title = typeof action.title === 'function'
          ? String(action.title(row, rowIndex))
          : String(action.title || componentText(componentLang(options), 'table.actions'));
        if (button.textContent !== title) button.textContent = title;
        cursor += 1;
      });
      for (let index = cursor; index < existing.length; index += 1) existing[index].style.display = 'none';
      return true;
    }

    function renderCellContent(cell, column, row, rowIndex, reused) {
      if (!cell) return;
      if (isPlainTextColumn(column)) {
        let text;
        if (column.type === 'index') {
          text = typeof column.index === 'function'
            ? String(column.index(rowIndex))
            : String(rowIndex + (Number(column.index) || 1));
        } else {
          const rawValue = column.field == null ? '' : row?.[column.field];
          const value = typeof column.formatter === 'function'
            ? column.formatter(row, column, rawValue, rowIndex)
            : rawValue;
          text = value == null ? '' : String(value);
        }
        if (cell.textContent !== text) cell.textContent = text;
        if (column.showOverflowTooltip) {
          cell._tooltipText = text;
          if (!cell.classList.contains('kniu_sys_table_cell_tooltip')) {
            cell.classList.add('kniu_sys_table_cell_tooltip');
            cell.addEventListener('mouseenter', function () { showCellTooltip(cell); });
            cell.addEventListener('mouseleave', function () { hideTooltip(); });
          }
        }
        return;
      }
      if (reused && updateCellWidget(cell, column, row, rowIndex)) return;
      cell.replaceChildren();
      appendCellContent(cell, column, row, rowIndex);
    }

    function createBodyRow(offsets) {
      const tableRow = documentRef.createElement('tr');
      const cellFragment = documentRef.createDocumentFragment();
      columns.forEach(function (column, index) {
        const cell = documentRef.createElement('td');
        applyColumnLayout(cell, column, index, offsets);
        cellFragment.appendChild(cell);
      });
      tableRow.appendChild(cellFragment);
      return tableRow;
    }

    function buildBodyRow(row, rowIndex, offsets) {
      const pooled = rowPool[rowIndex];
      const reused = !!pooled
        && !pooled.classList.contains('kniu_sys_table_empty')
        && pooled.cells.length === columns.length;
      const tableRow = reused ? pooled : createBodyRow(offsets);
      if (options.rowKey && row?.[options.rowKey] != null) tableRow.dataset.rowKey = String(row[options.rowKey]);
      else if (tableRow.dataset.rowKey != null) delete tableRow.dataset.rowKey;
      tableRow.dataset.current = String(row === currentRow);
      tableRow.dataset.rowIndex = String(rowIndex);
      const cells = tableRow.cells;
      for (let index = 0; index < columns.length; index += 1) {
        const column = columns[index];
        if (column.editable) {
          cells[index].classList.toggle('kniu_sys_table_editable', row?.[column.field + '_editable'] !== false);
        } else {
          cells[index].classList.remove('kniu_sys_table_editable');
        }
        renderCellContent(cells[index], column, row, rowIndex, reused);
      }
      return tableRow;
    }

    function columnSignature() {
      let signature = String(columns.length);
      for (let i = 0; i < columns.length; i += 1) {
        const column = columns[i];
        signature += `|${column.field ?? column.type ?? ''},${column.width ?? ''},${column.minWidth ?? ''},${column.fixed ?? ''},${column.editable ? 1 : 0},${column.align ?? ''}`;
      }
      return signature;
    }

    function buildEmptyRow() {
      const emptyRow = documentRef.createElement('tr');
      emptyRow.className = 'kniu_sys_table_empty';
      const emptyCell = documentRef.createElement('td');
      emptyCell.colSpan = columns.length;
      if (options.emptySlot) {
        const slot = documentRef.createElement('slot');
        slot.name = 'empty';
        emptyCell.append(slot);
      } else if (options.emptyText === '') {
        emptyCell.textContent = '';
        emptyRow.style.display = 'none';
      } else {
        emptyCell.textContent = options.emptyText || componentText(componentLang(options), 'table.empty');
      }
      emptyRow.append(emptyCell);
      return emptyRow;
    }

    function findEventElement(event, selector) {
      const pathMatch = event.composedPath?.().find(function (node) {
        return node?.matches?.(selector);
      });
      return pathMatch || event.target?.closest?.(selector) || null;
    }

    function resolveRowFromEvent(event, selector) {
      if (disposed) return null;
      if (selector && findEventElement(event, selector)) return null;
      const cell = findEventElement(event, 'td');
      if (!cell || !bodyElement || !bodyElement.contains(cell)) return null;
      const tableRow = cell.parentElement;
      if (!tableRow || tableRow.parentElement !== bodyElement) return null;
      const rowIndex = Number.parseInt(tableRow.dataset.rowIndex, 10);
      if (!Number.isFinite(rowIndex)) return null;
      const row = rows[rowIndex];
      if (row === undefined) return null;
      return { cell: cell, tableRow: tableRow, row: row, rowIndex: rowIndex, column: columns[cell.cellIndex] };
    }

    function handleBodyClick(event) {
      const hit = resolveRowFromEvent(event, null);
      if (!hit) return;
      const { cell, tableRow, row, rowIndex, column } = hit;
      const isControl = findEventElement(event, '.kniu_sys_table_action,.kniu_sys_table_editable,.kniu_sys_table_selection,kniu-switch');
      if (isControl) {
        if (column?.editable && cell.classList.contains('kniu_sys_table_editable')) {
          beginCellEdit(cell, column, row, rowIndex);
        }
        return;
      }
      const previous = currentRow;
      currentRow = row;
      options.host?.dispatchEvent(new CustomEvent('row-click', { detail: { row: row, index: rowIndex }, bubbles: true, composed: true }));
      if (previous !== row) options.host?.dispatchEvent(new CustomEvent('current-change', { detail: { currentRow: row, oldCurrentRow: previous }, bubbles: true, composed: true }));
      if (options.highlightCurrentRow) {
        bodyElement.querySelectorAll('tr[data-current="true"]').forEach(function (item) { item.dataset.current = 'false'; });
        tableRow.dataset.current = 'true';
      }
    }

    function handleBodyPointerDown(event) {
      const cell = event.target.closest?.('td.kniu_sys_table_editable');
      if (!cell || !bodyElement || !bodyElement.contains(cell)) return;
      const activeInput = table.querySelector('.kniu_sys_table_edit_input');
      if (!activeInput || cell.contains(activeInput)) return;
      const tableRow = cell.parentElement;
      const rowIndex = Number.parseInt(tableRow?.dataset?.rowIndex, 10);
      const column = columns[cell.cellIndex];
      if (!column || !Number.isFinite(rowIndex)) return;
      event.preventDefault();
      pendingEdit = { row: rows[rowIndex], column: column };
      activeInput.blur();
    }

    function invalidateColumnWidthCache() {
      measuredColumnWidths = null;
    }

    function measureColumnWidths() {
      if (measuredColumnWidths) return measuredColumnWidths;
      const head = table.querySelector('thead');
      const row = head?.rows?.[0] || table.querySelector('tbody tr:not(.kniu_sys_table_empty)');
      const measured = [];
      let anyMeasured = false;
      for (let index = 0; index < columns.length; index += 1) {
        const fixed = columns[index].fixed;
        if (fixed !== true && fixed !== 'left' && fixed !== 'right') continue;
        const cell = row?.cells?.[index];
        const width = cell ? cell.getBoundingClientRect().width : 0;
        if (width > 0) anyMeasured = true;
        measured[index] = width;
      }
      if (!anyMeasured) return null;
      measuredColumnWidths = measured;
      return measured;
    }

    function resyncFixedGeometry() {
      const offsets = lastFixedOffsets;
      const measured = measureColumnWidths();
      function widthOf(index) {
        return measured ? (measured[index] || 0) : columnWidth(columns[index]);
      }
      const nextLeft = new Map();
      let leftTotal = 0;
      for (let index = 0; index < columns.length; index += 1) {
        const column = columns[index];
        if (column.fixed === true || column.fixed === 'left') {
          nextLeft.set(index, leftTotal);
          leftTotal += widthOf(index);
        }
      }
      const nextRight = new Map();
      let rightTotal = 0;
      for (let index = columns.length - 1; index >= 0; index -= 1) {
        if (columns[index].fixed === 'right') {
          nextRight.set(index, rightTotal);
          rightTotal += widthOf(index);
        }
      }
      function applySide(nextMap, oldMap, prop) {
        nextMap.forEach(function (value, index) {
          if (oldMap.get(index) === value) return;
          oldMap.set(index, value);
          const px = `${value}px`;
          const headCell = headElement?.rows?.[0]?.cells?.[index];
          if (headCell) headCell.style.setProperty(prop, px);
          if (bodyElement) {
            for (let r = 0; r < bodyElement.rows.length; r += 1) {
              const cell = bodyElement.rows[r].cells[index];
              if (cell) cell.style.setProperty(prop, px);
            }
          }
        });
      }
      applySide(nextLeft, offsets.left, '--kniu-fixed-left');
      applySide(nextRight, offsets.right, '--kniu-fixed-right');
      fixedLeftWidth = leftTotal;
      fixedRightWidth = rightTotal;
      const leftPx = `${leftTotal}px`;
      const rightPx = `${rightTotal}px`;
      if (leftFixedShadow.style.width !== leftPx) leftFixedShadow.style.width = leftPx;
      if (rightFixedShadow.style.width !== rightPx) rightFixedShadow.style.width = rightPx;
    }

    function scheduleShadowVisibilityUpdate() {
      invalidateLayoutMetrics();
      if (shadowVisibilityFrame) return;
      const view = documentRef.defaultView;
      if (!view || typeof view.requestAnimationFrame !== 'function') {
        updateFixedShadowVisibility();
        return;
      }
      shadowVisibilityFrame = view.requestAnimationFrame(function () {
        shadowVisibilityFrame = 0;
        if (!disposed) updateFixedShadowVisibility();
      });
    }

    let layoutMetrics = null;

    function invalidateLayoutMetrics() {
      layoutMetrics = null;
    }

    function getLayoutMetrics() {
      if (layoutMetrics) return layoutMetrics;
      const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      layoutMetrics = {
        maxScrollLeft: maxScrollLeft,
        hasHorizontalOverflow: maxScrollLeft > 1,
        isMobile: !isDeskViewport(),
        verticalScrollbarWidth: Math.max(0, viewport.offsetWidth - viewport.clientWidth)
      };
      return layoutMetrics;
    }

    function updateFixedShadowVisibility() {
      const metrics = getLayoutMetrics();
      const scrollLeft = viewport.scrollLeft;
      const { maxScrollLeft, hasHorizontalOverflow, isMobile, verticalScrollbarWidth } = metrics;
      group.dataset.mobileOverflowLeft = String(isMobile && hasHorizontalOverflow && scrollLeft > 1);
      group.dataset.mobileOverflowRight = String(isMobile && hasHorizontalOverflow && scrollLeft < maxScrollLeft - 1);
      const shadowEnabled = !isMobile;
      leftFixedShadow.style.display =
        shadowEnabled && fixedLeftWidth > 0 && hasHorizontalOverflow && scrollLeft > 1
          ? 'block'
          : 'none';
      rightFixedShadow.style.display =
        shadowEnabled && fixedRightWidth > 0 && hasHorizontalOverflow && scrollLeft < maxScrollLeft - 1
          ? 'block'
          : 'none';
      rightFixedShadow.style.right = `${verticalScrollbarWidth}px`;
    }

    function beginCellEdit(cell, column, row, rowIndex) {
      if (!column.editable || row?.[column.field + '_editable'] === false || cell.querySelector('.kniu_sys_table_edit_input')) return;
      const oldValue = row?.[column.field];
      const input = documentRef.createElement('input');
      input.className = 'kniu_sys_table_edit_input';
      const editMode = column.editable === 'number' ? 'number' : 'text';
      input.type = editMode;
      if (editMode === 'number' && column.editMin != null) input.min = String(column.editMin);
      input.value = oldValue == null ? '' : String(oldValue);
      cell.replaceChildren(input);
      input.focus();
      input.select();
      let cancelled = false;
      let committed = false;
      input.addEventListener('keydown', function (event) {
        if (editMode === 'number' && column.editMin >= 0 && event.key === '-') {
          event.preventDefault();
          return;
        }
        if (event.key === 'Escape') {
          cancelled = true;
          input.blur();
        } else if (event.key === 'Enter') {
          input.blur();
        }
      });
      input.addEventListener('blur', async function () {
        if (committed) return;
        committed = true;
        if (cancelled) {
          render();
          return;
        }
        const numericValue = Number.isFinite(Number(input.value)) ? Number(input.value) : 0;
        const nextValue = editMode === 'number'
          ? Math.max(column.editMin ?? 0, numericValue)
          : input.value;
        if (String(nextValue) === String(oldValue)) {
          render();
          return;
        }
        input.disabled = true;
        row[column.field] = nextValue;
        const saved = typeof column.onChange !== 'function'
          || await column.onChange(rowIndex, rows, nextValue, oldValue) !== false;
        if (!saved) row[column.field] = oldValue;
        if (saved) {
          rows.sort(function (left, right) {
            if (column.editable === 'number') return Number(left?.[column.field] || 0) - Number(right?.[column.field] || 0);
            return String(left?.[column.field] ?? '').localeCompare(String(right?.[column.field] ?? ''), 'zh-CN');
          });
        }
        render();
      }, { once: true });
    }

    function applySort(field, order) {
      const column = columns.find(function (item) { return item.field === field; });
      sortState = { field: field || '', order: order || '' };
      if (column && order) {
        const direction = order === 'descending' ? -1 : 1;
        rows = [...initialRows].sort(function (left, right) {
          if (typeof column.sortMethod === 'function') return column.sortMethod(left, right) * direction;
          const a = left?.[field];
          const b = right?.[field];
          if (a == null && b == null) return 0;
          if (a == null) return -direction;
          if (b == null) return direction;
          return (typeof a === 'number' && typeof b === 'number'
            ? a - b
            : String(a).localeCompare(String(b), 'zh-CN', { numeric: true })) * direction;
        });
      } else {
        rows = initialRows;
      }
      options.host?.dispatchEvent(new CustomEvent('sort-change', {
        detail: { column: column || null, field: field || '', order: order || null },
        bubbles: true, composed: true
      }));
      render();
    }

    function render(renderOptions = {}) {
      if (disposed || rendering) return;
      columns.length = 0;
      columns.push(...readColumns());
      refreshColumnPlan();
      applyTableMinWidth();
      rendering = true;
      const syncSortHeader = renderOptions.syncSortHeader !== false;
      const syncSelectionHeader = renderOptions.syncSelectionHeader !== false;
      const isEmpty = rows.length === 0;
      group.dataset.empty = String(isEmpty);
      const offsets = fixedOffsets();

      if (!headElement && options.showHeader !== false) {
        headElement = documentRef.createElement('thead');
        const headRow = documentRef.createElement('tr');
        const headFragment = documentRef.createDocumentFragment();
        columns.forEach(function (column, index) {
          const cell = documentRef.createElement('th');
          cell.scope = 'col';
          cell.style.textAlign = column.headerAlign || column.align || 'left';
          function getSelectableRows(columnObj) {
            return rows.filter(function (row, rowIndex) { return typeof columnObj.selectable !== 'function' || columnObj.selectable(row, rowIndex); });
          }
          if (column.type === 'checkbox') {
            const checkbox = documentRef.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'kniu_sys_table_selection';
            checkbox.disabled = isEmpty;
            checkbox.checked = getSelectableRows(column).length > 0 && getSelectableRows(column).every(function (row) { return selectedRows.has(row); });
            checkbox.indeterminate = !checkbox.checked && getSelectableRows(column).some(function (row) { return selectedRows.has(row); });
            checkbox.addEventListener('change', function () {
              if (!rows.length) return;
              getSelectableRows(column).forEach(function (row) { checkbox.checked ? selectedRows.add(row) : selectedRows.delete(row); });
              options.host?.dispatchEvent(new CustomEvent('selection-change', { detail: [...selectedRows], bubbles: true, composed: true }));
              render();
            });
            cell.append(checkbox);
          } else {
            cell.append(documentRef.createTextNode(column.label == null ? '' : String(column.label)));
          }
          if (column.sortable && column.field) {
            const sorter = documentRef.createElement('span');
            sorter.className = 'kniu_sys_table_sort';
            sorter.dataset.field = column.field;
            sorter.dataset.order = sortState.field === column.field ? sortState.order : '';
            sorter.innerHTML = '<span class="kniu_sys_table_sort_up">' + buildIconElement('triangle_up_fill') + '</span><span class="kniu_sys_table_sort_down">' + buildIconElement('triangle_down_fill') + '</span>';
            cell.append(sorter);
            cell.style.cursor = 'pointer';
            cell.addEventListener('click', function () {
              if (!rows.length) return;
              const nextOrder = sortState.field !== column.field || !sortState.order
                ? 'ascending'
                : (sortState.order === 'ascending' ? 'descending' : '');
              applySort(column.field, nextOrder);
            });
          }
          applyColumnLayout(cell, column, index, offsets);
          headFragment.appendChild(cell);
        });
        headRow.appendChild(headFragment);
        headElement.append(headRow);
      } else if (headElement && options.showHeader !== false) {
        if (syncSortHeader) headElement.querySelectorAll('.kniu_sys_table_sort').forEach(function (sorter) {
          const order = sortState.field === sorter.dataset.field ? sortState.order : '';
          if (sorter.dataset.order !== order) sorter.dataset.order = order;
        });
        const headerInputs = syncSelectionHeader
          ? headElement.querySelectorAll('input[type="checkbox"].kniu_sys_table_selection')
          : [];
        headerInputs.forEach(function (input) {
          const idx = [...input.closest('tr').cells].indexOf(input.closest('th'));
          const column = columns[idx];
          if (!column) return;
          const selectableRows = rows.filter(function (row, rowIndex) { return typeof column.selectable !== 'function' || column.selectable(row, rowIndex); });
          input.disabled = isEmpty;
          input.checked = selectableRows.length > 0 && selectableRows.every(function (row) { return selectedRows.has(row); });
          input.indeterminate = !input.checked && selectableRows.some(function (row) { return selectedRows.has(row); });
        });
      }
      if (headElement && headElement.getAttribute('aria-disabled') !== String(isEmpty)) {
        headElement.setAttribute('aria-disabled', String(isEmpty));
      }

      const signature = columnSignature();
      if (rowPoolColumnSignature !== signature) {
        rowPool = [];
        rowPoolColumnSignature = signature;
      }

      const rowNodes = [];
      if (!rows.length) {
        rowNodes.push(buildEmptyRow());
      } else {
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          rowNodes.push(buildBodyRow(rows[rowIndex], rowIndex, offsets));
        }
      }
      rowPool = rowNodes;
      if (!bodyElement) {
        bodyElement = documentRef.createElement('tbody');
        bodyElement.addEventListener('click', handleBodyClick);
        bodyElement.addEventListener('pointerdown', handleBodyPointerDown);
        if (options.showHeader !== false && headElement && !table.contains(headElement)) {
          table.append(headElement);
        }
        table.append(bodyElement);
      }
      replaceChildrenWithFragment(bodyElement, rowNodes);

      lastFixedOffsets = offsets;
      resyncFixedGeometry();

      scheduleShadowVisibilityUpdate();
      rendering = false;
      if (pendingEdit) {
        const target = pendingEdit;
        pendingEdit = null;
        const targetRowIndex = rows.indexOf(target.row);
        const targetColumnIndex = columns.indexOf(target.column);
        const targetCell = table.tBodies[0]?.rows[targetRowIndex]?.cells[targetColumnIndex];
        if (targetCell) beginCellEdit(targetCell, target.column, target.row, targetRowIndex);
      }
    }

    function handleAction(event) {
      const button = findEventElement(event, 'kniu-btn.kniu_sys_table_action');
      if (!button || !table.contains(button)) return;
      const rowIndex = Number.parseInt(button.dataset.rowIndex, 10);
      const column = columns[Number.parseInt(button.dataset.columnIndex, 10)];
      const action = column?.actions?.[Number.parseInt(button.dataset.actionIndex, 10)];
      if (!action || typeof action.onClick !== 'function') return;
      action.onClick({ row: rows[rowIndex], index: rowIndex, rows: rows, table: api, event: event });
    }

    function setData(data) {
      rows = Array.isArray(data) ? data : [];
      initialRows = rows;
      [...selectedRows].forEach(function (row) { if (!rows.includes(row)) selectedRows.delete(row); });
      if (currentRow && !rows.includes(currentRow)) currentRow = null;
      render({ syncSortHeader: false, syncSelectionHeader: true });
      return rows;
    }

    function clearSelection() {
      selectedRows.clear();
      options.host?.dispatchEvent(new CustomEvent('selection-change', { detail: [], bubbles: true, composed: true }));
      render();
    }

    function toggleRowSelection(row, selected) {
      if (!rows.includes(row)) return;
      const shouldSelect = selected == null ? !selectedRows.has(row) : !!selected;
      if (shouldSelect) selectedRows.add(row);
      else selectedRows.delete(row);
      options.host?.dispatchEvent(new CustomEvent('selection-change', { detail: [...selectedRows], bubbles: true, composed: true }));
      render();
    }

    function setCurrentRow(row) {
      const previous = currentRow;
      currentRow = rows.includes(row) ? row : null;
      options.host?.dispatchEvent(new CustomEvent('current-change', { detail: { currentRow: currentRow, oldCurrentRow: previous }, bubbles: true, composed: true }));
      render();
    }

    function removeRow(index) {
      if (index < 0 || index >= rows.length) return null;
      const removed = rows.splice(index, 1)[0];
      render();
      return removed;
    }

    function handleContainerResize() {
      invalidateColumnWidthCache();
      invalidateLayoutMetrics();
      const wasMobile = columnPlan ? columnPlan.isMobile : null;
      refreshColumnPlan();
      applyTableMinWidth();
      if (wasMobile !== null && wasMobile !== columnPlan.isMobile) {
        render();
        return;
      }
      resyncFixedGeometry();
      updateFixedShadowVisibility();
    }
    function handleWindowResize() { handleContainerResize(); }

    function destroy() {
      if (disposed) return;
      disposed = true;
      if (shadowVisibilityFrame) {
        documentRef.defaultView?.cancelAnimationFrame?.(shadowVisibilityFrame);
        shadowVisibilityFrame = 0;
      }
      table.removeEventListener('click', handleAction);
      bodyElement?.removeEventListener('click', handleBodyClick);
      bodyElement?.removeEventListener('pointerdown', handleBodyPointerDown);
      viewport.removeEventListener('scroll', updateFixedShadowVisibility);
      documentRef.defaultView?.removeEventListener('resize', handleWindowResize);
      if (viewportResizeObserver) {
        viewportResizeObserver.disconnect();
        viewportResizeObserver = null;
      }
      rowPool = [];
      rowPoolColumnSignature = '';
      target.replaceChildren();
    }

    function setLoading(active, text) {
      loadingMask.setAttribute('data-active', String(!!active));
      if (text != null) loadingTextEl.textContent = String(text);
    }
    function setMaxHeight(value) {
      const next = Number.parseInt(value, 10) || 0;
      viewport.style.maxHeight = next > 0 ? `${Math.max(40, next)}px` : '';
      viewport.style.overflowY = next > 0 ? 'auto' : '';
      updateFixedShadowVisibility();
    }
    if (options.loadingText != null) loadingTextEl.textContent = String(options.loadingText);

    const api = {
      setData: setData,
      getData: function () { return rows; },
      removeRow: removeRow,
      clearSelection: clearSelection,
      toggleRowSelection: toggleRowSelection,
      getSelectionRows: function () { return [...selectedRows]; },
      setCurrentRow: setCurrentRow,
      sort: applySort,
      clearSort: function () { applySort('', ''); },
      doLayout: function () { invalidateColumnWidthCache(); render(); },
      render: render,
      setLoading: setLoading,
      setMaxHeight: setMaxHeight,
      destroy: destroy
    };
    table.addEventListener('click', handleAction);
    viewport.addEventListener('scroll', updateFixedShadowVisibility, { passive: true });
    documentRef.defaultView?.addEventListener('resize', handleWindowResize, { passive: true });
    if (typeof ResizeObserver === 'function') {
      viewportResizeObserver = new ResizeObserver(function () { handleContainerResize(); });
      viewportResizeObserver.observe(viewport);
    }
    render();
    return api;
  }

  function confirm(message, title = '提示', options = {}) {
    if (typeof document === 'undefined') return Promise.resolve(false);
    registerModal(KNIU_COMPONENT_CONTEXT);
    const modal = document.createElement('kniu-modal');
    modal.confirm = true;
    modal.title = title;
    modal.message = message;
    document.body.append(modal);
    // 先完成自定义元素连接，再注入完整 options，确保确认/取消按钮监听已建立。
    modal.options = { ...(options || {}) };
    modal.show = true;
    return new Promise((resolve, reject) => {
      const onConfirm = () => { cleanup(); resolve('confirm'); };
      const onCancel = () => { cleanup(); reject('cancel'); };
      function cleanup() {
        modal.removeEventListener('confirm', onConfirm);
        modal.removeEventListener('cancel', onCancel);
        setTimeout(() => { if (modal.parentNode) modal.remove(); }, 320);
      }
      modal.addEventListener('confirm', onConfirm);
      modal.addEventListener('cancel', onCancel);
    });
  }

  function buildPageList(current, total) {
    const arr = [];
    if (total <= 5) {
      for (let i = 1; i <= total; i++) arr.push(i);
      return arr;
    }
    const start = Math.max(1, Math.min(current - 2, total - 4));
    const end = Math.min(total, start + 4);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }

  function usePagination(options) {
    const { state, self, url, field = 'id', sort = 'asc', params = null, transform = null, tableKey = null, pageKey = null, table = null, page = null, stateStore = null, storeRecordKey = '', onLoaded = null } = options;
    if (!state || !self || !url) {
      throw new Error('usePagination 需要 state、self、url 三个参数');
    }
    if (tableKey && (!state[tableKey] || typeof state[tableKey] !== 'object')) {
      state[tableKey] = Object.assign({ data: [], rowKey: 'id', loading: true }, table && typeof table === 'object' ? table : {});
    }
    if (pageKey && (!state[pageKey] || typeof state[pageKey] !== 'object')) {
      state[pageKey] = Object.assign({ currentPage: 1, pageSize: 20, total: 0 }, page && typeof page === 'object' ? page : {});
    }
    const pageOptions = pageKey && state[pageKey] && typeof state[pageKey] === 'object' ? state[pageKey] : {};
    const configuredPageSize = Number(pageOptions.pageSize);
    state.pageRows = Math.max(1, Number.isFinite(configuredPageSize) ? configuredPageSize : 10);
    state.currentPage = Math.max(1, Number(pageOptions.currentPage) || 1);
    state.pageTotal = Math.max(1, Number(state.pageTotal) || 1);
    state.total = Math.max(0, Number(pageOptions.total ?? state.total) || 0);

    function resolveExtraParams() {
      const extra = typeof params === 'function' ? params() : params;
      return extra && typeof extra === 'object' ? extra : {};
    }

    function syncOptions() {
      if (tableKey && state[tableKey] && typeof state[tableKey] === 'object') {
        const prev = state[tableKey];
        state[tableKey] = { ...prev, data: state.list, loading: state.loading };
      }
      if (pageKey && state[pageKey] && typeof state[pageKey] === 'object') {
        const prev = state[pageKey];
        state[pageKey] = { ...prev, total: state.total, currentPage: state.currentPage, pageSize: state.pageRows };
      }
    }

    let activeLoadKey = '';
    let activeLoadPromise = null;

    function serializeLoadParams(value) {
      if (value === null || typeof value !== 'object') return JSON.stringify(value);
      if (Array.isArray(value)) return '[' + value.map(serializeLoadParams).join(',') + ']';
      return '{' + Object.keys(value).sort().map(function (key) {
        return JSON.stringify(key) + ':' + serializeLoadParams(value[key]);
      }).join(',') + '}';
    }

    async function loadList(page, options) {
      const targetPage = Math.min(Math.max(Number(page) || 1, 1), state.pageTotal || 1);
      const requestData = {
        page_current: targetPage,
        page_rows: state.pageRows,
        field,
        sort,
        ...resolveExtraParams()
      };
      const loadKey = `${url}:${serializeLoadParams(requestData)}`;
      if (activeLoadPromise && activeLoadKey === loadKey) return activeLoadPromise;
      // silent：局部保存后的静默重拉（如改 sid 后按排序刷新）——不置 loading，
      // 避免表格遮罩(spinner+文字)整表闪烁；数据仍照常同步，行 DOM 走复用无重建。
      const silent = !!(options && options.silent);

      const run = (async function () {
        if (!silent) {
          state.loading = true;
          syncOptions();
        }
        await REQUEST({
          url,
          type: 'POST',
          mutation: false,
          data: requestData,
          async success(res) {
            if (res.status !== 1) {
              state.error = res.msg || '加载失败';
              if (!silent) state.loading = false;
              syncOptions();
              self.$msg({ content: state.error, type: 'error' });
              return;
            }
            const payload = res.data || {};
            const records = getResponseRecords(payload);
            state.list = typeof transform === 'function' ? transform(records) : records;
            state.currentPage = payload.page_current || 1;
            state.pageTotal = payload.page_total || 1;
            state.total = payload.total || 0;
            if (!silent) state.loading = false;
            syncOptions();
            if (onLoaded) onLoaded();
            if (stateStore && storeRecordKey && typeof stateStore.track === 'function') {
              await stateStore.track(storeRecordKey, {
                records: state.list,
                total: state.total,
                currentPage: state.currentPage,
                pageRows: state.pageRows
              }, 'records-changed');
            }
          },
          fail(res) {
            if (!silent) state.loading = false;
            syncOptions();
            state.error = res.msg || '加载失败';
            self.$msg({ content: state.error, type: 'error' });
          }
        });
      }());
      activeLoadKey = loadKey;
      activeLoadPromise = run;
      try {
        return await run;
      } finally {
        if (activeLoadPromise === run) {
          activeLoadPromise = null;
          activeLoadKey = '';
        }
      }
    }

    function changePage(event) {
      const page = event?.detail?.page ?? (event && event.currentTarget ? Number(event.currentTarget.dataset.page) : 0);
      if (!Number.isFinite(page) || page < 1 || page > state.pageTotal) return;
      loadList(page);
    }

    function changePageSize(event) {
      const raw = event?.detail?.size ?? Number(event && event.target ? event.target.value : state.pageRows);
      const size = Math.max(1, Math.min(200, Math.floor(raw) || 10));
      if (size === state.pageRows) return;
      state.pageRows = size;
      state.currentPage = 1;
      loadList(1);
    }

    if (pageKey && state[pageKey] && typeof state[pageKey] === 'object') {
      state[pageKey] = {
        ...state[pageKey],
        onCurrentChange: function (detail) { changePage({ detail: detail }); },
        onSizeChange: function (detail) { changePageSize({ detail: detail }); }
      };
    }

    return { loadList, changePage, changePageSize, syncOptions };
  }

  function makeSwitchOptions(enabled = true) {
    return {
      name: 'is_show',
      activeValue: 1,
      inactiveValue: 0,
      activeColor: '#13ce66',
      inactiveColor: '#ff4949',
      disabled: !enabled
    };
  }

  function createSearchActions(loadList, wait = 250) {
    const searchList = function () { loadList(1); };
    return { searchList: searchList, debouncedSearch: debounce(searchList, wait) };
  }

  function createRowDeleteHandler(config) {
    const { self, state, loadList, url, confirmMessage, gate = null, getSuccessMessage = null, onSuccess = null,
      reloadOnSuccess = true, idOf = null, buildData = null, reload = null,
      confirmTitle = '提示', confirmText = '确定' } = config || {};
    return async function deleteRow(index, list) {
      const row = list[index];
      if (!row) return false;
      if (typeof gate === 'function' && !gate()) return false;
      const confirmed = await self.$confirm(
        typeof confirmMessage === 'function' ? confirmMessage(row) : confirmMessage,
        confirmTitle,
        {
          confirmText: confirmText,
          cancelText: '取消',
          type: 'warning'
        }
      ).then(function () { return true; }).catch(function () { return false; });
      if (!confirmed) return false;
      await REQUEST({
        url: url,
        type: 'POST',
        // 复杂主键（db 系按 database/table/profile 定位）经 buildData 自定义载荷；
        // 常规主键经 idOf 提取，默认 row.id（A-M4）。
        data: buildData ? buildData(row) : { id: idOf ? idOf(row) : row.id },
        success(res) {
          if (res.status !== 1) {
            self.$msg({ content: res.msg, type: 'error' });
            return;
          }
          self.$msg({ content: typeof getSuccessMessage === 'function' ? getSuccessMessage(res) : '删除成功!', type: 'success' });
          if (typeof onSuccess === 'function') onSuccess(row, res);
          if (reloadOnSuccess) {
            if (typeof reload === 'function') reload();
            else loadList(state.currentPage);
          }
        },
        fail(res) { self.$msg({ content: res.msg, type: 'error' }); }
      });
      return false;
    };
  }

  function usePage(config) {
    const options = config || {};
    const pager = usePagination(options);
    const search = createSearchActions(pager.loadList, options.searchWait);
    const deleteRow = options.deleteUrl
      ? createRowDeleteHandler({
        self: options.self,
        state: options.state,
        loadList: pager.loadList,
        url: options.deleteUrl,
        confirmMessage: options.deleteMessage || '此操作将永久删除该条数据, 是否继续?',
        gate: options.deleteGate || null,
        onSuccess: options.onDeleteSuccess || null,
        reloadOnSuccess: options.reloadOnDeleteSuccess !== false
      })
      : null;
    return Object.assign({}, pager, search, { deleteRow: deleteRow });
  }

  function deferAffixTemplateMount(template, mount, done) {
    const finish = function () {
      mount();
      if (typeof done === 'function') done();
    };
    if (!template.hasAttribute(':option') && !template.hasAttribute('kniu:option')) { finish(); return; }
    if (template.__kniuAffixPending) return;
    template.__kniuAffixPending = true;
    template.__kniuAffixDeadline = Date.now() + 50;
    const retry = function () {
      template.__kniuAffixPending = false;
      if (!template.isConnected) return;
      const optionsReady = !!template.__kniuOptionsValue;
      const attrConsumed = !template.hasAttribute(':option') && !template.hasAttribute('kniu:option');
      if (!optionsReady && !attrConsumed && Date.now() <= template.__kniuAffixDeadline) {
        template.__kniuAffixPending = true;
        queueMicrotask(retry);
        return;
      }
      finish();
    };
    queueMicrotask(retry);
  }

  function mountAffixSlots(comp, groupSelector, affixPrefix) {
    const syncAffixStyles = function () {
      const group = comp.shadowRoot.querySelector(groupSelector);
      if (!group) return;
      let hasAny = false;
      ['prepend', 'append'].forEach((name) => {
        const content = comp.querySelector('[slot="' + name + '"]');
        const affix = comp.shadowRoot.querySelector('.' + affixPrefix + '_' + name);
        const labelWidth = content ? (content.dataset.labelWidth || '') : '';
        group.dataset['has' + name[0].toUpperCase() + name.slice(1)] = String(Boolean(content));
        if (content) hasAny = true;
        if (labelWidth && CSS.supports('width', labelWidth)) {
          const sized = 'calc(' + labelWidth + ' + 1px)';
          affix.style.width = sized;
          affix.style.flexBasis = sized;
        } else {
          affix.style.removeProperty('width');
          affix.style.removeProperty('flex-basis');
        }
      });
      group.dataset.affix = String(hasAny);
    };
    ['prepend', 'append'].forEach((name) => {
      const template = Array.from(comp.children).find((child) => child.tagName === 'TEMPLATE' && child.hasAttribute('#' + name));
      if (!template) return;
      deferAffixTemplateMount(template, function () {
        const content = document.createElement('span');
        content.slot = name;
        const labelWidth = template.getAttribute('label-width')
          || (template.__kniuOptionsValue && template.__kniuOptionsValue.labelWidth)
          || '';
        if (labelWidth) content.dataset.labelWidth = labelWidth;
        if (template.__kniuOptionsValue) content.__kniuOptionsValue = template.__kniuOptionsValue;
        content.append(template.content.cloneNode(true));
        template.replaceWith(content);
      }, syncAffixStyles);
    });
    syncAffixStyles();
  }

  const KNIU_ICON_FONT_NAMES = new Set(KNIU_ICON_NAMES);

  function resolveIconName(name) {
    const exact = String(name || '').trim();
    return KNIU_ICON_FONT_NAMES.has(exact) ? exact : '';
  }

  function buildIconElement(name) {
    return '<kniu-icon icon="' + resolveIconName(name) + '" aria-hidden="true"></kniu-icon>';
  }

  function mountOptionsValue(comp) {
    const consume = function () {
      if (comp.__kniuOptionsValueConsumed) return true;
      const value = comp.__kniuOptionsValue;
      if (!value || typeof value !== 'object') return false;
      comp.__kniuOptionsValueConsumed = true;
      comp.options = value;
      return true;
    };
    if (consume()) return;
    const deadline = Date.now() + 50;
    const retry = function () {
      if (consume()) return;
      if (!comp.isConnected || Date.now() > deadline) return;
      queueMicrotask(retry);
    };
    queueMicrotask(retry);
  }

  function installOptionsOnlyProtocol(tagName) {
    const Component = customElements.get(tagName);
    if (!Component || Component.prototype.__kniuOptionsOnly) return;
    const prototype = Component.prototype;
    const ownDescriptor = Object.getOwnPropertyDescriptor(prototype, 'options');
    const originalConnected = prototype.connectedCallback;
    const originalAttributeChanged = prototype.attributeChangedCallback;
    const allowedAttribute = function (name, element) {
      if (['id', 'class', 'style', 'slot', 'ref', 'role', 'tabindex', 'block', 'append-border', 'append-borderless'].includes(name)) return true;
      if (name.startsWith('aria-') || name.startsWith('data-') || name.startsWith('kniu:') || name.startsWith('kniu@') || name.startsWith('#')) return true;
      const observed = element && element.constructor && element.constructor.observedAttributes;
      return !!(observed && observed.includes(name));
    };
    const clearCallbacks = function (element) {
      (element.__kniuOptionListeners || []).forEach(function ([name, handler]) { element.removeEventListener(name, handler); });
      element.__kniuOptionListeners = [];
    };
    const bindCallbacks = function (element, options) {
      clearCallbacks(element);
      Object.entries(options || {}).forEach(function ([key, callback]) {
        if (!/^on[A-Z]/.test(key) || typeof callback !== 'function') return;
        const eventName = key.slice(2).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        const handler = function (event) { return callback(event.detail, event, element); };
        element.addEventListener(eventName, handler);
        element.__kniuOptionListeners.push([eventName, handler]);
      });
    };
    const hasWritableProperty = function (element, key) {
      let target = element;
      while (target) {
        const descriptor = Object.getOwnPropertyDescriptor(target, key);
        if (descriptor) return typeof descriptor.set === 'function' || descriptor.writable === true;
        target = Object.getPrototypeOf(target);
      }
      return false;
    };
    const reflectOptions = function (element, options) {
      (element.__kniuOptionAttributes || []).forEach(function (name) { element.removeAttribute(name); });
      element.__kniuOptionAttributes = [];
      Object.entries(options || {}).forEach(function ([key, value]) {
        if (/^on[A-Z]/.test(key) || value == null || typeof value === 'function') return;
        if (key !== 'options' && hasWritableProperty(element, key)) {
          const propertyAttribute = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
          element.__kniuOptionAttributes.push(propertyAttribute);
          element[key] = value;
          return;
        }
        if (typeof value === 'object') return;
        const name = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        element.__kniuOptionAttributes.push(name);
        if (value === false || value === '') element.removeAttribute(name);
        else element.setAttribute(name, value === true ? '' : String(value));
      });
    };
    Object.defineProperty(prototype, 'options', {
      configurable: true,
      get() { return ownDescriptor?.get ? ownDescriptor.get.call(this) : (this.__kniuOptions || {}); },
      set(value) {
        const defaults = componentDefaults[String(tagName || '').toLowerCase()] || {};
        const options = { ...defaults, ...(value && typeof value === 'object' ? value : {}) };
        this.__kniuOptions = options;
        bindCallbacks(this, options);
        if (ownDescriptor?.set) {
          if (typeof options.style === 'string' && options.style) this.style.cssText = options.style;
          ownDescriptor.set.call(this, options);
        } else {
          reflectOptions(this, options);
        }
        this._sync?.();
        this._render?.();
      }
    });
    prototype.connectedCallback = function () {
      [...this.attributes].forEach((attribute) => {
        if (!allowedAttribute(attribute.name, this) && !(this.__kniuOptionAttributes || []).includes(attribute.name)) this.removeAttribute(attribute.name);
      });
      if (typeof originalConnected === 'function') originalConnected.call(this);
    };
    if (typeof originalAttributeChanged === 'function') {
      prototype.attributeChangedCallback = function (name, oldValue, newValue) {
        const internal = (this.__kniuOptionAttributes || []).includes(name);
        if (!allowedAttribute(name, this) && !internal) {
          if (this.isConnected && this.hasAttribute(name)) queueMicrotask(() => this.removeAttribute(name));
          return;
        }
        return originalAttributeChanged.call(this, name, oldValue, newValue);
      };
    }
    prototype.__kniuOptionsOnly = true;
  }

  const KNIU_COMPONENT_CONTEXT = {
    BOOLEAN_ATTRIBUTES,
    IDENTITY,
    anchorScrollRoots,
    KNIU_BACKTOP_CSS,
    KNIU_BADGE_CSS,
    KNIU_BASE_CONTAIN_CSS,
    KNIU_BASE_FONT_CSS,
    KNIU_BASE_RESET_CSS,
    KNIU_BTN_CSS,
    KNIU_BTN_GROUP_CSS,
    KNIU_BTN_METRICS_CSS,
    KNIU_BTN_OVERRIDES_CSS,
    KNIU_COMMENT_CSS,
    KNIU_CONTAIN_EXCLUDE_TAGS,
    KNIU_CONTENT_TABLE_CSS,
    KNIU_CONTENT_TABLE_DOC_CSS,
    KNIU_DATE_PICKER_CSS,
    KNIU_DATE_PICKER_OVERRIDES_CSS,
    KNIU_DROPDOWN_CSS,
    KNIU_DROPDOWN_OPTION_CSS,
    KNIU_EDITOR_CSS,
    KNIU_EDITOR_OVERRIDE_CSS,
    KNIU_EDITOR_PRINT_CSS,
    KNIU_EMPTY_CSS,
    KNIU_FONT_FACE_CSS,
    KNIU_FONT_FAMILY,
    KNIU_FONT_MONO_FAMILY,
    KNIU_FONT_SERIF_FAMILY,
    KNIU_I18N,
    KNIU_ICON_CSS,
    KNIU_ICON_FONT_NAMES,
    KNIU_ICON_NAMES,
    KNIU_ICON_SVG,
    KNIU_IMAGE_CSS,
    KNIU_IMAGE_OVERRIDES_CSS,
    KNIU_INPUT_AFFIX_CSS,
    KNIU_INPUT_CSS,
    KNIU_INPUT_GROUP_CSS,
    KNIU_INPUT_METRICS_CSS,
    KNIU_INPUT_PASSWORD_ACTIONS_CSS,
    KNIU_INPUT_PASSWORD_CSS,
    KNIU_INPUT_STATES_CSS,
    KNIU_INPUT_TEXTAREA_CSS,
    KNIU_INPUT_TIP_CSS,
    KNIU_LIKE_CSS,
    KNIU_LOADING_CSS,
    KNIU_MARKDOWN_CSS,
    KNIU_MODAL_CONFIRM_CSS,
    KNIU_MODAL_CSS,
    KNIU_MSG_CSS,
    KNIU_NAVBAR_CELLS_CSS,
    KNIU_NAVBAR_CELL_CSS,
    KNIU_NAVBAR_CSS,
    KNIU_NAVBAR_PLACEHOLDER_CSS,
    KNIU_PAGE_CSS,
    KNIU_RADIO_GROUP_CSS,
    KNIU_RICHTEXT_CSS,
    KNIU_SELECT_CSS,
    KNIU_STATUS_CSS,
    KNIU_SUB_NAVBAR_CSS,
    KNIU_SUB_NAVBAR_OVERRIDES_CSS,
    KNIU_SWITCH_CSS,
    KNIU_TABLE_CLASS,
    KNIU_TABLE_COL_CSS,
    KNIU_TABLE_CSS,
    KNIU_TABLE_WRAP_CLASS,
    KNIU_TAB_CSS,
    KNIU_TAG_CSS,
    KNIU_UPLOAD_CSS,
    KNIU_USER_LOGIN_CSS,
    KNIU_USER_LOGIN_OVERRIDES_CSS,
    PRUNABLE_ATTRIBUTE_NAMES,
    REQUEST,
    RICH_TEXT_LITERAL_TAG_RE,
    SCROLL_LOCK_FLAG,
    SEMANTIC_EMPTY_ATTRIBUTES,
    SHADOW_TEMPLATE_CACHE_LIMIT,
    TABLE_TEMPLATE_CACHE_LIMIT,
    TABLE_TEMPLATE_RE,
    TEMPLATE,
    adoptDropdownStyle,
    adoptSharedStyle,
    adoptedSheetsFlushScheduled,
    appendRawStyle,
    applyScrollLock,
    attachComponentShadow,
    buildIconElement,
    buildPageList,
    compileTableRowTemplate,
    componentDefaults,
    componentLang,
    componentText,
    computePopoverLayout,
    confirm,
    createRowDeleteHandler,
    createSearchActions,
    createTable,
    debounce,
    deferAffixTemplateMount,
    flushPendingAdoptedSheets,
    getResponseRecords,
    getShadowInnerHTMLDescriptor,
    getSharedStyleSheet,
    hasRichTextLiteralTag,
    installMarkdownStyles,
    installOptionsOnlyProtocol,
    installRichTextStyles,
    isEmptyAttributeValue,
    lockDocumentScroll,
    makeSwitchOptions,
    mountAffixSlots,
    mountOptionsValue,
    mountPopoverPortal,
    msg,
    normalizeComponentCss,
    normalizedCssCache,
    pendingAdoptedSheets,
    pruneEmptyAttribute,
    pruneEmptyAttributeTree,
    pruneEmptyAttributes,
    pruneEmptyRootAttributes,
    readScrollLockOriginals,
    reconcileDocumentScrollLock,
    releaseScrollLock,
    replaceChildrenWithFragment,
    resolveIconName,
    resolveTableRowTemplate,
    sanitizeRichHtml,
    sanitizeRichHtmlAsync,
    scheduleAdoptedSheetsFlush,
    scrollLockNodes,
    scrollLockOriginals,
    scrollLockOwners,
    setLoading,
    shadowInnerHTMLDescriptor,
    shadowStyleSheetCache,
    shadowTemplateCache,
    shouldContainHost,
    state,
    supportsAdoptedStyleSheets,
    tableTemplateCache,
    toastInstance,
    toastTimer,
    trackPopoverPosition,
    unlockDocumentScroll,
    unwrapTablesIn,
    use,
    usePage,
    usePagination,
    wrapTablesIn,
    writeScrollLockOriginals
  };
  registerButton(KNIU_COMPONENT_CONTEXT);
  registerButtonGroup(KNIU_COMPONENT_CONTEXT);
  registerSwitch(KNIU_COMPONENT_CONTEXT);
  registerModal(KNIU_COMPONENT_CONTEXT);
  registerTable(KNIU_COMPONENT_CONTEXT);
  registerLoading(KNIU_COMPONENT_CONTEXT);
  registerMsg(KNIU_COMPONENT_CONTEXT);
  registerSelect(KNIU_COMPONENT_CONTEXT);
  registerRadioGroup(KNIU_COMPONENT_CONTEXT);
  registerPage(KNIU_COMPONENT_CONTEXT);
  registerPageMore(KNIU_COMPONENT_CONTEXT);
  registerImage(KNIU_COMPONENT_CONTEXT);
  registerInput(KNIU_COMPONENT_CONTEXT);
  registerDatePicker(KNIU_COMPONENT_CONTEXT);
  registerForm(KNIU_COMPONENT_CONTEXT);
  registerUpload(KNIU_COMPONENT_CONTEXT);
  registerIcon(KNIU_COMPONENT_CONTEXT);
  registerBadge(KNIU_COMPONENT_CONTEXT);
  registerTag(KNIU_COMPONENT_CONTEXT);
  registerStatus(KNIU_COMPONENT_CONTEXT);
  registerTab(KNIU_COMPONENT_CONTEXT);
  registerEmpty(KNIU_COMPONENT_CONTEXT);
  registerEditor(KNIU_COMPONENT_CONTEXT);
  registerNavbar(KNIU_COMPONENT_CONTEXT);
  registerBacktop(KNIU_COMPONENT_CONTEXT);
  registerComment(KNIU_COMPONENT_CONTEXT);
  registerLike(KNIU_COMPONENT_CONTEXT);
  registerUserLogin(KNIU_COMPONENT_CONTEXT);
  registerArticleTabComponent(KNIU_COMPONENT_CONTEXT);

  function installMarkdownStyles(root) {
    var documentTarget = typeof document !== 'undefined' ? document.head : null;
    var target = root && typeof root.appendChild === 'function' ? root : documentTarget;
    if (!target || typeof document === 'undefined') return;
    var style = target.querySelector ? target.querySelector('#kniu-markdown-styles') : null;
    if (!style) {
      style = document.createElement('style');
      style.id = 'kniu-markdown-styles';
      target.appendChild(style);
    }
    var css = KNIU_MARKDOWN_CSS + KNIU_CONTENT_TABLE_DOC_CSS;
    if (style.textContent !== css) style.textContent = css;
    if (target !== documentTarget && documentTarget) {
      var documentStyle = documentTarget.querySelector('#kniu-markdown-styles');
      if (!documentStyle) {
        documentStyle = document.createElement('style');
        documentStyle.id = 'kniu-markdown-styles';
        documentTarget.appendChild(documentStyle);
      }
      if (documentStyle.textContent !== css) documentStyle.textContent = css;
    }
  }
  function installRichTextStyles(root) {
    var documentTarget = typeof document !== 'undefined' ? document.head : null;
    var target = root && typeof root.appendChild === 'function' ? root : documentTarget;
    if (!target || typeof document === 'undefined') return;
    var style = target.querySelector ? target.querySelector('#kniu-rich-text-styles') : null;
    if (!style) {
      style = document.createElement('style');
      style.id = 'kniu-rich-text-styles';
      target.appendChild(style);
    }
    var css = KNIU_RICHTEXT_CSS + KNIU_CONTENT_TABLE_DOC_CSS;
    if (style.textContent !== css) style.textContent = css;
    if (target !== documentTarget && documentTarget) {
      var documentStyle = documentTarget.querySelector('#kniu-rich-text-styles');
      if (!documentStyle) {
        documentStyle = document.createElement('style');
        documentStyle.id = 'kniu-rich-text-styles';
        documentTarget.appendChild(documentStyle);
      }
      if (documentStyle.textContent !== css) documentStyle.textContent = css;
    }
  }
  [
    'kniu-btn', 'kniu-btn-group', 'kniu-switch', 'kniu-modal', 'kniu-table', 'kniu-table-col', 'kniu-loading', 'kniu-msg',
    'kniu-option', 'kniu-select', 'kniu-radio', 'kniu-radio-group', 'kniu-page', 'kniu-image', 'kniu-input',
    'kniu-input-group', 'kniu-form-cell', 'kniu-date-picker', 'kniu-form', 'kniu-upload', 'kniu-icon',
    'kniu-badge', 'kniu-tag', 'kniu-status', 'kniu-tab', 'kniu-empty', 'kniu-editor', 'kniu-navbar-cells', 'kniu-navbar-cell',
    // 注：kniu-tab-head/body/panel 暂不登记——它们无 observedAttributes 覆盖 label/name，
    // 登记后 connectedCallback 的 allowedAttribute 会把这些属性静默移除（标签标题丢失）。
    // 登记前须先在各子组件补 observedAttributes 或纳入 allowedAttribute 白名单。
    'kniu-sub-navbar', 'kniu-navbar', 'kniu-backtop', 'kniu-comment', 'kniu-like', 'kniu-user-login', 'kniu-article-tab'
  ].forEach(installOptionsOnlyProtocol);

  function assertCustomTag(tagName, apiName) {
    if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') {
      console.warn('[KNIU] ' + apiName + '("' + tagName + '") ignored: custom element registry unavailable');
      return false;
    }
    if (typeof tagName !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(tagName)) {
      console.warn('[KNIU] ' + apiName + '("' + tagName + '") rejected: tag must be lowercase and contain a hyphen, e.g. "app-rating"');
      return false;
    }
    if (tagName.indexOf('kniu-') === 0) {
      console.warn('[KNIU] ' + apiName + '("' + tagName + '") rejected: "kniu-" prefix is reserved for built-in components');
      return false;
    }
    if (customElements.get(tagName)) {
      console.warn('[KNIU] ' + apiName + '("' + tagName + '") skipped: already defined');
      return false;
    }
    return true;
  }

  function defineComponent(tagName, registerFn) {
    if (!assertCustomTag(tagName, 'defineComponent')) return;
    if (typeof registerFn !== 'function') {
      console.warn('[KNIU] defineComponent("' + tagName + '") rejected: second argument must be a register function (context) => void');
      return;
    }
    registerFn(KNIU_COMPONENT_CONTEXT);
  }

  function useComponent(spec) {
    const tag = spec && spec.tag;
    if (!assertCustomTag(tag, 'useComponent')) return;
    if (typeof spec.setup !== 'function') {
      console.warn('[KNIU] useComponent("' + tag + '") rejected: spec.setup(ctx) must return { state, ...actions }');
      return;
    }
    const style = typeof spec.style === 'string' ? spec.style : '';
    const template = typeof spec.template === 'string' ? spec.template : '';
    class KniuCustomComponent extends HTMLElement {
      constructor() {
        super();
        attachComponentShadow(this);
        if (style) {
          const styleNode = document.createElement('style');
          styleNode.textContent = style;
          this.shadowRoot.appendChild(styleNode);
        }
        if (template) {
          const root = document.createElement('div');
          root.innerHTML = template;
          this.shadowRoot.appendChild(root);
          this._root = root;
        } else {
          this._root = this.shadowRoot;
        }
        this._binding = null;
        this._pending = null;
        this._hooks = { beforeMount: [], mounted: [], unmounted: [] };
        this._built = false;
      }
      connectedCallback() {
        if (this._built) return;
        this._built = true;
        const self = this;
        function registerHook(bucket, fn) {
          if (typeof fn !== 'function') throw new TypeError('[KNIU] useComponent("' + tag + '") lifecycle hook must be a function');
          self._hooks[bucket].push(fn);
        }
        function runHooks(bucket) {
          self._hooks[bucket].forEach(function (fn) { fn.call(self, self); });
        }
        const ctx = {
          host: this,
          reactive: TEMPLATE.reactive,
          nextTick: TEMPLATE.nextTick,
          emit: this.emit.bind(this),
          onBeforeMount: function (fn) { registerHook('beforeMount', fn); },
          onMounted: function (fn) { registerHook('mounted', fn); },
          onUnmounted: function (fn) { registerHook('unmounted', fn); }
        };
        const bindings = spec.setup.call(ctx, ctx) || {};
        let state = bindings.state;
        if (!state || typeof state !== 'object') {
          console.warn('[KNIU] useComponent("' + tag + '") setup must return { state, ...actions }');
          return;
        }
        if (this._pending && typeof this._pending === 'object') Object.assign(state, this._pending);
        this._syncReadonly(state);
        runHooks('beforeMount');
        this._binding = TEMPLATE.bind(this._root, state);
        runHooks('mounted');
      }
      disconnectedCallback() {
        if (!this._built) return;
        this._hooks.unmounted.forEach(function (fn) { fn.call(this, this); }, this);
        if (this._binding && typeof this._binding.dispose === 'function') this._binding.dispose();
        this._binding = null;
        this._built = false;
      }
      emit(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { detail: detail, bubbles: true, composed: true }));
      }
      get options() {
        return this._binding ? Object.assign({}, this._binding.state) : Object.assign({}, this._pending);
      }
      set options(value) {
        const o = value && typeof value === 'object' ? value : {};
        if (this._binding) {
          Object.assign(this._binding.state, o);
        } else {
          this._pending = Object.assign({}, this._pending, o);
        }
        this._syncReadonly(o);
      }
      _syncReadonly(state) {
        this.toggleAttribute('readonly', state.readonly === true);
      }
    }
    customElements.define(tag, KniuCustomComponent);
  }

  return {
    state: state,
    use,
    setLoading: setLoading,
    lockDocumentScroll: lockDocumentScroll,
    unlockDocumentScroll: unlockDocumentScroll,
    reconcileDocumentScrollLock: reconcileDocumentScrollLock,
    isEmptyAttributeValue: isEmptyAttributeValue,
    pruneEmptyAttribute: pruneEmptyAttribute,
    pruneEmptyAttributes: pruneEmptyAttributes,
    pruneEmptyAttributeTree: pruneEmptyAttributeTree,
    pruneEmptyRootAttributes: pruneEmptyRootAttributes,
    msg: msg,
    usePagination: usePagination,
    makeSwitchOptions: makeSwitchOptions,
    createSearchActions: createSearchActions,
    createRowDeleteHandler: createRowDeleteHandler,
    usePage: usePage,
    confirm: confirm,
    defineComponent: defineComponent,
    useComponent: useComponent,
    installMarkdownStyles: installMarkdownStyles,
    installRichTextStyles: installRichTextStyles
  };
}());

export default KniuUI;

export const createRowDeleteHandler = KniuUI.createRowDeleteHandler;
