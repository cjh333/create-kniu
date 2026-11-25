export interface KniuRequestOptions extends Omit<RequestInit, 'cache'> {
  auth?: boolean;
  cache?: boolean;
  cacheTtl?: number;
  retries?: number;
  retryDelay?: number;
  retryUnsafe?: boolean;
  timeout?: number;
  csrfToken?: string;
}

export interface KniuRequest {
  <T = unknown>(url: string, options?: KniuRequestOptions): Promise<T>;
  get<T = unknown>(url: string, options?: KniuRequestOptions): Promise<T>;
  post<T = unknown>(url: string, body?: unknown, options?: KniuRequestOptions): Promise<T>;
  clearCache(url: string, options?: KniuRequestOptions): boolean;
  useResponseInterceptor(interceptor: (result: { ok: boolean; status: number; data: unknown; response: Response }) => unknown | Promise<unknown>): () => void;
}

export interface KniuStore<T extends Record<string, unknown> = Record<string, unknown>> {
  state: T;
  patch(values: Partial<T>): T;
  reset(): T;
  persist(): T;
  dispose(): void;
}

export interface KniuObservabilityOptions {
  enabled?: boolean;
  endpoint?: string;
  allowCrossOrigin?: boolean;
}

export interface KniuRouteSeo {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: string;
  jsonLd?: Record<string, unknown>;
}

export interface KniuRoute {
  path: string;
  view?: string;
  component?: string;
  seo?: KniuRouteSeo;
  [key: string]: unknown;
}

export interface KniuRouterOptions {
  routes?: KniuRoute[];
  views?: Record<string, string>;
  loading?: string | null;
  request?: KniuRequest;
  [key: string]: unknown;
}

export interface KniuRouter {
  navigate(path: string, params?: Record<string, unknown>, options?: { state?: boolean; loading?: boolean; loadingTarget?: string }): void;
  back(n?: number): void;
  start(): Promise<void>;
}

export interface KniuTemplateOptions {
  aliases?: Record<string, string>;
  head?: Record<string, unknown>;
}

export interface KniuPlugin {
  name?: string;
  install(app: KniuApp): void;
  [key: string]: unknown;
}

export interface KniuProtocol {
  readonly type: 'websocket' | 'sse';
  readonly url: string;
  readonly isOpen: boolean;
  readonly attempts: number;
  on(name: string, handler: (...args: unknown[]) => void): () => void;
  off(name: string, handler: (...args: unknown[]) => void): void;
  send(data: unknown): boolean;
  flush(): void;
  open(): void;
  close(code?: number, reason?: string): void;
  dispose(): void;
}

export interface KniuProtocolOptions {
  url: string;
  type?: 'websocket' | 'sse';
  protocols?: string[];
  withCredentials?: boolean;
  heartbeatInterval?: number;
  heartbeatMessage?: string;
  reconnect?: boolean;
  reconnectDelay?: number;
  reconnectMaxDelay?: number;
  reconnectMaxRetries?: number;
  queueLimit?: number;
}

export interface KniuProtocolPluginOptions {
  default?: KniuProtocolOptions;
}

export interface KniuProtocolService {
  create(options: KniuProtocolOptions): KniuProtocol;
  default?: KniuProtocol;
}

export interface KniuComponentContext {
  host: HTMLElement;
  root: ShadowRoot;
  reactive<T extends object>(state: T): T;
  computed<T>(getter: () => T): { readonly value: T };
  watch(source: unknown | (() => unknown), callback: (value: unknown, previous: unknown) => void): () => void;
  refs: Record<string, unknown>;
  emit(name: string, detail?: unknown): boolean;
  nextTick(callback: () => void): Promise<void>;
  onBeforeMount(callback: (host: HTMLElement, root: ShadowRoot) => void): void;
  onMounted(callback: (host: HTMLElement, root: ShadowRoot) => void): void;
  onUnmounted(callback: (host: HTMLElement, root: ShadowRoot) => void): void;
}

export interface KniuComponentSpec {
  tag: `${string}-${string}`;
  style?: string;
  template?: string;
  setup(context: KniuComponentContext): object | void;
}

export interface KniuApp {
  request: KniuRequest;
  store: KniuStore;
  router: KniuRouter | null;
  protocol?: KniuProtocolService;
  plugins: KniuPlugin[];
  use(plugin: KniuPlugin): KniuApp;
  mount(selector: string | Element): Promise<KniuApp>;
  auditAccessibility(): Array<{ rule: string; node: Element }>;
}