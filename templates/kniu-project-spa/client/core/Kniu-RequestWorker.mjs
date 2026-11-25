const requests = new Map();
let csrfToken = '';
let csrfHeader = '';
let csrfRotateStatus = 0;
let csrfRotateCode = null;

self.addEventListener('message', async (event) => {
  const message = event.data || {};
  if (message.type === 'configure') {
    if (message.csrfHeader != null) csrfHeader = String(message.csrfHeader);
    if (message.csrfRotateStatus != null) csrfRotateStatus = Number(message.csrfRotateStatus);
    if (message.csrfRotateCode != null) csrfRotateCode = message.csrfRotateCode;
    return;
  }
  if (message.type === 'abort') {
    requests.get(message.id)?.abort();
    return;
  }
  if (message.type !== 'request' || !message.id) return;

  const controller = new AbortController();
  requests.set(message.id, controller);
  try {
    const headers = message.init.headers || {};
    const hasCsrf = csrfHeader && Object.keys(headers).some((key) => key.toLowerCase() === csrfHeader.toLowerCase());
    if (csrfHeader && csrfToken && !hasCsrf) {
      message.init.headers = { ...headers, [csrfHeader]: csrfToken };
    }
    let response = await fetch(message.url, { ...message.init, signal: controller.signal });
    const previousToken = csrfToken;
    if (csrfHeader) {
      const deliveredToken = response.headers.get(csrfHeader);
      if (deliveredToken) csrfToken = deliveredToken;
    }
    if (csrfRotateStatus && response.status === csrfRotateStatus && csrfRotateCode != null) {
      const preview = await response.clone().json().catch(() => null);
      const responseToken = csrfHeader ? response.headers.get(csrfHeader) || '' : '';
      if (preview?.status === csrfRotateCode && responseToken && responseToken !== previousToken) {
        csrfToken = responseToken;
        if (csrfHeader) message.init.headers[csrfHeader] = csrfToken;
        response = await fetch(message.url, { ...message.init, signal: controller.signal });
      }
    }
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('json') ? await response.json() : await response.text();
    self.postMessage({
      type: 'response',
      id: message.id,
      result: { ok: response.ok, status: response.status, statusText: response.statusText, headers: Object.fromEntries(response.headers.entries()), data }
    });
  } catch (error) {
    self.postMessage({ type: 'error', id: message.id, error: { name: error.name, message: error.message } });
  } finally {
    requests.delete(message.id);
  }
});