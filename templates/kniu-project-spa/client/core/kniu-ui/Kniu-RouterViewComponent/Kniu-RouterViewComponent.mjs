import KNIU_ROUTER_VIEW_TEMPLATE from './Kniu-RouterViewComponent.html?module';
// 路由内容挂载点（对标 Vue <router-view>）：Router 渲染的页面宿主（data-kniu-route-view）统一挂进本组件；
// 组件自身零逻辑，slot 透传 light DOM 页面宿主。
// 🔴 contain:false 必须保留：本组件包住整页，若 adopt CONTAIN_CSS（:host{contain:layout}）会成为
// position:fixed 后代的包含块，页面内 fixed 头部随之相对本组件定位、滚动即消失（2026-11-23 悬浮失效）。
export function registerRouterView(context) {
  const { attachComponentShadow, KNIU_ROUTER_VIEW_CSS } = context;
  if (typeof customElements === 'undefined' || customElements.get('kniu-router-view')) return;
  class KniuRouterView extends HTMLElement {
    constructor() {
      super();
      attachComponentShadow(this, { contain: false });
      this.shadowRoot.innerHTML = `<style>${KNIU_ROUTER_VIEW_CSS}</style>${KNIU_ROUTER_VIEW_TEMPLATE}`;
    }
  }
  customElements.define('kniu-router-view', KniuRouterView);
}