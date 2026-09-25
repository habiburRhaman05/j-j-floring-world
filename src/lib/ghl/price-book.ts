import "server-only";
import { guessUnit, type PriceBookItem } from "@/lib/pricebook/types";
import { listProductPrices, listProducts, type GhlConnection } from "./client";

/** GHL descriptions are HTML ("<p>this test product</p>"); the estimate wants plain text. */
function plainText(html: string | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{2,}/g, "\n")
    .trim();
  return text || null;
}

/**
 * The price book: every active product in GHL with its one-time prices,
 * flattened to one item per price. Read live, so a price changed in GHL is
 * what the next estimate line uses. Recurring (subscription) prices are left
 * out - an estimate quotes a job, not a plan.
 */
export async function fetchPriceBook(connection: GhlConnection): Promise<PriceBookItem[]> {
  const products = (await listProducts(connection)).filter((p) => (p.status ?? "active") === "active");

  // A few products at a time keeps well inside GHL's rate limit.
  const priced: { product: (typeof products)[number]; prices: Awaited<ReturnType<typeof listProductPrices>> }[] = [];
  const CHUNK = 5;
  for (let i = 0; i < products.length; i += CHUNK) {
    const chunk = products.slice(i, i + CHUNK);
    const results = await Promise.all(chunk.map((product) => listProductPrices(connection, product._id)));
    chunk.forEach((product, j) => priced.push({ product, prices: results[j]! }));
  }

  const items: PriceBookItem[] = [];
  for (const { product, prices } of priced) {
    const usable = prices.filter((p) => !p.deleted && (p.type ?? "one_time") === "one_time" && Number.isFinite(Number(p.amount)));
    for (const price of usable) {
      const description = plainText(product.description);
      // GHL names an unnamed price "<product> @ <amount>"; only show a price name when it adds something.
      const named = usable.length > 1 && price.name && !/ @ [\d.,]+$/.test(price.name);
      items.push({
        id: `${product._id}:${price._id}`,
        productId: product._id,
        priceId: price._id,
        name: product.name,
        priceLabel: named ? price.name : null,
        description,
        imageUrl: product.image || null,
        unitPrice: Number(price.amount),
        compareAtPrice: price.compareAtPrice ? Number(price.compareAtPrice) : null,
        currency: price.currency ?? "USD",
        unit: guessUnit(price.name, product.name, description),
      });
    }
  }
  return items.sort((a, b) => a.name.localeCompare(b.name));
}
