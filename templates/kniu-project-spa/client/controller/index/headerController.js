import { setup } from '../../core/kniu-mvvm.mjs';

export default setup(({ reactive, onMounted }) => {
  const state = reactive({
    label: 'Kniu 示例头部'
  });

  onMounted(() => {
    console.debug('[header] mounted');
  });

  return { state };
});
