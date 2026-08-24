import KniuMvvm from '../../core/kniumvvm.mjs';

const { controller, reactive } = KniuMvvm;

const headerController = controller(() => {
  const state = reactive({ ready: true });
  return { state };
});

export default headerController;
