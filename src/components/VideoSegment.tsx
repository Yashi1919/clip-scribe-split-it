
import { Trash2, Download, Scissors, X } from "lucide-react";
import VideoPlayer from "./VideoPlayer";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/videoUtils";

interface VideoSegmentProps {
  index: number;
  videoUrl: string;
  startTime: number;
  endTime: number;
  onDelete: () => void;
  onDownload: () => void;
  type?: "cut" | "remove";
  isSelected?: boolean;
  onClick?: () => void;
}

const VideoSegment = ({
  index,
  videoUrl,
  startTime,
  endTime,
  onDelete,
  onDownload,
  type = "cut",
  isSelected = false,
  onClick
}: VideoSegmentProps) => {
  return (
    <div 
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col fade-in 
        ${type === "remove" ? "border-2 border-destructive/30" : ""}
        ${isSelected ? "ring-2 ring-primary shadow-lg" : ""}
        ${onClick ? "cursor-pointer transition-all hover:shadow-lg" : ""}`}
      onClick={onClick}
    >
      <div className={`p-3 ${
        type === "remove" ? "bg-destructive/20" : "bg-secondary/30"
      } border-b flex items-center justify-between`}>
        <div className="flex items-center">
          {type === "remove" ? (
            <X className="h-4 w-4 mr-1 text-destructive" />
          ) : (
            <Scissors className="h-4 w-4 mr-1" />
          )}
          <h3 className="font-medium">
            {type === "remove" ? "Remove" : "Segment"} {index + 1}
            {isSelected && <span className="ml-2 text-primary">(Selected)</span>}
          </h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatTime(startTime)} - {formatTime(endTime)} 
          <span className="ml-2">
            ({(endTime - startTime).toFixed(1)}s)
          </span>
        </span>
      </div>
      
      <VideoPlayer
        src={videoUrl}
        startTime={startTime}
        endTime={endTime}
        className="aspect-video"
      />
      
      <div className="p-3 flex justify-between items-center">
        <Button
          variant="destructive"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-xs"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
        
        {type !== "remove" && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            className="text-xs"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        )}
      </div>
    </div>
  );
};

export default VideoSegment;
