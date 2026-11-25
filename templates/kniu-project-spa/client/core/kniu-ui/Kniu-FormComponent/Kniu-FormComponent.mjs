import { invokeOptionCallback } from '../../Kniu-Error.mjs';
import KNIU_FORM_COMPONENT_CSS from './Kniu-FormComponent.css?module';

export function registerForm(context) {
  const { attachComponentShadow, msg } = context;
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
  if (customElements.get('kniu-form')) return;
  const FORM_FIELD_SELECTOR = [
    'kniu-input', 'kniu-smsvcode', 'kniu-gvcode', 'kniu-textarea', 'kniu-select', 'kniu-switch', 'kniu-radio-group',
    'kniu-checkbox-group', 'kniu-date-picker', 'kniu-upload', 'kniu-editor', 'kniu-slider'
  ].join(',');
  const FORM_RESERVED_KEYS = ['labelPosition', 'labelWidth', 'onSubmit', 'locked'];
  const isFieldObject = function (value) {
    return !!value && typeof value === 'object' && !Array.isArray(value) && 'value' in value;
  };
  const unwrapField = function (value) {
    return isFieldObject(value) ? value.value : value;
  };

  class KniuSysForm extends HTMLElement {
    constructor() {
      super();
      attachComponentShadow(this);
      this.shadowRoot.innerHTML = `<style>${KNIU_FORM_COMPONENT_CSS}</style><slot></slot>`;
      this._options = {};
      this._defaults = null;
      this._mountedForm = null;
      this._validateHandler = null;
      this._enterHandler = null;
    }
    connectedCallback() {
      queueMicrotask(() => {
        this._ensureNativeForm();
        this._syncLayout();
        this._syncLocked();
        this._mountForm();
      });
    }
    static snapshotOptions(options) {
      const out = {};
      Object.keys(options).forEach(function (key) {
        if (FORM_RESERVED_KEYS.indexOf(key) !== -1) return;
        out[key] = unwrapField(options[key]);
      });
      return out;
    }
    set options(value) {
      const next = value && typeof value === 'object' ? value : {};
      this._options = next;
      if (this._defaults === null) this._defaults = KniuSysForm.snapshotOptions(next);
      if (!this.isConnected) return;
      this._syncLayout();
      this._syncLocked();
      if (!this._mountedForm) this._mountForm();
    }
    get options() { return this._options; }
    get values() { return this._valuesOf(this._fieldNodes()); }
    _valuesOf(entries) {
      const options = this._options || {};
      const out = {};
      entries.forEach(function (entry) { out[entry.field] = entry.value; });
      Object.keys(options).forEach(function (key) {
        if (FORM_RESERVED_KEYS.indexOf(key) !== -1) return;
        if (key in out) return;
        out[key] = unwrapField(options[key]);
      });
      return out;
    }
    reset() {
      const defaults = this._defaults;
      const options = this._options;
      if (!defaults || !options) return;
      Object.keys(defaults).forEach(function (field) {
        if (isFieldObject(options[field])) options[field].value = defaults[field];
        else options[field] = defaults[field];
      });
    }
    validate() {
      const options = this._options || {};
      const entries = this._fieldNodes();
      const values = this._valuesOf(entries);
      let valid = true;
      let firstInvalid = null;
      let firstMessage = '';
      entries.forEach((entry) => {
        const rule = options[entry.field];
        const hasRule = isFieldObject(rule) && 'condition' in rule;
        if (!hasRule) {
          entry.node.removeAttribute('data-invalid');
          return;
        }
        const value = entry.value == null ? '' : String(entry.value);
        const invalid = !this._testCondition(rule.condition, value, entry, values);
        (entry.group || entry.node).toggleAttribute('required', true);
        entry.node.toggleAttribute('data-invalid', invalid);
        if (!invalid) return;
        valid = false;
        if (!firstInvalid) {
          firstInvalid = entry.node;
          firstMessage = rule.message || `${entry.field}格式不正确`;
        }
      });
      if (firstInvalid) {
        if (typeof firstInvalid.focus === 'function') firstInvalid.focus();
        if (typeof this.$msg === 'function') this.$msg({ content: firstMessage, type: 'error' });
        else if (typeof msg === 'function') msg({ content: firstMessage, type: 'error' });
      }
      return valid;
    }
    _testCondition(condition, value, entry, values) {
      if (condition === true) return value.trim().length > 0;
      if (condition == null) return true;
      if (condition && typeof condition.source === 'string') {
        return new RegExp(condition.source, condition.flags || '').test(value);
      }
      if (condition instanceof RegExp) return condition.test(value);
      if (typeof condition === 'function') {
        const payload = {
          value: value,
          field: entry.field,
          input: entry.node,
          model: this._options,
          options: this._options,
          values: values || {}
        };
        Object.keys(payload.values).forEach(function (key) {
          if (!Object.prototype.hasOwnProperty.call(payload, key)) payload[key] = payload.values[key];
        });
        return !!condition(payload);
      }
      return true;
    }
    _fieldNodes() {
      const options = this._options || {};
      const seen = new Set();
      const out = [];
      const self = this;
      this.querySelectorAll(FORM_FIELD_SELECTOR).forEach(function (node) {
        const field = self._fieldNameOf(node);
        if (!field || seen.has(field)) return;
        seen.add(field);
        out.push({
          field: field,
          node: node,
          group: node.closest('kniu-input-group, kniu-form-cell'),
          value: self._readField(field, node, options)
        });
      });
      return out;
    }
    _fieldNameOf(node) {
      const name = node.getAttribute('name');
      if (name) return name;
      const path = node.__kniuModelPath;
      if (path) return String(path).split('.').pop();
      return '';
    }
    _readField(field, node, options) {
      const option = options[field];
      if (isFieldObject(option)) return option.value;
      if (option !== undefined && option !== null && typeof option !== 'object') return option;
      return node.value === undefined ? '' : node.value;
    }
    _ensureNativeForm() {
      if (this.querySelector(':scope > form')) return;
      const form = (this.ownerDocument || document).createElement('form');
      form.className = 'kniu_sys_form_native';
      if (!form.hasAttribute('autocomplete')) form.setAttribute('autocomplete', 'off');
      while (this.firstChild) form.append(this.firstChild);
      this.append(form);
    }
    _syncLayout() {
      const options = this._options || {};
      const position = ['left', 'right', 'top'].indexOf(options.labelPosition) !== -1
        ? options.labelPosition
        : 'right';
      const width = options.labelWidth || '80px';
      if (this.getAttribute('data-label-position') !== position) {
        this.setAttribute('data-label-position', position);
      }
      this.querySelectorAll('kniu-input-group, kniu-form-cell').forEach(function (group) {
        const curPos = group.getAttribute('label-position');
        if (curPos !== position) group.setAttribute('label-position', position);
        const curWidth = group.getAttribute('label-width');
        if (curWidth !== width) group.setAttribute('label-width', width);
      });
    }
    _syncLocked() {
      const locked = !!(this._options && this._options.locked);
      this.toggleAttribute('data-locked', locked);
    }
    _mountForm() {
      const form = this.querySelector('form');
      if (!form || this._mountedForm === form) return;
      form.noValidate = true;
      this._validateHandler = (event) => {
        event.preventDefault();
        const valid = this.validate();
        if (!valid) event.stopImmediatePropagation();
        invokeOptionCallback(this, 'onSubmit', () => ({ values: this.values, valid: valid }), 'kniu-form.onSubmit');
      };
      this._enterHandler = (event) => {
        if (event.key !== 'Enter' || event.isComposing || event.defaultPrevented) return;
        const inputHost = event.composedPath().find((node) => node?.localName === 'kniu-input');
        if (inputHost?.getAttribute('type') === 'textarea') return;
        event.preventDefault();
        event.stopPropagation();
        form.requestSubmit();
      };
      form.addEventListener('keydown', this._enterHandler, true);
      form.addEventListener('submit', this._validateHandler);
      this._mountedForm = form;
    }
  }
  customElements.define('kniu-form', KniuSysForm);
}