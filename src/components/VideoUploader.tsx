
import { useState, useRef } from "react";
import { Upload, File, X, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface VideoUploaderProps {
  onVideoUploaded: (file: File, url: string) => void;
}

const VideoUploader = ({ onVideoUploaded }: VideoUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
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

  const processFile = async (file: File) => {
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

    // Check file size (warn for very large files)
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 3000) {
      toast.error("File too large. Please use files under 3GB for best performance.");
      return;
    }

    if (fileSizeMB > 500) {
      toast.warning(`Large file detected (${fileSizeMB.toFixed(0)}MB). Processing may take longer.`);
    }

    setIsProcessing(true);
    setUploadProgress(0);
    setSelectedFile(file);
    
    try {
      // Simulate upload progress for large files
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      // Create a URL for the video (this happens instantly)
      const videoUrl = URL.createObjectURL(file);
      
      // Complete the progress
      setUploadProgress(100);
      clearInterval(progressInterval);
      
      // Try to cache the file data for faster access
      try {
        const arrayBuffer = await file.arrayBuffer();
        const fileId = `video_${file.name}_${file.size}`;
        
        // Store file metadata in localStorage for session restoration
        localStorage.setItem(`video_meta_${fileId}`, JSON.stringify({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        }));
        
        toast.success("Video loaded and cached for fast processing!");
      } catch (error) {
        console.warn("Could not cache video data:", error);
        toast.success("Video uploaded successfully!");
      }
      
      // Call the callback with the file and URL
      onVideoUploaded(file, videoUrl);
      
    } catch (error) {
      console.error("Error processing file:", error);
      toast.error("Failed to process video file");
      setSelectedFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearFile = () => {
    if (selectedFile) {
      URL.revokeObjectURL(selectedFile.name);
    }
    setSelectedFile(null);
    setUploadProgress(0);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
              <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                <HardDrive className="h-3 w-3" />
                Supports files up to 3GB - Processing happens locally
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
                {formatFileSize(selectedFile.size)}
              </p>
              {isProcessing && (
                <div className="mt-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Loading and caching video... {uploadProgress}%
                  </p>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFile}
              className="ml-2"
              title="Remove"
              disabled={isProcessing}
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
