const PANEL_CSS = `
:host{position:fixed;right:16px;bottom:16px;width:340px;max-height:70vh;z-index:2147483647;
  background:#1e1e28;color:#d6d6e0;font:12px/1.6 Consolas,Menlo,monospace;
  border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.45);display:flex;flex-direction:column;overflow:hidden}
header{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#2a2a36;cursor:pointer;user-select:none}
header b{color:#8ab4ff;font-weight:600}
header .close{margin-left:auto;cursor:pointer;opacity:.7}
header .close:hover{opacity:1}
.tabs{display:flex;border-bottom:1px solid #33333f}
.tabs span{flex:1;text-align:center;padding:6px 0;cursor:pointer;opacity:.6}
.tabs span.active{opacity:1;color:#8ab4ff;border-bottom:2px solid #8ab4ff}
.kniu-dt-changed{color:#e0af68}
.kniu-dt-added{color:#9ece6a}
.kniu-dt-removed{color:#f7768e;opacity:.75}
.kniu-dt-copy{margin-top:8px;padding:4px 10px;background:#2a2a36;border:1px solid #3a3a48;border-radius:4px;color:#8ab4ff;cursor:pointer;font:inherit}
.kniu-dt-copy:hover{background:#333344}
.content{flex:1;overflow:auto;padding:8px 12px;white-space:pre-wrap;word-break:break-all}
.kniu-dt-row{display:flex;gap:8px;padding:2px 0}
.kniu-dt-path{color:#8ab4ff}
.kniu-dt-dim{opacity:.55}
.kniu-dt-tag{color:#9ece6a}
.kniu-dt-snap{display:flex;gap:8px;align-items:center;padding:3px 0;cursor:pointer;border-radius:4px}
.kniu-dt-snap:hover{background:#2a2a36}
.kniu-dt-snap-time{color:#8ab4ff;flex:none}
.kniu-dt-snap-label{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kniu-dt-snap-act{flex:none;color:#9ece6a;font-size:11px}
.kniu-dt-attrs{margin:0 0 6px 12px;font-size:11px;opacity:.85}
.kniu-dt-bar{height:6px;border-radius:3px;background:#8ab4ff;min-width:2px}
.kniu-dt-bar.slow{background:#f7768e}
.kniu-dt-bar-row{display:flex;gap:8px;align-items:center;padding:3px 0}
.kniu-dt-bar-row .kniu-dt-dim{flex:none;width:56px;text-align:right}
.kniu-dt-section{margin:10px 0 4px;font-size:11px;color:#8a8a99}
.kniu-dt-flame{margin-bottom:3px}
.kniu-dt-flame-label{font-size:10px;color:#9ece6a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kniu-dt-flame-track{position:relative;height:8px;background:#22222c;border-radius:2px;margin-top:1px}
.kniu-dt-flame-bar{position:absolute;top:0;height:8px;border-radius:2px;background:#8ab4ff}
.kniu-dt-flame-bar.slow{background:#f7768e}
`;

const TABS = ['路由', '组件树', '模型', '历史', '性能'];

class KniuDevtoolsPanel extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${PANEL_CSS}</style>`;
  }
  connectedCallback() {
    this._activeTab = this._activeTab ?? 0;
    if (this._api) this._render();
  }
  _render() {
    const shadow = this.shadowRoot;
    const header = document.createElement('header');
    header.innerHTML = `<b>Kniu Devtools</b><span class="kniu-dt-dim">Ctrl+Shift+K 关闭</span><span class="close">✕</span>`;
    header.querySelector('.close').addEventListener('click', () => this.remove());
    const tabs = document.createElement('div');
    tabs.className = 'tabs';
    TABS.forEach((label, index) => {
      const tab = document.createElement('span');
      tab.textContent = label;
      if (index === this._activeTab) tab.classList.add('active');
      tab.addEventListener('click', () => { this._activeTab = index; this._render(); });
      tabs.appendChild(tab);
    });
    const content = document.createElement('div');
    content.className = 'content';
    if (this._activeTab === 0) this._renderRoutes(content);
    else if (this._activeTab === 1) this._renderTree(content);
    else if (this._activeTab === 2) this._renderModel(content);
    else if (this._activeTab === 3) this._renderHistory(content);
    else this._renderPerf(content);
    shadow.replaceChildren(shadow.querySelector('style'), header, tabs, content);
  }
  _renderRoutes(container) {
    const routes = this._api.getEvents().filter((event) => event.type === 'route').slice(-30).reverse();
    if (!routes.length) { container.textContent = '暂无路由记录。'; return; }
    routes.forEach((event) => {
      const row = document.createElement('div');
      row.className = 'kniu-dt-row';
      row.innerHTML = `<span class="kniu-dt-path"></span><span class="kniu-dt-dim"></span>`;
      row.children[0].textContent = event.path;
      row.children[1].textContent = `${event.viewTag} ${event.elapsedMs}ms`;
      container.appendChild(row);
    });
  }
  _renderTree(container) {
    const snapshot = this._api.inspectView();
    if (!snapshot) { container.textContent = '当前无活动视图。'; return; }
    const viewRow = document.createElement('div');
    viewRow.innerHTML = `<span class="kniu-dt-tag"></span>`;
    viewRow.children[0].textContent = snapshot.view;
    container.appendChild(viewRow);
    const changes = (this._api.getEvents?.() || []).filter((item) => item.type === 'props').slice(-6).reverse();
    if (changes.length) {
      const title = document.createElement('div');
      title.className = 'kniu-dt-dim';
      title.textContent = '最近 props 变化';
      container.appendChild(title);
      const shorten = (value) => (String(value ?? '').length > 24 ? `${String(value).slice(0, 24)}…` : String(value ?? ''));
      changes.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'kniu-dt-row';
        const tag = document.createElement('span');
        tag.className = 'kniu-dt-tag';
        tag.textContent = item.tag;
        const detail = document.createElement('span');
        detail.className = 'kniu-dt-dim';
        detail.textContent = `${item.name}: ${shorten(item.from)} → ${shorten(item.to)}`;
        row.append(tag, detail);
        container.appendChild(row);
      });
    }
    const entries = Object.entries(snapshot.components || {}).sort((left, right) => right[1] - left[1]);
    if (!entries.length) { container.appendChild(Object.assign(document.createElement('div'), { className: 'kniu-dt-dim', textContent: 'shadow 内无自定义元素。' })); return; }
    entries.forEach(([tag, count]) => {
      const row = document.createElement('div');
      row.className = 'kniu-dt-row';
      row.innerHTML = `<span class="kniu-dt-tag"></span><span class="kniu-dt-dim"></span>`;
      row.children[0].textContent = tag;
      row.children[1].textContent = `×${count}`;
      container.appendChild(row);
      (snapshot.componentAttrs || []).filter((item) => item.tag === tag).slice(0, 3).forEach((item) => {
        const attrs = Object.entries(item.attrs);
        if (!attrs.length) return;
        const detail = document.createElement('div');
        detail.className = 'kniu-dt-attrs';
        detail.textContent = attrs.map(([name, value]) => `${name}="${value}"`).join(' ');
        container.appendChild(detail);
      });
    });
  }
  _renderPerf(container) {
    const routes = (this._api.getEvents?.() || []).filter((item) => item.type === 'route');
    const records = this._api.getRenders?.() || [];
    if (!routes.length && !records.length) { container.textContent = '暂无渲染耗时记录。'; return; }
    if (routes.length) this._renderRouteTimeline(container, routes);
    if (records.length) this._renderFlameChart(container, records);
  }
  _renderRouteTimeline(container, routes) {
    const spans = routes.map((item) => item.elapsedMs || 0);
    const summary = document.createElement('div');
    summary.className = 'kniu-dt-dim';
    const average = spans.reduce((sum, value) => sum + value, 0) / spans.length;
    summary.textContent = `路由 ${spans.length} 次｜平均 ${average.toFixed(1)}ms｜最大 ${Math.max(...spans).toFixed(1)}ms（含数据加载）`;
    container.appendChild(summary);
    const peak = Math.max(...spans, 1);
    routes.slice(-20).reverse().forEach((item) => {
      const row = document.createElement('div');
      row.className = 'kniu-dt-bar-row';
      const time = document.createElement('span');
      time.className = 'kniu-dt-dim';
      time.textContent = `${(item.elapsedMs || 0).toFixed(1)}ms`;
      const bar = document.createElement('span');
      bar.className = (item.elapsedMs || 0) > 60 ? 'kniu-dt-bar slow' : 'kniu-dt-bar';
      bar.style.width = `${Math.max(2, Math.round(((item.elapsedMs || 0) / peak) * 100))}%`;
      row.title = item.path;
      row.append(time, bar);
      container.appendChild(row);
    });
  }
  _renderFlameChart(container, records) {
    const recent = records.slice(-40);
    let batchStart = recent.length - 1;
    while (batchStart > 0 && recent[batchStart].start - (recent[batchStart - 1].start + recent[batchStart - 1].duration) < 200) {
      batchStart -= 1;
    }
    const batch = recent.slice(batchStart);
    const title = document.createElement('div');
    title.className = 'kniu-dt-section';
    title.textContent = `组件火焰图（最近一批 ${batch.length} 次挂载）`;
    container.appendChild(title);
    const minStart = Math.min(...batch.map((item) => item.start));
    const span = (Math.max(...batch.map((item) => item.start + item.duration)) - minStart) || 1;
    batch.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'kniu-dt-flame';
      const label = document.createElement('div');
      label.className = 'kniu-dt-flame-label';
      label.style.paddingLeft = `${Math.min(item.depth, 4) * 8}px`;
      label.textContent = `${item.tag} ${item.duration.toFixed(1)}ms`;
      const track = document.createElement('div');
      track.className = 'kniu-dt-flame-track';
      const bar = document.createElement('span');
      bar.className = item.duration > 16 ? 'kniu-dt-flame-bar slow' : 'kniu-dt-flame-bar';
      bar.style.left = `${((item.start - minStart) / span) * 100}%`;
      bar.style.width = `${Math.max(0.4, (item.duration / span) * 100)}%`;
      track.appendChild(bar);
      row.title = `${item.tag}｜${item.duration.toFixed(2)}ms｜深度 ${item.depth}`;
      row.append(label, track);
      container.appendChild(row);
    });
  }
  _renderModel(container) {
    const snapshot = this._api.inspectView();
    const keys = snapshot?.modelKeys;
    if (!keys?.length) { container.textContent = '当前视图无暴露模型。'; return; }
    const values = {};
    keys.forEach((key) => {
      let text;
      try { text = JSON.stringify(snapshot.model[key]) ?? String(snapshot.model[key]); }
      catch { text = '[不可序列化]'; }
      values[key] = text.length > 90 ? `${text.slice(0, 90)}…` : text;
    });
    const previous = this._lastModelValues || {};
    const removed = Object.keys(previous).filter((key) => !(key in values));
    const renderRow = (key, text, className) => {
      const row = document.createElement('div');
      row.className = className ? `kniu-dt-row ${className}` : 'kniu-dt-row';
      const label = document.createElement('span');
      label.textContent = key + ' = ';
      const value = document.createElement('span');
      value.textContent = text;
      row.append(label, value);
      container.appendChild(row);
    };
    keys.forEach((key) => {
      const current = values[key];
      if (!(key in previous)) renderRow(key, current, 'kniu-dt-added');
      else if (previous[key] !== current) renderRow(key, current, 'kniu-dt-changed');
      else renderRow(key, current, '');
    });
    removed.forEach((key) => renderRow(key, `${previous[key]}（已移除）`, 'kniu-dt-removed'));
    const copyButton = document.createElement('button');
    copyButton.className = 'kniu-dt-copy';
    copyButton.textContent = '复制模型 JSON';
    copyButton.addEventListener('click', () => {
      copyButton.textContent = '已复制';
      try { void navigator.clipboard?.writeText(JSON.stringify(snapshot.model, null, 2)); } catch { }
      setTimeout(() => { copyButton.textContent = '复制模型 JSON'; }, 1200);
    });
    container.appendChild(copyButton);
    this._lastModelValues = values;
  }
  _renderHistory(container) {
    const snapshots = this._api.getSnapshots?.() || [];
    if (!snapshots.length) { container.textContent = '暂无状态快照，切换路由后会自动记录。'; return; }
    const hint = document.createElement('div');
    hint.className = 'kniu-dt-dim';
    hint.textContent = '点击任意快照可回放该时刻状态。';
    container.appendChild(hint);
    snapshots.forEach((snapshot) => {
      const row = document.createElement('div');
      row.className = 'kniu-dt-snap';
      const time = document.createElement('span');
      time.className = 'kniu-dt-snap-time';
      time.textContent = new Date(snapshot.time).toLocaleTimeString('zh-CN', { hour12: false });
      const label = document.createElement('span');
      label.className = 'kniu-dt-snap-label';
      label.textContent = `#${snapshot.id} ${snapshot.label} · ${snapshot.fields} 字段`;
      const action = document.createElement('span');
      action.className = 'kniu-dt-snap-act';
      action.textContent = '回放';
      if (snapshot.skipped.length) row.title = `已跳过不可快照字段：${snapshot.skipped.join('、')}`;
      row.append(time, label, action);
      row.addEventListener('click', () => {
        const ok = this._api.restoreSnapshot?.(snapshot.id);
        action.textContent = ok ? '已回放' : '回放失败';
        setTimeout(() => this._render(), 600);
      });
      container.appendChild(row);
    });
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('kniu-devtools-panel')) {
  customElements.define('kniu-devtools-panel', KniuDevtoolsPanel);
}

export function openDevtoolsPanel(api) {
  if (typeof document === 'undefined') return;
  let panel = document.querySelector('kniu-devtools-panel');
  if (!panel) {
    panel = document.createElement('kniu-devtools-panel');
    document.body.appendChild(panel);
  }
  panel._api = api;
  panel._render();
  return panel;
}