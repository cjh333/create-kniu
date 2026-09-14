import MVVM from '../../core/kniumvvm.mjs';
import UTIL from '../../core/kniuui.js';

const { controller, reactive } = MVVM;

const mainController = controller(() => {
    const state = reactive({ ui: UTIL.state });
    return { state };
});

export default mainController;