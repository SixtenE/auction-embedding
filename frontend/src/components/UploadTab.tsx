import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { uploadImage } from "@/lib/api";
import type { UploadResponse } from "@/types";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

function StatusBadge({ status }: { status: string }) {
  if (status === "indexed") {
    return (
      <Badge variant="default" className="flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        indexed
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        failed
      </Badge>
    );
  }
  if (status === "embedding") {
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        embedding
      </Badge>
    );
  }
  return <Badge variant="secondary">{status}</Badge>;
}

export function UploadTab() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tagsJson, setTagsJson] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setPreview(URL.createObjectURL(f));
  }, []);

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
    setResult(null);
    setTagsJson("");
  };

  const handleUpload = async () => {
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
    setUploading(true);
    try {
      const data = await uploadImage(file, tags);
      setResult(data);
      toast.success("Image uploaded and indexed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          !file && "cursor-pointer hover:border-primary/50"
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
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <img
                src={preview}
                alt="Preview"
                className="max-h-64 max-w-full rounded-md object-contain mx-auto"
              />
              <button
                type="button"
                className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground p-0.5 hover:bg-destructive/90"
                onClick={(e) => { e.stopPropagation(); handleClear(); }}
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              className="flex flex-col items-center gap-2 text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Upload className="h-10 w-10" />
              <p className="text-sm font-medium">Drop an image here or click to select</p>
              <p className="text-xs">JPEG, PNG, WebP, HEIC — max 10 MB</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label htmlFor="tags-input">Tags (optional JSON object)</Label>
        <Input
          id="tags-input"
          placeholder='{"category": "watch", "lot": 42}'
          value={tagsJson}
          onChange={(e) => setTagsJson(e.target.value)}
          disabled={uploading}
        />
      </div>

      <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">
        {uploading ? (
          <>
            <Loader2 className="animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <Upload />
            Upload & Index
          </>
        )}
      </Button>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Upload Result</span>
                  <StatusBadge status={result.status} />
                </div>
                <div className="rounded-md overflow-hidden bg-muted flex items-center justify-center min-h-24">
                  <img
                    src={result.url}
                    alt="Uploaded"
                    className="max-h-48 max-w-full object-contain"
                  />
                </div>
                <dl className="text-sm grid grid-cols-[auto,1fr] gap-x-6 gap-y-1">
                  <dt className="text-muted-foreground">ID</dt>
                  <dd className="font-mono text-xs truncate">{result.id}</dd>
                  {result.width && result.height ? (
                    <>
                      <dt className="text-muted-foreground">Dimensions</dt>
                      <dd>{result.width} × {result.height}</dd>
                    </>
                  ) : null}
                  {result.embeddingModel ? (
                    <>
                      <dt className="text-muted-foreground">Model</dt>
                      <dd className="truncate">{result.embeddingModel}</dd>
                    </>
                  ) : null}
                </dl>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
