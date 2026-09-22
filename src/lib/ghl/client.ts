import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-box";

/* ==========================================================================
   client.ts  -  GoHighLevel API access
   --------------------------------------------------------------------------
   Best-effort implementation. Doc 05 §8 (risk R1) flags that GHL's exact API
   surface is unverified pending the week-one integration spike; the endpoint
   paths and header names below are GHL's documented v2 API conventions, not
   yet confirmed against this location's live account. Expect to adjust
   `verifyConnection` and `uploadMedia` once real credentials are tested.
   ========================================================================== */

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";
const PROVIDER = "gohighlevel";

export interface GhlConnection {
  locationId: string;
  token: string;
}

export async function getGhlConnection(): Promise<GhlConnection | null> {
  const credential = await prisma.integrationCredential.findUnique({
    where: { provider: PROVIDER },
  });
  if (!credential || !credential.locationId) return null;
  return { locationId: credential.locationId, token: decryptSecret(credential.encryptedToken) };
}

export async function saveGhlConnection(
  locationId: string,
  token: string,
  connectedById: string,
): Promise<void> {
  await prisma.integrationCredential.upsert({
    where: { provider: PROVIDER },
    create: {
      provider: PROVIDER,
      locationId,
      encryptedToken: encryptSecret(token),
      encryptionKeyId: "env:ENCRYPTION_KEY",
      connectedAt: new Date(),
      connectedById,
    },
    update: {
      locationId,
      encryptedToken: encryptSecret(token),
      connectedAt: new Date(),
      connectedById,
      lastVerifiedAt: null,
      lastVerifyError: null,
    },
  });
}

/** GET /locations/:id with the stored bearer token. Never throws; reports success/failure. */
export async function verifyConnection(): Promise<{ ok: boolean; error?: string }> {
  const connection = await getGhlConnection();
  if (!connection) return { ok: false, error: "No GoHighLevel connection is saved yet." };

  try {
    const response = await fetch(`${GHL_API_BASE}/locations/${connection.locationId}`, {
      headers: {
        Authorization: `Bearer ${connection.token}`,
        Version: GHL_API_VERSION,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, error: `GHL returned ${response.status}: ${body.slice(0, 300)}` };
    }

    await prisma.integrationCredential.update({
      where: { provider: PROVIDER },
      data: { lastVerifiedAt: new Date(), lastVerifyError: null },
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error contacting GHL.";
    await prisma.integrationCredential
      .update({ where: { provider: PROVIDER }, data: { lastVerifyError: message } })
      .catch(() => {});
    return { ok: false, error: message };
  }
}

/**
 * Uploads a file to GHL's media library and returns the URL GHL stores it at.
 * Used for avatar uploads (decision: no local/S3 storage in this pass, GHL
 * media storage is the file host per the user's explicit instruction).
 */
export async function uploadMedia(file: Blob, filename: string): Promise<{ url: string; id: string }> {
  const connection = await getGhlConnection();
  if (!connection) {
    throw new Error("Connect GoHighLevel in Settings before uploading files.");
  }

  const form = new FormData();
  form.append("file", file, filename);

  const response = await fetch(`${GHL_API_BASE}/medias/upload-file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.token}`,
      Version: GHL_API_VERSION,
    },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GHL media upload failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as { url?: string; fileId?: string; id?: string };
  const url = data.url;
  const id = data.fileId ?? data.id;
  if (!url || !id) {
    throw new Error("GHL media upload returned an unexpected response shape.");
  }
  return { url, id };
}
