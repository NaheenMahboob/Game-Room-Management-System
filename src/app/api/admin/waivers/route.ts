/**
 * `GET|POST /api/admin/waivers`
 *
 * Admin: list waiver versions; upload a new template PDF (bumps active version).
 *
 * @author Muhammad Naheen Mahboob
 */

import { withRole } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { AuditAction } from "@/lib/audit/actions";
import { getCurrentWaiverVersion } from "@/lib/settings";
import {
  currentWaiverTemplateSrc,
  MAX_WAIVER_TEMPLATE_BYTES,
  saveWaiverTemplatePdf,
} from "@/lib/uploads/waiverTemplate";

/** Lists waiver rows and the currently active version. */
export const GET = withRole(["ADMIN"], async () => {
  try {
    const [version, waivers] = await Promise.all([
      getCurrentWaiverVersion(),
      prisma.waiver.findMany({
        orderBy: { version: "desc" },
        select: {
          id: true,
          version: true,
          templatePdfUrl: true,
          createdAt: true,
          createdByUserId: true,
        },
      }),
    ]);
    return jsonOk({
      currentVersion: version,
      pdfSrc: currentWaiverTemplateSrc(),
      waivers,
    });
  } catch (error) {
    return handleRouteError(error);
  }
});

/**
 * Uploads a new waiver template PDF.
 * Form fields: `file` (PDF), optional `version` (defaults to max+1).
 */
export const POST = withRole(["ADMIN"], async ({ request, session }) => {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonError("PDF file is required", 400);
    }
    if (file.size <= 0) {
      return jsonError("PDF file is empty", 400);
    }
    if (file.size > MAX_WAIVER_TEMPLATE_BYTES) {
      return jsonError("PDF is too large (max 12 MiB)", 400);
    }

    const versionRaw = formData.get("version");
    let version: number;
    if (typeof versionRaw === "string" && versionRaw.trim()) {
      version = Number(versionRaw);
      if (!Number.isInteger(version) || version < 1) {
        return jsonError("version must be a positive integer", 400);
      }
    } else {
      const latest = await prisma.waiver.findFirst({
        orderBy: { version: "desc" },
        select: { version: true },
      });
      version = (latest?.version ?? 0) + 1;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const templatePdfUrl = await saveWaiverTemplatePdf(version, buffer);

    const waiver = await prisma.waiver.upsert({
      where: { version },
      update: {
        templatePdfUrl,
        text: null,
        createdByUserId: session.sub,
      },
      create: {
        version,
        templatePdfUrl,
        text: null,
        createdByUserId: session.sub,
      },
    });

    await prisma.setting.upsert({
      where: { key: "waiverVersion" },
      update: { value: String(version) },
      create: { key: "waiverVersion", value: String(version) },
    });

    await writeAuditLog({
      actionType: AuditAction.WAIVER_TEMPLATE_UPLOADED,
      performedByUserId: session.sub,
      details: { version, templatePdfUrl, bytes: buffer.byteLength },
    });

    return jsonOk(
      {
        waiver,
        currentVersion: version,
        pdfSrc: currentWaiverTemplateSrc(),
      },
      201
    );
  } catch (error) {
    return handleRouteError(error);
  }
});
