import MVVM from '../../core/kniumvvm.mjs';
import UTIL from '../../core/kniuui.js';

const { controller } = MVVM;

const mainController = controller(({ reactive }) => {
    const state = reactive({ ui: UTIL.state });
    return { state };
});

export default mainController;