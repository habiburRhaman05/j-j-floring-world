import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api/api-route";
import { zodErrorResponse } from "@/lib/api/server-response";
import { requestMeta, writeAudit } from "@/lib/auth/audit";
import { requireAdmin } from "@/lib/auth/require-admin";
import { readRates, writeRates } from "@/lib/sales/rates.server";

const percent = z.coerce.number().min(0, "Can't be negative.").max(100, "Can't be over 100%.");

const RatesSchema = z
  .object({
    defaultCommissionPercent: percent,
    marginPercent: percent,
    repCommissionPercent: z.record(z.string(), percent),
  })
  .strict();

/** Admin: commission percent (default and per rep) and the average gross margin. */
export const PUT = apiRoute(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const parsed = RatesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const before = await readRates();
  const saved = await writeRates(parsed.data, gate.session.user.id);
  await writeAudit({
    actorId: gate.session.user.id,
    action: "sales.rates.updated",
    entity: "AppSetting",
    entityId: "sales.rates",
    before,
    after: saved,
    ...requestMeta(request),
  });
  return NextResponse.json(saved);
});
