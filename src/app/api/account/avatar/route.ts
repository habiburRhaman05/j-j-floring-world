import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session.server";
import { uploadMedia } from "@/lib/ghl/client";
import { writeAudit, requestMeta } from "@/lib/auth/audit";
import { errorResponse } from "@/lib/api/server-response";
import { apiRoute } from "@/lib/api/api-route";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const POST = apiRoute(async (request: NextRequest) => {
  const session = await getCurrentSession();
  if (!session) return errorResponse(401, "Sign in to continue.", { code: "unauthenticated" });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof Blob)) {
    return errorResponse(400, "No file was uploaded. Choose an image and try again.", { code: "missing_file" });
  }
  if (file.size > MAX_BYTES) {
    return errorResponse(422, "Image must be 5 MB or smaller.", { code: "file_too_large" });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return errorResponse(422, "Only JPEG, PNG or WebP images are supported.", {
      code: "unsupported_type",
    });
  }

  const filename = file instanceof File ? file.name : `avatar-${session.user.id}.jpg`;

  let uploaded: { url: string; id: string };
  try {
    uploaded = await uploadMedia(file, filename);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not upload the image to GoHighLevel.";
    return errorResponse(422, message, { code: "ghl_upload_failed" });
  }

  const fileAsset = await prisma.fileAsset.create({
    data: {
      storageKey: uploaded.url,
      bucket: "gohighlevel",
      originalName: filename,
      mimeType: file.type,
      sizeBytes: file.size,
      uploadedById: session.user.id,
    },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarFileId: fileAsset.id },
  });

  const { ipAddress, userAgent } = requestMeta(request);
  await writeAudit({
    actorId: session.user.id,
    action: "user.avatar.updated",
    entity: "User",
    entityId: session.user.id,
    after: { fileAssetId: fileAsset.id },
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ avatarUrl: fileAsset.storageKey });
});
