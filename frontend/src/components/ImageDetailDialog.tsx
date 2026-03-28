import { Loader2, Trash2, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export function ImageDetailDialog({ open, onOpenChange, image, loading, onDelete }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Image Details</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : image ? (
          <div className="space-y-4">
            <div className="rounded-md overflow-hidden bg-muted flex items-center justify-center min-h-32">
              <img
                src={image.url}
                alt={image.originalFilename}
                className="max-h-56 max-w-full object-contain"
              />
            </div>
            <dl className="text-sm grid grid-cols-[auto,1fr] gap-x-6 gap-y-2">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge variant={image.status === "indexed" ? "default" : image.status === "failed" ? "destructive" : "secondary"}>
                  {image.status}
                </Badge>
              </dd>
              <dt className="text-muted-foreground">ID</dt>
              <dd className="font-mono text-xs truncate">{image.id}</dd>
              <dt className="text-muted-foreground">Filename</dt>
              <dd className="truncate">{image.originalFilename}</dd>
              <dt className="text-muted-foreground">MIME type</dt>
              <dd>{image.mimeType}</dd>
              {image.width && image.height ? (
                <>
                  <dt className="text-muted-foreground">Dimensions</dt>
                  <dd>{image.width} × {image.height}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">File size</dt>
              <dd>{formatBytes(image.fileSize)}</dd>
              <dt className="text-muted-foreground">Model</dt>
              <dd className="truncate">{image.embeddingModel}</dd>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{new Date(image.createdAt).toLocaleString()}</dd>
              {image.tags ? (
                <>
                  <dt className="text-muted-foreground">Tags</dt>
                  <dd className="font-mono text-xs break-all">{JSON.stringify(image.tags)}</dd>
                </>
              ) : null}
            </dl>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" asChild>
                <a href={image.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open image
                </a>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="ml-auto"
                onClick={() => onDelete(image.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
