import { setup } from '../../core/Kniu-MVVM.mjs';

export default setup(({ reactive, onMounted }) => {
  const state = reactive({
    message: '这个页面由 aboutController.js 与 about/about.html 关联。',
    pageTitle: '关于'
  });

  onMounted(() => {
    console.debug('[about] mounted');
  });

  return { state };
});
