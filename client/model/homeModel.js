export function createHomeModel() {
  return {
    greeting: '上午好',
    userName: '林夕',
    todayOrders: 128,
    stats: [
      { label: '今日营收', value: '¥ 48,260', tip: '↑ 12.6% 较昨日' },
      { label: '待处理订单', value: '24', tip: '8 笔即将超时' },
      { label: '活跃客户', value: '1,892', tip: '↑ 5.2% 本月' },
      { label: '库存预警', value: '7', tip: '需要及时补货' },
    ],
    orderTrend: [32, 45, 36, 58, 48, 70, 55, 77, 66, 91, 72, 98]
      .map((height, index) => ({ height, hot: index >= 9 })),
    activities: ['订单 #3048 已完成支付', '华东仓完成批量入库', '新客户「星河科技」已注册'],
  };
}
