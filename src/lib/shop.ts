export const CATALOG = {
  mulligan: { name: "Mulligan", description: "One re-hit for your team", unitAmount: 1000 },
  string: { name: "String extender", description: "One sealed 6–24 inch digital envelope", unitAmount: 2000 },
  splits: { name: "Banana Splits", description: "Half the pot goes to the winner", unitAmount: 2000 },
} as const;

export type ProductId = keyof typeof CATALOG;

export type CheckoutLine = {
  productId: ProductId;
  qty: number;
};

function isProductId(value: string): value is ProductId {
  return Object.prototype.hasOwnProperty.call(CATALOG, value);
}

export function validateCheckoutLines(value: unknown): CheckoutLine[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > Object.keys(CATALOG).length) {
    return null;
  }

  const seen = new Set<ProductId>();
  const lines: CheckoutLine[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const { productId, qty } = item as { productId?: unknown; qty?: unknown };
    if (
      typeof productId !== "string"
      || !isProductId(productId)
      || seen.has(productId)
      || typeof qty !== "number"
      || !Number.isInteger(qty)
      || qty < 1
      || qty > 20
    ) {
      return null;
    }
    seen.add(productId);
    lines.push({ productId, qty });
  }

  return lines;
}

export function parseCheckoutLines(value: string | null | undefined): CheckoutLine[] | null {
  if (!value) return null;
  try {
    return validateCheckoutLines(JSON.parse(value));
  } catch {
    return null;
  }
}

export function checkoutTotalCents(lines: CheckoutLine[]) {
  return lines.reduce((total, line) => total + CATALOG[line.productId].unitAmount * line.qty, 0);
}

export function ticketPrefix(sessionId: string) {
  let hash = 0;
  for (let index = 0; index < sessionId.length; index += 1) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(6, "0").slice(-6);
}
