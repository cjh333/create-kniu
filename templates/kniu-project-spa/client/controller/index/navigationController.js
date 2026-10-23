import { setup } from '../../core/kniu-mvvm.mjs';

export default setup(({ reactive, onMounted }) => {
  const state = reactive({
    home: '首页',
    about: '关于'
  });

  onMounted(() => {
    console.debug('[navbar] mounted');
  });

  return { state };
});