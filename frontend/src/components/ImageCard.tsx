import { Trash2, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SearchMatch } from "@/types";
import { motion } from "motion/react";

interface Props {
  match: SearchMatch;
  onViewDetails: () => void;
  onDelete: () => void;
}

export function ImageCard({ match, onViewDetails, onDelete }: Props) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <Card className="overflow-hidden">
        <div className="aspect-square bg-muted">
          <img
            src={match.url}
            alt={match.metadata.filename ?? "Image"}
            className="w-full h-full object-cover"
          />
        </div>
        <CardContent className="pt-2 pb-3 px-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Score:{" "}
              <span className="font-medium text-foreground">
                {(match.score * 100).toFixed(1)}%
              </span>
            </span>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onViewDetails} title="View details">
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onDelete}
                title="Delete image"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {match.metadata.filename ? (
            <p className="text-xs truncate text-muted-foreground mt-0.5">{match.metadata.filename}</p>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}
