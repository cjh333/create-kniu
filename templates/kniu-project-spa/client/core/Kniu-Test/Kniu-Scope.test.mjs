import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScope, getDefaultScope, setDefaultScope, withScope, scopeGet, scopeSet, scopeDelete, scopeKeys } from '../Kniu-Scope.mjs';

test('createScope 读写与删除只作用于自身 Map', () => {
  const scope = createScope(null);
  scope.set('token', 'abc');
  assert.equal(scope.get('token'), 'abc');
  assert.equal(scope.has('token'), true);
  scope.delete('token');
  assert.equal(scope.get('token'), undefined);
  assert.equal(scope.has('token'), false);
});

test('createScope 未命中自身时回退父级', () => {
  const parent = createScope(null);
  parent.set('shared', 'from-parent');
  const child = createScope(parent);
  assert.equal(child.get('shared'), 'from-parent');
  child.set('shared', 'from-child');
  assert.equal(child.get('shared'), 'from-child');
  assert.equal(parent.get('shared'), 'from-parent');
});

test('createScope 支持命名安装器写入全局', () => {
  const installer = createScope('kniu-test-flag', 42);
  assert.equal(installer.name, 'scope:kniu-test-flag');
  installer.install();
  assert.equal(globalThis['kniu-test-flag'], 42);
  delete globalThis['kniu-test-flag'];
});

test('setDefaultScope 切换后 withScope 恢复原作用域', () => {
  const original = getDefaultScope();
  const scoped = createScope(null);
  scoped.set('marker', 'scoped');
  const returned = setDefaultScope(scoped);
  assert.equal(returned, scoped);
  assert.equal(scopeGet('marker'), 'scoped');
  withScope(original, () => {
    assert.notEqual(getDefaultScope(), scoped);
  });
  assert.equal(getDefaultScope(), scoped);
  setDefaultScope(original);
});

test('scopeSet 返回写入值且 keys 仅列自身键', () => {
  const original = getDefaultScope();
  const scoped = createScope(null);
  setDefaultScope(scoped);
  assert.equal(scopeSet('a', 1), 1);
  scopeSet('b', 2);
  assert.deepEqual(scopeKeys().sort(), ['a', 'b']);
  scopeDelete('a');
  assert.equal(scopeGet('a'), undefined);
  setDefaultScope(original);
});