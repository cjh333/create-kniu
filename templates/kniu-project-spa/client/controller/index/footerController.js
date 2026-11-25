import { setup } from '../../core/Kniu-MVVM.mjs';

export default setup(({ reactive, onMounted }) => {
  const state = reactive({
    label: 'Kniu 示例底部'
  });

  onMounted(() => {
    console.debug('[footer] mounted');
  });

  return { state };
});
