import MVVM from '../../core/kniumvvm.mjs';
import UI from '../../core/kniuui.js';

const { controller, reactive, watch } = MVVM;

const footerController = controller(() => {
  const state = reactive({
    currentYear: new Date().getFullYear(),
    loading: UI.state.loading
  });
  watch(() => UI.state.loading, function (value) {
    state.loading = value;
  });
  return { state };
});

export default footerController;