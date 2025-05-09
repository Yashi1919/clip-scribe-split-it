
import { Trash2, Download } from "lucide-react";
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
}

const VideoSegment = ({
  index,
  videoUrl,
  startTime,
  endTime,
  onDelete,
  onDownload,
}: VideoSegmentProps) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col fade-in">
      <div className="p-3 bg-secondary/30 border-b flex items-center justify-between">
        <h3 className="font-medium">Segment {index + 1}</h3>
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
          onClick={onDelete}
          className="text-xs"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onDownload}
          className="text-xs"
        >
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
      </div>
    </div>
  );
};

export default VideoSegment;
