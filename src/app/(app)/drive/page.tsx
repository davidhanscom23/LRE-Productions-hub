import type { ComponentProps } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DriveClientView } from "@/components/drive/drive-client";
import { DriveRootSettingsForm } from "@/components/drive/drive-root-settings-form";
import { getCurrentProfile } from "@/lib/auth/profile";
import {
  inspectDriveConnection,
  isDriveCredentialsConfigured,
  isDriveConfigured,
} from "@/lib/drive/client";
import {
  listDriveFolder,
  searchDrive,
  type DriveItem,
} from "@/lib/drive/browse";

export default async function DrivePage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; q?: string; settings?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "trainer") redirect("/");

  const isAdmin = profile.role === "admin";
  const connection = await inspectDriveConnection();
  const credentialsOk = isDriveCredentialsConfigured();
  const configured = await isDriveConfigured();
  const { folder, q, settings } = await searchParams;
  const showSettings =
    isAdmin &&
    (settings === "1" ||
      settings === "true" ||
      !credentialsOk ||
      !configured ||
      Boolean(connection.error));

  if (!credentialsOk) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Google Drive isn’t connected yet</p>
          <p className="mt-2">
            Set <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code> and{" "}
            <code>GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code> in the environment,
            then paste the company Drive folder URL below (or set{" "}
            <code>GOOGLE_DRIVE_ROOT_FOLDER_ID</code>). Share that folder with the
            service account as Editor.
          </p>
        </div>
        {isAdmin ? (
          <DriveRootSettingsForm
            currentFolderId={connection.rootFolderId}
            currentFolderName={connection.folderName}
            webViewLink={connection.webViewLink}
            rootFolderSource={connection.rootFolderSource}
            clientEmail={connection.clientEmail}
            connectionError={connection.error}
          />
        ) : null}
      </div>
    );
  }

  const query = (q ?? "").trim();

  let props: ComponentProps<typeof DriveClientView> | null = null;
  let loadError: string | null = null;

  if (configured && !connection.error) {
    try {
      if (query) {
        const results: DriveItem[] = await searchDrive(query);
        props = {
          mode: "search",
          query,
          items: results,
          folderId: "",
          folderName: "",
          parentId: null,
          isRoot: false,
        };
      } else {
        const view = await listDriveFolder(folder);
        props = {
          mode: "browse",
          query: "",
          items: view.items,
          folderId: view.folderId,
          folderName: view.folderName,
          parentId: view.parentId,
          isRoot: view.isRoot,
        };
      }
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Unknown error.";
    }
  } else {
    loadError =
      connection.error ??
      "Root folder is not set. Open Drive settings to paste a folder URL.";
  }

  return (
    <div className="space-y-5">
      {showSettings ? (
        <div className="mx-auto max-w-5xl space-y-3">
          {settings === "1" || settings === "true" ? (
            <p className="text-sm text-[var(--muted)]">
              <Link
                href="/drive"
                className="font-medium text-[var(--brand)] underline-offset-2 hover:underline"
              >
                ← Back to Drive
              </Link>
            </p>
          ) : null}
          <DriveRootSettingsForm
            currentFolderId={connection.rootFolderId}
            currentFolderName={connection.folderName}
            webViewLink={connection.webViewLink}
            rootFolderSource={connection.rootFolderSource}
            clientEmail={connection.clientEmail}
            connectionError={connection.error}
          />
        </div>
      ) : null}

      {loadError || !props ? (
        showSettings ? null : (
          <div className="mx-auto max-w-5xl rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
            <p className="font-semibold">Couldn’t load Drive</p>
            <p className="mt-2">{loadError ?? "Unknown error."}</p>
            {isAdmin ? (
              <p className="mt-2">
                <Link
                  href="/drive?settings=1"
                  className="font-medium underline-offset-2 hover:underline"
                >
                  Open Drive root settings
                </Link>
              </p>
            ) : null}
          </div>
        )
      ) : (
        <DriveClientView
          {...props}
          adminSettingsHref={isAdmin ? "/drive?settings=1" : null}
        />
      )}
    </div>
  );
}
