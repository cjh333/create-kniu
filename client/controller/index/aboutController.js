import KniuMvvm from '../../core/kniumvvm.mjs';

const { controller, reactive } = KniuMvvm;

const aboutController = controller(() => {
  const state = reactive({ ready: true, currentYear: new Date().getFullYear() });
  return { state };
});

export default aboutController;