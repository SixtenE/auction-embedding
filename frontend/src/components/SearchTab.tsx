import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Search, X, Loader2, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { searchByImage, deleteImage, getImage } from "@/lib/api";
import type { SearchMatch, ImageRecord } from "@/types";
import { cn } from "@/lib/utils";
import { ImageCard } from "@/components/ImageCard";
import { ImageDetailDialog } from "@/components/ImageDetailDialog";

export function SearchTab() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [topK, setTopK] = useState("10");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchMatch[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResults(null);
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
    setResults(null);
  };

  const handleSearch = async () => {
    if (!file) return;
    const k = parseInt(topK, 10);
    if (isNaN(k) || k < 1 || k > 100) {
      toast.error("Top K must be between 1 and 100");
      return;
    }
    setSearching(true);
    try {
      const data = await searchByImage(file, k);
      setResults(data.matches);
      if (data.matches.length === 0) {
        toast.info("No similar images found");
      } else {
        toast.success(`Found ${data.matches.length} similar image${data.matches.length !== 1 ? "s" : ""}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleViewDetails = async (id: string) => {
    setSelectedImage(null);
    setLoadingDetail(true);
    setDetailOpen(true);
    try {
      const img = await getImage(id);
      setSelectedImage(img);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load details");
      setDetailOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteImage(id);
      setResults((prev) => prev?.filter((m) => m.id !== id) ?? null);
      if (selectedImage?.id === id) {
        setDetailOpen(false);
        setSelectedImage(null);
      }
      toast.success("Image deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
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
        onClick={() => { if (!file) document.getElementById("search-file-input")?.click(); }}
      >
        <input
          id="search-file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
        />
        {preview ? (
          <div className="relative inline-block">
            <img
              src={preview}
              alt="Query"
              className="max-h-48 max-w-full rounded-md object-contain mx-auto"
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
            <Search className="h-10 w-10" />
            <p className="text-sm font-medium">Drop a query image here or click to select</p>
            <p className="text-xs">JPEG, PNG, WebP, HEIC — max 10 MB</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-3 items-end">
        <div className="space-y-1.5 w-32 shrink-0">
          <Label htmlFor="topk-input">Top K results</Label>
          <Input
            id="topk-input"
            type="number"
            min={1}
            max={100}
            value={topK}
            onChange={(e) => setTopK(e.target.value)}
            disabled={searching}
          />
        </div>
        <Button onClick={handleSearch} disabled={!file || searching} className="flex-1">
          {searching ? (
            <>
              <Loader2 className="animate-spin" />
              Searching…
            </>
          ) : (
            <>
              <Search />
              Search by Similarity
            </>
          )}
        </Button>
      </div>

      {/* Results */}
      {results !== null && (
        results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
            <ImageOff className="h-12 w-12" />
            <p className="text-sm">No similar images found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {results.map((match) => (
              <ImageCard
                key={match.id}
                match={match}
                onViewDetails={() => handleViewDetails(match.id)}
                onDelete={() => handleDelete(match.id)}
              />
            ))}
          </div>
        )
      )}

      <ImageDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        image={selectedImage}
        loading={loadingDetail}
        onDelete={handleDelete}
      />
    </div>
  );
}
