export const routes = {
  '/': {
    title: '首页',
    template: 'index/home.html',
    controller: 'index/homeController.js',
    seo: {
      description: 'Kniu 通用原生 SPA 框架示例。'
    },
    default: true
  },
  '/about/:id': {
    title: ({ model }) => model?.pageTitle || '关于',
    template: 'about/about.html',
    controller: 'about/aboutController.js',
    seo: ({ params }) => ({ description: `关于页面，编号 ${params.id}。` })
  }
};

export default routes;