import { setup } from '../../core/Kniu-MVVM.mjs';

export default setup(({ reactive, onMounted }) => {
  const state = reactive({
    label: 'Kniu 示例头部'
  });

  onMounted(() => {
    console.debug('[header] mounted');
  });

  return { state };
});
