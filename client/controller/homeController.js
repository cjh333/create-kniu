import { createHomeModel } from '../model/homeModel.js';

export const homeController = {
  data: {
    name: '总览',
    icon: '⌂',
    color: '#ff5c35'
  },
  mount(kniusystem) {
    kniusystem.reactive({
      ...createHomeModel(),
      handleCreateOrder() {
        this.emit('toast', '草稿订单已创建');
        kniusystem.navigateTo('/orders');
      },
    });
  },
};
