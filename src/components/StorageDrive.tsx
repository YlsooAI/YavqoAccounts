"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Download,
  File as FileIcon,
  Film,
  Image as ImageIcon,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  ACCOUNT_QUOTA_BYTES,
  MAX_FILE_BYTES,
  displayNameFromPath,
  formatBytes,
  safeFileName,
} from "@/lib/storageUsage";

type DriveFile = {
  path: string;
  name: string;
  size: number;
  mime: string;
  updatedAt: string | null;
};

function kindOf(mime: string, name: string): "image" | "video" | "other" {
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|svg|bmp|heic)$/i.test(name)) {
    return "image";
  }
  if (mime.startsWith("video/") || /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(name)) {
    return "video";
  }
  return "other";
}

export default function StorageDrive({
  userId,
  otherBytes,
}: {
  userId: string;
  otherBytes: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    file: DriveFile;
    url: string;
  } | null>(null);

  const driveBytes = files.reduce((sum, file) => sum + file.size, 0);
  const used = otherBytes + driveBytes;
  const remaining = Math.max(0, ACCOUNT_QUOTA_BYTES - used);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: listError } = await supabase.storage
      .from("files")
      .list(userId, {
        limit: 200,
        sortBy: { column: "created_at", order: "desc" },
      });
    if (listError) {
      setError(listError.message);
      setLoading(false);
      return;
    }
    const listed = (data ?? []).filter((item) => item.id && !item.name.endsWith("/"));
    setFiles(
      listed.map((item) => ({
        path: `${userId}/${item.name}`,
        name: displayNameFromPath(item.name),
        size: item.metadata?.size ?? 0,
        mime: String(item.metadata?.mimetype ?? ""),
        updatedAt: item.updated_at ?? item.created_at ?? null,
      }))
    );
    setError(null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function signedUrl(path: string, downloadName?: string) {
    const supabase = createClient();
    const { data, error: signError } = await supabase.storage
      .from("files")
      .createSignedUrl(path, 60 * 10, downloadName ? { download: downloadName } : undefined);
    if (signError || !data?.signedUrl) {
      throw new Error(signError?.message ?? "Could not open file.");
    }
    return data.signedUrl;
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!picked.length) return;

    setUploading(true);
    setError(null);
    const supabase = createClient();
    let extra = 0;

    for (const file of picked) {
      if (file.size > MAX_FILE_BYTES) {
        setError(`${file.name} is larger than 50 MB.`);
        continue;
      }
      if (otherBytes + driveBytes + extra + file.size > ACCOUNT_QUOTA_BYTES) {
        setError("Not enough account storage left for this file.");
        break;
      }

      const path = `${userId}/${Date.now()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("files").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
      if (uploadError) {
        setError(uploadError.message);
        break;
      }
      extra += file.size;
    }

    setUploading(false);
    await load();
  }

  async function openPreview(file: DriveFile) {
    try {
      const url = await signedUrl(file.path);
      setPreview({ file, url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open file.");
    }
  }

  async function download(file: DriveFile) {
    try {
      const url = await signedUrl(file.path, file.name);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed.");
    }
  }

  async function remove(file: DriveFile) {
    const supabase = createClient();
    const { error: deleteError } = await supabase.storage.from("files").remove([file.path]);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    if (preview?.file.path === file.path) setPreview(null);
    setFiles((prev) => prev.filter((item) => item.path !== file.path));
  }

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-medium text-[#9aa0a6]">Your files</h3>
          <p className="mt-1 text-[12px] text-[#9aa0a6]">
            Images, videos, and other files up to 50 MB each. {formatBytes(remaining)} free.
          </p>
        </div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="flex h-9 items-center gap-2 rounded-full bg-[#8ab4f8] px-4 text-[13px] font-medium text-[#202124] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <Upload size={14} aria-hidden="true" />
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFiles}
        />
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-[#452b0c] p-3 text-[13px] text-[#fdd663]">{error}</p>
      )}

      {loading ? (
        <p className="mt-4 text-[13px] text-[#9aa0a6]">Loading files…</p>
      ) : files.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-4 w-full rounded-2xl border border-dashed border-[#5f6368] bg-[#292a2d] px-6 py-10 text-center transition-colors hover:bg-white/5"
        >
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#c58af9]">
            <Upload size={20} className="text-[#1f1f1f]" aria-hidden="true" />
          </span>
          <p className="mt-4 text-[14px]">Drop files here or click to upload</p>
          <p className="mt-1 text-[12px] text-[#9aa0a6]">
            Photos, videos, PDFs, and more — max 50 MB per file
          </p>
        </button>
      ) : (
        <ul className="mt-4 overflow-hidden rounded-2xl border border-[#3c4043]">
          {files.map((file) => {
            const kind = kindOf(file.mime, file.name);
            const Icon = kind === "image" ? ImageIcon : kind === "video" ? Film : FileIcon;
            return (
              <li
                key={file.path}
                className="flex items-center gap-3 border-b border-[#3c4043] bg-[#292a2d] px-4 py-3 last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => openPreview(file)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3c4043]">
                    <Icon size={16} className="text-[#e8eaed]" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px]">{file.name}</span>
                    <span className="block text-[12px] text-[#9aa0a6]">
                      {formatBytes(file.size)}
                      {file.updatedAt
                        ? ` · ${new Date(file.updatedAt).toLocaleDateString("en-US", {
                            dateStyle: "medium",
                          })}`
                        : ""}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Download ${file.name}`}
                  onClick={() => download(file)}
                  className="rounded-full p-2 text-[#9aa0a6] hover:bg-white/10 hover:text-white"
                >
                  <Download size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${file.name}`}
                  onClick={() => remove(file)}
                  className="rounded-full p-2 text-[#9aa0a6] hover:bg-white/10 hover:text-[#f28b82]"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close preview"
            className="absolute inset-0 bg-black/70"
            onClick={() => setPreview(null)}
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-[720px] overflow-hidden rounded-2xl bg-[#292a2d]">
            <div className="flex items-center justify-between gap-3 border-b border-[#3c4043] px-4 py-3">
              <p className="truncate text-[14px]">{preview.file.name}</p>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setPreview(null)}
                className="rounded-full p-2 hover:bg-white/10"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto bg-[#202124] p-4">
              {kindOf(preview.file.mime, preview.file.name) === "image" ? (
                <img src={preview.url} alt={preview.file.name} className="mx-auto max-h-[70vh] rounded-lg" />
              ) : kindOf(preview.file.mime, preview.file.name) === "video" ? (
                <video src={preview.url} controls className="mx-auto max-h-[70vh] w-full rounded-lg" />
              ) : (
                <p className="text-center text-[13px] text-[#9aa0a6]">
                  Preview is not available for this file type.{" "}
                  <button
                    type="button"
                    onClick={() => download(preview.file)}
                    className="text-[#8ab4f8] hover:underline"
                  >
                    Download instead
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
