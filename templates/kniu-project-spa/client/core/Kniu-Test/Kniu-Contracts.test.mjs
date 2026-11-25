import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeFromLocation, routeHref, routeSeparator, isAnonymousRoute, configureContracts, resetContracts, getContracts, limitValue } from '../Kniu-Contracts.mjs';

test('routeSeparator 按 mode 返回前缀', () => {
  assert.equal(routeSeparator('hash'), '#');
  assert.equal(routeSeparator('history'), '');
  assert.equal(routeSeparator(undefined), '#');
});

test('routeHref hash 模式拼接 # 前缀', () => {
  assert.equal(routeHref('/index/search', { router: { mode: 'hash' } }), '#/index/search');
  assert.equal(routeHref('index/search', { router: {} }), '#index/search');
});

test('routeHref history 模式拼接 base', () => {
  assert.equal(routeHref('/a/b', { router: { mode: 'history', base: '/app' } }), '/app/a/b');
  assert.equal(routeHref('/a/b', { router: { mode: 'history' } }), '/a/b');
});

test('routeFromLocation hash 模式解析 location.hash', () => {
  const contracts = { router: { mode: 'hash' } };
  assert.equal(routeFromLocation({ hash: '#/index/article/1' }, contracts), '/index/article/1');
  assert.equal(routeFromLocation({ hash: '' }, contracts, '/'), '/');
  assert.equal(routeFromLocation({ hash: '#/' }, contracts, '/'), '/');
});

test('configureContracts 合并路由配置并可重置', () => {
  resetContracts();
  configureContracts({ router: { mode: 'history', base: '/app' } });
  assert.equal(getContracts().router.mode, 'history');
  assert.equal(getContracts().router.base, '/app');
  resetContracts();
  assert.equal(getContracts().router.mode || 'hash', 'hash', '重置后回到默认');
});

test('limitValue 对未注册 key 回退默认值', () => {
  assert.equal(limitValue('not-exist-key', 'fallback'), 'fallback');
});

test('isAnonymousRoute 识别登录路由', () => {
  resetContracts();
  configureContracts({ auth: { loginRoute: '/index/login', anonymousRoutes: ['/index/about'] } });
  assert.equal(isAnonymousRoute('/index/login'), true);
  assert.equal(isAnonymousRoute('/index/about'), true);
  assert.equal(isAnonymousRoute('/admin/daily'), false);
  resetContracts();
});