import { createOrdersModel } from '../model/ordersModel.js';

export const ordersController = {
  data: {
    name: '订单中心',
    icon: '▤',
    color: '#635bff',
    badge: '24'
  },
  mount(root, kniusystem) {
    const model = createOrdersModel();
    kniusystem.reactive({
      ...model,
      handleExportOrders() {
        this.emit('toast', model.exportMessage);
      },
    });
  },
};
