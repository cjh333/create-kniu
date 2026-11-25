import { maskExternalImages, hydrateExternalImages } from '../../Kniu-Proxy.mjs';
import KNIU_COMMENT_TEMPLATE from './Kniu-CommentComponent.html?module';
import KNIU_COMMENT_INPUT_TEMPLATE from './Kniu-CommentComponent.Input.html?module';
import KNIU_COMMENT_ITEM_TEMPLATE from './Kniu-CommentComponent.Item.html?module';

export function registerComment(context) {
  const { KNIU_COMMENT_CSS, adoptDropdownStyle, attachComponentShadow, componentLang, componentText, msg } = context;
  if (typeof customElements === 'undefined' || customElements.get('kniu-comment')) return;
  const documentRef = typeof document !== 'undefined' ? document : null;
  if (!documentRef) return;

  const COMMENT_DEFAULT_EMOJIS = [
    '😀', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😜', '🤪', '🤗', '🤭', '🤔', '😏', '😎',
    '😴', '🥱', '😪', '😢', '😭', '😤', '😡', '🤬', '😱', '😳', '🥺', '😯', '😲', '😮', '🤐', '😐', '😑', '😶', '😒', '🙄', '😬', '😔', '😷', '🤒',
    '🤢', '🤮', '🥵', '🥶', '😵', '🤯', '🤠', '🥳', '🤓', '🧐', '😕', '🤑', '👋', '🤚', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙',
    '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪', '❤️', '🧡', '💛', '💚', '💙', '💜',
    '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '✨', '⭐', '🌟', '💫', '🔥', '💥', '💯', '✅', '❌', '⚠️', '❓',
    '❗', '🎉', '🎊', '🎈', '🎁', '👀', '💬', '💭', '📌', '📝', '📎', '🔗', '💡', '🔔', '🏆', '🥇', '👑', '💎', '⏰', '📚', '✏️', '🎵', '🎮', '☕',
    '🍀', '🌈', '🌸', '🌹', '🌞', '🌙', '⚡', '❄️', '🍉'
  ];

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
      this._replyTarget = null;
      this._replyName = '';
      this._closeEmojiHandler = null;
      this._playedLikeFeedback = new Map();
      this._built = false;
    }
    connectedCallback() { this._buildSkeleton(); this._render(); }
    attributeChangedCallback() { }
    set options(value) {
      this._options = value && typeof value === 'object' ? value : {};
      this._render();
    }
    get options() { return this._options; }
    set submitting(value) {
      this._submitting = !!value;
      this.shadowRoot?.querySelectorAll('.kniu_sys_comment_input_area').forEach(function (input) {
        input.toggleAttribute('inert', !!value);
        input.setAttribute('aria-busy', String(!!value));
      });
    }
    get submitting() { return !!this._submitting; }

    _buildSkeleton() {
      if (this._built) return;
      this._built = true;
      this.shadowRoot.innerHTML = '<style>' + KNIU_COMMENT_CSS + '</style>' + KNIU_COMMENT_TEMPLATE;
    }
    _buildInlineAreaHtml() {
      return KNIU_COMMENT_INPUT_TEMPLATE.replace(/\{\{input-area\}\}/g, 'dynamic');
    }

    _render() {
      const root = this.shadowRoot;
      if (!root) return;
      this._buildSkeleton();

      const options = this._options || {};
      const lang = componentLang(options);
      const t = (k, p) => componentText(lang, k, p);
      const list = Array.isArray(options.list) ? options.list : [];
      const placeholder = options.placeholder || 'Please enter a comment...';
      const submitText = options.submitText || t('comment.title');
      const emojis = Array.isArray(options.emojis) ? options.emojis : COMMENT_DEFAULT_EMOJIS;
      const emptyText = options.emptyText || t('comment.empty');
      const currentUserId = Math.max(0, Number.parseInt(options.currentUserId, 10) || 0);
      const maxLength = Math.max(0, Number.parseInt(options.maxLength, 10) || 0);
      const canSubmit = options.canSubmit !== false;

      root.querySelectorAll('[data-input-area="dynamic"]').forEach(function (el) { el.remove(); });

      const listSlot = root.querySelector('[data-list-slot]');
      if (listSlot) {
        listSlot.innerHTML = '';
        if (list.length === 0) {
          const empty = documentRef.createElement('div');
          empty.className = 'kniu_sys_comment_empty';
          empty.textContent = emptyText;
          listSlot.appendChild(empty);
        } else {
          this._renderList(listSlot, list, currentUserId, t);
        }
      }

      const rootArea = root.querySelector('[data-input-area="root"]');
      if (rootArea) {
        rootArea.hidden = !canSubmit;
        this._fillInputArea(rootArea, { placeholder: placeholder, submitText: submitText, maxLength: maxLength, emojis: emojis });
        this._bindInputArea(rootArea);
      }

      if (this._replyTarget != null && String(this._replyTarget) !== '') {
        const targetItem = listSlot?.querySelector('.kniu_sys_comment_item[data-id="' + this._replyTarget + '"]');
        if (targetItem && canSubmit) {
          const inlineSlot = targetItem.querySelector('[data-inline-slot]');
          if (inlineSlot) {
            inlineSlot.innerHTML = this._buildInlineAreaHtml();
            const inlineArea = inlineSlot.querySelector('.kniu_sys_comment_input_area');
            if (inlineArea) {
              this._fillInputArea(inlineArea, { placeholder: placeholder, submitText: submitText, maxLength: maxLength, emojis: emojis });
              const replyHint = inlineArea.querySelector('[data-reply-hint]');
              if (replyHint) {
                const replyNameEl = replyHint.querySelector('[data-reply-name]');
                if (replyNameEl) replyNameEl.textContent = '回复 ' + this._replyName + '：';
                replyHint.hidden = false;
              }
              this._bindInputArea(inlineArea);
            }
          }
        } else {
          this._replyTarget = null;
          this._replyName = '';
        }
      }

      adoptDropdownStyle(root);

      this._bindEvents();

      const inlineTextarea = root.querySelector('[data-input-area="dynamic"] .kniu_sys_comment_textarea');
      if (inlineTextarea) inlineTextarea.focus({ preventScroll: true });
      this.submitting = this._submitting;
      this._playLikeFeedback();
    }

    _fillInputArea(area, opts) {
      if (!area) return;
      const textarea = area.querySelector('.kniu_sys_comment_textarea');
      if (textarea && opts.placeholder) textarea.placeholder = opts.placeholder;
      const submitBtn = area.querySelector('.kniu_sys_comment_submit');
      if (submitBtn && opts.submitText) submitBtn.textContent = opts.submitText;

      const emojiPanel = area.querySelector('[data-emoji-panel]');
      const emojiList = Array.isArray(opts.emojis) ? opts.emojis : COMMENT_DEFAULT_EMOJIS;
      if (emojiPanel) {
        emojiPanel.innerHTML = '';
        emojiPanel.classList.add('kniu_sys_comment_hidden');
        emojiList.forEach(function (emoji) {
          const btn = documentRef.createElement('button');
          btn.type = 'button';
          btn.className = 'kniu_sys_comment_emoji_item';
          btn.textContent = emoji;
          emojiPanel.appendChild(btn);
        });
      }

      const countEl = area.querySelector('[data-count]');
      if (countEl) {
        if (opts.maxLength) {
          countEl.hidden = false;
          countEl.textContent = '0/' + opts.maxLength;
        } else {
          countEl.hidden = true;
        }
      }
    }

    _renderList(listSlot, list, currentUserId, t) {
      const itemsById = new Map();
      list.forEach(function (item) { itemsById.set(Number(item.id), item); });
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

      const itemHtml = function (item) {
        const itemUsername = item.username || t('comment.anonymous');
        const isOwn = Boolean(item.isOwn)
          || (currentUserId > 0 && Number(item.userId) === currentUserId);
        const canDelete = item.canDelete !== false;
        const username = isOwn ? '我' : itemUsername;
        const firstChar = Array.from(String(username))[0] || '?';
        const userAttr = Number(item.userId) > 0 ? ' data-user-id="' + commentEscape(item.userId) + '"' : '';
        const contentHtml = Number(item.parentId) > 0
          ? '<span class="kniu_sys_comment_reply_prefix">' + commentEscape(t('comment.replyTo') + (item.replyTo || t('comment.anonymous')) + '：') + '</span>' + commentEscape(item.content || '')
          : commentEscape(item.content || '');

        let actionHtml = '';
        const hasActions = !isOwn || (currentUserId > 0 && canDelete);
        if (hasActions) {
          actionHtml += '<div class="kniu_sys_comment_actions">';
          if (currentUserId > 0 && isOwn && canDelete) {
            actionHtml += '<button type="button" class="kniu_sys_comment_action_delete" title="' + t('comment.delete') + '">' + t('common.delete') + '</button>';
          }
          if (currentUserId > 0 && !isOwn) {
            actionHtml += '<button type="button" class="kniu_sys_comment_action_reply">' + t('comment.reply') + '</button>';
            actionHtml += '<span class="kniu_sys_comment_action_sep">|</span>';
          }
          if (!isOwn) {
            if (currentUserId > 0) {
              actionHtml += '<button type="button" class="kniu_sys_comment_action_like' + (item.liked ? ' kniu_sys_comment_liked' : '') + (item.likeFeedback ? ' kniu_sys_comment_like_feedback_pending' : '') + '"' + (item.likeFeedback ? ' data-like-feedback="' + commentEscape(item.likeFeedback) + '"' : '') + '>';
              actionHtml += '<span class="kniu_sys_comment_like_icon">' + (item.liked ? '❤' : '♡') + '</span>';
              actionHtml += '<span>' + (Number(item.likes) || 0) + '</span>';
              actionHtml += '</button>';
            } else {
              actionHtml += '<button type="button" class="kniu_sys_comment_action_like' + (item.liked ? ' kniu_sys_comment_liked' : '') + '">';
              actionHtml += '<span class="kniu_sys_comment_like_icon">' + (item.liked ? '❤' : '♡') + '</span><span>' + (Number(item.likes) || 0) + '</span></button>';
            }
          }
          actionHtml += '</div>';
        }

        const avatarHtml = item.avatar
          ? '<img src="' + commentEscape(item.avatar) + '" alt="">'
          : '<div class="kniu_sys_comment_avatar_default">' + commentEscape(firstChar) + '</div>';

        return KNIU_COMMENT_ITEM_TEMPLATE
          .replace(/\{\{item-id\}\}/g, commentEscape(item.id))
          .replace(/\{\{own-class\}\}/g, isOwn ? ' kniu_sys_comment_item_own' : '')
          .replace(/\{\{user-id-attr\}\}/g, userAttr)
          .replace(/\{\{avatar-html\}\}/g, avatarHtml)
          .replace(/\{\{username-html\}\}/g, commentEscape(username))
          .replace(/\{\{time-html\}\}/g, commentEscape(item.time || ''))
          .replace(/\{\{action-html\}\}/g, actionHtml)
          .replace(/\{\{content-html\}\}/g, contentHtml);
      };

      const appendBranch = function (item, container) {
        // 评论头像可能来自外部数据：字符串阶段先 mask，避免外链 <img> 解析瞬间触发 CSP。
        container.insertAdjacentHTML('beforeend', maskExternalImages(itemHtml(item)));
        const element = container.lastElementChild;
        void hydrateExternalImages(container);
        if (Number(item.parentId) !== 0 || !element) return;
        const body = element.querySelector('.kniu_sys_comment_body');
        if (!body) return;
        list.forEach(function (reply) {
          if (rootIdFor(reply) === Number(item.id)) appendBranch(reply, body);
        });
      };

      list.forEach(function (item) { if (Number(item.parentId) === 0) appendBranch(item, listSlot); });
      list.forEach(function (item) {
        if (Number(item.parentId) > 0 && !list.some(function (parent) { return Number(parent.id) === Number(item.parentId); })) appendBranch(item, listSlot);
      });
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
          const feedback = documentRef.createElement('span');
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

    _bindInputArea(area) {
      const self = this;
      if (!area || area.__kniu_bound) return;
      area.__kniu_bound = true;
      const documentRefLocal = this.ownerDocument || document;
      const textarea = area.querySelector('.kniu_sys_comment_textarea');
      const emojiBtn = area.querySelector('[data-emoji-btn]');
      const emojiPanel = area.querySelector('[data-emoji-panel]');
      const submitBtn = area.querySelector('.kniu_sys_comment_submit');
      const countEl = area.querySelector('[data-count]');
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
          e.__kniuEmojiBtn = true;
          emojiPanel.classList.toggle('kniu_sys_comment_hidden');
          const hidden = emojiPanel.classList.contains('kniu_sys_comment_hidden');
          emojiBtn.setAttribute('aria-expanded', String(!hidden));
          if (!hidden) {
            emojiPanel.classList.remove('kniu_sys_comment_above');
            const rect = area.getBoundingClientRect();
            if (rect) {
              const panelHeight = emojiPanel.offsetHeight || 220;
              const spaceBelow = (globalThis.innerHeight || 0) - rect.bottom;
              if (spaceBelow < panelHeight + 6) emojiPanel.classList.add('kniu_sys_comment_above');
            }
          }
        });
        if (area.__kniuEmojiClose) documentRefLocal.removeEventListener('click', area.__kniuEmojiClose);
        const closeHandler = function (e) {
          if (!self.isConnected || !area.isConnected || area.hidden) return;
          if (e?.__kniuEmojiBtn) return;
          const path = e.composedPath?.() || [];
          if (!path.includes(emojiBtn) && !path.includes(emojiPanel)) {
            emojiPanel.classList.add('kniu_sys_comment_hidden');
          }
        };
        area.__kniuEmojiClose = closeHandler;
        documentRefLocal.addEventListener('click', closeHandler);
        const observer = new MutationObserver(function () {
          if (!area.isConnected) {
            documentRefLocal.removeEventListener('click', closeHandler);
            area.__kniuEmojiClose = null;
            observer.disconnect();
          }
        });
        observer.observe(area, { childList: true, subtree: true });
      }

      area.querySelectorAll('.kniu_sys_comment_emoji_item').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (textarea) {
            textarea.value = maxLength
              ? Array.from(textarea.value + btn.textContent).slice(0, maxLength).join('')
              : textarea.value + btn.textContent;
            syncCount();
            textarea.focus();
          }
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
          const isDynamic = area.matches('[data-input-area="dynamic"]');
          const parentId = isDynamic && self._replyTarget != null
            ? Number(self._replyTarget) || 0
            : 0;
          self._dispatch('submit', { content: content, parentId: parentId });
          textarea.value = '';
          if (isDynamic) {
            self._replyTarget = null;
            self._replyName = '';
          }
          self._render();
        });
      }

      const cancelReplyBtn = area.querySelector('[data-reply-cancel]');
      if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', function () {
          self._replyTarget = null;
          self._replyName = '';
          self._render();
        });
      }
    }

    _bindEvents() {
      const self = this;
      const root = this.shadowRoot;
      if (!root) return;

      root.querySelectorAll('.kniu_sys_comment_action_reply').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.disabled) return;
          const item = btn.closest('.kniu_sys_comment_item[data-id]');
          if (!item) return;
          self._replyTarget = item.dataset.id || null;
          const usernameEl = item.querySelector('.kniu_sys_comment_username');
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

      const commentList = root.querySelector('.kniu_sys_comment_list');
      if (commentList) {
        commentList.addEventListener('click', function (e) {
          const target = e.target instanceof Element ? e.target : null;
          const userEl = target ? target.closest('[data-user-id]') : null;
          if (!userEl) return;
          const userId = Number(userEl.getAttribute('data-user-id'));
          if (Number.isInteger(userId) && userId > 0) self._dispatch('user', { userId: userId });
        });
      }
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