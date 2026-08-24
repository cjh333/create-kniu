import KniuMvvm from '../../core/kniumvvm.mjs';
import UI from '../../core/kniuui.js';

const { controller, reactive, watch } = KniuMvvm;

const footerController = controller(() => {
  const state = reactive({
    currentYear: new Date().getFullYear(),
    // 初始值与全局加载态对齐
    loading: UI.state.loading
  });
  // 跟随全局加载态（ui.loading）。
  // 注意：模板引擎对 extra 作用域传入的「深层路径」（如 {{ui.loading}}）只记录顶层 key，
  // 不会追踪 ui 对象内部的属性变化，因此这里手动把全局 loading 镜像到组件自身响应式 state，
  // 模板改用 {{loading}} 绑定即可获得响应式更新。
  watch(() => UI.state.loading, function (value) {
    state.loading = value;
  });
  return { state };
});

export default footerController;
