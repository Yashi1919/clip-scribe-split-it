
import { useState, useRef } from "react";
import { Upload, File, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface VideoUploaderProps {
  onVideoUploaded: (file: File, url: string) => void;
}

const VideoUploader = ({ onVideoUploaded }: VideoUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    // Check if the file is a video (including MKV)
    const supportedVideoTypes = [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/avi',
      'video/mov',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska' // MKV format
    ];

    const isSupportedVideo = file.type.startsWith("video/") || 
                           supportedVideoTypes.includes(file.type) ||
                           file.name.toLowerCase().endsWith('.mkv');

    if (!isSupportedVideo) {
      toast.error("Please upload a video file (MP4, MOV, AVI, WebM, MKV)");
      return;
    }

    setSelectedFile(file);
    
    // Create a URL for the video
    const videoUrl = URL.createObjectURL(file);
    
    // Call the callback with the file and URL
    onVideoUploaded(file, videoUrl);
    toast.success("Video uploaded successfully!");
  };

  const handleClearFile = () => {
    if (selectedFile) {
      URL.revokeObjectURL(selectedFile.name);
    }
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full">
      {!selectedFile ? (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-border"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleFileDrop}
        >
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="p-4 bg-primary/10 rounded-full">
              <Upload className="h-10 w-10 text-primary" />
            </div>
            <div>
              <p className="text-lg font-medium">Drag & drop your video here</p>
              <p className="text-sm text-muted-foreground mt-1">
                Or click to browse (MP4, MOV, AVI, WebM, MKV)
              </p>
            </div>
            <Button onClick={triggerFileInput} variant="outline" className="mt-2">
              Select Video
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="video/*,.mkv"
              className="hidden"
            />
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-4 bg-secondary/50">
          <div className="flex items-center">
            <File className="h-8 w-8 text-primary mr-3" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFile}
              className="ml-2"
              title="Remove"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoUploader;
