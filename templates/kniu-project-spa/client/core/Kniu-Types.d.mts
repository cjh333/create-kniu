declare module 'Kniu-MVVM' {
  export interface EffectRunner {
    run(): void;
    stop(): void;
    scheduler?: () => void;
  }
  export type ReactiveState<T extends object> = T;
  export function reactive<T extends object>(target: T): T;
  export function effect(fn: () => void, options?: { scheduler?: () => void }): EffectRunner;
  export interface ComputedRef<T> {
    readonly value: T;
    stop(): void;
  }
  export function computed<T>(getter: () => T): ComputedRef<T>;
  export function watch(source: () => unknown, callback: (next: unknown, prev: unknown) => void, options?: { immediate?: boolean }): () => void;
  export function nextTick(callback?: () => void): Promise<void>;
  export interface SetupApi {
    reactive: typeof reactive;
    computed: typeof computed;
    watch: typeof watch;
    nextTick: typeof nextTick;
    state: Record<string, unknown>;
    onMounted(fn: () => void | Promise<void>): void;
    onUnmounted(fn: () => void | Promise<void>): void;
  }
  export function setup(factory: (api: SetupApi) => Promise<Record<string, unknown>> | Record<string, unknown>): (context: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

declare module 'Kniu-Contracts' {
  export interface RouteMeta {
    admin?: boolean;
    section?: string;
    requiresAuth?: boolean;
    [key: string]: unknown;
  }
  export interface ContractRoute {
    title?: string | ((context: { model?: Record<string, unknown>; params?: Record<string, string> }) => string);
    template: string;
    controller?: string;
    layout?: string;
    loadingTarget?: string;
    loadingContainer?: string;
    showLoading?: boolean;
    default?: boolean;
    meta?: RouteMeta;
    seo?: RouteSeo | ((context: { model?: Record<string, unknown> }) => RouteSeo);
    children?: ContractRoute[];
  }
  export interface RouteSeo {
    title?: string;
    description?: string;
    type?: string;
    jsonLd?: Record<string, unknown>;
  }
  export interface KniuContracts {
    router?: {
      mode?: 'hash' | 'history';
      base?: string;
      unknownRoute?: 'home' | 'block';
      scrollBehavior?: 'top' | 'restore' | 'manual';
      layoutContainerSelector?: string;
      isInternalLink?: (href: string, mode: string, contracts: KniuContracts) => boolean;
      [key: string]: unknown;
    };
    paths?: { templates?: string; controllers?: string; webCssPattern?: RegExp;[key: string]: unknown };
    [key: string]: unknown;
  }
  export function routeFromLocation(location: { hash?: string; pathname?: string }, contracts: KniuContracts, fallback?: string): string;
  export function routeHref(path: string, contracts: KniuContracts): string;
  export function routeSeparator(mode?: string): string;
  export function isAnonymousRoute(path: string): boolean;
  export function configureContracts(partial: Partial<KniuContracts>): void;
  export function resetContracts(): void;
  export function getContracts(): KniuContracts;
  export function limitValue(key: string, fallback: unknown): unknown;
}

declare module 'Kniu-TemplateEngine' {
  export function renderTemplate(source: string, data?: Record<string, unknown>, options?: { collect?: boolean; scopeKey?: string }): string;
  export function evaluateTemplateExpression(code: string, scope: Record<string, unknown>): unknown;
  export function escapeHtml(value: unknown): string;
  export function configureTemplateEngine(options: { aliases?: Record<string, string>; head?: Record<string, unknown> | null }): void;
}

declare module 'Kniu-Router' {
  import type { ContractRoute, KniuContracts } from 'Kniu-Contracts';
  export interface RouterOptions {
    root?: HTMLElement | null;
    routes: Record<string, ContractRoute>;
    data?: () => Promise<Record<string, unknown>> | Record<string, unknown>;
    actions?: Record<string, (payload?: unknown) => void>;
    hooks?: Record<string, (context: Record<string, unknown>) => Promise<void> | void>;
    views?: Record<string, string>;
    loading?: boolean | { enabled?: boolean; text?: string; duration?: number };
    request?: unknown;
    paths?: { templates?: string; controllers?: string };
    defaultTitle?: string;
  }
  export interface RouterHooks {
    beforeEach(fn: (to: Record<string, unknown>, from: Record<string, unknown>) => Promise<boolean | void> | boolean | void): void;
    afterEach(fn: (to: Record<string, unknown>, from: Record<string, unknown>) => void): void;
  }
  export function createRouter(options: RouterOptions): {
    start(): Promise<void>;
    navigate(path: string): Promise<void>;
    refresh(): Promise<void>;
    hooks: RouterHooks;
    routeState: { snapshot: { path: string; params: Record<string, string>; query: URLSearchParams } };
  };
  export const hooks: Readonly<Record<string, (context: Record<string, unknown>) => Promise<void> | void>>;
  export function retargetEvent(event: Event, node: Element): Element | null;
}

declare module 'Kniu-ComponentLoader' {
  export function loadComponents(root?: Document | ShadowRoot | Element): Promise<void>;
  export function preloadComponents(): Promise<void>;
}

declare module 'Kniu-BuildClient' {
  export function renderPrerenderShell(): Promise<string>;
}