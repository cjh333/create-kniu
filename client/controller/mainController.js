import KniuMvvm from '../core/kniumvvm.mjs';
import UTIL from '../core/kniuui.js';

const { controller, reactive } = KniuMvvm;

const mainController = controller(() => {
    const state = reactive({ ui: UTIL.state });
    return { state };
});

export default mainController;
