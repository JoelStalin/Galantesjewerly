export type CartPolicyItem = {
  productId?: string | number;
  quantity: number;
  clientPrice?: number;
};

export type StockSnapshot = {
  productId: number;
  stock: number;
  price: number;
};

export function validateCartForCheckout(items: CartPolicyItem[], stock: StockSnapshot[]) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('The cart is empty.');

  const snapshots = new Map(stock.map((item) => [item.productId, item]));
  const seen = new Set<number>();
  let total = 0;

  for (const [index, item] of items.entries()) {
    const productId = Number(item.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new Error(`Cart item ${index + 1} has an invalid product ID.`);
    }
    if (seen.has(productId)) throw new Error(`Product ${productId} appears more than once in the cart.`);
    seen.add(productId);
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error(`Quantity for product ${productId} must be a positive integer.`);
    }

    const current = snapshots.get(productId);
    if (!current) throw new Error(`Product ${productId} is no longer available.`);
    if (!Number.isFinite(current.stock) || current.stock < 0) throw new Error(`Stock for product ${productId} is invalid.`);
    if (item.quantity > current.stock) throw new Error(`Insufficient stock for product ${productId}. Available: ${current.stock}.`);
    if (!Number.isFinite(current.price) || current.price < 0) throw new Error(`Price for product ${productId} is invalid.`);
    total += current.price * item.quantity;
  }

  return { total, items: items.map((item) => ({ productId: Number(item.productId), quantity: item.quantity, price: snapshots.get(Number(item.productId))!.price })) };
}
