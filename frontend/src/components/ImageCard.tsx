import { Trash2, Eye } from "lucide-react";
import type { SearchMatch } from "@/types";

interface Props {
  match: SearchMatch;
  onViewDetails: () => void;
  onDelete: () => void;
}

export function ImageCard({ match, onViewDetails, onDelete }: Props) {
  return (
    <div className="rounded-xl border border-[#e5e5e5] overflow-hidden bg-white">
      <div className="aspect-square bg-[#fafafa]">
        <img
          src={match.url}
          alt={match.metadata.filename ?? "Image"}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="px-3 pt-2 pb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#737373]">
            <span className="font-medium text-black">{(match.score * 100).toFixed(1)}%</span>
            {" "}match
          </span>
          <div className="flex gap-1">
            <button
              className="rounded-full p-1.5 text-[#737373] hover:bg-[#e5e5e5] hover:text-black"
              onClick={onViewDetails}
              title="View details"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button
              className="rounded-full p-1.5 text-[#737373] hover:bg-[#e5e5e5] hover:text-black"
              onClick={onDelete}
              title="Delete image"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {match.metadata.filename ? (
          <p className="text-xs truncate text-[#a3a3a3] mt-0.5">{match.metadata.filename}</p>
        ) : null}
      </div>
    </div>
  );
}
