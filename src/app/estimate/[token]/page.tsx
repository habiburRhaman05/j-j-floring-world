import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadPublicEstimate } from "@/lib/estimates/public.server";
import { estimateTierTotals, round2 } from "@/lib/data/pricing";
import { money2, qty, dt } from "@/lib/format";
import { TIERS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Estimate | J&J Flooring World",
  robots: { index: false, follow: false },
};

/** Allowed hosts for the "Review & sign document" link. */
const ALLOWED_DOC_HOSTS = [
  "gohighlevel.com",
  "leadconnectorhq.com",
  "msgsndr.com",
];

function isSafeDocLink(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return ALLOWED_DOC_HOSTS.some(
      (h) => u.hostname === h || u.hostname.endsWith(`.${h}`),
    );
  } catch {
    return false;
  }
}

export default async function PublicEstimatePage(props: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await props.params;
  const sp = await props.searchParams;
  const data = await loadPublicEstimate(token);
  if (!data) notFound();

  const { estimate, customerName, repName, documentUrl } = data;

  // Prefer docsLink from query, fall back to DB documentUrl.
  const rawDocsLink =
    (typeof sp.docsLink === "string" ? sp.docsLink : undefined) ?? documentUrl;
  const docsLink = rawDocsLink && isSafeDocLink(rawDocsLink) ? rawDocsLink : null;

  const isSigned = estimate.status === "Signed";

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)" }}>
      <div className="public-estimate">
        {/* Header */}
        <header className="pe-header">
          <div className="pe-header-brand">
            <img src="/jj-mascot.webp" alt="J&J Flooring World" className="pe-logo" />
            <div>
              <h1 className="pe-title">J&J Flooring World</h1>
              <p className="pe-subtitle">Estimate {estimate.number}</p>
            </div>
          </div>
          <div className="pe-header-meta">
            <div className="pe-meta-row">
              <span className="pe-meta-label">Prepared for</span>
              <span className="pe-meta-value">{customerName}</span>
            </div>
            {repName ? (
              <div className="pe-meta-row">
                <span className="pe-meta-label">By</span>
                <span className="pe-meta-value">{repName}</span>
              </div>
            ) : null}
            <div className="pe-meta-row">
              <span className="pe-meta-label">Date</span>
              <span className="pe-meta-value">{dt(estimate.createdAt)}</span>
            </div>
          </div>
        </header>

        {/* Packages */}
        {TIERS.map((tier) => {
          const lines = estimate.tiers[tier] ?? [];
          if (!lines.length) return null;
          const meta = estimate.tierMeta[tier];
          const totals = estimateTierTotals(lines, meta, estimate.taxRate);
          const deposit = round2(
            totals.totalPrice * (estimate.depositPercent / 100),
          );

          return (
            <section key={tier} className="panel pe-package">
              <div className="panel-head">
                <div>
                  <h2 style={{ margin: 0 }}>{meta?.label || tier}</h2>
                  {meta?.summary ? (
                    <p className="t-meta" style={{ margin: "4px 0 0" }}>
                      {meta.summary}
                    </p>
                  ) : null}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="money-big">{money2(totals.totalPrice)}</div>
                  <div className="t-meta">
                    {money2(deposit)} deposit ({estimate.depositPercent}%)
                  </div>
                </div>
              </div>

              <div className="panel-body tight">
                <table className="pe-lines-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="pe-num">Qty</th>
                      <th className="pe-num">Unit price</th>
                      <th className="pe-num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <span className="pe-line-name">{row.name}</span>
                          {row.description ? (
                            <span className="pe-line-desc">{row.description}</span>
                          ) : null}
                        </td>
                        <td className="pe-num">
                          {qty(row.qty)} {row.unit}
                        </td>
                        <td className="pe-num">{money2(row.unitPrice)}</td>
                        <td className="pe-num">{money2(row.linePrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals summary */}
                <div className="pkg-sum">
                  <div>
                    <span>Subtotal</span>
                    <span>{money2(totals.subtotalPrice)}</span>
                  </div>
                  {totals.discountAmount > 0 ? (
                    <div className="save">
                      <span>Discount</span>
                      <span>-{money2(totals.discountAmount)}</span>
                    </div>
                  ) : null}
                  {totals.taxAmount > 0 ? (
                    <div>
                      <span>Sales tax ({estimate.taxRate}%)</span>
                      <span>{money2(totals.taxAmount)}</span>
                    </div>
                  ) : null}
                  <div className="grand">
                    <span>Total</span>
                    <span>{money2(totals.totalPrice)}</span>
                  </div>
                  <div>
                    <span>Deposit due ({estimate.depositPercent}%)</span>
                    <span>{money2(deposit)}</span>
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        {/* Customer notes */}
        {estimate.customerNotes ? (
          <section className="panel pe-notes">
            <div className="panel-head">
              <h3 style={{ margin: 0 }}>Notes</h3>
            </div>
            <div className="panel-body">
              <p style={{ margin: 0, whiteSpace: "pre-line" }}>
                {estimate.customerNotes}
              </p>
            </div>
          </section>
        ) : null}

        {/* Action */}
        <div className="pe-action">
          {isSigned ? (
            <div className="pe-signed-banner">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <circle cx="10" cy="10" r="10" fill="var(--moss)" />
                <path d="M6 10.5l2.5 2.5 5.5-5.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>
                Signed{estimate.signedAt ? ` on ${dt(estimate.signedAt, true)}` : ""}
                {estimate.signedByName ? ` by ${estimate.signedByName}` : ""}
              </span>
            </div>
          ) : docsLink ? (
            <a
              href={docsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-lg pe-sign-btn"
            >
              Review &amp; sign document
            </a>
          ) : null}
        </div>

        {/* Footer */}
        <footer className="pe-footer">
          <p>
            J&amp;J Flooring World &mdash; Thank you for choosing us for your
            flooring needs.
          </p>
        </footer>
      </div>

      <style>{`
        .public-estimate {
          max-width: 720px;
          margin: 0 auto;
          padding: 24px 16px 48px;
        }

        .pe-header {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 2px solid var(--navy-700);
        }
        .pe-header-brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .pe-logo {
          width: 52px;
          height: 52px;
          border-radius: 12px;
        }
        .pe-title {
          margin: 0;
          font-size: 20px;
          color: var(--navy-700);
        }
        .pe-subtitle {
          margin: 2px 0 0;
          font-size: 14px;
          color: var(--ink-2);
        }
        .pe-header-meta {
          font-size: 13.5px;
          text-align: right;
        }
        .pe-meta-row {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
        .pe-meta-label {
          color: var(--ink-3);
        }
        .pe-meta-value {
          color: var(--ink);
          font-weight: 600;
        }

        .pe-package {
          margin-bottom: 16px;
        }

        .pe-lines-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13.5px;
        }
        .pe-lines-table th {
          text-align: left;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--ink-3);
          padding: 6px 0;
          border-bottom: 1px solid var(--rule);
        }
        .pe-lines-table td {
          padding: 8px 0;
          border-bottom: 1px solid var(--rule);
          vertical-align: top;
        }
        .pe-lines-table tr:last-child td {
          border-bottom: none;
        }
        .pe-num {
          text-align: right !important;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
          padding-left: 12px !important;
        }
        .pe-line-name {
          display: block;
          font-weight: 600;
          color: var(--ink);
        }
        .pe-line-desc {
          display: block;
          font-size: 12px;
          color: var(--ink-3);
          margin-top: 2px;
        }

        .pe-notes {
          margin-bottom: 16px;
        }

        .pe-action {
          text-align: center;
          margin: 28px 0;
        }
        .pe-sign-btn {
          font-size: 16px;
          padding: 14px 32px;
        }
        .pe-signed-banner {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 12px 24px;
          border-radius: 10px;
          background: var(--moss-soft);
          color: var(--moss);
          font-weight: 600;
          font-size: 15px;
        }

        .pe-footer {
          text-align: center;
          font-size: 12.5px;
          color: var(--ink-3);
          padding-top: 16px;
          border-top: 1px solid var(--rule);
        }
        .pe-footer p { margin: 0; }

        @media (max-width: 600px) {
          .pe-header { flex-direction: column; }
          .pe-header-meta { text-align: left; }
          .pe-meta-row { justify-content: flex-start; }
        }
      `}</style>
    </div>
  );
}
