import { Table, TableWrap, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { totalsFor } from "@/lib/data/pricing";
import { money2, pct, qty } from "@/lib/format";
import type { Database, LineItem } from "@/lib/types";

interface LineTableProps {
  db: Database;
  lineItems: LineItem[];
  /**
   * The cost and margin columns are only ever BUILT for Admin, so for every
   * other role those cells do not exist in the DOM to be found.
   */
  showCost: boolean;
}

export function LineTable({ db, lineItems, showCost }: LineTableProps) {
  const totals = totalsFor(db.products, lineItems);

  return (
    <TableWrap>
      <Table>
        <THead>
          <Tr>
            <Th>Item</Th>
            <Th>Unit</Th>
            <Th numeric>Qty</Th>
            <Th numeric>Price</Th>
            <Th numeric>Line total</Th>
            {showCost ? (
              <>
                <Th numeric>Cost</Th>
                <Th numeric>Margin</Th>
              </>
            ) : null}
          </Tr>
        </THead>
        <TBody>
          {totals.rows.map((row) => (
            <Tr key={row.productId}>
              <Td>
                <div>{row.name}</div>
                <div className="t-meta">{row.category}</div>
              </Td>
              <Td className="muted">{row.unit}</Td>
              <Td numeric>{qty(row.qty)}</Td>
              <Td numeric>{money2(row.pricePerUnit)}</Td>
              <Td numeric>{money2(row.linePrice)}</Td>
              {showCost ? (
                <>
                  <Td numeric className="muted">
                    {money2(row.lineCost)}
                  </Td>
                  <Td numeric>{money2(row.linePrice - row.lineCost)}</Td>
                </>
              ) : null}
            </Tr>
          ))}

          {/* The total row stays inside the tbody so the last-row rules keep
              the table's bottom hairline clean, exactly as before. */}
          <Tr style={{ background: "var(--panel-sunk)" }}>
            <Td colSpan={4} style={{ textAlign: "right", fontWeight: 600 }}>
              Total
            </Td>
            <Td numeric style={{ fontWeight: 700 }}>
              {money2(totals.totalPrice)}
            </Td>
            {showCost ? (
              <>
                <Td numeric className="muted">
                  {money2(totals.totalCost)}
                </Td>
                <Td numeric style={{ fontWeight: 700, color: "var(--moss)" }}>
                  {money2(totals.totalMargin)}
                </Td>
              </>
            ) : null}
          </Tr>
        </TBody>
      </Table>
    </TableWrap>
  );
}

interface InvoiceSummaryProps {
  totalPrice: number;
  totalCost: number;
  totalMargin: number;
  depositPercent: number;
  depositAmount: number;
  depositPaid: boolean;
  balanceAmount: number;
  showCost: boolean;
}

/** Compact money summary. Cost and margin rows exist only for Admin. */
export function InvoiceSummary({
  totalPrice,
  totalCost,
  totalMargin,
  depositPercent,
  depositAmount,
  depositPaid,
  balanceAmount,
  showCost,
}: InvoiceSummaryProps) {
  return (
    <dl className="kv">
      <dt>Contract total</dt>
      <dd>{money2(totalPrice)}</dd>

      <dt>Deposit ({depositPercent}%)</dt>
      <dd>
        {money2(depositAmount)}
        {depositPaid ? " paid" : " due"}
      </dd>

      <dt>Balance</dt>
      <dd>{money2(balanceAmount)}</dd>

      {showCost ? (
        <>
          <dt>Cost of goods</dt>
          <dd>{money2(totalCost)}</dd>

          <dt>Margin</dt>
          <dd style={{ color: "var(--moss)", fontWeight: 600 }}>
            {money2(totalMargin)}
            {`  (${pct(totalPrice ? (totalMargin / totalPrice) * 100 : 0)})`}
          </dd>
        </>
      ) : null}
    </dl>
  );
}
