import { renderMarkdownArticle } from '../../kniucode.mjs';
import { isDangerousUrl } from '../../kniusanitizer.mjs';
export function registerEditor(context) {
  const { BOOLEAN_ATTRIBUTES, IDENTITY, KNIU_BACKTOP_CSS, KNIU_BADGE_CSS, KNIU_BASE_CONTAIN_CSS, KNIU_BASE_FONT_CSS, KNIU_BTN_CSS, KNIU_BTN_GROUP_CSS, KNIU_BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS, KNIU_COMMENT_CSS, KNIU_CONTAIN_EXCLUDE_TAGS, KNIU_CONTENT_TABLE_CSS, KNIU_CONTENT_TABLE_DOC_CSS, KNIU_DATE_PICKER_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS, KNIU_DROPDOWN_CSS, KNIU_DROPDOWN_OPTION_CSS, KNIU_EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS, KNIU_EMPTY_CSS, KNIU_FONT_FACE_CSS, KNIU_FONT_FAMILY, KNIU_FONT_MONO_FAMILY, KNIU_FONT_SERIF_FAMILY, KNIU_I18N, KNIU_ICON_CSS, KNIU_ICON_FONT_NAMES, KNIU_ICON_NAMES, KNIU_ICON_SVG, KNIU_IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS, KNIU_INPUT_AFFIX_CSS, KNIU_INPUT_CSS, KNIU_INPUT_GROUP_CSS, KNIU_INPUT_METRICS_CSS, KNIU_INPUT_PASSWORD_ACTIONS_CSS, KNIU_INPUT_PASSWORD_CSS, KNIU_INPUT_STATES_CSS, KNIU_INPUT_TEXTAREA_CSS, KNIU_INPUT_TIP_CSS, KNIU_LIKE_CSS, KNIU_LOADING_CSS, KNIU_MARKDOWN_CSS, KNIU_MODAL_CONFIRM_CSS, KNIU_MODAL_CSS, KNIU_MSG_CSS, KNIU_NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS, KNIU_NAVBAR_CSS, KNIU_NAVBAR_PLACEHOLDER_CSS, KNIU_PAGE_CSS, KNIU_RADIO_GROUP_CSS, KNIU_RICHTEXT_CSS, KNIU_SELECT_CSS, KNIU_STATUS_CSS, KNIU_SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS, KNIU_SWITCH_CSS, KNIU_TABLE_CLASS, KNIU_TABLE_COL_CSS, KNIU_TABLE_CSS, KNIU_TABLE_WRAP_CLASS, KNIU_TAB_CSS, KNIU_TAG_CSS, KNIU_UPLOAD_CSS, KNIU_USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS, PRUNABLE_ATTRIBUTE_NAMES, REQUEST, RICH_TEXT_LITERAL_TAG_RE, SCROLL_LOCK_FLAG, SEMANTIC_EMPTY_ATTRIBUTES, SHADOW_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_RE, TEMPLATE, adoptDropdownStyle, adoptSharedStyle, adoptedSheetsFlushScheduled, appendRawStyle, applyScrollLock, attachComponentShadow, buildIconElement, buildPageList, compileTableRowTemplate, componentDefaults, componentLang, componentText, computePopoverLayout, confirm, createRowDeleteHandler, createSearchActions, createTable, debounce, deferAffixTemplateMount, flushPendingAdoptedSheets, getResponseRecords, getShadowInnerHTMLDescriptor, getSharedStyleSheet, hasRichTextLiteralTag, installMarkdownStyles, installOptionsOnlyProtocol, installRichTextStyles, isEmptyAttributeValue, lockDocumentScroll, makeSwitchOptions, mountAffixSlots, mountPopoverPortal, msg, normalizeComponentCss, normalizedCssCache, pendingAdoptedSheets, pruneEmptyAttribute, pruneEmptyAttributeTree, pruneEmptyAttributes, pruneEmptyRootAttributes, readScrollLockOriginals, reconcileDocumentScrollLock, releaseScrollLock, replaceChildrenWithFragment, resolveIconName, resolveTableRowTemplate, sanitizeRichHtml, sanitizeRichHtmlAsync, scheduleAdoptedSheetsFlush, scrollLockNodes, scrollLockOriginals, scrollLockOwners, setLoading, shadowInnerHTMLDescriptor, shadowStyleSheetCache, shadowTemplateCache, shouldContainHost, state, supportsAdoptedStyleSheets, tableTemplateCache, toastInstance, toastTimer, trackPopoverPosition, unlockDocumentScroll, unwrapTablesIn, use, usePage, usePagination, wrapTablesIn, writeScrollLockOriginals } = context;
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
  if (customElements.get('kniu-editor')) return;

  var documentRef = typeof document !== 'undefined' ? document : null;
  if (!documentRef) return;

  var EMOJIS = ['😀', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😍', '😘', '😎', '🤔', '🤨', '😐', '😴', '😭', '😡', '👍', '👎', '👌', '✌️', '🤝', '👏', '💪', '🙏', '👀', '💡', '🔥', '⭐', '✨', '🎉', '❤️', '💔', '💯', '✅', '❌', '⚠️', '❓', '❗', '💬', '📌', '📎', '🔗', '🚀', '📝', '📅', '📈', '📊', '☕', '🍀', '🌟', '🎯', '🏆', '💻', '📱', '🌈', '🍻'];

  var EDITOR_ICON_MAXIMIZE = '<kniu-icon icon="fullscreen_open" aria-hidden="true"></kniu-icon>';
  var EDITOR_ICON_RESTORE = '<kniu-icon icon="fullscreen_exit" aria-hidden="true"></kniu-icon>';

  var EDITOR_ICON_CLEAR_FORMAT = '<kniu-icon icon="unbrush" aria-hidden="true"></kniu-icon>';

  var EDITOR_TOOLBAR_ITEMS = {
    'undo': '<button type="button" class="kniu_sys_editor_btn" data-cmd="undo" title="撤销"><kniu-icon icon="back" aria-hidden="true"></kniu-icon></button>',
    'redo': '<button type="button" class="kniu_sys_editor_btn" data-cmd="redo" title="重做"><kniu-icon icon="front" aria-hidden="true"></kniu-icon></button>',
    'print': '<button type="button" class="kniu_sys_editor_btn" data-action="print" title="打印"><kniu-icon icon="print" aria-hidden="true"></kniu-icon></button>',
    'code': '<button type="button" class="kniu_sys_editor_btn" data-action="code" title="代码模式"><kniu-icon icon="code" aria-hidden="true"></kniu-icon></button>',
    'maximize': '<button type="button" class="kniu_sys_editor_btn" data-action="maximize" title="最大化/还原"><kniu-icon icon="fullscreen_open" aria-hidden="true"></kniu-icon></button>',
    'bold': '<button type="button" class="kniu_sys_editor_btn" data-cmd="bold" title="加粗"><kniu-icon icon="font_strong" aria-hidden="true"></kniu-icon></button>',
    'italic': '<button type="button" class="kniu_sys_editor_btn" data-cmd="italic" title="斜体"><kniu-icon icon="font_i" aria-hidden="true"></kniu-icon></button>',
    'underline': '<button type="button" class="kniu_sys_editor_btn" data-cmd="underline" title="下划线"><kniu-icon icon="font_u" aria-hidden="true"></kniu-icon></button>',
    'strikeThrough': '<button type="button" class="kniu_sys_editor_btn" data-cmd="strikeThrough" title="删除线"><kniu-icon icon="font_del" aria-hidden="true"></kniu-icon></button>',
    'subscript': '<button type="button" class="kniu_sys_editor_btn" data-cmd="subscript" title="下标"><kniu-icon icon="sub" aria-hidden="true"></kniu-icon></button>',
    'superscript': '<button type="button" class="kniu_sys_editor_btn" data-cmd="superscript" title="上标"><kniu-icon icon="sup" aria-hidden="true"></kniu-icon></button>',
    'justifyLeft': '<button type="button" class="kniu_sys_editor_btn" data-cmd="justifyLeft" title="左对齐"><kniu-icon icon="align_left" aria-hidden="true"></kniu-icon></button>',
    'justifyCenter': '<button type="button" class="kniu_sys_editor_btn" data-cmd="justifyCenter" title="居中"><kniu-icon icon="align_center" aria-hidden="true"></kniu-icon></button>',
    'justifyRight': '<button type="button" class="kniu_sys_editor_btn" data-cmd="justifyRight" title="右对齐"><kniu-icon icon="align_right" aria-hidden="true"></kniu-icon></button>',
    'justifyFull': '<button type="button" class="kniu_sys_editor_btn" data-cmd="justifyFull" title="两端对齐"><kniu-icon icon="align_center" aria-hidden="true"></kniu-icon></button>',
    'indent': '<button type="button" class="kniu_sys_editor_btn" data-cmd="indent" title="增加缩进"><kniu-icon icon="shrink_left" aria-hidden="true"></kniu-icon></button>',
    'outdent': '<button type="button" class="kniu_sys_editor_btn" data-cmd="outdent" title="减少缩进"><kniu-icon icon="shrink_right" aria-hidden="true"></kniu-icon></button>',
    'insertOrderedList': '<button type="button" class="kniu_sys_editor_btn" data-cmd="insertOrderedList" title="有序列表"><kniu-icon icon="list" aria-hidden="true"></kniu-icon></button>',
    'insertUnorderedList': '<button type="button" class="kniu_sys_editor_btn" data-cmd="insertUnorderedList" title="无序列表"><kniu-icon icon="unlist" aria-hidden="true"></kniu-icon></button>',
    'lineheight': '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_lineheight" data-action="lineheight" title="行距" aria-label="选择行距"><kniu-icon icon="lineheight" aria-hidden="true"></kniu-icon><span class="kniu_sys_editor_font_arrow">▾</span></button>',
    'spacing': '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_spacing" data-action="spacing" title="字距" aria-label="选择字距"><kniu-icon icon="spacing" aria-hidden="true"></kniu-icon><span class="kniu_sys_editor_font_arrow">▾</span></button>',
    'heading': '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_heading" data-action="heading" title="标题" aria-label="选择标题"><kniu-icon icon="h" aria-hidden="true"></kniu-icon><span class="kniu_sys_editor_font_arrow">▾</span></button>',
    'h1': '<button type="button" class="kniu_sys_editor_btn" data-block="h1" title="标题1"><kniu-icon icon="h1" aria-hidden="true"></kniu-icon></button>',
    'h2': '<button type="button" class="kniu_sys_editor_btn" data-block="h2" title="标题2"><kniu-icon icon="h2" aria-hidden="true"></kniu-icon></button>',
    'h3': '<button type="button" class="kniu_sys_editor_btn" data-block="h3" title="标题3"><kniu-icon icon="h3" aria-hidden="true"></kniu-icon></button>',
    'h4': '<button type="button" class="kniu_sys_editor_btn" data-block="h4" title="标题4"><kniu-icon icon="h4" aria-hidden="true"></kniu-icon></button>',
    'h5': '<button type="button" class="kniu_sys_editor_btn" data-block="h5" title="标题5"><kniu-icon icon="h5" aria-hidden="true"></kniu-icon></button>',
    'h6': '<button type="button" class="kniu_sys_editor_btn" data-block="h6" title="标题6"><kniu-icon icon="h6" aria-hidden="true"></kniu-icon></button>',
    'p': '<button type="button" class="kniu_sys_editor_btn" data-block="p" title="段落"><kniu-icon icon="p" aria-hidden="true"></kniu-icon></button>',
    'blockquote': '<button type="button" class="kniu_sys_editor_btn" data-block="blockquote" title="引用"><kniu-icon icon="quotes" aria-hidden="true"></kniu-icon></button>',
    'pre': '<button type="button" class="kniu_sys_editor_btn" data-block="pre" title="代码块"><kniu-icon icon="pre" aria-hidden="true"></kniu-icon></button>',
    'inlineCode': '<button type="button" class="kniu_sys_editor_btn" data-action="inlineCode" title="行内代码"><kniu-icon icon="inlinecode" aria-hidden="true"></kniu-icon></button>',
    'hr': '<button type="button" class="kniu_sys_editor_btn" data-action="hr" title="分割线"><kniu-icon icon="line_x" aria-hidden="true"></kniu-icon></button>',
    'table': '<button type="button" class="kniu_sys_editor_btn" data-action="table" title="表格"><kniu-icon icon="table" aria-hidden="true"></kniu-icon></button>',
    'fontname': '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_fontname" data-action="fontname" title="字体" aria-label="选择字体"><kniu-icon icon="text" aria-hidden="true"></kniu-icon><span class="kniu_sys_editor_font_arrow">▾</span></button>',
    'fontsize': '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_fontsize" data-action="fontsize" title="字号" aria-label="选择字号"><kniu-icon icon="textsize" aria-hidden="true"></kniu-icon><span class="kniu_sys_editor_font_arrow">▾</span></button>',
    'forecolor': '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_color_btn" data-action="forecolor" title="文字颜色" aria-label="文字颜色"><kniu-icon icon="textcolor" aria-hidden="true"></kniu-icon><span class="kniu_sys_editor_font_arrow">▾</span></button>',
    'hilitecolor': '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_color_btn" data-action="hilitecolor" title="文字背景" aria-label="文字背景"><kniu-icon icon="bgcolor" aria-hidden="true"></kniu-icon><span class="kniu_sys_editor_font_arrow">▾</span></button>',
    'link': '<button type="button" class="kniu_sys_editor_btn" data-action="link" title="链接"><kniu-icon icon="link" aria-hidden="true"></kniu-icon></button>',
    'image': '<button type="button" class="kniu_sys_editor_btn" data-action="image" title="插入图片" aria-label="插入图片"><kniu-icon icon="picture" aria-hidden="true"></kniu-icon></button>',
    'media': '<button type="button" class="kniu_sys_editor_btn" data-action="media" title="插入音视频" aria-label="插入音视频"><kniu-icon icon="video" aria-hidden="true"></kniu-icon></button>',
    'unlink': '<button type="button" class="kniu_sys_editor_btn" data-cmd="unlink" title="取消链接"><kniu-icon icon="unlink" aria-hidden="true"></kniu-icon></button>',
    'emoticons': '<button type="button" class="kniu_sys_editor_btn" data-action="emoticons" title="表情"><kniu-icon icon="smile" aria-hidden="true"></kniu-icon></button>',
    'removeFormat': '<button type="button" class="kniu_sys_editor_btn" data-cmd="removeFormat" title="清除格式"><kniu-icon icon="unbrush" aria-hidden="true"></kniu-icon></button>',
    'clearhtml': '<button type="button" class="kniu_sys_editor_btn" data-action="clearhtml" title="清理HTML"><kniu-icon icon="clearhtml" aria-hidden="true"></kniu-icon></button>',
    'selectAll': '<button type="button" class="kniu_sys_editor_btn" data-cmd="selectAll" title="全选"><kniu-icon icon="alllist" aria-hidden="true"></kniu-icon></button>'
  };

  var EDITOR_DEFAULT_TOOLBAR = [
    ['code'],
    ['undo', 'redo'],
    ['removeFormat', 'clearhtml'],
    ['bold', 'italic', 'underline', 'strikeThrough', 'fontname', 'fontsize', 'forecolor', 'hilitecolor', 'lineheight', 'spacing'],
    ['heading', 'p', 'blockquote', 'subscript', 'superscript'],
    ['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'],
    ['insertOrderedList', 'insertUnorderedList', 'indent', 'outdent', 'selectAll'],
    ['table', 'hr', 'emoticons'],
    ['image', 'media', 'link', 'unlink'],
    ['inlineCode', 'pre'],
    ['print', 'maximize']
  ];

  var EDITOR_MD_TOOLBAR_ITEMS = {
    'undo': '<button type="button" class="kniu_sys_editor_btn" data-md-cmd="undo" title="撤销"><kniu-icon icon="back" aria-hidden="true"></kniu-icon></button>',
    'redo': '<button type="button" class="kniu_sys_editor_btn" data-md-cmd="redo" title="重做"><kniu-icon icon="front" aria-hidden="true"></kniu-icon></button>',
    'bold': '<button type="button" class="kniu_sys_editor_btn" data-md-cmd="bold" title="粗体"><kniu-icon icon="font_strong" aria-hidden="true"></kniu-icon></button>',
    'italic': '<button type="button" class="kniu_sys_editor_btn" data-md-cmd="italic" title="斜体"><kniu-icon icon="font_i" aria-hidden="true"></kniu-icon></button>',
    'strike': '<button type="button" class="kniu_sys_editor_btn" data-md-cmd="strike" title="删除线"><kniu-icon icon="font_del" aria-hidden="true"></kniu-icon></button>',
    'inlineCode': '<button type="button" class="kniu_sys_editor_btn" data-md-cmd="inlineCode" title="行内代码"><kniu-icon icon="inlinecode" aria-hidden="true"></kniu-icon></button>',
    'heading': '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_heading" data-md-cmd="heading" title="标题"><kniu-icon icon="h" aria-hidden="true"></kniu-icon><span class="kniu_sys_editor_font_arrow">▾</span></button>',
    'quote': '<button type="button" class="kniu_sys_editor_btn" data-md-cmd="quote" title="引用"><kniu-icon icon="quotes" aria-hidden="true"></kniu-icon></button>',
    'code': '<button type="button" class="kniu_sys_editor_btn" data-md-cmd="code" title="代码块"><kniu-icon icon="pre" aria-hidden="true"></kniu-icon></button>',
    'ul': '<button type="button" class="kniu_sys_editor_btn" data-md-cmd="ul" title="无序列表"><kniu-icon icon="unlist" aria-hidden="true"></kniu-icon></button>',
    'ol': '<button type="button" class="kniu_sys_editor_btn" data-md-cmd="ol" title="有序列表"><kniu-icon icon="list" aria-hidden="true"></kniu-icon></button>',
    'link': '<button type="button" class="kniu_sys_editor_btn" data-md-cmd="link" title="链接"><kniu-icon icon="link" aria-hidden="true"></kniu-icon></button>',
    'image': '<button type="button" class="kniu_sys_editor_btn" data-md-cmd="image" title="图片"><kniu-icon icon="picture" aria-hidden="true"></kniu-icon></button>',
    'hr': '<button type="button" class="kniu_sys_editor_btn" data-md-cmd="hr" title="分割线"><kniu-icon icon="line_x" aria-hidden="true"></kniu-icon></button>',
    'table': '<button type="button" class="kniu_sys_editor_btn" data-md-cmd="table" title="表格"><kniu-icon icon="table" aria-hidden="true"></kniu-icon></button>',
    'preview': '<button type="button" class="kniu_sys_editor_btn" data-md-cmd="preview" title="预览"><kniu-icon icon="view" aria-hidden="true"></kniu-icon></button>',
    'maximize': '<button type="button" class="kniu_sys_editor_btn" data-md-cmd="maximize" title="最大化/还原"><kniu-icon icon="fullscreen_open" aria-hidden="true"></kniu-icon></button>'
  };

  var EDITOR_MARKDOWN_TOOLBAR = [
    ['undo', 'redo'],
    ['bold', 'italic', 'strike', 'inlineCode'],
    ['heading', 'quote'],
    ['code', 'ul', 'ol'],
    ['link', 'image', 'hr', 'table'],
    ['preview', 'maximize']
  ];

  function wrapEditorTables(editor, skipNode) {
    wrapTablesIn(editor, skipNode || null);
  }

  function stripEditorTableWraps(root) {
    unwrapTablesIn(root);
  }

  class KniuSysEditor extends HTMLElement {
    static get observedAttributes() { return ['name', 'placeholder', 'readonly', 'disabled', 'toolbar', 'type']; }
    constructor() {
      super();
      attachComponentShadow(this);
      this.shadowRoot.innerHTML = [
        '<div class="kniu_sys_editor_group" data-has-prepend="false" data-code-mode="false">',
        '<span class="kniu_sys_editor_affix kniu_sys_editor_prepend"><slot name="prepend"></slot></span>',
        '<div class="kniu_sys_editor_main">',
        '<div class="kniu_sys_editor_toolbar">',
        // 撤销 / 重做
        '<button type="button" class="kniu_sys_editor_btn" data-cmd="undo" title="撤销"><kniu-icon icon="back" aria-hidden="true"></kniu-icon></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-cmd="redo" title="重做"><kniu-icon icon="front" aria-hidden="true"></kniu-icon></button>',
        '<span class="kniu_sys_editor_divider"></span>',
        // 视图
        '<button type="button" class="kniu_sys_editor_btn" data-action="print" title="打印"><kniu-icon icon="print" aria-hidden="true"></kniu-icon></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-action="code" title="代码模式"><kniu-icon icon="code" aria-hidden="true"></kniu-icon></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-action="maximize" title="最大化/还原"><kniu-icon icon="fullscreen_open" aria-hidden="true"></kniu-icon></button>',
        '<span class="kniu_sys_editor_divider"></span>',
        // 字体样式
        '<button type="button" class="kniu_sys_editor_btn" data-cmd="bold" title="加粗"><kniu-icon icon="font_strong" aria-hidden="true"></kniu-icon></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-cmd="italic" title="斜体"><kniu-icon icon="font_i" aria-hidden="true"></kniu-icon></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-cmd="underline" title="下划线"><kniu-icon icon="font_u" aria-hidden="true"></kniu-icon></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-cmd="strikeThrough" title="删除线"><kniu-icon icon="font_del" aria-hidden="true"></kniu-icon></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-cmd="subscript" title="下标"><kniu-icon icon="sub" aria-hidden="true"></kniu-icon></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-cmd="superscript" title="上标"><kniu-icon icon="sup" aria-hidden="true"></kniu-icon></button>',
        '<span class="kniu_sys_editor_divider"></span>',
        // 对齐
        '<button type="button" class="kniu_sys_editor_btn" data-cmd="justifyLeft" title="左对齐"><kniu-icon icon="align_left" aria-hidden="true"></kniu-icon></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-cmd="justifyCenter" title="居中"><kniu-icon icon="align_center" aria-hidden="true"></kniu-icon></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-cmd="justifyRight" title="右对齐"><kniu-icon icon="align_right" aria-hidden="true"></kniu-icon></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-cmd="justifyFull" title="两端对齐"><kniu-icon icon="align_center" aria-hidden="true"></kniu-icon></button>',
        '<span class="kniu_sys_editor_divider"></span>',
        // 缩进 / 列表
        '<button type="button" class="kniu_sys_editor_btn" data-cmd="indent" title="增加缩进"><kniu-icon icon="shrink_left" aria-hidden="true"></kniu-icon></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-cmd="outdent" title="减少缩进"><kniu-icon icon="shrink_right" aria-hidden="true"></kniu-icon></button>',
        '<span class="kniu_sys_editor_divider"></span>',
        '<button type="button" class="kniu_sys_editor_btn" data-cmd="insertOrderedList" title="有序列表"><kniu-icon icon="list" aria-hidden="true"></kniu-icon></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-cmd="insertUnorderedList" title="无序列表"><kniu-icon icon="unlist" aria-hidden="true"></kniu-icon></button>',
        '<span class="kniu_sys_editor_divider"></span>',
        '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_lineheight" data-action="lineheight" title="行距" aria-label="选择行距"><kniu-icon icon="lineheight" aria-hidden="true"></kniu-icon><span class="kniu_sys_editor_font_arrow">▾</span></button>',
        '<span class="kniu_sys_editor_divider"></span>',
        '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_heading" data-action="heading" title="标题" aria-label="选择标题"><kniu-icon icon="h" aria-hidden="true"></kniu-icon><span class="kniu_sys_editor_font_arrow">▾</span></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-block="p" title="段落"><kniu-icon icon="p" aria-hidden="true"></kniu-icon></button>',
        '<span class="kniu_sys_editor_divider"></span>',
        '<button type="button" class="kniu_sys_editor_btn" data-block="blockquote" title="引用"><kniu-icon icon="quotes" aria-hidden="true"></kniu-icon></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-block="pre" title="代码块"><kniu-icon icon="pre" aria-hidden="true"></kniu-icon></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-action="hr" title="分割线"><kniu-icon icon="line_x" aria-hidden="true"></kniu-icon></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-action="table" title="表格"><kniu-icon icon="table" aria-hidden="true"></kniu-icon></button>',
        '<span class="kniu_sys_editor_divider"></span>',
        // 字体
        '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_fontname" data-action="fontname" title="字体" aria-label="选择字体"><kniu-icon icon="text" aria-hidden="true"></kniu-icon><span class="kniu_sys_editor_font_arrow">▾</span></button>',
        '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_fontsize" data-action="fontsize" title="字号" aria-label="选择字号"><kniu-icon icon="textsize" aria-hidden="true"></kniu-icon><span class="kniu_sys_editor_font_arrow">▾</span></button>',
        '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_color_btn" data-action="forecolor" title="文字颜色" aria-label="文字颜色"><kniu-icon icon="textcolor" aria-hidden="true"></kniu-icon><span class="kniu_sys_editor_font_arrow">▾</span></button>',
        '<button type="button" class="kniu_sys_editor_btn kniu_sys_editor_color_btn" data-action="hilitecolor" title="文字背景" aria-label="文字背景"><kniu-icon icon="bgcolor" aria-hidden="true"></kniu-icon><span class="kniu_sys_editor_font_arrow">▾</span></button>',
        '<span class="kniu_sys_editor_divider"></span>',
        // 插入
        '<button type="button" class="kniu_sys_editor_btn" data-action="link" title="链接"><kniu-icon icon="link" aria-hidden="true"></kniu-icon></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-cmd="unlink" title="取消链接"><kniu-icon icon="unlink" aria-hidden="true"></kniu-icon></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-action="emoticons" title="表情"><kniu-icon icon="smile" aria-hidden="true"></kniu-icon></button>',
        '<span class="kniu_sys_editor_divider"></span>',
        // 清理 / 全选
        '<button type="button" class="kniu_sys_editor_btn" data-cmd="removeFormat" title="清除格式"><kniu-icon icon="unbrush" aria-hidden="true"></kniu-icon></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-action="clearhtml" title="清理HTML"><kniu-icon icon="clearhtml" aria-hidden="true"></kniu-icon></button>',
        '<button type="button" class="kniu_sys_editor_btn" data-cmd="selectAll" title="全选"><kniu-icon icon="alllist" aria-hidden="true"></kniu-icon></button>',
        '<div class="kniu_sys_editor_popover kniu_sys_dropdown_panel" hidden></div>',
        '</div>',
        '<div class="kniu_sys_editor_split">',
        '<div class="kniu_sys_editor_content_wrap"><div class="kniu_sys_editor_line_numbers" aria-hidden="true"><div class="kniu_sys_editor_line_numbers_inner"></div></div><div class="kniu_sys_editor_content" contenteditable="true" data-placeholder=""></div></div>',
        '<div class="kniu_sys_editor_source_wrap"><span class="kniu_sys_editor_pane_badge">Markdown</span><div class="kniu_sys_editor_source_lines" aria-hidden="true"><div class="kniu_sys_editor_source_lines_inner"></div></div><textarea class="kniu_sys_editor_source" spellcheck="false"></textarea></div>',
        '<div class="kniu_sys_editor_preview_wrap"><span class="kniu_sys_editor_pane_badge">预览</span><div class="kniu_sys_editor_preview kniu_sys_markdown_body" aria-hidden="true"></div></div>',
        '</div>',
        '<div class="kniu_sys_editor_statusbar">',
        '<span class="kniu_sys_editor_status_info"></span>',
        '<label class="kniu_sys_editor_status_sync"><input type="checkbox" class="kniu_sys_editor_sync_scroll" checked><span>同步滚动</span></label>',
        '</div>',
        '</div>',
        '</div>'
      ].join('');
      adoptSharedStyle(this.shadowRoot, KNIU_EDITOR_CSS);
      this._editor = this.shadowRoot.querySelector('.kniu_sys_editor_content');
      this._group = this.shadowRoot.querySelector('.kniu_sys_editor_group');
      this._toolbar = this.shadowRoot.querySelector('.kniu_sys_editor_toolbar');
      this._source = this.shadowRoot.querySelector('.kniu_sys_editor_source');
      this._sourceLines = this.shadowRoot.querySelector('.kniu_sys_editor_source_lines_inner');
      this._previewPane = this.shadowRoot.querySelector('.kniu_sys_editor_preview');
      this._statusBar = this.shadowRoot.querySelector('.kniu_sys_editor_statusbar');
      this._statusInfo = this.shadowRoot.querySelector('.kniu_sys_editor_status_info');
      this._statusSync = this.shadowRoot.querySelector('.kniu_sys_editor_sync_scroll');
      this._editorLines = this.shadowRoot.querySelector('.kniu_sys_editor_line_numbers_inner');
      adoptDropdownStyle(this.shadowRoot);
      adoptSharedStyle(this.shadowRoot, KNIU_EDITOR_OVERRIDE_CSS);
      appendRawStyle(this.shadowRoot, KNIU_CONTENT_TABLE_CSS);
      appendRawStyle(this.shadowRoot, KNIU_MARKDOWN_CSS);
      this._codeMode = false;
      this._markdownMode = false;
      this._markdownPreview = undefined;
      this._mdSyncScroll = true;
      this._mdScrollEcho = null;
      this._maximized = false;
      this._maxPrevParent = null;
      this._maxPrevNext = null;
      this._popoverAction = null;
      this._lineNumberResizeObserver = null;
      this._lineNumberKey = '';
      this._maxHeight = null;

      var self = this;
      this._buildToolbar(this._resolveToolbarConfig());

      this.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && self._maximized) {
          e.stopPropagation();
          self._toggleMaximize();
        }
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'b' || e.key === 'B') && !self._codeMode && !self._markdownMode) {
          e.preventDefault();
          self._editor.focus();
          documentRef.execCommand('bold', false, null);
          self._normalizeBold();
          self.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          self._syncToolbarState();
        }
      });

      this._editor.addEventListener('input', function () {
        // 输入热路径只做轻活（B3-m2）：危险标签转码与表格规范化移到插入路径
        //（_afterContentInsert）/blur/setValue；行号 rAF 合批，同帧多次输入只测一次。
        self._lineContentVersion = (self._lineContentVersion || 0) + 1;
        self.removeAttribute('data-invalid');
        self._scheduleLineNumbers();
        self.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      });
      this._editor.addEventListener('beforeinput', function (e) {
        if (e.inputType === 'insertText' && (e.data === '<' || hasRichTextLiteralTag(e.data))) {
          e.preventDefault();
          self._insertSafeRichText(e.data);
        }
      });
      this._editor.addEventListener('paste', function (e) {
        var clipboard = e.clipboardData;
        var text = clipboard && clipboard.getData ? clipboard.getData('text/plain') : '';
        if (hasRichTextLiteralTag(text)) {
          e.preventDefault();
          self._insertSafeRichText(text);
          return;
        }
        // text/html 富文本粘贴走浏览器原生插入（内容在事件后进入 DOM），
        // 异步补一次危险标签黑名单扫描——防线从每键 input 收敛到插入路径（B3-m2）。
        if (clipboard && clipboard.types && Array.prototype.indexOf.call(clipboard.types, 'text/html') >= 0) {
          setTimeout(function () {
            self._afterContentInsert();
            self._lineContentVersion = (self._lineContentVersion || 0) + 1;
            self._scheduleLineNumbers();
          }, 0);
        }
      });
      this._editor.addEventListener('scroll', function () { self._updateLineNumbers(); });
      this._editor.addEventListener('focus', function () { self._updateLineNumbers(); });
      this._editor.addEventListener('blur', function () {
        self._lineContentVersion = (self._lineContentVersion || 0) + 1;
        self._normalizeTables();
        self._afterContentInsert();
        self.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      });
      this._source.addEventListener('input', function () { self._handleSourceInput(); });
      this._source.addEventListener('scroll', function () {
        self._updateLineNumbers();
        if (self._consumeScrollEcho('source')) return;
        self._syncMarkdownPreviewScroll();
      });
      this._previewPane.addEventListener('scroll', function () {
        if (self._consumeScrollEcho('preview')) return;
        self._syncMarkdownSourceScroll();
      });
      this._source.addEventListener('keyup', function () { self._scheduleStatusUpdate(); });
      this._source.addEventListener('click', function () { self._updateMarkdownStatus(); });
      this._source.addEventListener('select', function () { self._updateMarkdownStatus(); });
      this._statusSync.addEventListener('change', function () {
        self._mdSyncScroll = self._statusSync.checked;
        if (self._mdSyncScroll) self._syncMarkdownPreviewScroll();
      });
      this._source.addEventListener('focus', function () { self._updateLineNumbers(); });
      this._editor.addEventListener('keyup', function () { self._syncToolbarState(); });
      this._editor.addEventListener('mouseup', function () { self._syncToolbarState(); });
      this._editor.addEventListener('focus', function () { self._syncToolbarState(); });
      this._editor.addEventListener('click', function (e) {
        var media = e.target.closest ? e.target.closest('img,video,audio') : null;
        if (media && self._editor.contains(media)) self._selectMedia(media);
        else self._selectMedia(null);
      });
      this._editor.addEventListener('contextmenu', function (e) {
        var media = e.target.closest ? e.target.closest('img,video,audio') : null;
        if (media && self._editor.contains(media)) {
          e.preventDefault();
          self._selectMedia(media);
          self._openMediaSizeDialog(media);
        }
      });
    }

    connectedCallback() {
      this._mountAffixes();
      this._sync();
      this._updateLineNumbers();
      this._scheduleSourceLineNumbers();
      if (!this._lineNumberResizeObserver && typeof ResizeObserver !== 'undefined') {
        this._lineNumberResizeObserver = new ResizeObserver(function () {
          this._scheduleLineNumbers();
        }.bind(this));
        this._lineNumberResizeObserver.observe(this._editor);
        this._lineNumberResizeObserver.observe(this._source);
      }
      var mb0 = this._toolbar && this._toolbar.querySelector('[data-action="maximize"]');
      if (mb0 && !mb0.querySelector('kniu-icon')) mb0.innerHTML = EDITOR_ICON_MAXIMIZE;
      queueMicrotask(function () { this._mountAffixes(); }.bind(this));
    }
    attributeChangedCallback(name) {
      if (!this._editor) return;
      if (name === 'toolbar') {
        this._buildToolbar(this._resolveToolbarConfig());
        this._sync();
        return;
      }
      if (name === 'type') {
        const typeValue = this.getAttribute('type');
        if (typeValue) this.setType(typeValue);
      }
      this._sync();
    }
    disconnectedCallback() {
      if (this._lineNumberResizeObserver) {
        this._lineNumberResizeObserver.disconnect();
        this._lineNumberResizeObserver = null;
      }
      if (this._lineNumberRaf) { globalThis.cancelAnimationFrame(this._lineNumberRaf); this._lineNumberRaf = 0; }
      if (this._statusDebounce) { clearTimeout(this._statusDebounce); this._statusDebounce = 0; }
      if (this._mdPreviewDebounce) { clearTimeout(this._mdPreviewDebounce); this._mdPreviewDebounce = 0; }
      if (this._mdPreviewRaf) { globalThis.cancelAnimationFrame(this._mdPreviewRaf); this._mdPreviewRaf = 0; }
    }

    get toolbar() {
      if (this.__kniuOptions && Object.prototype.hasOwnProperty.call(this.__kniuOptions, 'toolbar')) {
        return this.__kniuOptions.toolbar;
      }
      return this.getAttribute('toolbar');
    }
    set toolbar(v) {
      if (v == null || v === '') { this.removeAttribute('toolbar'); return; }
      var str = Array.isArray(v) ? v.map(function (item) {
        return Array.isArray(item) ? item.join(' ') : String(item);
      }).join(' ') : String(v);
      this.setAttribute('toolbar', str);
    }

    get maxHeight() {
      if (this.__kniuOptions && Object.prototype.hasOwnProperty.call(this.__kniuOptions, 'maxHeight')) {
        return this.__kniuOptions.maxHeight;
      }
      return this._maxHeight;
    }
    set maxHeight(v) {
      this._maxHeight = (v == null || v === '') ? null : v;
      this._applyMaxHeight();
    }
    _applyMaxHeight() {
      var wrap = this.shadowRoot.querySelector('.kniu_sys_editor_content_wrap');
      if (!wrap) return;
      var value = Number(this._maxHeight);
      if (this._maximized || !Number.isFinite(value) || value <= 0) {
        wrap.style.maxHeight = '';
        return;
      }
      wrap.style.maxHeight = Math.max(200, value) + 'px';
    }

    _resolveToolbarConfig() {
      var raw = this.__kniuOptions && Object.prototype.hasOwnProperty.call(this.__kniuOptions, 'toolbar')
        ? this.__kniuOptions.toolbar : this.getAttribute('toolbar');
      if (Array.isArray(raw)) {
        var aliases = { fontName: 'fontname', fontSize: 'fontsize', foreColor: 'forecolor', hiliteColor: 'hilitecolor', clear: 'clearhtml', fullscreen: 'maximize' };
        var groupsFromArray = [[]];
        raw.forEach(function (item) {
          if (item === '|') { if (groupsFromArray[groupsFromArray.length - 1].length) groupsFromArray.push([]); return; }
          var token = aliases[item] || item;
          if (EDITOR_TOOLBAR_ITEMS[token]) groupsFromArray[groupsFromArray.length - 1].push(token);
        });
        return groupsFromArray.filter(function (group) { return group.length; });
      }
      if (raw == null || String(raw).trim() === '') return EDITOR_DEFAULT_TOOLBAR;
      raw = String(raw);
      var groups;
      if (raw.indexOf('|') !== -1) {
        groups = raw.split('|').map(function (g) { return g.trim().split(/[\s,]+/).filter(Boolean); });
      } else {
        groups = [raw.split(/[\s,]+/).filter(Boolean)];
      }
      return groups;
    }

    _buildToolbar(groups) {
      if (this._markdownMode) { this._buildMarkdownToolbar(); return; }
      if (!groups) groups = this._resolveToolbarConfig();
      var html = [];
      for (var gi = 0; gi < groups.length; gi++) {
        if (gi > 0) html.push('<span class="kniu_sys_editor_divider"></span>');
        var group = groups[gi] || [];
        for (var i = 0; i < group.length; i++) {
          var item = EDITOR_TOOLBAR_ITEMS[group[i]];
          if (item) html.push(item);
        }
      }
      html.push('<div class="kniu_sys_editor_popover kniu_sys_dropdown_panel" hidden></div>');
      this._toolbar.innerHTML = html.join('');
      var clearFormatBtn = this._toolbar.querySelector('[data-cmd="removeFormat"]');
      if (clearFormatBtn) clearFormatBtn.innerHTML = EDITOR_ICON_CLEAR_FORMAT;
      var mb = this._toolbar.querySelector('[data-action="maximize"]');
      if (mb && !mb.querySelector('kniu-icon')) mb.innerHTML = EDITOR_ICON_MAXIMIZE;
      if (this._maximized) {
        var maxBtn = this._toolbar.querySelector('[data-action="maximize"]');
        if (maxBtn) {
          maxBtn.setAttribute('aria-pressed', 'true');
          maxBtn.innerHTML = EDITOR_ICON_RESTORE;
        }
      }
      var self = this;
      this._toolbar.querySelectorAll('.kniu_sys_editor_btn').forEach(function (btn) {
        btn.addEventListener('pointerdown', function (e) { e.preventDefault(); });
        btn.addEventListener('click', function () { self._handleToolbar(btn); });
      });
      this._toolbar.querySelectorAll('.kniu_sys_editor_select').forEach(function (sel) {
        sel.addEventListener('change', function () {
          self._editor.focus();
          self._applySelect(sel);
          self.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        });
      });
      this._toolbar.querySelectorAll('.kniu_sys_editor_color').forEach(function (inp) {
        inp.addEventListener('change', function () {
          self._editor.focus();
          self._applyColor(inp);
          self.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        });
      });
      this._bindPopoverEvents();
      this._applyToolbarLang();
      this._syncToolbarState();
    }

    _bindPopoverEvents() {
      var self = this;
      this._popover = this._toolbar.querySelector('.kniu_sys_editor_popover');
      this._popover.addEventListener('click', function (e) {
        var t = e.target;
        var emojiBtn = t.closest ? t.closest('.kniu_sys_editor_emoji') : null;
        if (emojiBtn) { self._insertEmoji(emojiBtn.dataset.emoji); self._closePopover(); return; }
        var confirmBtn = t.closest ? t.closest('[data-confirm="table"]') : null;
        if (confirmBtn) {
          var r = self._popover.querySelector('.kniu_sys_editor_pop_rows').value;
          var c = self._popover.querySelector('.kniu_sys_editor_pop_cols').value;
          self._insertTable(r, c);
          self._closePopover();
          return;
        }
        var linkBtn = t.closest ? t.closest('[data-confirm="link"]') : null;
        if (linkBtn) { self._confirmLink(); return; }
        var imageBtn = t.closest ? t.closest('[data-confirm="image"]') : null;
        if (imageBtn) { self._confirmImage(); return; }
        var mediaBtn = t.closest ? t.closest('[data-confirm="media"]') : null;
        if (mediaBtn) { self._confirmMedia(); return; }
        var mediaSizeBtn = t.closest ? t.closest('[data-confirm="media-size"]') : null;
        if (mediaSizeBtn) { self._confirmMediaSize(); return; }
        var deleteMediaBtn = t.closest ? t.closest('[data-delete="media"]') : null;
        if (deleteMediaBtn) { self._showMediaDeleteConfirm(); return; }
        var confirmDeleteMediaBtn = t.closest ? t.closest('[data-confirm="delete-media"]') : null;
        if (confirmDeleteMediaBtn) { self._deleteEditingMedia(); return; }
        var backMediaEditBtn = t.closest ? t.closest('[data-back="media-edit"]') : null;
        if (backMediaEditBtn && self._editingMedia) { self._openMediaSizeDialog(self._editingMedia); return; }
        var cancelBtn = t.closest ? t.closest('[data-cancel="popover"]') : null;
        if (cancelBtn) { self._closePopover(); return; }
        var fontBtn = t.closest ? t.closest('[data-font]') : null;
        if (fontBtn) { self._applyFont(fontBtn.dataset.font || ''); return; }
        var sizeBtn = t.closest ? t.closest('[data-font-size]') : null;
        if (sizeBtn) { self._applyFontSize(sizeBtn.dataset.fontSize); return; }
        var headingBtn = t.closest ? t.closest('[data-heading]') : null;
        if (headingBtn) { self._applyHeading(headingBtn.dataset.heading); return; }
        var mdHeadingBtn = t.closest ? t.closest('[data-md-heading]') : null;
        if (mdHeadingBtn) { self._insertMarkdownHeading(Number(mdHeadingBtn.dataset.mdHeading)); self._closePopover(); return; }
        var lineHeightBtn = t.closest ? t.closest('[data-line-height]') : null;
        if (lineHeightBtn) { self._applyLineHeight(lineHeightBtn.dataset.lineHeight); return; }
        var spacingBtn = t.closest ? t.closest('[data-letter-spacing]') : null;
        if (spacingBtn) { self._applyLetterSpacing(spacingBtn.dataset.letterSpacing); return; }
        var colorBtn = t.closest ? t.closest('[data-editor-color]') : null;
        if (colorBtn) { self._applyEditorColor(colorBtn.dataset.editorColor || ''); return; }
      });
      this._popover.addEventListener('pointerdown', function (e) {
        var option = e.target.closest ? e.target.closest('[data-font],[data-font-size],[data-editor-color],[data-heading],[data-md-heading],[data-line-height],[data-letter-spacing]') : null;
        if (option) e.preventDefault();
      });
      this._popover.addEventListener('change', function (e) {
        if (e.target.matches('.kniu_sys_editor_pop_image_source,.kniu_sys_editor_pop_media_source,.kniu_sys_editor_pop_edit_source,.kniu_sys_editor_pop_media_type')) self._syncMediaSourceFields();
        if (e.target.matches('.kniu_sys_editor_pop_image_file,.kniu_sys_editor_pop_media_file,.kniu_sys_editor_pop_edit_file')) self._fillMediaNameFromFile(e.target);
      });
      this._popover.addEventListener('input', function (e) {
        if (e.target.matches('.kniu_sys_editor_pop_media_width,.kniu_sys_editor_pop_media_height')) self._syncMediaAspect(e.target);
      });
      this._popover.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && self._popoverAction === 'link') {
          e.preventDefault();
          self._confirmLink();
        } else if (e.key === 'Enter' && self._popoverAction === 'image') {
          e.preventDefault();
          self._confirmImage();
        } else if (e.key === 'Enter' && self._popoverAction === 'media') {
          e.preventDefault();
          self._confirmMedia();
        } else if (e.key === 'Enter' && self._popoverAction === 'media-size') {
          e.preventDefault();
          self._confirmMediaSize();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          self._closePopover();
        }
      });
      this._applyToolbarLang();
      this._syncToolbarState();
    }

    _buildMarkdownToolbar() {
      var html = [];
      for (var gi = 0; gi < EDITOR_MARKDOWN_TOOLBAR.length; gi++) {
        if (gi > 0) html.push('<span class="kniu_sys_editor_divider"></span>');
        var group = EDITOR_MARKDOWN_TOOLBAR[gi] || [];
        for (var i = 0; i < group.length; i++) {
          var item = EDITOR_MD_TOOLBAR_ITEMS[group[i]];
          if (item) html.push(item);
        }
      }
      html.push('<div class="kniu_sys_editor_popover kniu_sys_dropdown_panel" hidden></div>');
      this._toolbar.innerHTML = html.join('');
      this._syncMaximizeIcon();
      var previewBtn = this._toolbar.querySelector('[data-md-cmd="preview"]');
      if (previewBtn) previewBtn.setAttribute('aria-pressed', String(this._markdownPreview !== false));
      var self = this;
      this._toolbar.querySelectorAll('.kniu_sys_editor_btn').forEach(function (btn) {
        btn.addEventListener('pointerdown', function (e) { e.preventDefault(); });
        btn.addEventListener('click', function () { self._handleToolbar(btn); });
      });
      this._bindPopoverEvents();
    }

    _markdownHeadingPopoverHTML() {
      var headings = [['h1', 'H1'], ['h2', 'H2'], ['h3', 'H3'], ['h4', 'H4'], ['h5', 'H5'], ['h6', 'H6']];
      return '<div class="kniu_sys_editor_font_list" role="menu">' + headings.map(function (h) {
        return '<button type="button" class="kniu_sys_editor_font_item kniu_sys_dropdown_option" role="menuitemradio" aria-checked="false" data-md-heading="' + h[0].slice(1) + '">' + h[1] + '</button>';
      }).join('') + '</div>';
    }

    _insertMarkdownHeading(level) {
      var ta = this._source;
      var s = ta.selectionStart, e = ta.selectionEnd;
      var v = ta.value;
      var lineStart = v.lastIndexOf('\n', s - 1) + 1;
      var lineEnd = v.indexOf('\n', s);
      if (lineEnd === -1) lineEnd = v.length;
      var line = v.slice(lineStart, lineEnd).replace(/^#{1,6}\s*/, '');
      var prefix = new Array(level + 1).join('#') + ' ';
      ta.value = v.slice(0, lineStart) + prefix + line + v.slice(lineEnd);
      var caret = lineStart + prefix.length + (s - lineStart);
      ta.setSelectionRange(caret, caret + (e - s));
      this._handleSourceInput();
      this._source.focus();
    }

    _handleMarkdownToolbar(btn) {
      var md = btn.dataset.mdCmd;
      if (md === 'maximize') { this._toggleMaximize(); return; }
      if (md === 'preview') { this._toggleMarkdownPreview(); return; }
      if (md === 'heading') { this._togglePopover('md-heading', btn); return; }
      if (md === 'undo' || md === 'redo') {
        this._source.focus();
        try { documentRef.execCommand(md, false, null); } catch (e) { }
        this._handleSourceInput();
        return;
      }
      this._source.focus();
      switch (md) {
        case 'bold': this._insertMarkdownAround('**', '**', '粗体文本'); break;
        case 'italic': this._insertMarkdownAround('*', '*', '斜体文本'); break;
        case 'strike': this._insertMarkdownAround('~~', '~~', '删除线文本'); break;
        case 'inlineCode': this._insertMarkdownAround('`', '`', '代码'); break;
        case 'quote': this._insertMarkdownLine('> ', '引用内容'); break;
        case 'ul': this._insertMarkdownLine('- ', '列表项'); break;
        case 'ol': this._insertMarkdownLine('1. ', '列表项'); break;
        case 'code': this._insertMarkdownBlock('代码'); break;
        case 'hr': this._insertMarkdownLine('', '---'); break;
        case 'link': this._insertMarkdownLink(); break;
        case 'image': this._insertMarkdownImage(); break;
        case 'table': this._insertMarkdownTable(); break;
      }
    }

    _insertMarkdownAround(before, after, placeholder) {
      var ta = this._source;
      var s = ta.selectionStart, e = ta.selectionEnd;
      var v = ta.value;
      var selected = v.slice(s, e);
      var text = selected || placeholder;
      ta.value = v.slice(0, s) + before + text + after + v.slice(e);
      if (selected) {
        ta.setSelectionRange(s + before.length + text.length, s + before.length + text.length);
      } else {
        ta.setSelectionRange(s + before.length, s + before.length + placeholder.length);
      }
      this._handleSourceInput();
    }

    _insertMarkdownLine(prefix, placeholder) {
      var ta = this._source;
      var s = ta.selectionStart, e = ta.selectionEnd;
      var v = ta.value;
      var before = v.slice(0, s), after = v.slice(e);
      var needNl = before && !before.endsWith('\n') ? '\n' : '';
      var insert = needNl + prefix + placeholder;
      ta.value = before + insert + after;
      var caret = before.length + insert.length;
      ta.setSelectionRange(caret, caret);
      this._handleSourceInput();
    }

    _insertMarkdownBlock(placeholder) {
      var ta = this._source;
      var s = ta.selectionStart, e = ta.selectionEnd;
      var v = ta.value;
      var before = v.slice(0, s), after = v.slice(e);
      var needNl = before && !before.endsWith('\n') ? '\n' : '';
      var insert = needNl + '```\n' + placeholder + '\n```\n';
      ta.value = before + insert + after;
      var caret = before.length + insert.length - 5;
      ta.setSelectionRange(caret, caret);
      this._handleSourceInput();
    }

    _insertMarkdownLink() {
      var ta = this._source;
      var s = ta.selectionStart, e = ta.selectionEnd;
      var v = ta.value;
      var selected = v.slice(s, e) || '链接文本';
      var text = '[' + selected + '](https://)';
      ta.value = v.slice(0, s) + text + v.slice(e);
      var caret = s + 1 + selected.length + 2;
      ta.setSelectionRange(caret, caret + 'https://'.length);
      this._handleSourceInput();
    }

    _insertMarkdownImage() {
      var ta = this._source;
      var s = ta.selectionStart, e = ta.selectionEnd;
      var v = ta.value;
      var selected = v.slice(s, e) || '图片描述';
      var text = '![' + selected + '](https://)';
      ta.value = v.slice(0, s) + text + v.slice(e);
      var caret = s + 2 + selected.length + 2;
      ta.setSelectionRange(caret, caret + 'https://'.length);
      this._handleSourceInput();
    }

    _insertMarkdownTable() {
      var ta = this._source;
      var s = ta.selectionStart, e = ta.selectionEnd;
      var v = ta.value;
      var before = v.slice(0, s), after = v.slice(e);
      var needNl = before && !before.endsWith('\n') ? '\n' : '';
      var tpl = needNl + '| 列1 | 列2 |\n| --- | --- |\n| 内容 | 内容 |\n';
      ta.value = before + tpl + after;
      var caret = before.length + needNl.length + tpl.length;
      ta.setSelectionRange(caret, caret);
      this._handleSourceInput();
    }

    _toggleMarkdownPreview() {
      this._markdownPreview = this._markdownPreview === false ? true : false;
      this._group.dataset.markdownPreview = String(this._markdownPreview !== false);
      var btn = this.shadowRoot.querySelector('[data-md-cmd="preview"]');
      if (btn) btn.setAttribute('aria-pressed', String(this._markdownPreview !== false));
      if (this._markdownPreview !== false) this._renderMarkdownPreview();
    }

    _handleSourceInput() {
      this._lineContentVersion = (this._lineContentVersion || 0) + 1;
      this._updateLineNumbers();
      this._scheduleStatusUpdate();
      if (this._markdownMode && this._markdownPreview !== false) this._scheduleMarkdownPreview();
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }

    // 状态栏字数/行列合拍（B3-S1）：input/keyup 打字态 150ms 防抖收敛，
    // 避免每键 3 次全文扫描；click/select（光标移动）保持同步反馈。
    _scheduleStatusUpdate() {
      var self = this;
      if (this._statusDebounce) clearTimeout(this._statusDebounce);
      this._statusDebounce = setTimeout(function () {
        self._statusDebounce = 0;
        self._updateMarkdownStatus();
      }, 150);
    }

    // 行号 rAF 合批（B-M2）：同帧多次输入/resize 只测量一次；
    // 缓存 key 为内容版本号（_lineNumbersKey），滚动/焦点路径 key 未变时零测量。
    _scheduleLineNumbers() {
      if (typeof globalThis.requestAnimationFrame !== 'function') {
        this._updateLineNumbers();
        return;
      }
      if (this._lineNumberRaf) return;
      var self = this;
      this._lineNumberRaf = globalThis.requestAnimationFrame(function () {
        self._lineNumberRaf = 0;
        self._updateLineNumbers();
      });
    }

    // 内容插入后的纵深收口（B3-m2）：危险标签黑名单转码 + 新表规范化，
    // 只在插入路径（paste/插入命令/setValue/blur）执行，不挂每键 input。
    _afterContentInsert() {
      this._escapeParsedRichTextNodes();
      this._syncEditorTables();
    }

    _updateMarkdownStatus() {
      if (!this._statusInfo || !this._source) return;
      var value = this._source.value || '';
      var chars = value.replace(/\n/g, '').length;
      var pos = this._source.selectionStart || 0;
      var before = value.slice(0, pos);
      var line = before.split('\n').length;
      var col = pos - before.lastIndexOf('\n');
      this._statusInfo.textContent = chars + ' 字 | 行 ' + line + ', 列 ' + col;
    }

    _consumeScrollEcho(dir) {
      var echo = this._mdScrollEcho;
      if (echo && echo.dir === dir && Date.now() - echo.t < 120) {
        this._mdScrollEcho = null;
        return true;
      }
      return false;
    }

    _syncMarkdownPreviewScroll() {
      if (!this._markdownMode || !this._mdSyncScroll) return;
      if (!this._previewPane || this._markdownPreview === false) return;
      var ta = this._source;
      var scrollRange = ta.scrollHeight - ta.clientHeight;
      var ratio = scrollRange > 0 ? ta.scrollTop / scrollRange : 0;
      var paneRange = this._previewPane.scrollHeight - this._previewPane.clientHeight;
      this._mdScrollEcho = { dir: 'preview', t: Date.now() };
      this._previewPane.scrollTop = paneRange > 0 ? Math.round(ratio * paneRange) : 0;
    }

    _syncMarkdownSourceScroll() {
      if (!this._markdownMode || !this._mdSyncScroll) return;
      if (!this._previewPane || this._markdownPreview === false) return;
      var ta = this._source;
      var paneRange = this._previewPane.scrollHeight - this._previewPane.clientHeight;
      var ratio = paneRange > 0 ? this._previewPane.scrollTop / paneRange : 0;
      var scrollRange = ta.scrollHeight - ta.clientHeight;
      this._mdScrollEcho = { dir: 'source', t: Date.now() };
      ta.scrollTop = scrollRange > 0 ? Math.round(ratio * scrollRange) : 0;
    }

    // markdown 预览合批：150ms 防抖收敛连击，rAF 边界渲染同帧只画一次（B2-M1）。
    _scheduleMarkdownPreview() {
      if (typeof globalThis.requestAnimationFrame !== 'function') {
        this._renderMarkdownPreview();
        return;
      }
      var self = this;
      if (this._mdPreviewDebounce) clearTimeout(this._mdPreviewDebounce);
      this._mdPreviewDebounce = setTimeout(function () {
        self._mdPreviewDebounce = 0;
        if (self._mdPreviewRaf) globalThis.cancelAnimationFrame(self._mdPreviewRaf);
        self._mdPreviewRaf = globalThis.requestAnimationFrame(function () {
          self._mdPreviewRaf = 0;
          self._renderMarkdownPreview();
        });
      }, 150);
    }

    _renderMarkdownPreview() {
      if (!this._previewPane) return;
      var value = this._source.value || '';
      if (this._mdPreviewValue === value) return;
      this._mdPreviewValue = value;
      this._previewPane.innerHTML = renderMarkdownArticle(value);
      this._previewPane.setAttribute('aria-hidden', 'false');
    }

    _applyToolbarLang() {
      var lang = this._editorLang();
      var t = function (key, params) { return componentText(lang, key, params); };
      this._toolbar.querySelectorAll('.kniu_sys_editor_btn').forEach(function (btn) {
        var token = btn.dataset.cmd || btn.dataset.action || btn.dataset.block;
        if (!token || !KNIU_I18N.cn['editor.' + token]) return;
        btn.setAttribute('title', t('editor.' + token));
        btn.setAttribute('aria-label', t('editor.' + token));
        if (btn.dataset.action === 'fontname') btn.setAttribute('aria-label', t('editor.chooseFont'));
        else if (btn.dataset.action === 'fontsize') btn.setAttribute('aria-label', t('editor.chooseSize'));
        else if (btn.dataset.action === 'heading') btn.setAttribute('aria-label', t('editor.chooseHeading'));
        else if (btn.dataset.action === 'lineheight') btn.setAttribute('aria-label', t('editor.chooseLineHeight'));
        else if (btn.dataset.action === 'spacing') btn.setAttribute('aria-label', t('editor.chooseLetterSpacing'));
        else if (btn.dataset.action === 'forecolor') btn.setAttribute('aria-label', t('editor.forecolor'));
        else if (btn.dataset.action === 'hilitecolor') btn.setAttribute('aria-label', t('editor.hilitecolor'));
        else if (btn.dataset.action === 'image') btn.setAttribute('aria-label', t('editor.image'));
        else if (btn.dataset.action === 'media') btn.setAttribute('aria-label', t('editor.media'));
      });
      this._toolbar.querySelectorAll('.kniu_sys_editor_select').forEach(function (sel) {
        var token = sel.dataset.action;
        if (token && KNIU_I18N.cn['editor.' + token]) sel.setAttribute('title', t('editor.' + token));
      });
    }

    get value() {
      if (this._codeMode || this._markdownMode) return this._source.value;
      var clone = this._editor.cloneNode(true);
      clone.querySelectorAll('.kniu_sys_editor_media_selected').forEach(function (media) {
        media.classList.remove('kniu_sys_editor_media_selected');
        pruneEmptyAttribute(media, 'class');
      });
      stripEditorTableWraps(clone);
      return clone.innerHTML;
    }
    set value(v) {
      var raw = v == null ? '' : String(v);
      this._lastRawValue = raw;
      if (this._markdownMode) {
        this._source.value = raw.replace(/\r\n?/g, '\n');
        this._updateLineNumbers();
        this._scheduleSourceLineNumbers();
        this._updateMarkdownStatus();
        if (this._markdownPreview !== false) this._renderMarkdownPreview();
        return;
      }
      var self = this;
      var large = raw.length > 200000;
      if (!large) {
        var html = sanitizeRichHtml(raw);
        this._applyEditorValue(html);
        this._scheduleSourceLineNumbers();
        return;
      }
      var token = (this._pendingValueToken || 0) + 1;
      this._pendingValueToken = token;
      sanitizeRichHtmlAsync(raw).then(function (html) {
        if (self._pendingValueToken === token) {
          self._applyEditorValue(html);
          self._scheduleSourceLineNumbers();
        }
      }).catch(function () {
        if (self._pendingValueToken === token) {
          self._applyEditorValue(sanitizeRichHtml(raw));
          self._scheduleSourceLineNumbers();
        }
      });
    }
    _applyEditorValue(html) {
      this._editor.innerHTML = html;
      this._normalizeCodeBlocks();
      this._afterContentInsert();
      this._normalizeTables();
      this._lineContentVersion = (this._lineContentVersion || 0) + 1;
      if (this._source) {
        this._source.value = this._serializedHtml();
        this._updateLineNumbers();
      }
    }
    _serializedHtml() {
      var clone = this._editor.cloneNode(true);
      stripEditorTableWraps(clone);
      return clone.innerHTML;
    }
    _syncEditorTables() {
      if (!this._editor) return;
      if (!this._editor.querySelector('table:not(.' + KNIU_TABLE_CLASS + ')')) return;
      var selection = documentRef.getSelection ? documentRef.getSelection() : null;
      var anchor = selection && selection.rangeCount ? selection.getRangeAt(0).startContainer : null;
      this._normalizeTables(anchor);
    }
    _insertSafeRichText(text) {
      var html = sanitizeRichHtml(text);
      var inserted = false;
      this._editor.focus();
      if (typeof document.execCommand === 'function') {
        inserted = document.execCommand('insertHTML', false, html);
      }
      if (!inserted) {
        var selection = document.getSelection();
        if (!selection || !selection.rangeCount) return;
        var range = selection.getRangeAt(0);
        var template = document.createElement('template');
        template.innerHTML = html;
        var lastNode = template.content.lastChild;
        range.deleteContents();
        range.insertNode(template.content);
        if (lastNode) {
          range.setStartAfter(lastNode);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      // 插入路径收口（B3-m2）：危险标签转码 + 表格规范化只在此执行，不挂每键 input。
      this._afterContentInsert();
      this._lineContentVersion = (this._lineContentVersion || 0) + 1;
      this._scheduleLineNumbers();
      this._editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
    _escapeParsedRichTextNodes() {
      var nodes = this._editor.querySelectorAll('script,iframe,object,embed,link,meta,style,base,form');
      if (!nodes.length) return;
      var documentRef = this._editor.ownerDocument || document;
      Array.prototype.forEach.call(nodes, function (node) {
        var code = documentRef.createElement('code');
        code.textContent = node.outerHTML;
        node.replaceWith(code);
      });
    }
    _lineNumbersKey() {
      var sourceMode = this._codeMode || this._markdownMode;
      // 缓存 key 用内容版本号（B-M2）：不含 scrollHeight/clientHeight 强制布局读，
      // 折行/块结构变化由输入路径递增版本号驱动，滚动/焦点路径 key 未变即零测量；
      // 编辑器尺寸变化由 ResizeObserver 合批重测兜底。
      return (sourceMode ? 'src:' : 'rich:') + (this._lineContentVersion || 0);
    }
    _updateLineNumbers(force) {
      var sourceMode = this._codeMode || this._markdownMode;
      var input = sourceMode ? this._source : this._editor;
      var lines = sourceMode ? this._sourceLines : this._editorLines;
      if (!input || !lines) return;
      var key = this._lineNumbersKey();
      if (force || key !== this._lineNumberKey) {
        this._lineNumberKey = key;
        if (sourceMode) {
          lines.innerHTML = this._buildSourceLineNumbers(input);
          lines.style.removeProperty('padding-top');
        } else {
          var layout = this._buildEditorLineNumbers(input);
          lines.innerHTML = layout.html;
          if (layout.lead > 0) lines.style.paddingTop = layout.lead + 'px';
          else lines.style.removeProperty('padding-top');
        }
      }
      lines.style.transform = 'translateY(-' + input.scrollTop + 'px)';
    }
    _editorLineMetrics(input) {
      var style = globalThis.getComputedStyle ? globalThis.getComputedStyle(input) : null;
      var lineHeight = style ? parseFloat(style.lineHeight) : 0;
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
        var fontSize = style ? parseFloat(style.fontSize) : 0;
        lineHeight = (Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 12) * 1.7;
      }
      return {
        lineHeight: lineHeight,
        paddingTop: style ? parseFloat(style.paddingTop) || 0 : 0,
        paddingBottom: style ? parseFloat(style.paddingBottom) || 0 : 0,
      };
    }
    _measureEditorRows(input, lineHeight, paddingTop) {
      var doc = input.ownerDocument || document;
      var base = input.getBoundingClientRect().top - input.scrollTop + paddingTop;
      var tops = [];
      var push = function (top) {
        var y = top - base;
        if (Number.isFinite(y)) tops.push(y);
      };
      if (doc.createTreeWalker && doc.createRange) {
        var walker = doc.createTreeWalker(input, 4, null);
        var node;
        var guard = 0;
        while ((node = walker.nextNode())) {
          if (guard++ > 4000) break;
          var value = node.nodeValue;
          if (!value || !value.replace(/[\s\u00a0]+/g, '')) continue;
          var range = doc.createRange();
          range.selectNodeContents(node);
          var rects = range.getClientRects();
          for (var i = 0; i < rects.length; i++) {
            push(rects[i].top - Math.max(0, (lineHeight - rects[i].height) / 2));
          }
        }
      }
      var children = input.children || [];
      for (var c = 0; c < children.length; c++) {
        var child = children[c];
        if (String(child.textContent || '').replace(/[\s\u00a0]+/g, '')) continue;
        push(child.getBoundingClientRect().top);
      }
      tops.sort(function (a, b) { return a - b; });
      var rows = [];
      var tolerance = Math.max(2, lineHeight / 2);
      for (var t = 0; t < tops.length; t++) {
        if (!rows.length || tops[t] - rows[rows.length - 1] > tolerance) rows.push(tops[t]);
      }
      return rows;
    }
    _buildEditorLineNumbers(input) {
      var metrics = this._editorLineMetrics(input);
      var rows = this._measureEditorRows(input, metrics.lineHeight, metrics.paddingTop);
      if (!rows.length) rows.push(0);
      var contentHeight = Math.max(0, input.scrollHeight - metrics.paddingTop - metrics.paddingBottom);
      var total = Math.max(rows[rows.length - 1] + metrics.lineHeight, contentHeight);
      var visibleRows = Math.max(1, Math.ceil(Math.max(0,
        input.clientHeight - metrics.paddingTop - metrics.paddingBottom) / metrics.lineHeight));
      while (rows.length < visibleRows && rows[rows.length - 1] + metrics.lineHeight < total) {
        rows.push(rows[rows.length - 1] + metrics.lineHeight);
      }
      var html = '';
      for (var i = 0; i < rows.length; i++) {
        var next = i + 1 < rows.length ? rows[i + 1] : total;
        var height = Math.round(Math.max(1, next - rows[i]) * 100) / 100;
        html += '<span style="height:' + height + 'px">' + (i + 1) + '</span>';
      }
      return { html: html, lead: Math.max(0, rows[0]) };
    }
    _buildSourceLineNumbers(input) {
      var metrics = this._editorLineMetrics(input);
      var text = String(input.value || '').replace(/\r\n?/g, '\n');
      var logicalRows = text.length ? text.split('\n').length : 1;
      var visibleRows = Math.max(1, Math.ceil(Math.max(0, input.clientHeight - metrics.paddingTop - metrics.paddingBottom) / metrics.lineHeight));
      var contentRows = logicalRows;
      var rowHeight = metrics.lineHeight;
      if (input.scrollHeight > input.clientHeight + 1) {
        var contentHeight = Math.max(0, input.scrollHeight - metrics.paddingTop - metrics.paddingBottom);
        contentRows = Math.max(logicalRows, Math.round(contentHeight / metrics.lineHeight));
        rowHeight = contentHeight / contentRows;
      }
      var lineCount = Math.max(1, contentRows, visibleRows);
      rowHeight = Math.round(rowHeight * 1000) / 1000;
      var numbers = '';
      for (var index = 1; index <= lineCount; index++) numbers += '<span style="height:' + rowHeight + 'px">' + index + '</span>';
      return numbers;
    }
    _scheduleSourceLineNumbers() {
      var self = this;
      var update = function () { self._updateLineNumbers(); };
      if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(function () {
          update();
          globalThis.requestAnimationFrame(update);
        });
      } else {
        setTimeout(update, 0);
        setTimeout(update, 32);
      }
    }
    focus() { this._editor.focus(); }

    _handleToolbar(btn) {
      if (this._markdownMode) { this._handleMarkdownToolbar(btn); return; }
      var cmd = btn.dataset.cmd;
      var block = btn.dataset.block;
      var action = btn.dataset.action;
      if (action === 'maximize') { this._toggleMaximize(); return; }
      if (action === 'code') {
        if (this._markdownMode) return;
        this._toggleCodeMode();
        return;
      }
      if (action === 'inlineCode') {
        if (this._markdownMode || this._codeMode) return;
        this._toggleInlineCode();
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this._syncToolbarState();
        return;
      }
      if (action === 'print') { this._print(); return; }
      if (action === 'table' || action === 'emoticons' || action === 'link' || action === 'image' || action === 'media' || action === 'fontname' || action === 'fontsize' || action === 'forecolor' || action === 'hilitecolor' || action === 'heading' || action === 'lineheight' || action === 'spacing') { this._togglePopover(action, btn); return; }
      if (cmd && this._selectedMedia && /^justify(?:Left|Center|Right|Full)$/.test(cmd)) {
        this._alignSelectedMedia(cmd);
        return;
      }
      this._editor.focus();
      if (cmd === 'selectAll') { this._toggleSelectAll(); this._syncToolbarState(); return; }
      if (cmd) {
        documentRef.execCommand(cmd, false, null);
        if (cmd === 'bold') this._normalizeBold();
      } else if (block) {
        if (block === 'pre') { this._togglePre(); }
        else { this._formatBlockSafe(block); }
      } else if (action === 'hr') {
        documentRef.execCommand('insertHorizontalRule', false, null);
      } else if (action === 'unlink') {
        documentRef.execCommand('unlink', false, null);
      } else if (action === 'clearhtml') {
        this._clearHtml();
        return;
      }
      this._editor.focus();
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      this._syncToolbarState();
    }

    _normalizeBold() {
      var self = this;
      var selection = documentRef.getSelection();
      var range = null;
      if (selection && selection.rangeCount && this._editor.contains(selection.anchorNode)) {
        range = selection.getRangeAt(0);
      }
      var bolds = Array.prototype.slice.call(this._editor.querySelectorAll('b'));
      bolds.forEach(function (node) {
        var strong = self._editor.ownerDocument.createElement('strong');
        while (node.firstChild) strong.appendChild(node.firstChild);
        var attributes = node.attributes;
        for (var i = 0; i < attributes.length; i++) strong.setAttribute(attributes[i].name, attributes[i].value);
        node.parentNode.replaceChild(strong, node);
      });
      if (range) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    _alignSelectedMedia(command) {
      var media = this._selectedMedia;
      if (!media || !this._editor.contains(media)) return;
      media.style.display = 'block';
      media.style.marginTop = '.5em';
      media.style.marginBottom = '.5em';
      if (command === 'justifyCenter') {
        media.style.marginLeft = 'auto';
        media.style.marginRight = 'auto';
      } else if (command === 'justifyRight') {
        media.style.marginLeft = 'auto';
        media.style.marginRight = '0';
      } else if (command === 'justifyFull') {
        media.style.marginLeft = '0';
        media.style.marginRight = '0';
        media.style.width = '100%';
      } else {
        media.style.marginLeft = '0';
        media.style.marginRight = 'auto';
      }
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      this._syncToolbarState();
    }

    _applySelect(sel) {
      var action = sel.dataset.action;
      if (!sel.value && action !== 'fontname') return;
      this._editor.focus();
      if (action === 'fontname') {
        if (sel.value) {
          documentRef.execCommand('fontName', false, sel.value);
        } else {
          this._clearFontName();
        }
        var opt = sel.options[sel.selectedIndex];
        sel.style.fontFamily = opt ? opt.style.fontFamily : '';
      } else if (action === 'fontsize') {
        documentRef.execCommand('fontSize', false, sel.value);
      }
      this._syncToolbarState();
    }

    _clearFontName() {
      var editor = this._editor;
      var walker = documentRef.createTreeWalker(editor, NodeFilter.SHOW_ELEMENT, {
        acceptNode: function (n) {
          if (n.tagName === 'FONT' && n.hasAttribute('face')) return NodeFilter.FILTER_ACCEPT;
          if (n.style && n.style.fontFamily) return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_SKIP;
        }
      });
      var targets = [];
      var node;
      while ((node = walker.nextNode())) targets.push(node);
      for (var i = 0; i < targets.length; i++) {
        var el = targets[i];
        if (el.tagName === 'FONT') {
          var p = el.parentNode;
          while (el.firstChild) p.insertBefore(el.firstChild, el);
          p.removeChild(el);
        } else {
          el.style.removeProperty('font-family');
        }
      }
    }

    _applyColor(inp) {
      var action = inp.dataset.action;
      this._editor.focus();
      if (action === 'forecolor') {
        documentRef.execCommand('foreColor', false, inp.value);
      } else if (action === 'hilitecolor') {
        try { documentRef.execCommand('hiliteColor', false, inp.value); }
        catch (e) { documentRef.execCommand('backColor', false, inp.value); }
      }
    }

    _toggleMaximize() {
      if (!this._maximized) {
        this._maxPrevParent = this.parentNode;
        this._maxPrevNext = this.nextSibling;
        documentRef.body.appendChild(this);
        this._maximized = true;
        this.setAttribute('data-maximized', 'true');
      } else {
        if (this._maxPrevParent) {
          if (this._maxPrevNext && this._maxPrevNext.parentNode === this._maxPrevParent) {
            this._maxPrevParent.insertBefore(this, this._maxPrevNext);
          } else {
            this._maxPrevParent.appendChild(this);
          }
        }
        this._maximized = false;
        this.removeAttribute('data-maximized');
      }
      this._syncMaximizeIcon();
      // 最大化让位全屏（清 inline maxHeight），还原时恢复动态上限。
      this._applyMaxHeight();
      if (!this._codeMode) this._editor.focus(); else this._source.focus();
    }

    _syncMaximizeIcon() {
      var btns = this.shadowRoot.querySelectorAll('[data-action="maximize"], [data-md-cmd="maximize"]');
      Array.prototype.forEach.call(btns, function (btn) {
        btn.setAttribute('aria-pressed', String(this._maximized));
        btn.innerHTML = this._maximized ? EDITOR_ICON_RESTORE : EDITOR_ICON_MAXIMIZE;
      }, this);
    }

    _toggleCodeMode() {
      if (this._popover) this._closePopover();
      this._selectMedia(null);
      this._codeMode = !this._codeMode;
      if (this._codeMode) {
        this._source.value = this._beautifyHtml(this._serializedHtml());
        this._updateLineNumbers();
        this._scheduleSourceLineNumbers();
        this._group.dataset.codeMode = 'true';
        this._source.focus();
      } else {
        this._editor.innerHTML = sanitizeRichHtml(this._source.value);
        this._normalizeCodeBlocks();
        this._normalizeTables();
        this._group.dataset.codeMode = 'false';
        this._editor.focus();
      }
      var codeBtn = this.shadowRoot.querySelector('[data-action="code"]');
      if (codeBtn) codeBtn.setAttribute('aria-pressed', String(this._codeMode));
      this._sync();
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }

    get type() { return this._markdownMode ? 'markdown' : 'rich'; }
    set type(value) { this.setType(value); }
    setType(value) {
      var markdown = String(value || '').toLowerCase() === 'markdown';
      if (markdown === this._markdownMode) { this._buildToolbar(); this._sync(); return; }
      if (markdown) {
        this._source.value = this._codeMode ? this._source.value : (this._lastRawValue || this._editor.innerText);
        this._codeMode = true;
      } else {
        if (this._popover) this._closePopover(true);
        this._editor.innerHTML = sanitizeRichHtml(this._source.value);
        this._normalizeCodeBlocks();
        this._normalizeTables();
        this._codeMode = false;
      }
      this._markdownMode = markdown;
      this._group.dataset.markdownMode = String(markdown);
      this._updateLineNumbers();
      this._scheduleSourceLineNumbers();
      this._buildToolbar();
      this._sync();
      if (markdown) {
        this._updateMarkdownStatus();
        if (this._markdownPreview === false) {
          this._group.dataset.markdownPreview = 'false';
        } else {
          this._group.dataset.markdownPreview = 'true';
          this._renderMarkdownPreview();
        }
        this._source.focus();
      }
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }

    _beautifyHtml(html) {
      if (!html) return html;
      var source = String(html);
      if (!/<[a-zA-Z!\/]/.test(source)) {
        return source.replace(/\r\n?/g, '\n');
      }
      var BLOCK = 'p|div|h1|h2|h3|h4|h5|h6|ul|ol|li|dl|dt|dd|table|thead|tbody|tfoot|tr|td|th|blockquote|pre|hr|figure|figcaption|section|article|header|footer|aside|nav|main|form|fieldset|details|summary|address';
      var blockRe = new RegExp('^<\\s*/?\\s*(' + BLOCK + ')\\b', 'i');
      var voidRe = /^<\s*(?:br|hr|img|input|area|base|col|embed|source|track|wbr)\b/i;
      var parts = source.split(/(<[^>]+>)/);
      var out = [];
      var depth = 0;
      var stack = [];
      var brPending = false;
      var afterBr = false;
      function pad() {
        var s = '';
        for (var i = 0; i < depth; i++) s += '  ';
        return s;
      }
      function lastStartsWithNewline() {
        var last = out.length ? out[out.length - 1] : '';
        return typeof last === 'string' ? last.charAt(0) === '\n' : false;
      }
      for (var i = 0; i < parts.length; i++) {
        var t = parts[i];
        if (t === '') continue;
        if (t.charAt(0) !== '<') {
          if (brPending) { brPending = false; out.push('\n' + pad()); afterBr = true; }
          var chunk = afterBr ? t.replace(/^\s+/, '') : t;
          afterBr = false;
          if (chunk === '') continue;
          var txt = chunk.replace(/\s+/g, ' ');
          if (txt === ' ') {
            var prevPart = i > 0 ? parts[i - 1] : '';
            var nextPart = i + 1 < parts.length ? parts[i + 1] : '';
            if (blockRe.test(prevPart) || blockRe.test(nextPart)) continue;
          }
          out.push(txt);
          continue;
        }
        var isClose = /^<\s*\//.test(t);
        var m = t.match(/^<\s*\/?\s*([a-zA-Z0-9-]+)/);
        var name = m ? m[1].toLowerCase() : '';
        var isBlock = blockRe.test(t);
        var isVoid = voidRe.test(t);
        if (brPending) {
          brPending = false;
          if (!(isClose && isBlock)) { out.push('\n' + pad()); afterBr = true; }
        }
        if (!isClose && name === 'br') {
          out.push(t);
          brPending = true;
          continue;
        }
        afterBr = false;
        if (!isClose && name === 'pre' && !/\/>$/.test(t)) {
          if (stack.length) stack[stack.length - 1].inline = false;
          out.push('\n' + pad() + t);
          depth++;
          stack.push({ inline: false });
          var raw = [];
          var closed = false;
          for (var j = i + 1; j < parts.length; j++) {
            raw.push(parts[j]);
            if (/^<\s*\/\s*pre\s*>$/i.test(parts[j])) { closed = true; i = j; break; }
          }
          out.push(raw.join(''));
          if (closed) { depth--; stack.pop(); }
          continue;
        }
        if (isClose) {
          var frame = isBlock && !isVoid ? stack.pop() : null;
          if (isBlock && !isVoid && depth > 0) depth--;
          if (isBlock) {
            if (frame && frame.inline && !lastStartsWithNewline()) out.push(t);
            else out.push('\n' + pad() + t);
          } else {
            out.push(t);
          }
        } else {
          if (isBlock) {
            if (stack.length) stack[stack.length - 1].inline = false;
            out.push('\n' + pad() + t);
            if (!isVoid && !/\/>$/.test(t)) { depth++; stack.push({ inline: true }); }
          } else {
            out.push(t);
          }
        }
      }
      return out.join('').replace(/^\s+/, '');
    }

    _print() {
      try {
        var w = documentRef.defaultView.open('', '_blank');
        if (!w) return;
        w.document.write('<html><head><meta charset="utf-8"><title>打印</title><style>' + KNIU_EDITOR_PRINT_CSS + '</style></head><body>' + this._editor.innerHTML + '</body></html>');
        w.document.close();
        w.focus();
        w.print();
      } catch (e) { }
    }

    _isAllSelected() {
      var sel = documentRef.getSelection();
      if (!sel || sel.rangeCount === 0) return false;
      var range = sel.getRangeAt(0);
      if (range.collapsed) return false;
      var full = documentRef.createRange();
      full.selectNodeContents(this._editor);
      return range.compareBoundaryPoints(0, full) === 0 && range.compareBoundaryPoints(2, full) === 0;
    }

    _toggleSelectAll() {
      var sel = documentRef.getSelection();
      if (this._isAllSelected()) {
        sel.removeAllRanges();
        var r = documentRef.createRange();
        r.selectNodeContents(this._editor);
        r.collapse(false);
        sel.addRange(r);
      } else {
        sel.removeAllRanges();
        var rAll = documentRef.createRange();
        rAll.selectNodeContents(this._editor);
        sel.addRange(rAll);
      }
    }

    _currentBlockTag() {
      try {
        var sel = documentRef.getSelection();
        if (!sel || sel.rangeCount === 0) return '';
        var node = sel.anchorNode;
        if (!node) return '';
        if (node.nodeType === 3) node = node.parentNode;
        var blockTags = { pre: 1, p: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, blockquote: 1, div: 1, li: 1, dd: 1, dt: 1, address: 1, article: 1, section: 1, aside: 1, figure: 1, figcaption: 1 };
        while (node && node !== this._editor) {
          var tag = (node.tagName || '').toLowerCase();
          if (blockTags[tag]) return tag;
          node = node.parentNode;
        }
        return 'p';
      }
      catch (e) { return ''; }
    }

    _togglePre() {
      if (this._currentBlockTag() === 'pre') {
        var current = this._currentBlockElement();
        if (current) this._unwrapCodeBlock(current);
        this._formatBlockSafe('p');
        return;
      }
      this._formatBlockSafe('pre');
      this._normalizeCodeBlocks();
    }

    _toggleInlineCode() {
      var selection = documentRef.getSelection();
      if (!selection || !selection.rangeCount || selection.getRangeAt(0).collapsed) return;
      var range = selection.getRangeAt(0);
      var node = range.commonAncestorContainer;
      if (node && node.nodeType === 3) node = node.parentNode;
      var existing = node && node.closest ? node.closest('code') : null;
      if (existing && this._editor.contains(existing) && !existing.parentNode.closest('pre')) {
        while (existing.firstChild) existing.parentNode.insertBefore(existing.firstChild, existing);
        existing.remove();
        return;
      }
      this._wrapSelectedTextInCodeBlock();
    }

    _wrapSelectedTextInCodeBlock() {
      var selection = documentRef.getSelection();
      if (!selection || !selection.rangeCount) return false;
      var range = selection.getRangeAt(0);
      if (range.collapsed) return false;
      var editor = this._editor;
      var findRootBlock = function (node) {
        if (node && node.nodeType === 3) node = node.parentNode;
        while (node && node !== editor && node.parentNode !== editor) node = node.parentNode;
        return node && node !== editor && node.parentNode === editor ? node : null;
      };
      var block = findRootBlock(range.startContainer);
      if (!block || block !== findRootBlock(range.endContainer)) return false;

      var code = documentRef.createElement('code');
      code.appendChild(range.extractContents());
      range.insertNode(code);

      var codeRange = documentRef.createRange();
      codeRange.selectNodeContents(code);
      selection.removeAllRanges();
      selection.addRange(codeRange);
      return true;
    }

    _currentBlockElement() {
      try {
        var sel = documentRef.getSelection();
        if (!sel || sel.rangeCount === 0) return null;
        var node = sel.anchorNode;
        if (node && node.nodeType === 3) node = node.parentNode;
        while (node && node !== this._editor) {
          if ((node.tagName || '').toLowerCase() === 'pre') return node;
          node = node.parentNode;
        }
      } catch (e) { }
      return null;
    }

    _normalizeCodeBlocks() {
      var editor = this._editor;
      editor.querySelectorAll('pre').forEach(function (pre) {
        var first = pre.firstElementChild;
        if (first && first.tagName.toLowerCase() === 'code' && first === pre.lastElementChild) return;
        var code = documentRef.createElement('code');
        while (pre.firstChild) code.appendChild(pre.firstChild);
        pre.appendChild(code);
      });
    }

    _normalizeTables(skipNode) {
      if (!this._editor) return;
      wrapEditorTables(this._editor, skipNode || null);
    }

    _unwrapCodeBlock(pre) {
      var code = pre && pre.firstElementChild;
      if (!code || code.tagName.toLowerCase() !== 'code' || code !== pre.lastElementChild) return;
      while (code.firstChild) pre.insertBefore(code.firstChild, code);
      code.remove();
    }

    _formatBlockSafe(tag) {
      var sel = documentRef.getSelection();
      var oldBlock = null;
      if (sel && sel.rangeCount) {
        var node = sel.anchorNode;
        if (node && node.nodeType === 3) node = node.parentNode;
        while (node && node.parentNode && node.parentNode !== this._editor) node = node.parentNode;
        if (node && node !== this._editor && node.parentNode === this._editor) oldBlock = node;
      }
      var index = oldBlock ? Array.prototype.indexOf.call(this._editor.children, oldBlock) : -1;
      var startOffset = -1, endOffset = -1;
      if (oldBlock && sel && sel.rangeCount) {
        var r = documentRef.createRange();
        r.selectNodeContents(oldBlock);
        try {
          var cur = sel.getRangeAt(0);
          r.setEnd(cur.startContainer, cur.startOffset);
          startOffset = r.toString().length;
          r.setEnd(cur.endContainer, cur.endOffset);
          endOffset = r.toString().length;
        } catch (e) { startOffset = endOffset = -1; }
      }
      documentRef.execCommand('formatBlock', false, tag);
      var anchor = sel && sel.anchorNode;
      while (anchor) {
        if (anchor === this._editor) return;
        anchor = anchor.parentNode;
      }
      var newBlock = (index >= 0 && this._editor.children[index]) || this._editor.firstElementChild;
      if (!newBlock) return;
      var range = documentRef.createRange();
      if (startOffset >= 0) {
        var probe = documentRef.createRange();
        probe.selectNodeContents(newBlock);
        var max = probe.toString().length;
        var s = Math.min(startOffset, max);
        var e = Math.min(Math.max(endOffset, startOffset), max);
        var sp = this._locateByCharOffset(newBlock, s);
        var ep = this._locateByCharOffset(newBlock, e);
        range.setStart(sp[0], sp[1]);
        range.setEnd(ep[0], ep[1]);
      } else {
        range.selectNodeContents(newBlock);
        range.collapse(false);
      }
      sel.removeAllRanges();
      sel.addRange(range);
    }

    _locateByCharOffset(scope, charOffset) {
      var walker = documentRef.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      var remaining = charOffset;
      var textNode;
      while ((textNode = walker.nextNode())) {
        var len = textNode.nodeValue.length;
        if (remaining <= len) return [textNode, remaining];
        remaining -= len;
      }
      var last = scope;
      while (last.lastChild) last = last.lastChild;
      return [last, last.nodeType === 3 ? last.nodeValue.length : last.childNodes.length];
    }

    _clearHtml() {
      var tmp = documentRef.createElement('div');
      tmp.innerHTML = this._editor.innerHTML;
      var text = (tmp.innerText || '').replace(/\u00A0/g, ' ');
      var paras = text.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
      this._editor.innerHTML = paras.length ? '<p>' + paras.join('</p><p>') + '</p>' : '';
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      this._syncToolbarState();
    }

    _togglePopover(action, btn) {
      if (this._popoverAction === action && !this._popover.hidden) { this._closePopover(); return; }
      if (!this._popover.hidden) this._closePopover(true);
      this._popoverAction = action;
      if (action === 'link' || action === 'image' || action === 'media' || action === 'fontname' || action === 'fontsize' || action === 'forecolor' || action === 'hilitecolor' || action === 'heading' || action === 'lineheight' || action === 'spacing') {
        var selection = (this.shadowRoot.getSelection && this.shadowRoot.getSelection()) || documentRef.getSelection();
        var savedRange = selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
        if (action === 'link') this._linkRange = savedRange;
        else if (action === 'image' || action === 'media') this._resourceRange = savedRange;
        else if (action === 'fontname') this._fontRange = savedRange;
        else if (action === 'fontsize') this._fontSizeRange = savedRange;
        else if (action === 'heading') this._headingRange = savedRange;
        else if (action === 'lineheight') this._lineHeightRange = savedRange;
        else if (action === 'spacing') this._letterSpacingRange = savedRange;
        else if (action === 'forecolor' || action === 'hilitecolor') { this._colorRange = savedRange; this._colorAction = action; }
      }
      this._popover.innerHTML = action === 'table' ? this._tablePopoverHTML()
        : action === 'link' ? this._linkPopoverHTML()
          : action === 'image' ? this._imagePopoverHTML()
            : action === 'media' ? this._mediaPopoverHTML()
              : action === 'fontname' ? this._fontPopoverHTML()
                : action === 'fontsize' ? this._fontSizePopoverHTML()
                  : action === 'heading' ? this._headingPopoverHTML()
                    : action === 'md-heading' ? this._markdownHeadingPopoverHTML()
                      : action === 'lineheight' ? this._lineHeightPopoverHTML()
                        : action === 'spacing' ? this._letterSpacingPopoverHTML()
                          : action === 'forecolor' || action === 'hilitecolor' ? this._colorPopoverHTML()
                            : this._emojiPopoverHTML();
      this._popover.classList.toggle('kniu_sys_editor_popover_link', action === 'link' || action === 'image' || action === 'media');
      this._popover.hidden = false;
      this._positionPopover(btn);
      if (action === 'link') {
        var urlInput = this._popover.querySelector('.kniu_sys_editor_pop_link_url');
        if (urlInput) setTimeout(function () { urlInput.focus(); urlInput.select(); }, 0);
      }
      var self = this;
      setTimeout(function () {
        var handler = function (e) {
          if (self._popover.contains(e.target)) return;
          if (btn.contains(e.target)) return;
          self._closePopover();
          self.shadowRoot.removeEventListener('pointerdown', handler, true);
        };
        self.shadowRoot.addEventListener('pointerdown', handler, true);
      }, 0);
    }

    _closePopover(immediate) {
      if (!immediate && !this._popover.hidden && this._popover.classList.contains('kniu_sys_editor_popover_media_edit')) {
        if (this._popover.classList.contains('kniu_sys_editor_popover_closing')) return;
        this._popover.classList.add('kniu_sys_editor_popover_closing');
        var self = this;
        this._popoverCloseTimer = setTimeout(function () { self._finishClosePopover(); }, 180);
        return;
      }
      this._finishClosePopover();
    }

    _finishClosePopover() {
      if (this._popoverCloseTimer) clearTimeout(this._popoverCloseTimer);
      this._popoverCloseTimer = null;
      this._popover.hidden = true;
      this._popover.innerHTML = '';
      this._popover.classList.remove('kniu_sys_editor_popover_link');
      this._popover.classList.remove('kniu_sys_editor_popover_media_edit');
      this._popover.classList.remove('kniu_sys_editor_popover_closing');
      this._popoverAction = null;
      this._linkRange = null;
      this._fontRange = null;
      this._fontSizeRange = null;
      this._headingRange = null;
      this._lineHeightRange = null;
      this._letterSpacingRange = null;
      this._colorRange = null;
      this._colorAction = null;
      this._resourceRange = null;
      this._editingMedia = null;
    }

    _positionPopover(btn) {
      var main = this.shadowRoot.querySelector('.kniu_sys_editor_main');
      if (!btn || !this._popover || !main) return;
      var mainRect = main.getBoundingClientRect();
      if (this._popoverAction === 'link' || this._popoverAction === 'image' || this._popoverAction === 'media' || this._popoverAction === 'media-size') {
        this._popover.style.top = '50%';
        this._popover.style.left = '50%';
        this._popover.style.transform = 'translate(-50%, -50%)';
        this._popover.style.maxHeight = 'calc(100% - 32px)';
        return;
      }
      var btnRect = btn.getBoundingClientRect();
      var top = btnRect.bottom - mainRect.top + 4;
      var left = btnRect.left - mainRect.left;
      var availableHeight = Math.max(80, mainRect.height - top - 8);
      this._popover.style.transform = 'none';
      this._popover.style.top = top + 'px';
      this._popover.style.maxHeight = availableHeight + 'px';
      var popoverWidth = this._popover.offsetWidth;
      left = Math.max(8, Math.min(left, mainRect.width - popoverWidth - 8));
      this._popover.style.left = left + 'px';
    }

    _tablePopoverHTML() {
      var t = this._editorT();
      return '<div class="kniu_sys_editor_popover_row"><label>' + t('editor.tableRows') + '</label><input type="number" class="kniu_sys_editor_pop_rows" min="1" max="20" value="3"></div>' +
        '<div class="kniu_sys_editor_popover_row"><label>' + t('editor.tableCols') + '</label><input type="number" class="kniu_sys_editor_pop_cols" min="1" max="20" value="3"></div>' +
        '<div class="kniu_sys_editor_popover_row"><button type="button" class="kniu_sys_editor_popover_btn" data-confirm="table">' + t('editor.insertTable') + '</button></div>';
    }

    _emojiPopoverHTML() {
      return '<div class="kniu_sys_editor_popover_grid">' + EMOJIS.map(function (e) {
        return '<button type="button" class="kniu_sys_editor_emoji" data-emoji="' + e + '">' + e + '</button>';
      }).join('') + '</div>';
    }

    _linkPopoverHTML() {
      var t = this._editorT();
      var selectedText = this._linkRange ? this._linkRange.toString() : '';
      return '<div class="kniu_sys_editor_popover_title">' + t('editor.insertLink') + '</div>' +
        '<div class="kniu_sys_editor_popover_row"><label>' + t('editor.linkUrl') + '</label><input type="url" class="kniu_sys_editor_pop_link_url" value="https://" autocomplete="off" placeholder="https://example.com"></div>' +
        (selectedText ? '' : '<div class="kniu_sys_editor_popover_row"><label>' + t('editor.linkText') + '</label><input type="text" class="kniu_sys_editor_pop_link_text" value="' + t('editor.link') + '" autocomplete="off" placeholder="' + t('editor.enterLinkText') + '"></div>') +
        '<div class="kniu_sys_editor_popover_error" role="alert"></div>' +
        '<div class="kniu_sys_editor_popover_actions"><button type="button" class="kniu_sys_editor_popover_cancel" data-cancel="popover">' + t('common.cancel') + '</button><button type="button" class="kniu_sys_editor_popover_btn" data-confirm="link">' + t('common.ok') + '</button></div>';
    }

    _imagePopoverHTML() {
      var t = this._editorT();
      return '<div class="kniu_sys_editor_popover_title">' + t('editor.insertImage') + '</div>' +
        '<div class="kniu_sys_editor_popover_row"><label>' + t('common.sourceType') + '</label><select class="kniu_sys_editor_pop_image_source"><option value="cloud">' + t('common.cloud') + '</option><option value="local">' + t('common.localUpload') + '</option></select></div>' +
        '<div class="kniu_sys_editor_popover_row kniu_sys_editor_pop_cloud_row"><label>' + t('editor.imageUrl') + '</label><input type="url" class="kniu_sys_editor_pop_image_url" autocomplete="off" placeholder="https://example.com/image.jpg"></div>' +
        '<div class="kniu_sys_editor_popover_row kniu_sys_editor_pop_local_row" hidden><label>' + t('editor.localImage') + '</label><input type="file" class="kniu_sys_editor_pop_image_file" accept="image/jpeg,image/png,image/gif,image/webp"></div>' +
        '<div class="kniu_sys_editor_popover_row"><label>' + t('common.mediaName') + '</label><input type="text" class="kniu_sys_editor_pop_image_name" autocomplete="off" placeholder="' + t('editor.enterMediaName') + '"></div>' +
        '<div class="kniu_sys_editor_popover_error" role="alert"></div>' +
        '<div class="kniu_sys_editor_popover_actions"><button type="button" class="kniu_sys_editor_popover_cancel" data-cancel="popover">' + t('common.cancel') + '</button><button type="button" class="kniu_sys_editor_popover_btn" data-confirm="image">' + t('common.ok') + '</button></div>';
    }

    _mediaPopoverHTML() {
      var t = this._editorT();
      return '<div class="kniu_sys_editor_popover_title">' + t('editor.insertMedia') + '</div>' +
        '<div class="kniu_sys_editor_popover_row"><label>' + t('editor.mediaType') + '</label><select class="kniu_sys_editor_pop_media_type"><option value="video">' + t('editor.video') + '</option><option value="audio">' + t('editor.audio') + '</option></select></div>' +
        '<div class="kniu_sys_editor_popover_row"><label>' + t('common.sourceType') + '</label><select class="kniu_sys_editor_pop_media_source"><option value="cloud">' + t('common.cloud') + '</option><option value="local">' + t('common.localUpload') + '</option></select></div>' +
        '<div class="kniu_sys_editor_popover_row kniu_sys_editor_pop_cloud_row"><label>' + t('common.mediaUrl') + '</label><input type="url" class="kniu_sys_editor_pop_media_url" autocomplete="off" placeholder="https://example.com/media.mp4"></div>' +
        '<div class="kniu_sys_editor_popover_row kniu_sys_editor_pop_local_row" hidden><label>' + t('common.localFile') + '</label><input type="file" class="kniu_sys_editor_pop_media_file" accept="video/mp4,video/webm,video/ogg,video/quicktime"></div>' +
        '<div class="kniu_sys_editor_popover_row"><label>' + t('common.mediaName') + '</label><input type="text" class="kniu_sys_editor_pop_media_name" autocomplete="off" placeholder="' + t('editor.enterMediaName') + '"></div>' +
        '<div class="kniu_sys_editor_popover_error" role="alert"></div>' +
        '<div class="kniu_sys_editor_popover_actions"><button type="button" class="kniu_sys_editor_popover_cancel" data-cancel="popover">' + t('common.cancel') + '</button><button type="button" class="kniu_sys_editor_popover_btn" data-confirm="media">' + t('common.ok') + '</button></div>';
    }

    _openMediaSizeDialog(media) {
      this._closePopover(true);
      this._editingMedia = media;
      this._selectMedia(media);
      this._popoverAction = 'media-size';
      var t = this._editorT();
      var label = this._editorMediaLabel(media.tagName);
      var editKey = media.tagName === 'IMG' ? 'editor.editImage' : media.tagName === 'AUDIO' ? 'editor.editAudio' : 'editor.editVideo';
      var rect = media.getBoundingClientRect();
      var width = parseFloat(media.style.width) || Math.round(rect.width) || '';
      var height = parseFloat(media.style.height) || Math.round(rect.height) || '';
      var source = this._escapeEditorAttribute(media.getAttribute('src') || '');
      var name = this._escapeEditorAttribute(media.getAttribute('data-media-name') || '');
      var accept = media.tagName === 'IMG' ? 'image/jpeg,image/png,image/gif,image/webp'
        : media.tagName === 'AUDIO' ? 'audio/mpeg,audio/ogg,audio/wav,audio/mp4'
          : 'video/mp4,video/webm,video/ogg,video/quicktime';
      this._popover.innerHTML = '<div class="kniu_sys_editor_popover_title">' + t(editKey) + '</div>' +
        '<div class="kniu_sys_editor_popover_row"><label>' + t('common.sourceType') + '</label><select class="kniu_sys_editor_pop_edit_source"><option value="cloud">' + t('common.cloud') + '</option><option value="local">' + t('common.localUpload') + '</option></select></div>' +
        '<div class="kniu_sys_editor_popover_row kniu_sys_editor_pop_cloud_row"><label>' + t('common.mediaUrl') + '</label><input type="url" class="kniu_sys_editor_pop_edit_url" value="' + source + '" autocomplete="off" placeholder="' + t('editor.enterMediaUrl') + '"></div>' +
        '<div class="kniu_sys_editor_popover_row kniu_sys_editor_pop_local_row" hidden><label>' + t('common.localFile') + '</label><input type="file" class="kniu_sys_editor_pop_edit_file" accept="' + accept + '"></div>' +
        '<div class="kniu_sys_editor_popover_row"><label>' + t('common.mediaName') + '</label><input type="text" class="kniu_sys_editor_pop_edit_name" value="' + name + '" autocomplete="off" placeholder="' + t('editor.enterMediaName') + '"></div>' +
        '<div class="kniu_sys_editor_popover_row"><label>' + t('common.width') + '</label><input type="number" class="kniu_sys_editor_pop_media_width" min="1" max="5000" value="' + width + '" placeholder="' + t('common.auto') + '"><span>px</span></div>' +
        '<div class="kniu_sys_editor_popover_row"><label>' + t('common.height') + '</label><input type="number" class="kniu_sys_editor_pop_media_height" min="1" max="5000" value="' + height + '" placeholder="' + t('common.auto') + '"><span>px</span></div>' +
        '<div class="kniu_sys_editor_popover_row"><label>' + t('common.scale') + '</label><input type="checkbox" class="kniu_sys_editor_pop_media_ratio_lock" checked><span>' + t('common.lockRatio') + '</span></div>' +
        '<div class="kniu_sys_editor_popover_error" role="alert"></div>' +
        '<div class="kniu_sys_editor_popover_actions"><button type="button" class="kniu_sys_editor_popover_delete" data-delete="media">' + t('common.delete') + ' ' + label + '</button><button type="button" class="kniu_sys_editor_popover_cancel" data-cancel="popover">' + t('common.cancel') + '</button><button type="button" class="kniu_sys_editor_popover_btn" data-confirm="media-size">' + t('common.ok') + '</button></div>';
      this._popover.classList.add('kniu_sys_editor_popover_link');
      this._popover.classList.add('kniu_sys_editor_popover_media_edit');
      this._popover.hidden = false;
      this._positionPopover(media);
      var widthInput = this._popover.querySelector('.kniu_sys_editor_pop_media_width');
      this._mediaAspectRatio = rect.width && rect.height ? rect.width / rect.height : 1;
      if (widthInput) { widthInput.focus(); widthInput.select(); }
    }

    _escapeEditorAttribute(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    _selectMedia(media) {
      if (this._selectedMedia && this._selectedMedia !== media) {
        this._selectedMedia.classList.remove('kniu_sys_editor_media_selected');
      }
      this._selectedMedia = media || null;
      if (this._selectedMedia) this._selectedMedia.classList.add('kniu_sys_editor_media_selected');
    }

    _showMediaDeleteConfirm() {
      if (!this._editingMedia) return;
      var t = this._editorT();
      var label = this._editorMediaLabel(this._editingMedia.tagName);
      var deleteKey = this._editingMedia.tagName === 'IMG' ? 'editor.deleteImage' : this._editingMedia.tagName === 'AUDIO' ? 'editor.deleteAudio' : 'editor.deleteVideo';
      this._popover.innerHTML = '<div class="kniu_sys_editor_popover_title">' + t(deleteKey) + '</div>' +
        '<div class="kniu_sys_editor_delete_tip">' + t('editor.deleteConfirm', { '1': label }) + '</div>' +
        '<div class="kniu_sys_editor_popover_actions"><button type="button" class="kniu_sys_editor_popover_cancel" data-back="media-edit">' + t('common.back') + '</button><button type="button" class="kniu_sys_editor_popover_btn" data-confirm="delete-media">' + t('editor.deleteMediaBtn') + '</button></div>';
    }

    _deleteEditingMedia() {
      var media = this._editingMedia;
      if (!media) { this._closePopover(); return; }
      this._selectMedia(null);
      media.remove();
      this._closePopover();
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }

    _syncMediaAspect(changedInput) {
      if (this._syncingMediaAspect) return;
      var lock = this._popover.querySelector('.kniu_sys_editor_pop_media_ratio_lock');
      if (!lock || !lock.checked || !this._mediaAspectRatio) return;
      var widthInput = this._popover.querySelector('.kniu_sys_editor_pop_media_width');
      var heightInput = this._popover.querySelector('.kniu_sys_editor_pop_media_height');
      if (!widthInput || !heightInput) return;
      this._syncingMediaAspect = true;
      if (changedInput === widthInput && Number(widthInput.value) > 0) {
        heightInput.value = Math.max(1, Math.round(Number(widthInput.value) / this._mediaAspectRatio));
      } else if (changedInput === heightInput && Number(heightInput.value) > 0) {
        widthInput.value = Math.max(1, Math.round(Number(heightInput.value) * this._mediaAspectRatio));
      }
      this._syncingMediaAspect = false;
    }

    async _confirmMediaSize() {
      var media = this._editingMedia;
      if (!media) { this._closePopover(); return; }
      var sourceInput = this._popover.querySelector('.kniu_sys_editor_pop_edit_source');
      var urlInput = this._popover.querySelector('.kniu_sys_editor_pop_edit_url');
      var fileInput = this._popover.querySelector('.kniu_sys_editor_pop_edit_file');
      var nameInput = this._popover.querySelector('.kniu_sys_editor_pop_edit_name');
      var widthInput = this._popover.querySelector('.kniu_sys_editor_pop_media_width');
      var heightInput = this._popover.querySelector('.kniu_sys_editor_pop_media_height');
      var error = this._popover.querySelector('.kniu_sys_editor_popover_error');
      var width = widthInput && widthInput.value !== '' ? Number(widthInput.value) : 0;
      var height = heightInput && heightInput.value !== '' ? Number(heightInput.value) : 0;
      if ((width && (width < 1 || width > 5000)) || (height && (height < 1 || height > 5000))) {
        if (error) error.textContent = this._editorT()('editor.widthHeightRange');
        return;
      }
      var isLocal = sourceInput && sourceInput.value === 'local';
      var source = isLocal
        ? await this._uploadEditorMedia(fileInput && fileInput.files ? fileInput.files[0] : null, error)
        : (urlInput ? urlInput.value.trim() : '');
      if (!source) return;
      if (!isLocal && !this._validResourceUrl(source)) {
        if (error) error.textContent = this._editorT()('editor.enterMediaUrlSafe');
        if (urlInput) urlInput.focus();
        return;
      }
      media.src = source;
      var mediaName = nameInput ? nameInput.value.trim() : '';
      if (mediaName) media.setAttribute('data-media-name', mediaName);
      else media.removeAttribute('data-media-name');
      if (width) media.style.width = Math.round(width) + 'px';
      else media.style.removeProperty('width');
      if (height) media.style.height = Math.round(height) + 'px';
      else media.style.removeProperty('height');
      this._closePopover();
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }

    _validResourceUrl(url) {
      return Boolean(url) && !isDangerousUrl(url);
    }

    _syncMediaSourceFields() {
      var source = this._popover.querySelector('.kniu_sys_editor_pop_image_source,.kniu_sys_editor_pop_media_source,.kniu_sys_editor_pop_edit_source');
      if (!source) return;
      var isLocal = source.value === 'local';
      var cloudRow = this._popover.querySelector('.kniu_sys_editor_pop_cloud_row');
      var localRow = this._popover.querySelector('.kniu_sys_editor_pop_local_row');
      if (cloudRow) cloudRow.hidden = isLocal;
      if (localRow) localRow.hidden = !isLocal;
      var mediaType = this._popover.querySelector('.kniu_sys_editor_pop_media_type');
      var mediaFile = this._popover.querySelector('.kniu_sys_editor_pop_media_file');
      if (mediaType && mediaFile) {
        mediaFile.accept = mediaType.value === 'audio'
          ? 'audio/mpeg,audio/ogg,audio/wav,audio/mp4'
          : 'video/mp4,video/webm,video/ogg,video/quicktime';
        mediaFile.value = '';
      }
    }

    _fillMediaNameFromFile(fileInput) {
      var file = fileInput && fileInput.files ? fileInput.files[0] : null;
      if (!file) return;
      var nameInput = this._popover.querySelector('.kniu_sys_editor_pop_image_name,.kniu_sys_editor_pop_media_name,.kniu_sys_editor_pop_edit_name');
      if (nameInput) nameInput.value = file.name;
    }

    async _uploadEditorMedia(file, error) {
      if (!file) {
        if (error) error.textContent = this._editorT()('common.chooseLocalFile');
        return '';
      }
      const maxSize = file.type.startsWith('image/') ? this.__kniuOptions?.imgMaxSize
        : file.type.startsWith('video/') ? this.__kniuOptions?.videoMaxSize
          : file.type.startsWith('audio/') ? this.__kniuOptions?.audioMaxSize : null;
      if (Number.isFinite(Number(maxSize)) && Number(maxSize) > 0 && file.size > Number(maxSize)) {
        if (error) error.textContent = `文件大小不能超过 ${Math.round(Number(maxSize) / 1024 / 1024)}MB`;
        return '';
      }
      var form = new FormData();
      form.append('file', file);
      try {
        var result = await REQUEST({
          url: '/article_media_upload',
          type: 'POST',
          data: form
        });
        if (Number(result.status) !== 1 || !result.data || !result.data.url) {
          if (error) error.textContent = result.msg || this._editorT()('editor.mediaUploadFail');
          return '';
        }
        return result.data.url;
      } catch (e) {
        if (error) error.textContent = this._editorT()('editor.mediaUploadRetry');
        return '';
      }
    }

    _insertResourceNode(node) {
      var selection = (this.shadowRoot.getSelection && this.shadowRoot.getSelection()) || documentRef.getSelection();
      this._editor.focus();
      if (selection && this._resourceRange) {
        selection.removeAllRanges();
        selection.addRange(this._resourceRange);
        this._resourceRange.deleteContents();
        this._resourceRange.insertNode(node);
        this._resourceRange.setStartAfter(node);
        this._resourceRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(this._resourceRange);
      } else {
        this._editor.appendChild(node);
      }
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      this._syncToolbarState();
      this._closePopover();
    }

    async _confirmImage() {
      var sourceInput = this._popover.querySelector('.kniu_sys_editor_pop_image_source');
      var urlInput = this._popover.querySelector('.kniu_sys_editor_pop_image_url');
      var fileInput = this._popover.querySelector('.kniu_sys_editor_pop_image_file');
      var nameInput = this._popover.querySelector('.kniu_sys_editor_pop_image_name');
      var error = this._popover.querySelector('.kniu_sys_editor_popover_error');
      var isLocal = sourceInput && sourceInput.value === 'local';
      var localFile = fileInput && fileInput.files ? fileInput.files[0] : null;
      var url = isLocal
        ? await this._uploadEditorMedia(localFile, error)
        : (urlInput ? urlInput.value.trim() : '');
      if (!url) return;
      if (!isLocal && !this._validResourceUrl(url)) {
        if (error) error.textContent = this._editorT()('editor.enterImageUrl');
        if (urlInput) urlInput.focus();
        return;
      }
      var img = documentRef.createElement('img');
      img.src = url;
      var imageName = (nameInput ? nameInput.value.trim() : '') || (localFile ? localFile.name : this._mediaNameFromUrl(url));
      if (imageName) img.setAttribute('data-media-name', imageName);
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      this._insertResourceNode(img);
    }

    async _confirmMedia() {
      var typeInput = this._popover.querySelector('.kniu_sys_editor_pop_media_type');
      var sourceInput = this._popover.querySelector('.kniu_sys_editor_pop_media_source');
      var urlInput = this._popover.querySelector('.kniu_sys_editor_pop_media_url');
      var fileInput = this._popover.querySelector('.kniu_sys_editor_pop_media_file');
      var nameInput = this._popover.querySelector('.kniu_sys_editor_pop_media_name');
      var error = this._popover.querySelector('.kniu_sys_editor_popover_error');
      var type = typeInput && typeInput.value === 'audio' ? 'audio' : 'video';
      var isLocal = sourceInput && sourceInput.value === 'local';
      var localFile = fileInput && fileInput.files ? fileInput.files[0] : null;
      var url = isLocal
        ? await this._uploadEditorMedia(localFile, error)
        : (urlInput ? urlInput.value.trim() : '');
      if (!url) return;
      if (!isLocal && !this._validResourceUrl(url)) {
        if (error) error.textContent = this._editorT()('editor.enterMediaUrlSafe');
        if (urlInput) urlInput.focus();
        return;
      }
      var media = documentRef.createElement(type);
      media.src = url;
      media.controls = true;
      media.preload = 'metadata';
      var mediaName = (nameInput ? nameInput.value.trim() : '') || (localFile ? localFile.name : this._mediaNameFromUrl(url));
      if (mediaName) media.setAttribute('data-media-name', mediaName);
      if (type === 'video') media.style.maxWidth = '100%';
      this._insertResourceNode(media);
    }

    _mediaNameFromUrl(url) {
      try {
        var pathname = new URL(url, documentRef.baseURI).pathname;
        return decodeURIComponent(pathname.split('/').pop() || '');
      } catch (e) { return ''; }
    }

    _fontPopoverHTML() {
      var fonts = [
        ['KniuSans_Regular', 'KniuSans', 'KniuSans_Regular'],
        ['KniuHei_Regular', 'KniuHei', 'KniuHei_Regular']
      ];
      return '<div class="kniu_sys_editor_font_list" role="menu">' + fonts.map(function (font) {
        return '<button type="button" class="kniu_sys_editor_font_item kniu_sys_dropdown_option" role="menuitemradio" aria-checked="' + (font[0] ? 'false' : 'true') + '" data-font="' + font[0] + '" style="font-family:\'' + font[2] + '\'">' + font[1] + '</button>';
      }).join('') + '</div>';
    }

    _applyFont(font) {
      var selection = documentRef.getSelection();
      if (selection && this._fontRange) {
        selection.removeAllRanges();
        selection.addRange(this._fontRange);
      }
      this._editor.focus();
      if (font) documentRef.execCommand('fontName', false, font);
      else this._clearFontName();
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      this._syncToolbarState();
      this._closePopover();
    }

    _fontSizePopoverHTML() {
      var sizes = [['1', '12px'], ['2', '14px'], ['3', '16px'], ['4', '18px'], ['5', '22px'], ['6', '26px'], ['7', '32px']];
      return '<div class="kniu_sys_editor_size_list" role="menu">' + sizes.map(function (size) {
        return '<button type="button" class="kniu_sys_editor_size_item kniu_sys_dropdown_option" role="menuitem" data-font-size="' + size[0] + '" style="font-size:' + size[1] + '">' + size[1] + '</button>';
      }).join('') + '</div>';
    }

    _applyFontSize(size) {
      var selection = documentRef.getSelection();
      if (selection && this._fontSizeRange) {
        selection.removeAllRanges();
        selection.addRange(this._fontSizeRange);
      }
      this._editor.focus();
      documentRef.execCommand('fontSize', false, size || '3');
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      this._syncToolbarState();
      this._closePopover();
    }

    _headingPopoverHTML() {
      var headings = [['h1', 'H1'], ['h2', 'H2'], ['h3', 'H3'], ['h4', 'H4'], ['h5', 'H5'], ['h6', 'H6']];
      return '<div class="kniu_sys_editor_font_list" role="menu">' + headings.map(function (h) {
        return '<button type="button" class="kniu_sys_editor_font_item kniu_sys_dropdown_option" role="menuitemradio" aria-checked="false" data-heading="' + h[0] + '">' + h[1] + '</button>';
      }).join('') + '</div>';
    }

    _applyHeading(tag) {
      var selection = documentRef.getSelection();
      if (selection && this._headingRange) {
        selection.removeAllRanges();
        selection.addRange(this._headingRange);
      }
      this._editor.focus();
      this._formatBlockSafe(tag);
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      this._syncToolbarState();
      this._closePopover();
    }

    _lineHeightPopoverHTML() {
      var values = [['1', '1.0'], ['1.5', '1.5'], ['1.75', '1.75'], ['2', '2.0'], ['2.5', '2.5'], ['3', '3.0']];
      return '<div class="kniu_sys_editor_font_list" role="menu">' + values.map(function (v) {
        return '<button type="button" class="kniu_sys_editor_font_item kniu_sys_dropdown_option" role="menuitemradio" aria-checked="false" data-line-height="' + v[0] + '">' + v[1] + '</button>';
      }).join('') + '</div>';
    }

    _lineHeightBlocks(range) {
      var blocks = [];
      if (!range || !range.intersectsNode) return blocks;
      var candidates = this._editor.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre,dd,dt');
      for (var i = 0; i < candidates.length; i++) {
        var el = candidates[i];
        if (range.intersectsNode(el)) blocks.push(el);
      }
      return blocks.filter(function (el) {
        return !blocks.some(function (other) { return other !== el && el.contains(other); });
      });
    }

    _applyLineHeight(value) {
      var selection = (this.shadowRoot.getSelection && this.shadowRoot.getSelection()) || documentRef.getSelection();
      if (selection && this._lineHeightRange) {
        selection.removeAllRanges();
        selection.addRange(this._lineHeightRange);
      }
      this._editor.focus();
      var range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
      var blocks = this._lineHeightBlocks(range);
      if (blocks.length) {
        blocks.forEach(function (b) { b.style.lineHeight = value; });
      } else {
        this._editor.style.lineHeight = value;
      }
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      this._syncToolbarState();
      this._closePopover();
    }

    _letterSpacingPopoverHTML() {
      var values = [['0', '正常'], ['1', '1px'], ['2', '2px'], ['3', '3px'], ['5', '5px'], ['8', '8px']];
      return '<div class="kniu_sys_editor_font_list" role="menu">' + values.map(function (v) {
        return '<button type="button" class="kniu_sys_editor_font_item kniu_sys_dropdown_option" role="menuitemradio" aria-checked="false" data-letter-spacing="' + v[0] + '">' + v[1] + '</button>';
      }).join('') + '</div>';
    }

    _applyLetterSpacing(value) {
      var spacingCss = value === '0' ? 'normal' : value + 'px';
      var selection = (this.shadowRoot.getSelection && this.shadowRoot.getSelection()) || documentRef.getSelection();
      if (selection && this._letterSpacingRange) {
        selection.removeAllRanges();
        selection.addRange(this._letterSpacingRange);
      }
      this._editor.focus();
      var range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
      if (range && !range.collapsed) {
        var span = documentRef.createElement('span');
        span.style.letterSpacing = spacingCss;
        try {
          var frag = range.extractContents();
          span.appendChild(frag);
          range.insertNode(span);
          selection.removeAllRanges();
          var wrapRange = documentRef.createRange();
          wrapRange.selectNodeContents(span);
          selection.addRange(wrapRange);
        } catch (e) { }
      } else {
        this._editor.style.letterSpacing = spacingCss;
      }
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      this._syncToolbarState();
      this._closePopover();
    }

    _colorPopoverHTML() {
      var colors = [
        '#f5222d', '#fa541c', '#fa8c16', '#fadb14', '#ffe58f', '#fff000',
        '#52c41a', '#13c2c2', '#08979c', '#389e0d', '#b7eb8f', '#00e5ff',
        '#2f80ed', '#003eb3', '#531dab', '#722ed1', '#c41dff', '#eb2fdb',
        '#ffffff', '#e5e5e5', '#bfbfbf', '#8c8c8c', '#595959', '#262626', '#000000'
      ];
      return '<div class="kniu_sys_editor_palette"><button type="button" class="kniu_sys_editor_no_color" data-editor-color="">无颜色</button>' +
        '<div class="kniu_sys_editor_swatch_grid">' + colors.map(function (color) {
          return '<button type="button" class="kniu_sys_editor_swatch" data-editor-color="' + color + '" title="' + color + '" aria-label="' + color + '" style="background-color:' + color + '"></button>';
        }).join('') + '</div></div>';
    }

    _applyEditorColor(color) {
      var action = this._colorAction || 'forecolor';
      var selection = (this.shadowRoot.getSelection && this.shadowRoot.getSelection()) || documentRef.getSelection();
      this._editor.focus();
      if (selection && this._colorRange) {
        selection.removeAllRanges();
        selection.addRange(this._colorRange);
      }
      var appliedColor = color || (action === 'hilitecolor' ? 'transparent' : '#303133');
      var range = selection && selection.rangeCount ? selection.getRangeAt(0) : this._colorRange;
      if (!color && range && !range.collapsed) {
        this._removeSelectedColor(range, action);
      } else if (range && !range.collapsed) {
        var span = documentRef.createElement('span');
        if (action === 'hilitecolor') span.style.backgroundColor = appliedColor;
        else span.style.color = appliedColor;
        try {
          span.appendChild(range.extractContents());
          range.insertNode(span);
          selection.removeAllRanges();
          var appliedRange = documentRef.createRange();
          appliedRange.selectNodeContents(span);
          selection.addRange(appliedRange);
        } catch (e) {
          var fallbackCommand = action === 'hilitecolor' ? 'backColor' : 'foreColor';
          documentRef.execCommand(fallbackCommand, false, appliedColor);
        }
      } else {
        var command = action === 'hilitecolor' ? 'backColor' : 'foreColor';
        documentRef.execCommand(command, false, appliedColor);
      }
      var toolbarBtn = this._toolbar.querySelector('[data-action="' + action + '"]');
      if (toolbarBtn) {
        var mark = toolbarBtn.querySelector('.kniu_sys_editor_color_mark');
        var letter = toolbarBtn.querySelector('.kniu_sys_editor_color_letter_bg');
        if (mark) mark.style.backgroundColor = color || 'var(--kniu-color-primary, #409eff)';
        if (letter) letter.style.backgroundColor = color || '#ffd900';
      }
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      this._syncToolbarState();
      this._closePopover();
    }

    _removeSelectedColor(range, action) {
      var property = action === 'hilitecolor' ? 'background-color' : 'color';
      var editor = this._editor;
      function coloredAncestor(source) {
        var element = source && source.nodeType === 3 ? source.parentNode : source;
        while (element && element !== editor) {
          if (element.nodeType === 1 && element.style && element.style.getPropertyValue(property)) return element;
          element = element.parentNode;
        }
        return null;
      }
      function cleanColor(scope) {
        if (scope.nodeType === 1 && scope.style) {
          scope.style.removeProperty(property);
          pruneEmptyAttribute(scope, 'style');
        }
        var elements = Array.from(scope.querySelectorAll ? scope.querySelectorAll('*') : []);
        elements.forEach(function (element) {
          element.style.removeProperty(property);
          pruneEmptyAttribute(element, 'style');
        });
        elements.reverse().forEach(function (element) {
          if (element.tagName === 'SPAN' && element.attributes.length === 0 && element.parentNode) {
            while (element.firstChild) element.parentNode.insertBefore(element.firstChild, element);
            element.remove();
          }
        });
      }
      var startColor = coloredAncestor(range.startContainer);
      var endColor = coloredAncestor(range.endContainer);
      if (startColor && startColor === endColor && startColor.parentNode) {
        var beforeRange = documentRef.createRange();
        beforeRange.selectNodeContents(startColor);
        beforeRange.setEnd(range.startContainer, range.startOffset);
        var before = beforeRange.cloneContents();
        var selected = range.cloneContents();
        var afterRange = documentRef.createRange();
        afterRange.selectNodeContents(startColor);
        afterRange.setStart(range.endContainer, range.endOffset);
        var after = afterRange.cloneContents();
        cleanColor(selected);

        var replacement = documentRef.createDocumentFragment();
        if (before.hasChildNodes()) {
          var beforeWrap = startColor.cloneNode(false);
          beforeWrap.appendChild(before);
          replacement.appendChild(beforeWrap);
        }
        var marker = documentRef.createElement('span');
        marker.setAttribute('data-kniu-color-clear', '');
        var selectedWrap = startColor.cloneNode(false);
        selectedWrap.style.removeProperty(property);
        pruneEmptyAttribute(selectedWrap, 'style');
        selectedWrap.appendChild(selected);
        if (selectedWrap.tagName === 'SPAN' && selectedWrap.attributes.length === 0) {
          while (selectedWrap.firstChild) marker.appendChild(selectedWrap.firstChild);
        } else {
          marker.appendChild(selectedWrap);
        }
        replacement.appendChild(marker);
        if (after.hasChildNodes()) {
          var afterWrap = startColor.cloneNode(false);
          afterWrap.appendChild(after);
          replacement.appendChild(afterWrap);
        }
        startColor.parentNode.replaceChild(replacement, startColor);

        var first = marker.firstChild;
        var last = marker.lastChild;
        var parent = marker.parentNode;
        while (marker.firstChild) parent.insertBefore(marker.firstChild, marker);
        marker.remove();
        if (first && last) {
          var selection = (this.shadowRoot.getSelection && this.shadowRoot.getSelection()) || documentRef.getSelection();
          var restored = documentRef.createRange();
          restored.setStartBefore(first);
          restored.setEndAfter(last);
          selection.removeAllRanges();
          selection.addRange(restored);
        }
        return;
      }

      var fragment = range.cloneContents();
      cleanColor(fragment);
      range.deleteContents();
      range.insertNode(fragment);
    }

    _confirmLink() {
      var urlInput = this._popover.querySelector('.kniu_sys_editor_pop_link_url');
      var textInput = this._popover.querySelector('.kniu_sys_editor_pop_link_text');
      var error = this._popover.querySelector('.kniu_sys_editor_popover_error');
      var url = urlInput ? urlInput.value.trim() : '';
      if (!url || isDangerousUrl(url)) {
        if (error) error.textContent = !url ? this._editorT()('editor.enterLinkUrl') : this._editorT()('editor.enterLinkUrlSafe');
        if (urlInput) urlInput.focus();
        return;
      }
      var selection = documentRef.getSelection();
      if (selection && this._linkRange) {
        selection.removeAllRanges();
        selection.addRange(this._linkRange);
      }
      this._editor.focus();
      if (this._linkRange && this._linkRange.toString()) {
        documentRef.execCommand('createLink', false, url);
      } else {
        var a = documentRef.createElement('a');
        a.href = url;
        a.textContent = textInput && textInput.value.trim() ? textInput.value.trim() : '链接';
        documentRef.execCommand('insertHTML', false, a.outerHTML);
      }
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      this._syncToolbarState();
      this._closePopover();
    }

    _insertTable(rows, cols) {
      rows = Math.max(1, Math.min(20, parseInt(rows, 10) || 3));
      cols = Math.max(1, Math.min(20, parseInt(cols, 10) || 3));
      var html = '<div class="' + KNIU_TABLE_WRAP_CLASS + '"><table class="' + KNIU_TABLE_CLASS + '" style="border-collapse:collapse;width:100%;margin:.5em 0"><tbody>';
      for (var r = 0; r < rows; r++) {
        html += '<tr>';
        for (var c = 0; c < cols; c++) html += '<td style="border:1px solid #dcdfe6;padding:6px 10px;min-width:48px;height:22px"></td>';
        html += '</tr>';
      }
      html += '</tbody></table></div><p><br></p>';
      this._editor.focus();
      documentRef.execCommand('insertHTML', false, html);
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      this._syncToolbarState();
    }

    _insertEmoji(ch) {
      this._editor.focus();
      documentRef.execCommand('insertText', false, ch);
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }

    // 工具栏按钮引用惰性缓存（B2-S1）：断连（工具栏重建）后自动重查，
    // 常态下 _syncToolbarState 的十余次 querySelector 降为 Map 读取。
    _toolbarBtn(selector) {
      if (!this.__btnCache) this.__btnCache = new Map();
      var btn = this.__btnCache.get(selector);
      if (btn && btn.isConnected) return btn;
      btn = this.shadowRoot.querySelector(selector);
      this.__btnCache.set(selector, btn);
      return btn;
    }

    _syncToolbarState() {
      if (this._codeMode) return;
      var cmds = ['bold', 'italic', 'underline', 'strikeThrough', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull', 'subscript', 'superscript'];
      for (var i = 0; i < cmds.length; i++) {
        var btn = this._toolbarBtn('[data-cmd="' + cmds[i] + '"]');
        if (btn) {
          try { btn.setAttribute('aria-pressed', String(documentRef.queryCommandState(cmds[i]))); }
          catch (e) { btn.setAttribute('aria-pressed', 'false'); }
        }
      }
      var allBtn = this._toolbarBtn('[data-cmd="selectAll"]');
      if (allBtn) allBtn.setAttribute('aria-pressed', String(this._isAllSelected()));
      var preBtn = this._toolbarBtn('[data-block="pre"]');
      if (preBtn) preBtn.setAttribute('aria-pressed', String(this._currentBlockTag() === 'pre'));
      var headingBtn = this._toolbarBtn('[data-action="heading"]');
      if (headingBtn) headingBtn.setAttribute('aria-pressed', String(/^h[1-6]$/.test(this._currentBlockTag())));
      var lhBtn = this._toolbarBtn('[data-action="lineheight"]');
      if (lhBtn) {
        var lhPressed = false;
        try {
          var sel = documentRef.getSelection();
          if (sel && sel.rangeCount && this._editor.contains(sel.anchorNode)) {
            var lhNode = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
            while (lhNode && lhNode !== this._editor && lhNode.nodeType !== 1) lhNode = lhNode.parentNode;
            if (lhNode && lhNode.nodeType === 1) {
              var lhStyle = getComputedStyle(lhNode);
              var ratio = parseFloat(lhStyle.lineHeight) / parseFloat(lhStyle.fontSize);
              lhPressed = ['1', '1.5', '1.75', '2', '2.5', '3'].some(function (v) {
                return Math.abs(ratio - parseFloat(v)) < 0.02;
              });
            }
          }
        } catch (e) { lhPressed = false; }
        lhBtn.setAttribute('aria-pressed', String(lhPressed));
      }
      var spBtn = this._toolbarBtn('[data-action="spacing"]');
      if (spBtn) {
        var spPressed = false;
        try {
          var spSel = documentRef.getSelection();
          if (spSel && spSel.rangeCount && this._editor.contains(spSel.anchorNode)) {
            var spNode = spSel.anchorNode.nodeType === 3 ? spSel.anchorNode.parentNode : spSel.anchorNode;
            while (spNode && spNode !== this._editor && spNode.nodeType !== 1) spNode = spNode.parentNode;
            if (spNode && spNode.nodeType === 1) {
              var ls = getComputedStyle(spNode).letterSpacing;
              spPressed = ls !== 'normal' && ['1', '2', '3', '5', '8'].some(function (v) {
                return Math.abs(parseFloat(ls) - parseFloat(v)) < 0.3;
              });
            }
          }
        } catch (e) { spPressed = false; }
        spBtn.setAttribute('aria-pressed', String(spPressed));
      }
    }

    _mountAffixes() {
      var self = this;
      var applyPrependStyles = function () {
        var prependContent = self.querySelector('[slot="prepend"]');
        self._group.dataset.hasPrepend = String(Boolean(prependContent));
        if (prependContent) {
          var affix = self.shadowRoot.querySelector('.kniu_sys_editor_prepend');
          var lw = prependContent.dataset.labelWidth || '';
          if (lw && CSS.supports('width', lw)) {
            affix.style.width = lw;
            affix.style.flexBasis = lw;
          } else {
            affix.style.removeProperty('width');
            affix.style.removeProperty('flex-basis');
          }
        }
      };
      var template = Array.from(this.children).find(function (child) {
        return child.tagName === 'TEMPLATE' && child.hasAttribute('#prepend');
      });
      if (template) {
        deferAffixTemplateMount(template, function () {
          var content = documentRef.createElement('span');
          content.slot = 'prepend';
          var labelWidth = template.getAttribute('label-width')
            || (template.__kniuOptionsValue && template.__kniuOptionsValue.labelWidth)
            || '';
          if (labelWidth) content.dataset.labelWidth = labelWidth;
          if (template.__kniuOptionsValue) content.__kniuOptionsValue = template.__kniuOptionsValue;
          content.append(template.content.cloneNode(true));
          template.replaceWith(content);
        }, applyPrependStyles);
      }
      applyPrependStyles();
    }

    _sync() {
      var toolbarConfig = this._resolveToolbarConfig();
      var toolbarKey = JSON.stringify(toolbarConfig) + '|md:' + (this._markdownMode ? 1 : 0);
      if (this.__kniuLastToolbar !== toolbarKey) {
        this.__kniuLastToolbar = toolbarKey;
        if (this._toolbar) this._buildToolbar(toolbarConfig);
      }
      var lang = this._editorLang();
      if (this.__kniuLastLang !== lang) {
        this.__kniuLastLang = lang;
        if (this._toolbar) {
          this._buildToolbar(this._resolveToolbarConfig());
        }
      }
      var placeholder = this.getAttribute('placeholder');
      this._editor.dataset.placeholder = placeholder || '';
      var ro = this.hasAttribute('readonly') || this.hasAttribute('disabled');
      this._editor.contentEditable = ro ? 'false' : 'true';
      if (this._source) this._source.disabled = ro;
      if (this._statusSync) this._statusSync.disabled = ro; var ctrls = this.shadowRoot.querySelectorAll('.kniu_sys_editor_btn, .kniu_sys_editor_select, .kniu_sys_editor_color');
      for (var i = 0; i < ctrls.length; i++) {
        var c = ctrls[i];
        var isCodeToggle = c.dataset.action === 'code';
        var isCodeAction = c.dataset.action === 'code';
        var isMax = c.dataset.action === 'maximize';
        c.disabled = ro
          || (this._markdownMode && isCodeAction)
          || (this._codeMode && !this._markdownMode && !isCodeToggle && !isMax);
      }
      this._applyMaxHeight();
    }

    _editorLang() {
      return componentLang(this.__kniuOptions);
    }

    _editorT() {
      var lang = this._editorLang();
      return function (key, params) { return componentText(lang, key, params); };
    }

    _editorMediaLabel(tagName) {
      var key = tagName === 'IMG' ? 'editor.image' : tagName === 'AUDIO' ? 'editor.audio' : 'editor.video';
      return componentText(this._editorLang(), key);
    }
  }

  customElements.define('kniu-editor', KniuSysEditor);
}