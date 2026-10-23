export interface KniuRequestOptions extends RequestInit {
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

export interface KniuApp {
  request: KniuRequest;
  store: KniuStore;
  mount(selector: string | Element): Promise<KniuApp>;
  auditAccessibility(): Array<{ rule: string; node: Element }>;
}

export interface KniuRouteSeo { title?: string; description?: string; canonical?: string; image?: string; type?: string; jsonLd?: Record<string, unknown>; }

export interface KniuComponentContext {
  host: HTMLElement;
  root: ShadowRoot;
  reactive<T extends object>(state: T): T;
  emit(name: string, detail?: unknown): boolean;
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
