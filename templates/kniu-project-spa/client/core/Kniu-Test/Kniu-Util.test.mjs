import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeAttribute, createLruCache, assignModelFields, assignOptionFields,
  optionsToValues, updateListRecord, resolveAliasReferences, isValidEmail
} from '../Kniu-Util.mjs';

test('escapeAttribute 全量转义五类危险字符', () => {
  assert.equal(escapeAttribute('a&b"c\'d<e>f'), 'a&amp;b&quot;c&#39;d&lt;e&gt;f');
  assert.equal(escapeAttribute(null), '');
  assert.equal(escapeAttribute(0), '0');
});

test('createLruCache 超限淘汰最久未访问项', () => {
  const cache = createLruCache(2);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.get('a');
  cache.set('c', 3);
  assert.equal(cache.has('b'), false);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('c'), 3);
  assert.equal(cache.size, 2);
});

test('createLruCache 重复 set 刷新热度且不超限', () => {
  const cache = createLruCache(2);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('a', 10);
  cache.set('c', 3);
  assert.equal(cache.has('b'), false);
  assert.equal(cache.get('a'), 10);
});

test('assignModelFields 按目标字段覆盖且缺失源字段给空默认', () => {
  const target = { name: '旧名', age: 0, extra: '旧值' };
  const result = assignModelFields(target, { name: '新名', age: null });
  assert.equal(result.name, '新名');
  assert.equal(result.age, '');
  assert.equal(result.extra, '');
  assert.equal(assignModelFields(null, { a: 1 }), null);
});

test('assignOptionFields 支持 value 槽对象与普通字段', () => {
  const options = { keyword: '', page: { value: 1 } };
  assignOptionFields(options, { keyword: 'kniu', page: 3, ignored: 1 });
  assert.equal(options.keyword, 'kniu');
  assert.equal(options.page.value, 3);
  assert.deepEqual(optionsToValues(options), { keyword: 'kniu', page: 3 });
});

test('updateListRecord 按 key 匹配并返回新数组不改动原列表', () => {
  const list = [{ id: 1, title: '甲' }, { id: 2, title: '乙' }];
  const updated = updateListRecord(list, { id: 2, title: '丙' });
  assert.equal(updated[1].title, '丙');
  assert.equal(list[1].title, '乙');
  assert.notEqual(updated, list);
  assert.deepEqual(updateListRecord(null, { id: 1 }), []);
});

test('resolveAliasReferences 按别名前缀替换路径且无别名时原样返回', () => {
  const aliased = resolveAliasReferences('<include src="@ui/button.html">', { '@ui': 'views/ui' });
  assert.equal(aliased, '<include src="/views/ui/button.html">');
  assert.equal(resolveAliasReferences('<include src="plain.html">'), '<include src="plain.html">');
});

test('isValidEmail 拒绝空值与非法格式', () => {
  assert.equal(isValidEmail('a@b.cn'), true);
  assert.equal(isValidEmail('a@b'), false);
  assert.equal(isValidEmail(''), false);
  assert.equal(isValidEmail(null), false);
});