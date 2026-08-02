export function createOrdersModel() {
  const orders = [
    { number: '#OD-3048', title: '江屿设计', content: '企业协作套件', pay: '3680', status: '待付款' },
    { number: '#OD-3047', title: '星河科技', content: '数据服务年包', pay: '12800', status: '处理中' },
    { number: '#OD-3046', title: '远山工作室', content: '标准版订阅', pay: '1299', status: '已完成' },
    { number: '#OD-3045', title: '一禾餐饮', content: '门店管理套件', pay: '4520', status: '处理中' },
  ];
  return {
    orders,
    nopay: orders.filter((order) => order.status === '待付款').length,
    processing: orders.filter((order) => order.status === '处理中').length,
    completed: orders.filter((order) => order.status === '已完成').length,
    exportMessage: '订单导出成功',
  };
}
