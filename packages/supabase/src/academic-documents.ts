import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { validateSupabasePublicConfig } from "./config.js";
import type { SsrCookieAdapter, SupabasePublicConfig } from "./types.js";

if (typeof window !== "undefined") {
  throw new Error(
    "@preparatoria/supabase/academic-documents solo puede importarse desde el servidor.",
  );
}

export interface AcademicDocumentSummary {
  readonly documentId: string;
  readonly folio: string | null;
  readonly issuedAt: string;
  readonly publishedAt: string | null;
  readonly requestedPeriodId: string | null;
  readonly status: string;
  readonly typeCode: string;
  readonly typeName: string;
}

export interface AcademicDocumentDetail extends AcademicDocumentSummary {
  readonly downloadAvailable: boolean;
  readonly supersedesDocumentId: string | null;
  readonly supersededByDocumentId: string | null;
}

export interface DocumentDownloadDescriptor {
  readonly documentId: string;
  readonly fileHash: string;
  readonly mimeType: "application/pdf";
  readonly objectPath: string;
  readonly sizeBytes: number;
}

export interface DocumentVerificationResult {
  readonly verified: boolean;
  readonly folio?: string;
  readonly issuedAt?: string;
  readonly status: "VIGENTE" | "REVOCADO" | "SUSTITUIDO" | "EXPIRADO" | "NO_VERIFICADO";
  readonly typeName?: string;
}

export interface AcademicDocumentFileStore {
  createDeterministicPdf(input: {
    readonly documentId: string;
    readonly folio: string;
    readonly title: string;
    readonly payload: Readonly<Record<string, unknown>>;
  }): Promise<DocumentDownloadDescriptor>;
  read(objectPath: string): Promise<Buffer>;
}

type AcademicDocumentsRpcName =
  | "get_my_documents"
  | "get_my_document"
  | "get_my_document_download"
  | "get_my_guardian_student_documents"
  | "get_my_guardian_student_document"
  | "verify_document_public";

interface AcademicDocumentsSdk {
  rpc(
    name: AcademicDocumentsRpcName,
    input?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown }>;
}

export type AcademicDocumentsClientFactory = (
  url: string,
  publishableKey: string,
  options: { cookieOptions: { secure: boolean }; cookies: SsrCookieAdapter },
) => AcademicDocumentsSdk;

export class AcademicDocumentsError extends Error {
  readonly code: string;

  constructor(code: string, options?: ErrorOptions) {
    super("No fue posible completar la operación documental solicitada.", options);
    this.name = "AcademicDocumentsError";
    this.code = code;
  }
}

function parseRpcError(error: unknown) {
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string" && error.message.length > 0) {
      return error.message;
    }
    if ("code" in error && typeof error.code === "string" && error.code.length > 0) {
      return error.code;
    }
  }
  return "DOCUMENT_OPERATION_FAILED";
}

function expectObject(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AcademicDocumentsError("DOCUMENT_OPERATION_FAILED");
  }
  return value as Readonly<Record<string, unknown>>;
}

function expectArray(value: unknown) {
  if (!Array.isArray(value)) {
    throw new AcademicDocumentsError("DOCUMENT_OPERATION_FAILED");
  }
  return value as readonly unknown[];
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(value: string, errorCode: string) {
  if (!uuidPattern.test(value)) {
    throw new AcademicDocumentsError(errorCode);
  }
}

function assertOptionalPeriodId(periodId?: string | null) {
  if (periodId) {
    assertUuid(periodId, "DOCUMENT_NOT_FOUND");
  }
}

function asSummary(entry: unknown): AcademicDocumentSummary {
  const value = expectObject(entry);
  return {
    documentId: String(value.documentId),
    folio: typeof value.folio === "string" ? value.folio : null,
    issuedAt: String(value.issuedAt),
    publishedAt: typeof value.publishedAt === "string" ? value.publishedAt : null,
    requestedPeriodId: typeof value.requestedPeriodId === "string" ? value.requestedPeriodId : null,
    status: String(value.status),
    typeCode: String(value.typeCode),
    typeName: String(value.typeName),
  };
}

function asDetail(entry: unknown): AcademicDocumentDetail {
  const value = expectObject(entry);
  return {
    ...asSummary(value),
    downloadAvailable: value.downloadAvailable === true,
    supersedesDocumentId:
      typeof value.supersedesDocumentId === "string" ? value.supersedesDocumentId : null,
    supersededByDocumentId:
      typeof value.supersededByDocumentId === "string" ? value.supersededByDocumentId : null,
  };
}

function asDownloadDescriptor(entry: unknown): DocumentDownloadDescriptor {
  const value = expectObject(entry);
  return {
    documentId: String(value.documentId),
    fileHash: typeof value.fileHash === "string" ? value.fileHash : "",
    mimeType: "application/pdf",
    objectPath: String(value.objectPath),
    sizeBytes: Number(value.sizeBytes),
  };
}

function asVerificationResult(entry: unknown): DocumentVerificationResult {
  const value = expectObject(entry);
  const status =
    value.status === "VIGENTE" ||
    value.status === "REVOCADO" ||
    value.status === "SUSTITUIDO" ||
    value.status === "EXPIRADO"
      ? value.status
      : "NO_VERIFICADO";
  return {
    verified: value.verified === true,
    status,
    ...(typeof value.folio === "string" ? { folio: value.folio } : {}),
    ...(typeof value.issuedAt === "string" ? { issuedAt: value.issuedAt } : {}),
    ...(typeof value.typeName === "string" ? { typeName: value.typeName } : {}),
  };
}

function deterministicPdfContent(
  title: string,
  folio: string,
  payload: Readonly<Record<string, unknown>>,
) {
  const body = JSON.stringify(
    {
      title,
      folio,
      disclaimer:
        "Documento informativo generado por el sistema. Su validez institucional está pendiente de confirmación.",
      payload,
    },
    Object.keys(payload).sort(),
    2,
  );
  const stream = `BT /F1 12 Tf 72 720 Td (${title.replaceAll("(", "[").replaceAll(")", "]")}) Tj 0 -18 Td (${folio}) Tj 0 -18 Td (Documento informativo generado por el sistema.) Tj ET`;
  return `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length ${stream.length} >> stream
${stream}
endstream endobj
6 0 obj << /Producer (Codex) /Subject (${body.replaceAll("(", "[").replaceAll(")", "]")}) >> endobj
xref
0 7
0000000000 65535 f 
0000000010 00000 n 
0000000063 00000 n 
0000000122 00000 n 
0000000248 00000 n 
0000000318 00000 n 
0000000443 00000 n 
trailer << /Size 7 /Root 1 0 R /Info 6 0 R >>
startxref
${520 + stream.length}
%%EOF
`;
}

export function createLocalAcademicDocumentFileStore(
  baseDirectory = join(tmpdir(), "preparatoria-documentos-local"),
): AcademicDocumentFileStore {
  return {
    async createDeterministicPdf({ documentId, folio, title, payload }) {
      const content = Buffer.from(deterministicPdfContent(title, folio, payload), "utf8");
      const folder = join(baseDirectory, "pdf");
      await mkdir(folder, { recursive: true });
      const hash = createHash("sha256").update(content).digest("hex");
      const objectPath = `documents/${documentId}/${hash.slice(0, 12)}.pdf`;
      const filePath = join(folder, `${documentId}-${hash.slice(0, 12)}.pdf`);
      await writeFile(filePath, content);
      return {
        documentId,
        fileHash: hash,
        mimeType: "application/pdf",
        objectPath,
        sizeBytes: content.byteLength,
      };
    },
    async read(objectPath: string) {
      const sanitized = objectPath.replaceAll("/", "-");
      const folder = join(baseDirectory, "pdf");
      await mkdir(folder, { recursive: true });
      const files = [
        join(folder, sanitized),
        join(folder, objectPath.split("/").slice(-2).join("-")),
      ];
      for (const filePath of files) {
        try {
          await stat(filePath);
          return await readFile(filePath);
        } catch {}
      }
      throw new AcademicDocumentsError("DOCUMENT_NOT_AVAILABLE");
    },
  };
}

export function createVerificationCode() {
  const code = randomBytes(6).toString("base64url").toUpperCase();
  return {
    plain: code,
    hash: createHash("sha256").update(code).digest("hex"),
    prefix: code.slice(0, 4),
  };
}

export function createAcademicDocumentsService(
  config: SupabasePublicConfig,
  cookies: SsrCookieAdapter,
  factory: AcademicDocumentsClientFactory = createServerClient as unknown as AcademicDocumentsClientFactory,
) {
  const validated = validateSupabasePublicConfig(config);
  const client = factory(validated.url, validated.publishableKey, {
    cookieOptions: { secure: validated.url.startsWith("https://") },
    cookies,
  });

  async function invoke(name: AcademicDocumentsRpcName, input?: Record<string, unknown>) {
    const result = await client.rpc(name, input);
    if (result.error) {
      throw new AcademicDocumentsError(parseRpcError(result.error), { cause: result.error });
    }
    return result.data;
  }

  return Object.freeze({
    async getMyDocuments() {
      return expectArray(await invoke("get_my_documents")).map(asSummary);
    },
    async getMyDocument(documentId: string) {
      assertUuid(documentId, "DOCUMENT_NOT_FOUND");
      return asDetail(await invoke("get_my_document", { document_id: documentId }));
    },
    async getMyDocumentDownload(documentId: string) {
      assertUuid(documentId, "DOCUMENT_NOT_FOUND");
      return asDownloadDescriptor(
        await invoke("get_my_document_download", { document_id: documentId }),
      );
    },
    async getGuardianStudentDocuments(linkId: string) {
      assertUuid(linkId, "DOCUMENT_SCOPE_DENIED");
      const result = await invoke("get_my_guardian_student_documents", { link_id: linkId });
      if (Array.isArray(result)) {
        return result.map(asSummary);
      }
      const object = expectObject(result);
      if ("error" in object) {
        throw new AcademicDocumentsError(String(object.error));
      }
      return expectArray(result).map(asSummary);
    },
    async getGuardianStudentDocument(linkId: string, documentId: string) {
      assertUuid(linkId, "DOCUMENT_SCOPE_DENIED");
      assertUuid(documentId, "DOCUMENT_NOT_FOUND");
      return asDetail(
        await invoke("get_my_guardian_student_document", {
          document_id: documentId,
          link_id: linkId,
        }),
      );
    },
    async verifyPublicDocument(folio: string, verificationCode: string) {
      return asVerificationResult(
        await invoke("verify_document_public", {
          folio: folio.trim(),
          verification_code: verificationCode.trim().toUpperCase(),
        }),
      );
    },
    validateOwnDocumentInput(documentId: string, periodId?: string | null) {
      assertUuid(documentId, "DOCUMENT_NOT_FOUND");
      assertOptionalPeriodId(periodId);
      return { documentId, periodId: periodId ?? null };
    },
  });
}
