export const NAVIGATION_ITEMS = [
  { path: '/', name: '控制台', icon: 'house' },
  { path: '/seo', name: '网站信息', icon: 'document' },
  { path: '/nav', name: '栏目管理', icon: 'folder' }
];

export const ROUTE_TO_NAVIGATION = {
  '/dailydetail': '/nav',
  '/articledetail': '/nav'
};

export const NAVIGATION_PATHS = NAVIGATION_ITEMS.map(function (item) { return item.path; });