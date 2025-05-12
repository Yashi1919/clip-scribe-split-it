
import React from "react";
import { FileVideo, Clock, Maximize2, FileDigit } from "lucide-react";
import { formatTime } from "@/lib/videoUtils";
import { formatFileSize } from "@/lib/formatUtils";

interface VideoMetadataPanelProps {
  file: File;
  duration: number;
  width?: number;
  height?: number;
  format?: string;
}

const VideoMetadataPanel: React.FC<VideoMetadataPanelProps> = ({
  file,
  duration,
  width,
  height,
  format
}) => {
  return (
    <div className="bg-card rounded-lg p-4 border">
      <h3 className="text-lg font-medium mb-3 flex items-center">
        <FileVideo className="mr-2 h-5 w-5 text-primary" />
        Video Information
      </h3>
      
      <div className="space-y-2">
        <div className="flex items-start">
          <div className="w-28 text-sm font-medium text-muted-foreground">Name:</div>
          <div className="text-sm flex-1 break-all">{file.name}</div>
        </div>
        
        <div className="flex items-center">
          <div className="w-28 text-sm font-medium text-muted-foreground">Size:</div>
          <div className="text-sm">{formatFileSize(file.size)}</div>
        </div>
        
        <div className="flex items-center">
          <div className="w-28 text-sm font-medium text-muted-foreground">Duration:</div>
          <div className="text-sm flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            {formatTime(duration)} ({duration.toFixed(1)}s)
          </div>
        </div>
        
        {width && height && (
          <div className="flex items-center">
            <div className="w-28 text-sm font-medium text-muted-foreground">Resolution:</div>
            <div className="text-sm flex items-center">
              <Maximize2 className="h-3 w-3 mr-1" />
              {width} × {height}
            </div>
          </div>
        )}
        
        {format && (
          <div className="flex items-center">
            <div className="w-28 text-sm font-medium text-muted-foreground">Format:</div>
            <div className="text-sm flex items-center">
              <FileDigit className="h-3 w-3 mr-1" />
              {format}
            </div>
          </div>
        )}
        
        <div className="flex items-center">
          <div className="w-28 text-sm font-medium text-muted-foreground">Modified:</div>
          <div className="text-sm">
            {new Date(file.lastModified).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoMetadataPanel;
