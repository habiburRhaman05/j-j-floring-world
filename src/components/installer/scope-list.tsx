import { invoiceForJob } from "@/lib/data/selectors";
import { qty } from "@/lib/format";
import type { Database, Job } from "@/lib/types";

/**
 * PERMISSIONS: this component reads product names, units and quantities only.
 * It never reads pricePerUnit, costPerUnit or any invoice money field, so no
 * money figure of any kind is constructed for this role.
 */
export function ScopeList({ db, job }: { db: Database; job: Job }) {
  const invoice = invoiceForJob(db, job.id);
  const lines = invoice ? invoice.lineItems : [];

  if (!lines.length) {
    return (
      <ul className="scope-list">
        <li>
          <span className="t-meta">Scope not attached yet.</span>
        </li>
      </ul>
    );
  }

  return (
    <ul className="scope-list">
      {lines.map((line) => {
        const product = db.products.find((p) => p.id === line.productId);
        if (!product) return null;
        return (
          <li key={line.productId}>
            <span>{product.name}</span>
            <span className="q">
              {qty(line.qty)} {product.unit}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
