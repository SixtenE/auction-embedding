import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Search, X, Loader2, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useSearchByImage, useGetImage, useDeleteImage } from "@/lib/queries";
import type { SearchMatch } from "@/types";
import { cn } from "@/lib/utils";
import { ImageCard } from "@/components/ImageCard";
import { ImageDetailDialog } from "@/components/ImageDetailDialog";
import { motion, AnimatePresence } from "motion/react";

export function SearchTab() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [topK, setTopK] = useState("10");
  const [results, setResults] = useState<SearchMatch[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [detailImageId, setDetailImageId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const search = useSearchByImage();
  const imageDetail = useGetImage(detailOpen ? detailImageId : null);
  const deleteMutation = useDeleteImage();

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

  const handleSearch = () => {
    if (!file) return;
    const k = parseInt(topK, 10);
    if (isNaN(k) || k < 1 || k > 100) {
      toast.error("Top K must be between 1 and 100");
      return;
    }
    search.mutate(
      { file, topK: k },
      {
        onSuccess: (data) => {
          setResults(data.matches);
          if (data.matches.length === 0) {
            toast.info("No similar images found");
          } else {
            toast.success(`Found ${data.matches.length} similar image${data.matches.length !== 1 ? "s" : ""}`);
          }
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Search failed"),
      }
    );
  };

  const handleViewDetails = (id: string) => {
    setDetailImageId(id);
    setDetailOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setResults((prev) => prev?.filter((m) => m.id !== id) ?? null);
        if (detailImageId === id) {
          setDetailOpen(false);
          setDetailImageId(null);
        }
        toast.success("Image deleted");
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
    });
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
              <Search className="h-10 w-10" />
              <p className="text-sm font-medium">Drop a query image here or click to select</p>
              <p className="text-xs">JPEG, PNG, WebP, HEIC — max 10 MB</p>
            </motion.div>
          )}
        </AnimatePresence>
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
            disabled={search.isPending}
          />
        </div>
        <Button onClick={handleSearch} disabled={!file || search.isPending} className="flex-1">
          {search.isPending ? (
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
      <AnimatePresence mode="wait">
        {results !== null && (
          results.length === 0 ? (
            <motion.div
              key="empty"
              className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <ImageOff className="h-12 w-12" />
              <p className="text-sm">No similar images found</p>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              className="grid grid-cols-2 sm:grid-cols-3 gap-4"
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={{
                visible: { transition: { staggerChildren: 0.06 } },
                hidden: {},
              }}
            >
              {results.map((match) => (
                <motion.div
                  key={match.id}
                  variants={{
                    hidden: { opacity: 0, y: 16, scale: 0.97 },
                    visible: { opacity: 1, y: 0, scale: 1 },
                  }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <ImageCard
                    match={match}
                    onViewDetails={() => handleViewDetails(match.id)}
                    onDelete={() => handleDelete(match.id)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )
        )}
      </AnimatePresence>

      <ImageDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        image={imageDetail.data ?? null}
        loading={imageDetail.isLoading}
        onDelete={handleDelete}
      />
    </div>
  );
}
