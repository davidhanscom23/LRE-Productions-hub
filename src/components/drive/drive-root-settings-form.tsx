"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clearDriveRootFolderOverrideAction,
  saveDriveRootFolderAction,
} from "@/app/(app)/drive/actions";

type DriveRootSettingsFormProps = {
  currentFolderId: string | null;
  currentFolderName: string | null;
  webViewLink: string | null;
  rootFolderSource: "env" | "app_settings" | "default" | null;
  clientEmail: string | null;
  connectionError: string | null;
};

export function DriveRootSettingsForm({
  currentFolderId,
  currentFolderName,
  webViewLink,
  rootFolderSource,
  clientEmail,
  connectionError,
}: DriveRootSettingsFormProps) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await saveDriveRootFolderAction(value);
      if (result.error) {
        setError(result.error);
        return;
      }
      setValue("");
      setMessage("Drive root folder updated.");
      router.refresh();
    });
  }

  function handleClearOverride() {
    if (
      !confirm(
        "Clear the Hub override and fall back to GOOGLE_DRIVE_ROOT_FOLDER_ID (or the built-in Vident company folder)?",
      )
    ) {
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await clearDriveRootFolderOverrideAction();
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage("Override cleared — using env or the Vident default folder.");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-[var(--foreground)]">
        Connected Drive root
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Confirm the connected company Drive folder below. To point the Hub at a
        different folder, paste its Google Drive URL and save. Share that folder
        with the service account as{" "}
        <span className="font-medium">Editor</span>.
      </p>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <dt className="text-[var(--muted)]">Folder</dt>
          <dd className="font-medium text-[var(--foreground)]">
            {currentFolderName ? (
              webViewLink ? (
                <a
                  href={webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--brand)] underline-offset-2 hover:underline"
                >
                  {currentFolderName}
                </a>
              ) : (
                currentFolderName
              )
            ) : (
              <span className="text-[var(--muted)]">Unknown / unreachable</span>
            )}
          </dd>
        </div>
        {currentFolderId ? (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            <dt className="text-[var(--muted)]">Folder id</dt>
            <dd className="break-all font-mono text-xs text-[var(--foreground)]">
              {currentFolderId}
            </dd>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <dt className="text-[var(--muted)]">Source</dt>
          <dd className="text-[var(--foreground)]">
            {rootFolderSource === "app_settings"
              ? "Hub override (app setting)"
              : rootFolderSource === "env"
                ? "Environment variable"
                : rootFolderSource === "default"
                  ? "Vident company folder (built-in default)"
                  : "Not set"}
          </dd>
        </div>
        {clientEmail ? (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            <dt className="text-[var(--muted)]">Service account</dt>
            <dd className="break-all font-mono text-xs text-[var(--foreground)]">
              {clientEmail}
            </dd>
          </div>
        ) : null}
      </dl>

      {connectionError ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
          {connectionError}
        </p>
      ) : null}

      <label className="mt-4 block space-y-1.5">
        <span className="text-sm font-medium text-[var(--foreground)]">
          {currentFolderId ? "Replace with folder URL or id" : "Folder URL or id"}
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://drive.google.com/drive/folders/…"
          autoComplete="off"
          spellCheck={false}
          className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
        />
      </label>

      {error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-2 text-sm text-[var(--brand)]">{message}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending || !value.trim()}
          className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save Drive root"}
        </button>
        {rootFolderSource === "app_settings" ? (
          <button
            type="button"
            disabled={pending}
            onClick={handleClearOverride}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            Use env folder id
          </button>
        ) : null}
      </div>
    </form>
  );
}
