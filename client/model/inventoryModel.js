export function createInventoryModel() {
  const products = [
    { icon: '▣', name: '智能终端 Pro', quantity: 126, stockRate: 76, safeStock: 40 },
    { icon: '◉', name: '云端网关 S2', quantity: 38, stockRate: 26, safeStock: 50 },
    { icon: '⌁', name: '环境传感器', quantity: 284, stockRate: 88, safeStock: 100 },
  ].map((product) => ({ ...product, low: product.quantity < product.safeStock }));
  return {
    title: '库存管理',
    warehouseCount: 3,
    stockTotal: products.reduce((total, product) => total + product.quantity, 0),
    products,
  };
}
