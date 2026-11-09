import "server-only";

import {
  ensureChildFolder,
  getDriveClient,
  isDriveConfigured,
  uploadFileToFolder,
} from "@/lib/drive/client";

export async function getDriveFileWebViewLink(
  fileId: string,
): Promise<string | null> {
  const { drive } = await getDriveClient();
  const meta = await drive.files.get({
    fileId,
    fields: "id, webViewLink, name",
    supportsAllDrives: true,
  });
  return meta.data.webViewLink ?? null;
}

/** Upload a proposal PDF under Proposals / {client} / {eventOrDate}. */
export async function uploadProposalPdfToDrive(input: {
  clientName: string;
  eventName: string;
  eventDate: string | null;
  fileName: string;
  bytes: Buffer;
}): Promise<{
  fileId: string;
  webViewLink: string;
  folderPath: string;
  error?: undefined;
} | { error: string; fileId?: undefined; webViewLink?: undefined; folderPath?: undefined }> {
  if (!(await isDriveConfigured())) {
    return {
      error:
        "Google Drive is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL + PRIVATE_KEY and a root folder (/drive or GOOGLE_DRIVE_ROOT_FOLDER_ID).",
    };
  }

  try {
    const { rootFolderId } = await getDriveClient();
    const clientFolder = (input.clientName || "Client").trim().slice(0, 80) || "Client";
    const eventFolder =
      (input.eventName || "").trim().slice(0, 80) ||
      (input.eventDate?.slice(0, 10) ?? "Proposal");

    const proposalsRoot = await ensureChildFolder(rootFolderId, "Proposals");
    const clientId = await ensureChildFolder(proposalsRoot, clientFolder);
    const eventId = await ensureChildFolder(clientId, eventFolder);
    const folderPath = `Proposals/${clientFolder}/${eventFolder}`;

    const fileId = await uploadFileToFolder({
      parentId: eventId,
      fileName: input.fileName,
      mimeType: "application/pdf",
      bytes: input.bytes,
    });
    const webViewLink =
      (await getDriveFileWebViewLink(fileId)) ??
      `https://drive.google.com/file/d/${fileId}/view`;

    return { fileId, webViewLink, folderPath };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not upload the proposal PDF to Google Drive.",
    };
  }
}
