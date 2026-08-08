// Stripe paused the account on the morning of the golf day. While this is
// false, purchases become IOUs on the team's tab and no Stripe code runs.
// Flip back to true when the account is restored.
export const PAYMENTS_ENABLED = false;

export const CATALOG = {
  mulligan: { name: "Mulligan", description: "One team re-hit · final sale", unitAmount: 1000 },
  string: { name: "String", description: "One-use sealed 6–24 inch string", unitAmount: 2000 },
  splits: { name: "Banana Splits", description: "Half the pot goes to the winner", unitAmount: 2000 },
} as const;

export type ProductId = keyof typeof CATALOG;

export type CheckoutLine = {
  productId: ProductId;
  qty: number;
  beneficiaryType?: "team" | "player";
  beneficiaryPlayerId?: string | null;
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
    const { productId, qty, beneficiaryType, beneficiaryPlayerId } = item as {
      productId?: unknown;
      qty?: unknown;
      beneficiaryType?: unknown;
      beneficiaryPlayerId?: unknown;
    };
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
    if (productId === "splits") {
      if (beneficiaryType !== "team" && beneficiaryType !== "player") return null;
      if (beneficiaryType === "player" && (typeof beneficiaryPlayerId !== "string" || !beneficiaryPlayerId)) return null;
      if (beneficiaryType === "team" && beneficiaryPlayerId != null) return null;
      lines.push({
        productId,
        qty,
        beneficiaryType,
        beneficiaryPlayerId: beneficiaryType === "player" ? beneficiaryPlayerId as string : null,
      });
      seen.add(productId);
      continue;
    }
    if (beneficiaryType !== undefined || beneficiaryPlayerId !== undefined) return null;
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

export function checkoutBeneficiaryValid(lines: CheckoutLine[], teamId: string) {
  const splits = lines.find((line) => line.productId === "splits");
  return !splits
    || splits.beneficiaryType === "team"
    || (
      splits.beneficiaryPlayerId?.startsWith(teamId) === true
      && /^-p[1-4]$/.test(splits.beneficiaryPlayerId.slice(teamId.length))
    );
}

export function ticketPrefix(sessionId: string) {
  let hash = 0;
  for (let index = 0; index < sessionId.length; index += 1) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(6, "0").slice(-6);
}
