import { createInsightsModel } from '../model/insightsModel.js';

export const insightsController = {
  data: {
    name: '数据洞察',
    icon: '↗',
    color: '#e7a11a'
  },
  mount(kniusystem) {
    kniusystem.reactive(createInsightsModel());
  }
};
