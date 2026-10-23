import { setup } from '../../core/kniu-mvvm.mjs';

export default setup(({ reactive, computed, watch, onMounted, context }) => {
  const state = reactive({
    visits: 0,
    search: '',
    rating: 3,
    features: ['路由钩子', '模板插值', '零依赖'],
    multiplication: Array.from({ length: 9 }, (_, row) => Array.from({ length: row + 1 }, (_, column) => ({ left: column + 1, right: row + 1, result: (column + 1) * (row + 1) })))
  });

  const visitLabel = computed(() => {
    return `已点击 ${state.visits} 次`;
  });

  watch(() => state.search, (value) => console.debug('搜索内容：', value));

  onMounted(() => {
    console.debug('[home] mounted');
  });

  return {
    state,
    visitLabel,
    increment() {
      state.visits += 1;
    },
    onRate(event) {
      state.rating = Number(event?.detail?.value) || state.rating;
    },
    openAbout() {
      context.navigate('/about/:id', { id: state.visits || 1 });
    }
  };
});