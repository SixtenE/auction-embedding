import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useUploadImage } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";

function StatusBadge({ status }: { status: string }) {
  const base = "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium";
  if (status === "indexed") {
    return (
      <span className={cn(base, "bg-[#e5e5e5] text-[#262626]")}>
        <CheckCircle className="h-3 w-3" />
        indexed
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className={cn(base, "bg-[#262626] text-white")}>
        <AlertCircle className="h-3 w-3" />
        failed
      </span>
    );
  }
  if (status === "embedding") {
    return (
      <span className={cn(base, "bg-[#e5e5e5] text-[#262626]")}>
        <Loader2 className="h-3 w-3 animate-spin" />
        embedding
      </span>
    );
  }
  return (
    <span className={cn(base, "bg-[#e5e5e5] text-[#262626]")}>{status}</span>
  );
}

export function UploadTab() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tagsJson, setTagsJson] = useState("");
  const [dragging, setDragging] = useState(false);
  const upload = useUploadImage();

  const handleFile = useCallback((f: File) => {
    setFile(f);
    upload.reset();
    setPreview(URL.createObjectURL(f));
  }, [upload]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleClear = () => {
    setFile(null);
    setPreview(null);
    upload.reset();
    setTagsJson("");
  };

  const handleUpload = () => {
    if (!file) return;
    let tags: Record<string, unknown> | undefined;
    if (tagsJson.trim()) {
      try {
        tags = JSON.parse(tagsJson) as Record<string, unknown>;
      } catch {
        toast.error("Invalid JSON in tags field");
        return;
      }
    }
    upload.mutate(
      { file, tags },
      {
        onSuccess: () => toast.success("Image uploaded and indexed"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Upload failed"),
      }
    );
  };

  return (
    <div className="space-y-5">
      {/* Drop Zone */}
      <div
        className={cn(
          "relative rounded-xl border p-10 text-center",
          dragging ? "border-black bg-[#fafafa]" : "border-[#e5e5e5]",
          !file && "cursor-pointer"
        )}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => { if (!file) document.getElementById("upload-file-input")?.click(); }}
      >
        <input
          id="upload-file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
        />
        <AnimatePresence mode="wait">
          {preview ? (
            <motion.div
              key="preview"
              className="relative inline-block"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <img
                src={preview}
                alt="Preview"
                className="max-h-64 max-w-full rounded-xl object-contain mx-auto"
              />
              <button
                type="button"
                className="absolute -top-2 -right-2 rounded-full bg-[#262626] text-white p-1"
                onClick={(e) => { e.stopPropagation(); handleClear(); }}
              >
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              className="flex flex-col items-center gap-2 text-[#737373]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Upload className="h-8 w-8" />
              <p className="text-sm font-medium text-[#262626]">Drop an image here or click to select</p>
              <p className="text-xs text-[#a3a3a3]">JPEG, PNG, WebP, HEIC — max 10 MB</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <label htmlFor="tags-input" className="text-sm font-medium text-[#262626]">
          Tags <span className="text-[#a3a3a3] font-normal">(optional JSON object)</span>
        </label>
        <input
          id="tags-input"
          type="text"
          placeholder='{"category": "watch", "lot": 42}'
          value={tagsJson}
          onChange={(e) => setTagsJson(e.target.value)}
          disabled={upload.isPending}
          className="w-full rounded-full border border-[#e5e5e5] bg-white px-4 py-2.5 text-sm text-black placeholder:text-[#a3a3a3] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 disabled:opacity-50"
        />
      </div>

      {/* CTA Button */}
      <button
        onClick={handleUpload}
        disabled={!file || upload.isPending}
        className="w-full rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {upload.isPending ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading…
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Upload className="h-4 w-4" />
            Upload & Index
          </span>
        )}
      </button>

      {/* Result */}
      <AnimatePresence>
        {upload.data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl border border-[#e5e5e5] bg-white p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-black">Upload Result</span>
              <StatusBadge status={upload.data.status} />
            </div>
            <div className="rounded-xl overflow-hidden bg-[#fafafa] flex items-center justify-center min-h-24">
              <img
                src={upload.data.url}
                alt="Uploaded"
                className="max-h-48 max-w-full object-contain"
              />
            </div>
            <dl className="text-sm grid grid-cols-[auto,1fr] gap-x-6 gap-y-1.5">
              <dt className="text-[#737373]">ID</dt>
              <dd className="font-mono text-xs truncate text-black">{upload.data.id}</dd>
              {upload.data.width && upload.data.height ? (
                <>
                  <dt className="text-[#737373]">Dimensions</dt>
                  <dd className="text-black">{upload.data.width} × {upload.data.height}</dd>
                </>
              ) : null}
              {upload.data.embeddingModel ? (
                <>
                  <dt className="text-[#737373]">Model</dt>
                  <dd className="truncate text-black">{upload.data.embeddingModel}</dd>
                </>
              ) : null}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
