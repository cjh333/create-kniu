import { defineComponent, reactive, toRefs } from '../core/kniumvvm.mjs';

export const insightsController = defineComponent({
  setup() {
    const state = reactive({
      name: '数据洞察',
      icon: '↗',
      color: '#e7a11a',
      sales: { label: '本月销售额', value: '¥ 1,284,560', change: '同比增长 18.4% ↗' },
      channelPerformance: [44, 68, 58, 88, 74, 100, 84, 72],
      trafficSources: [
        { name: '直接访问', rate: '42.8%' },
        { name: '搜索引擎', rate: '31.6%' },
        { name: '合作渠道', rate: '18.2%' },
        { name: '其他', rate: '7.4%' }
      ]
    });

    toRefs(state);
  }
});
