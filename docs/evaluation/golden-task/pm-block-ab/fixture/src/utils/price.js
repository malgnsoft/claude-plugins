// 주문 금액 계산
export function calcPrice(unitPrice, quantity) {
  const base = unitPrice * quantity;
  if (quantity >= 10) {
    return Math.round(base * 0.9);
  }
  return base;
}
