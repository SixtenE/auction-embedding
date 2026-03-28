import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useUploadImage } from "@/lib/queries";
import { cn } from "@/lib/utils";

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
        {preview ? (
          <div className="relative inline-block">
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
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="h-10 w-10" />
            <p className="text-sm font-medium">Drop an image here or click to select</p>
            <p className="text-xs">JPEG, PNG, WebP, HEIC — max 10 MB</p>
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label htmlFor="tags-input">Tags (optional JSON object)</Label>
        <Input
          id="tags-input"
          placeholder='{"category": "watch", "lot": 42}'
          value={tagsJson}
          onChange={(e) => setTagsJson(e.target.value)}
          disabled={upload.isPending}
        />
      </div>

      <Button onClick={handleUpload} disabled={!file || upload.isPending} className="w-full">
        {upload.isPending ? (
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
      {upload.data && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Upload Result</span>
              <StatusBadge status={upload.data.status} />
            </div>
            <div className="rounded-md overflow-hidden bg-muted flex items-center justify-center min-h-24">
              <img
                src={upload.data.url}
                alt="Uploaded"
                className="max-h-48 max-w-full object-contain"
              />
            </div>
            <dl className="text-sm grid grid-cols-[auto,1fr] gap-x-6 gap-y-1">
              <dt className="text-muted-foreground">ID</dt>
              <dd className="font-mono text-xs truncate">{upload.data.id}</dd>
              {upload.data.width && upload.data.height ? (
                <>
                  <dt className="text-muted-foreground">Dimensions</dt>
                  <dd>{upload.data.width} × {upload.data.height}</dd>
                </>
              ) : null}
              {upload.data.embeddingModel ? (
                <>
                  <dt className="text-muted-foreground">Model</dt>
                  <dd className="truncate">{upload.data.embeddingModel}</dd>
                </>
              ) : null}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
