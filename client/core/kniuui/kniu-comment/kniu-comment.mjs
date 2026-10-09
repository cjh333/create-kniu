export function registerComment(context) {
  const { BOOLEAN_ATTRIBUTES, IDENTITY, KNIU_BACKTOP_CSS, KNIU_BADGE_CSS, KNIU_BASE_CONTAIN_CSS, KNIU_BASE_FONT_CSS, KNIU_BTN_CSS, KNIU_BTN_GROUP_CSS, KNIU_BTN_METRICS_CSS, KNIU_BTN_OVERRIDES_CSS, KNIU_COMMENT_CSS, KNIU_CONTAIN_EXCLUDE_TAGS, KNIU_CONTENT_TABLE_CSS, KNIU_CONTENT_TABLE_DOC_CSS, KNIU_DATE_PICKER_CSS, KNIU_DATE_PICKER_OVERRIDES_CSS, KNIU_DROPDOWN_CSS, KNIU_DROPDOWN_OPTION_CSS, KNIU_EDITOR_CSS, KNIU_EDITOR_OVERRIDE_CSS, KNIU_EDITOR_PRINT_CSS, KNIU_EMPTY_CSS, KNIU_FONT_FACE_CSS, KNIU_FONT_FAMILY, KNIU_FONT_MONO_FAMILY, KNIU_FONT_SERIF_FAMILY, KNIU_I18N, KNIU_ICON_CSS, KNIU_ICON_FONT_NAMES, KNIU_ICON_NAMES, KNIU_ICON_SVG, KNIU_IMAGE_CSS, KNIU_IMAGE_OVERRIDES_CSS, KNIU_INPUT_AFFIX_CSS, KNIU_INPUT_CSS, KNIU_INPUT_GROUP_CSS, KNIU_INPUT_METRICS_CSS, KNIU_INPUT_PASSWORD_ACTIONS_CSS, KNIU_INPUT_PASSWORD_CSS, KNIU_INPUT_STATES_CSS, KNIU_INPUT_TEXTAREA_CSS, KNIU_INPUT_TIP_CSS, KNIU_LIKE_CSS, KNIU_LOADING_CSS, KNIU_MARKDOWN_CSS, KNIU_MODAL_CONFIRM_CSS, KNIU_MODAL_CSS, KNIU_MSG_CSS, KNIU_NAVBAR_CELLS_CSS, KNIU_NAVBAR_CELL_CSS, KNIU_NAVBAR_CSS, KNIU_NAVBAR_PLACEHOLDER_CSS, KNIU_PAGE_CSS, KNIU_RADIO_GROUP_CSS, KNIU_RICHTEXT_CSS, KNIU_SELECT_CSS, KNIU_STATUS_CSS, KNIU_SUB_NAVBAR_CSS, KNIU_SUB_NAVBAR_OVERRIDES_CSS, KNIU_SWITCH_CSS, KNIU_TABLE_CLASS, KNIU_TABLE_COL_CSS, KNIU_TABLE_CSS, KNIU_TABLE_WRAP_CLASS, KNIU_TAB_CSS, KNIU_TAG_CSS, KNIU_UPLOAD_CSS, KNIU_USER_LOGIN_CSS, KNIU_USER_LOGIN_OVERRIDES_CSS, PRUNABLE_ATTRIBUTE_NAMES, REQUEST, RICH_TEXT_LITERAL_TAG_RE, SCROLL_LOCK_FLAG, SEMANTIC_EMPTY_ATTRIBUTES, SHADOW_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_CACHE_LIMIT, TABLE_TEMPLATE_RE, TEMPLATE, adoptDropdownStyle, adoptSharedStyle, adoptedSheetsFlushScheduled, appendRawStyle, applyScrollLock, attachComponentShadow, buildIconElement, buildPageList, compileTableRowTemplate, componentDefaults, componentLang, componentText, computePopoverLayout, confirm, createRowDeleteHandler, createSearchActions, createTable, debounce, flushPendingAdoptedSheets, getResponseRecords, getShadowInnerHTMLDescriptor, getSharedStyleSheet, hasRichTextLiteralTag, installMarkdownStyles, installOptionsOnlyProtocol, installRichTextStyles, isEmptyAttributeValue, lockDocumentScroll, makeSwitchOptions, mountAffixSlots, mountPopoverPortal, msg, normalizeComponentCss, normalizedCssCache, pendingAdoptedSheets, pruneEmptyAttribute, pruneEmptyAttributeTree, pruneEmptyAttributes, pruneEmptyRootAttributes, readScrollLockOriginals, reconcileDocumentScrollLock, releaseScrollLock, replaceChildrenWithFragment, resolveIconName, resolveTableRowTemplate, sanitizeRichHtml, sanitizeRichHtmlAsync, scheduleAdoptedSheetsFlush, scrollLockNodes, scrollLockOriginals, scrollLockOwners, setLoading, shadowInnerHTMLDescriptor, shadowStyleSheetCache, shadowTemplateCache, shouldContainHost, state, supportsAdoptedStyleSheets, tableTemplateCache, toastInstance, toastTimer, trackPopoverPosition, unlockDocumentScroll, unwrapTablesIn, use, useListPage, usePagination, wrapTablesIn, writeScrollLockOriginals } = context;
  if (typeof customElements === 'undefined' || customElements.get('kniu-comment')) return;
  const documentRef = typeof document !== 'undefined' ? document : null;
  if (!documentRef) return;

  const COMMENT_DEFAULT_EMOJIS = ['😀', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😍', '😘', '😎', '🤔', '🤨', '😐', '😴', '😭', '😡', '👍', '👎', '👌', '✌️', '🤝', '👏', '💪', '🙏', '👀', '💡', '🔥', '⭐', '✨', '🎉', '❤️', '💔', '💯', '✅', '❌', '⚠️', '❓', '❗', '💬', '📌', '📝'];

  function commentEscape(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  class KniuSysComment extends HTMLElement {
    constructor() {
      super();
      attachComponentShadow(this);
      this._options = {};
      this._showEmoji = false;
      this._replyId = null;
      this._replyName = '';
      this._closeEmojiHandler = null;
      this._playedLikeFeedback = new Map();
    }
    connectedCallback() { this._render(); }
    attributeChangedCallback() { }
    set options(value) {
      this._options = value && typeof value === 'object' ? value : {};
      this._render();
    }
    get options() { return this._options; }
    _render() {
      const options = this._options || {};
      const lang = componentLang(options);
      const t = (k, p) => componentText(lang, k, p);
      const list = Array.isArray(options.list) ? options.list : [];
      const placeholder = options.placeholder || 'Please enter a comment...';
      const submitText = options.submitText || t('comment.title');
      const emojis = Array.isArray(options.emojis) ? options.emojis : COMMENT_DEFAULT_EMOJIS;
      const emptyText = options.emptyText || t('comment.empty');
      const currentUser = options.currentUser || null;
      const currentUserId = Math.max(0, Number.parseInt(options.currentUserId, 10) || 0);
      const maxLength = Math.max(0, Number.parseInt(options.maxLength, 10) || 0);
      const canSubmit = options.canSubmit !== false;
      const htmlParts = ['<style>' + KNIU_COMMENT_CSS + '</style><div class="kniu_sys_comment">'];
      if (canSubmit) {
        htmlParts.push('<div class="kniu_sys_comment_input_area">');
        if (this._replyId) {
          htmlParts.push('<div class="kniu_sys_comment_reply_hint">' + t('comment.replyTo') + commentEscape(this._replyName) + '...<button type="button" data-action="cancel-reply" title="' + t('comment.cancelReply') + '">×</button></div>');
        }
        htmlParts.push('<div class="kniu_sys_comment_textarea_wrap">');
        htmlParts.push('<textarea class="kniu_sys_comment_textarea" placeholder="' + commentEscape(placeholder) + '"></textarea>');
        if (maxLength) htmlParts.push('<span class="kniu_sys_comment_count">0/' + maxLength + '</span>');
        htmlParts.push('</div>');
        htmlParts.push('<div class="kniu_sys_comment_toolbar">');
        htmlParts.push('<button type="button" class="kniu_sys_comment_emoji_btn" title="' + t('comment.emoji') + '">😊</button>');
        htmlParts.push('<button type="button" class="kniu_sys_comment_submit" disabled>' + commentEscape(submitText) + '</button>');
        htmlParts.push('</div>');
        htmlParts.push('<div class="kniu_sys_comment_emoji_panel kniu_sys_dropdown_panel' + (this._showEmoji ? '' : ' kniu_sys_comment_hidden') + '">');
        emojis.forEach(function (emoji) {
          htmlParts.push('<button type="button" class="kniu_sys_comment_emoji_item">' + emoji + '</button>');
        });
        htmlParts.push('</div>');
        htmlParts.push('</div>');
      }
      htmlParts.push('<div class="kniu_sys_comment_list">');
      if (list.length === 0) {
        htmlParts.push('<div class="kniu_sys_comment_empty">' + commentEscape(emptyText) + '</div>');
      } else {
        const itemsById = new Map();
        list.forEach(function (item) {
          itemsById.set(Number(item.id), item);
        });
        const rootIdFor = function (item) {
          let parentId = Number(item.parentId);
          const seen = new Set([Number(item.id)]);
          while (parentId > 0) {
            if (seen.has(parentId)) return 0;
            seen.add(parentId);
            const parent = itemsById.get(parentId);
            if (!parent) return 0;
            if (Number(parent.parentId) === 0) return parentId;
            parentId = Number(parent.parentId);
          }
          return 0;
        };
        const renderItem = function (item) {
          const itemUsername = item.username || t('comment.anonymous');
          const isOwn = Boolean(item.isOwn)
            || (currentUserId > 0 && Number(item.userId) === currentUserId);
          const username = isOwn ? '我' : itemUsername;
          const firstChar = Array.from(String(username))[0] || '?';
          htmlParts.push('<div class="kniu_sys_comment_item' + (isOwn ? ' kniu_sys_comment_item_own' : '') + '" data-id="' + commentEscape(item.id) + '">');
          htmlParts.push('<div class="kniu_sys_comment_avatar">');
          if (item.avatar) htmlParts.push('<img src="' + commentEscape(item.avatar) + '" alt="">');
          else htmlParts.push('<div class="kniu_sys_comment_avatar_default">' + commentEscape(firstChar) + '</div>');
          htmlParts.push('</div>');
          htmlParts.push('<div class="kniu_sys_comment_body">');
          htmlParts.push('<div class="kniu_sys_comment_meta">');
          htmlParts.push('<span class="kniu_sys_comment_username">' + commentEscape(username) + '</span>');
          htmlParts.push('<span class="kniu_sys_comment_time">' + commentEscape(item.time || '') + '</span>');
          if (currentUserId > 0 || !isOwn) {
            htmlParts.push('<div class="kniu_sys_comment_actions">');
            if (currentUserId > 0 && isOwn) {
              htmlParts.push('<button type="button" class="kniu_sys_comment_action_delete" title="' + t('comment.delete') + '">' + t('common.delete') + '</button>');
            }
            if (currentUserId > 0 && !isOwn) {
              htmlParts.push('<button type="button" class="kniu_sys_comment_action_reply">' + t('comment.reply') + '</button>');
              htmlParts.push('<span class="kniu_sys_comment_action_sep">|</span>');
              htmlParts.push('<button type="button" class="kniu_sys_comment_action_like' + (item.liked ? ' kniu_sys_comment_liked' : '') + (item.likeFeedback ? ' kniu_sys_comment_like_feedback_pending' : '') + '"' + (item.likeFeedback ? ' data-like-feedback="' + commentEscape(item.likeFeedback) + '"' : '') + '>');
              htmlParts.push('<span class="kniu_sys_comment_like_icon">' + (item.liked ? '❤' : '♡') + '</span>');
              htmlParts.push('<span>' + (Number(item.likes) || 0) + '</span>');
              htmlParts.push('</button>');
            }
            if (!isOwn && currentUserId <= 0) {
              htmlParts.push('<button type="button" class="kniu_sys_comment_action_like' + (item.liked ? ' kniu_sys_comment_liked' : '') + '">');
              htmlParts.push('<span class="kniu_sys_comment_like_icon">' + (item.liked ? '❤' : '♡') + '</span><span>' + (Number(item.likes) || 0) + '</span></button>');
            }
            htmlParts.push('</div>');
          }
          htmlParts.push('</div>');
          const contentHtml = Number(item.parentId) > 0
            ? '<span class="kniu_sys_comment_reply_prefix">' + commentEscape(t('comment.replyTo') + (item.replyTo || t('comment.anonymous')) + '：') + '</span>' + commentEscape(item.content || '')
            : commentEscape(item.content || '');
          htmlParts.push('<div class="kniu_sys_comment_item"><div class="kniu_sys_comment_content">' + contentHtml + '</div></div>');
          if (Number(item.parentId) === 0) {
            list.forEach(function (reply) {
              if (rootIdFor(reply) === Number(item.id)) renderItem(reply);
            });
          }
          htmlParts.push('</div>');
          htmlParts.push('</div>');
        };
        list.forEach(function (item) {
          if (Number(item.parentId) === 0) renderItem(item);
        });
        list.forEach(function (item) {
          if (Number(item.parentId) > 0 && !list.some(function (parent) {
            return Number(parent.id) === Number(item.parentId);
          })) renderItem(item);
        });
      }
      htmlParts.push('</div>');
      htmlParts.push('</div>');
      this.shadowRoot.innerHTML = htmlParts.join('');
      adoptDropdownStyle(this.shadowRoot);
      this._bindEvents();
      this._playLikeFeedback();
    }
    _playLikeFeedback() {
      const root = this.shadowRoot;
      if (!root) return;
      const play = () => {
        if (!this.isConnected) return;
        root.querySelectorAll('[data-like-feedback]').forEach((button) => {
          const item = button.closest('.kniu_sys_comment_item');
          const commentId = item?.dataset.id || '';
          const feedbackId = button.getAttribute('data-like-feedback') || '';
          if (!commentId || !feedbackId || this._playedLikeFeedback.get(commentId) === feedbackId) return;
          this._playedLikeFeedback.set(commentId, feedbackId);
          button.removeAttribute('data-like-feedback');
          const feedback = document.createElement('span');
          feedback.className = 'kniu_sys_comment_like_feedback';
          feedback.textContent = '❤';
          feedback.setAttribute('aria-hidden', 'true');
          feedback.addEventListener('animationend', () => feedback.remove(), { once: true });
          feedback.style.animation = 'none';
          button.appendChild(feedback);
          void feedback.offsetWidth;
          feedback.style.animation = 'kniu_sys_comment_like_heart .9s ease-out forwards';
        });
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(play);
      else setTimeout(play, 0);
    }
    _bindEvents() {
      const self = this;
      const root = this.shadowRoot;
      const documentRefLocal = this.ownerDocument || document;
      if (!root) return;

      const textarea = root.querySelector('.kniu_sys_comment_textarea');
      const emojiBtn = root.querySelector('.kniu_sys_comment_emoji_btn');
      const emojiPanel = root.querySelector('.kniu_sys_comment_emoji_panel');
      const submitBtn = root.querySelector('.kniu_sys_comment_submit');
      const countEl = root.querySelector('.kniu_sys_comment_count');
      const maxLength = Math.max(0, Number.parseInt(this._options?.maxLength, 10) || 0);
      const syncCount = function () {
        if (!textarea) return;
        const characters = Array.from(textarea.value);
        if (maxLength && characters.length > maxLength) textarea.value = characters.slice(0, maxLength).join('');
        const length = Array.from(textarea.value).length;
        if (countEl && maxLength) {
          countEl.textContent = length + '/' + maxLength;
          countEl.classList.toggle('kniu_sys_comment_limit', length >= maxLength);
        }
        if (submitBtn) submitBtn.disabled = String(textarea.value || '').trim().length === 0;
      };
      textarea?.addEventListener('input', syncCount);
      syncCount();

      if (emojiBtn && emojiPanel) {
        emojiBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          self._showEmoji = !self._showEmoji;
          emojiPanel.classList.toggle('kniu_sys_comment_hidden', !self._showEmoji);
          if (self._showEmoji) {
            emojiPanel.classList.remove('kniu_sys_comment_above');
            const area = emojiPanel.closest('.kniu_sys_comment_input_area');
            const rect = area ? area.getBoundingClientRect() : null;
            if (rect) {
              const panelHeight = emojiPanel.offsetHeight || 220;
              const spaceBelow = (globalThis.innerHeight || 0) - rect.bottom;
              if (spaceBelow < panelHeight + 6) {
                emojiPanel.classList.add('kniu_sys_comment_above');
              }
            }
          }
        });
        if (this._closeEmojiHandler) documentRefLocal.removeEventListener('click', this._closeEmojiHandler);
        this._closeEmojiHandler = function (e) {
          if (!self.isConnected) return;
          const path = e.composedPath?.() || [];
          if (!path.includes(emojiBtn) && !path.includes(emojiPanel)) {
            self._showEmoji = false;
            emojiPanel.classList.add('kniu_sys_comment_hidden');
          }
        };
        documentRefLocal.addEventListener('click', this._closeEmojiHandler);
      }

      root.querySelectorAll('.kniu_sys_comment_emoji_item').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (textarea) {
            textarea.value = maxLength
              ? Array.from(textarea.value + btn.textContent).slice(0, maxLength).join('')
              : textarea.value + btn.textContent;
            syncCount();
            textarea.focus();
          }
          self._showEmoji = false;
          emojiPanel?.classList.add('kniu_sys_comment_hidden');
        });
      });

      if (submitBtn && textarea) {
        submitBtn.addEventListener('click', function () {
          const content = String(textarea.value || '').trim();
          if (!content) return;
          if (maxLength && Array.from(content).length > maxLength) return;
          const sensitiveWords = String(self._options?.filter || '').split(',').map(function (word) { return word.trim().toLocaleLowerCase(); }).filter(Boolean);
          const normalizedContent = content.toLocaleLowerCase();
          if (sensitiveWords.some(function (word) { return normalizedContent.includes(word); })) {
            msg({ content: '您的评论涉及敏感字不可提交评论', type: 'error' });
            return;
          }
          self._dispatch('submit', { content: content, parentId: self._replyId });
          textarea.value = '';
          self._replyId = null;
          self._replyName = '';
          self._render();
        });
      }

      const cancelReplyBtn = root.querySelector('[data-action="cancel-reply"]');
      if (cancelReplyBtn && textarea) {
        cancelReplyBtn.addEventListener('click', function () {
          self._replyId = null;
          self._replyName = '';
          self._render();
        });
      }

      root.querySelectorAll('.kniu_sys_comment_action_reply').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.disabled) return;
          const item = btn.closest('.kniu_sys_comment_item[data-id]');
          if (!item || !textarea) return;
          const id = item.dataset.id;
          const usernameEl = item.querySelector('.kniu_sys_comment_username');
          self._replyId = id || null;
          self._replyName = usernameEl ? usernameEl.textContent : '';
          self._render();
        });
      });

      root.querySelectorAll('.kniu_sys_comment_action_like').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const item = btn.closest('.kniu_sys_comment_item[data-id]');
          if (!item) return;
          const id = item.dataset.id;
          if (!id) return;
          const liked = btn.classList.contains('kniu_sys_comment_liked');
          self._dispatch('like', { commentId: id, liked: !liked });
        });
      });

      root.querySelectorAll('.kniu_sys_comment_action_delete').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const item = btn.closest('.kniu_sys_comment_item[data-id]');
          const id = item?.dataset.id;
          if (id) self._dispatch('delete', { commentId: id });
        });
      });
    }
    _dispatch(name, detail) {
      this.dispatchEvent(new CustomEvent(name, { detail: detail, bubbles: true, composed: true }));
    }
    disconnectedCallback() {
      if (this._closeEmojiHandler) {
        (this.ownerDocument || document).removeEventListener('click', this._closeEmojiHandler);
        this._closeEmojiHandler = null;
      }
    }
  }
  customElements.define('kniu-comment', KniuSysComment);
}
