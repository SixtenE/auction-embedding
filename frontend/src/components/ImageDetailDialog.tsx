import { Loader2, Trash2, ExternalLink, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ImageRecord } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  image: ImageRecord | null;
  loading: boolean;
  onDelete: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusTag({ status }: { status: string }) {
  const base = "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium";
  if (status === "indexed") return <span className={`${base} bg-[#e5e5e5] text-[#262626]`}>indexed</span>;
  if (status === "failed") return <span className={`${base} bg-[#262626] text-white`}>failed</span>;
  return <span className={`${base} bg-[#e5e5e5] text-[#262626]`}>{status}</span>;
}

export function ImageDetailDialog({ open, onOpenChange, image, loading, onDelete }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-none">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-medium text-black">Image Details</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#a3a3a3]" />
          </div>
        ) : image ? (
          <div className="space-y-5">
            <div className="rounded-xl overflow-hidden bg-[#fafafa] flex items-center justify-center min-h-32">
              <img
                src={image.url}
                alt={image.originalFilename}
                className="max-h-56 max-w-full object-contain"
              />
            </div>
            <dl className="text-sm grid grid-cols-[auto,1fr] gap-x-8 gap-y-2">
              <dt className="text-[#737373]">Status</dt>
              <dd><StatusTag status={image.status} /></dd>
              <dt className="text-[#737373]">ID</dt>
              <dd className="font-mono text-xs truncate text-black">{image.id}</dd>
              <dt className="text-[#737373]">Filename</dt>
              <dd className="truncate text-black">{image.originalFilename}</dd>
              <dt className="text-[#737373]">MIME type</dt>
              <dd className="text-black">{image.mimeType}</dd>
              {image.width && image.height ? (
                <>
                  <dt className="text-[#737373]">Dimensions</dt>
                  <dd className="text-black">{image.width} × {image.height}</dd>
                </>
              ) : null}
              <dt className="text-[#737373]">File size</dt>
              <dd className="text-black">{formatBytes(image.fileSize)}</dd>
              <dt className="text-[#737373]">Model</dt>
              <dd className="truncate text-black">{image.embeddingModel}</dd>
              <dt className="text-[#737373]">Created</dt>
              <dd className="text-black">{new Date(image.createdAt).toLocaleString()}</dd>
              {image.tags ? (
                <>
                  <dt className="text-[#737373]">Tags</dt>
                  <dd className="font-mono text-xs break-all text-black">{JSON.stringify(image.tags)}</dd>
                </>
              ) : null}
            </dl>
            <div className="flex gap-2 pt-1">
              <a
                href={image.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#d4d4d4] bg-white px-4 py-2 text-xs font-medium text-[#404040]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open image
              </a>
              <button
                className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#e5e5e5] bg-white px-4 py-2 text-xs font-medium text-[#262626]"
                onClick={() => onDelete(image.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
