export function createOrdersModel() {
  const orders = [
    { number: '#OD-3048', title: '江屿设计', content: '企业协作套件', pay: '3680', status: '待付款' },
    { number: '#OD-3047', title: '星河科技', content: '数据服务年包', pay: '12800', status: '处理中' },
    { number: '#OD-3046', title: '远山工作室', content: '标准版订阅', pay: '1299', status: '已完成' },
    { number: '#OD-3045', title: '一禾餐饮', content: '门店管理套件', pay: '4520', status: '处理中' },
    { number: '#OD-3044', title: '青禾教育', content: '智慧校园服务', pay: '6800', status: '待付款' },
    { number: '#OD-3043', title: '云帆物流', content: '运输调度系统', pay: '9600', status: '已完成' },
    { number: '#OD-3042', title: '拾光摄影', content: '客户管理套件', pay: '2380', status: '处理中' },
    { number: '#OD-3041', title: '博雅咨询', content: '专业版订阅', pay: '4999', status: '待付款' },
    { number: '#OD-3040', title: '森野家居', content: '库存管理系统', pay: '7350', status: '已完成' },
    { number: '#OD-3039', title: '启明文化', content: '内容协作套件', pay: '3280', status: '处理中' },
    { number: '#OD-3038', title: '新锐传媒', content: '营销数据服务', pay: '8600', status: '待付款' },
    { number: '#OD-3037', title: '蓝海医药', content: '企业旗舰版', pay: '15800', status: '已完成' },
    { number: '#OD-3036', title: '筑梦建筑', content: '项目协作套件', pay: '6200', status: '处理中' },
    { number: '#OD-3035', title: '麦田食品', content: '连锁门店服务', pay: '5480', status: '待付款' },
    { number: '#OD-3034', title: '极光网络', content: '数据分析年包', pay: '11200', status: '已完成' },
    { number: '#OD-3033', title: '松果科技', content: '团队协作标准版', pay: '2899', status: '处理中' },
  ];
  return {
    orders,
    nopay: orders.filter((order) => order.status === '待付款').length,
    processing: orders.filter((order) => order.status === '处理中').length,
    completed: orders.filter((order) => order.status === '已完成').length,
    exportMessage: '订单导出成功',
  };
}
