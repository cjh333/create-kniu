import { createInventoryModel } from '../model/inventoryModel.js';

export const inventoryController = {
  data: {
    name: '库存管理',
    icon: '◇',
    color: '#19a974'
  },
  mount(root, kniusystem) {
    kniusystem.reactive(createInventoryModel());
  },
};
