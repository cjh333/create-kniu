import { createOrdersModel } from '../model/ordersModel.js';

export const ordersController = {
  data: {
    name: '订单中心',
    icon: '▤',
    color: '#635bff',
    badge: String(createOrdersModel().orders.length)
  },
  mount(kniusystem) {
    const model = createOrdersModel();
    const pageSize = 10;
    const updatePage = (state, page = 1) => {
      const filteredOrders = state.currentFilter === 'all'
        ? model.orders
        : model.orders.filter((order) => order.status === state.currentFilter);
      state.totalOrders = filteredOrders.length;
      state.totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
      state.currentPage = Math.min(Math.max(page, 1), state.totalPages);
      const start = (state.currentPage - 1) * pageSize;
      state.orders = filteredOrders.slice(start, start + pageSize);
    };
    const state = kniusystem.reactive({
      ...model,
      orders: model.orders.slice(0, pageSize),
      currentFilter: 'all',
      currentPage: 1,
      totalPages: Math.ceil(model.orders.length / pageSize),
      totalOrders: model.orders.length,
      handleFilterOrders(event) {
        this.currentFilter = event.currentTarget.dataset.filter;
        updatePage(this, 1);
      },
      handlePreviousPage() {
        updatePage(this, this.currentPage - 1);
      },
      handleNextPage() {
        updatePage(this, this.currentPage + 1);
      },
      handleExportOrders() {
        this.emit('toast', model.exportMessage);
      }
    });
    updatePage(state);
  }
};
