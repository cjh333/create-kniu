import { defineComponent, reactive, toRefs } from '../core/kniumvvm.mjs';
import { UTIL } from '../core/kniutil.mjs';

export const mainController = defineComponent({
  setup() {
    const state = reactive({ ui: UTIL.state });
    toRefs(state);
  }
});
