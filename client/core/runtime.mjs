export class EventBus extends EventTarget {
  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  on(type, listener) {
    const handler = (event) => listener(event.detail);
    this.addEventListener(type, handler);
    return () => this.removeEventListener(type, handler);
  }
}

const BaseElement = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};

export class ShadowAppHost extends BaseElement {
  #definition;
  #kniusystem;
  #cleanup;
  #mountPromise;
  #generation = 0;

  configureApp(definition, kniusystem) {
    this.#definition = definition;
    this.#kniusystem = kniusystem;
    return this;
  }

  async mountApp() {
    if (this.#cleanup || !this.#definition) return this.#mountPromise;
    if (this.#mountPromise) return this.#mountPromise;
    const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
    const generation = ++this.#generation;
    this.setAttribute('data-status', 'mounting');
    this.#mountPromise = Promise.resolve(this.#definition.mount(this.#kniusystem, root))
      .then((cleanup) => {
        const dispose = typeof cleanup === 'function' ? cleanup : () => {};
        if (generation !== this.#generation) {
          dispose();
          return;
        }
        this.#cleanup = dispose;
        this.setAttribute('data-status', 'mounted');
      })
      .catch((error) => {
        if (generation === this.#generation) this.setAttribute('data-status', 'error');
        throw error;
      })
      .finally(() => {
        if (generation === this.#generation) this.#mountPromise = null;
      });
    return this.#mountPromise;
  }

  unmountApp() {
    this.#generation++;
    this.#cleanup?.();
    this.#cleanup = null;
    this.#mountPromise = null;
    this.shadowRoot?.replaceChildren();
    this.setAttribute('data-status', 'idle');
  }
}

if (typeof customElements !== 'undefined' && !customElements.get?.('shadow-app-host')) {
  customElements.define('shadow-app-host', ShadowAppHost);
}

export class MicroAppRuntime {
  #registry = new Map();
  #instances = new Map();

  constructor({ outlet, eventTo, onChange }) {
    this.outlet = outlet;
    this.eventTo = eventTo;
    this.onChange = onChange;
    this.handleHashChange = () => this.resolveCurrentRoute();
    window.addEventListener('hashchange', this.handleHashChange);
  }

  registerRoutes(routes) {
    routes.forEach((route) => {
      if (!route.path?.startsWith('/') || typeof route.app?.mount !== 'function') {
        throw new TypeError(`Invalid application route: ${route.path ?? 'unknown'}`);
      }
      this.#registry.set(route.path, route);
      if (route.initialPath) {
        if (!route.initialPath.startsWith('/')) throw new TypeError(`Invalid initial route: ${route.initialPath}`);
        this.#registry.set(route.initialPath, route);
      }
    });
    return this;
  }

  startRouter(defaultRoute) {
    this.defaultRoute = defaultRoute;
    this.resolveCurrentRoute();
    return this;
  }

  navigateTo(path) {
    if (this.#registry.has(path)) location.hash = path;
  }

  openExternalUrl(url) {
    let target;
    try {
      target = new URL(url, location.href);
    } catch {
      console.warn(`[KniuSystem] 无法打开无效的外部地址：${url}`);
      return null;
    }
    if (!['http:', 'https:'].includes(target.protocol)) {
      console.warn(`[KniuSystem] launch 仅支持 HTTP/HTTPS 地址：${target.href}`);
      return null;
    }
    const externalWindow = window.open(target.href, '_blank', 'noopener,noreferrer');
    if (externalWindow) externalWindow.opener = null;
    return externalWindow;
  }

  resolveCurrentRoute() {
    const path = location.hash.slice(1) || this.defaultRoute;
    const definition = this.#registry.get(path) ?? this.#registry.get(this.defaultRoute);
    if (!definition) return;
    if (!this.#registry.has(path)) history.replaceState(null, '', `#${definition.path}`);
    void this.activateRoute(definition.path);
  }

  async activateRoute(path) {
    const definition = this.#registry.get(path);
    if (!definition) return;
    for (const [key, host] of this.#instances) {
      const active = key === path;
      host.hidden = !active;
      if (active) void host.mountApp();
    }
    if (!this.#instances.has(path)) {
      const host = document.createElement('shadow-app-host');
      host.configureApp(definition.app, {
        eventTo: this.eventTo,
        navigateTo: (nextPath) => this.navigateTo(nextPath),
        openExternalUrl: (targetUrl) => this.openExternalUrl(targetUrl),
      });
      this.#instances.set(path, host);
      this.outlet.append(host);
      await host.mountApp();
    }
    this.onChange?.(definition);
  }

  dispose() {
    window.removeEventListener('hashchange', this.handleHashChange);
    this.#instances.forEach((host) => host.unmountApp());
    this.#instances.clear();
  }
}
