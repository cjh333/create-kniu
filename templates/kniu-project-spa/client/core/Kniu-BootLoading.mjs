export const BOOT_LOADING_SELECTOR = '.kniu_sys_boot_loading';
export const BOOT_LOADING_HTML = `
<div class="kniu_sys_boot_loading" data-kniu-preserve="boot-loading">
  <span class="kniu_sys_boot_loading_spinner"></span>
  <span class="kniu_sys_boot_loading_text"></span>
  <style>
    .kniu_sys_boot_loading {
      z-index: 9999;
      position: fixed;
      top: 0;
      left: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      background-color: #fff;
      opacity: 1;
      transition: opacity .6s ease-in-out;
      -webkit-transition: opacity .6s ease-in-out;
      -moz-transition: opacity .6s ease-in-out;
      -o-transition: opacity .6s ease-in-out;
    }
    .kniu_sys_boot_loading.kniu_sys_boot_loading_hidden {
      opacity: 0;
      pointer-events: none;
    }
    .kniu_sys_boot_loading.kniu_sys_boot_loading_closed {
      display: none;
    }
    .kniu_sys_boot_loading.kniu_sys_boot_loading_contained {
      position: absolute;
    }
    .kniu_sys_boot_loading_spinner {
      border: 3px solid rgba(64, 158, 255, .25);
      border-top-color: var(--kniu-color-primary, #409eff);
      border-radius: 50%;
      -webkit-border-radius: 50%;
      -moz-border-radius: 50%;
      -ms-border-radius: 50%;
      -o-border-radius: 50%;
      width: 34px;
      height: 34px;
      animation: kniu_sys_boot_loading_spin .7s linear infinite;
      -webkit-animation: kniu_sys_boot_loading_spin .7s linear infinite;
      -moz-animation: kniu_sys_boot_loading_spin .7s linear infinite;
      -o-animation: kniu_sys_boot_loading_spin .7s linear infinite;
    }
    .kniu_sys_boot_loading_text {
      max-width: 80%;
      font-size: 13px;
      text-align: center;
      color: #606266;
    }
    @keyframes kniu_sys_boot_loading_spin {
      100% {
        transform: rotate(360deg);
        -webkit-transform: rotate(360deg);
        -moz-transform: rotate(360deg);
        -o-transform: rotate(360deg);
      }
    }
  </style>
</div>
`;

export function withBootLoadingHtml(html) {
  if (typeof html !== 'string' || html.includes(BOOT_LOADING_SELECTOR)) return html;
  return html.replace(/(<body\b[^>]*>)/i, `$1${BOOT_LOADING_HTML}`);
}

const HIDDEN_CLASS = 'kniu_sys_boot_loading_hidden';
const CLOSED_CLASS = 'kniu_sys_boot_loading_closed';
const CONTAINED_CLASS = 'kniu_sys_boot_loading_contained';

let bootNode = null;
let hideTimer = 0;

if (typeof document !== 'undefined') showBootLoading();

function showBootLoading(options = {}) {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = 0;
  }
  if (!bootNode || !bootNode.isConnected) {
    bootNode = document.querySelector(BOOT_LOADING_SELECTOR);
    if (!bootNode) {
      document.body.insertAdjacentHTML('afterbegin', BOOT_LOADING_HTML);
      bootNode = document.querySelector(BOOT_LOADING_SELECTOR);
    }
  }
  const target = options.target && options.target.isConnected ? options.target : document.body;
  if (bootNode.parentNode !== target) target.appendChild(bootNode);
  bootNode.classList.toggle(CONTAINED_CLASS, target !== document.body);
  bootNode.classList.remove(HIDDEN_CLASS, CLOSED_CLASS);
}

function hideBootLoading() {
  if (!bootNode || !bootNode.isConnected) return;
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = 0;
  }
  const loading = bootNode;
  loading.classList.add(HIDDEN_CLASS);
  hideTimer = setTimeout(() => {
    hideTimer = 0;
    if (bootNode === loading) loading.classList.add(CLOSED_CLASS);
  }, 650);
}

export { showBootLoading, hideBootLoading };