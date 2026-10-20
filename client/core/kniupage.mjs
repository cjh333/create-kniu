export async function withSubmitting(state, keyOrFn, maybeFn) {
  let key = 'isSubmitting';
  let fn = keyOrFn;
  if (typeof keyOrFn === 'string') {
    key = keyOrFn;
    fn = maybeFn;
  }
  if (state[key]) return;
  state[key] = true;
  try {
    await fn();
  } finally {
    state[key] = false;
  }
}

export function createRequestActions(io) {
  const request = io && io.request;
  const msg = io && io.msg;
  if (typeof request !== 'function' || typeof msg !== 'function') {
    throw new Error('createRequestActions 需要 request 与 msg');
  }
  const isOk = typeof io.isOk === 'function' ? io.isOk : function (res) { return Number(res && res.status) === 1; };
  const messageOf = typeof io.messageOf === 'function' ? io.messageOf : function (res) { return (res && res.msg) || ''; };

  async function post(url, data, options) {
    const config = options || {};
    let result = null;
    await request({
      url: url,
      type: 'POST',
      data: data,
      mutation: config.mutation,
      success(res) {
        if (!isOk(res)) {
          msg({ content: messageOf(res) || '请求失败', type: 'error' });
          return;
        }
        result = res;
        if (typeof config.onOk === 'function') config.onOk(res);
        if (config.toast !== false) msg({ content: messageOf(res) || '操作成功', type: 'success' });
      },
      fail(res) { msg({ content: messageOf(res) || '请求失败', type: 'error' }); }
    });
    return result;
  }

  async function updateRow(url, row, patch, options) {
    if (!row) return false;
    const config = options || {};
    const res = await post(url, Object.assign({ id: row.id }, patch), { toast: false });
    if (!res) return false;
    Object.assign(row, patch);
    if (typeof config.onSaved === 'function') config.onSaved(res);
    msg({ content: messageOf(res) || '操作成功', type: 'success' });
    return true;
  }

  return { post: post, updateRow: updateRow };
}