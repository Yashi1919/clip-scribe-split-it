import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, Scissors, Plus, Trash, Archive, Settings, HardDrive } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import VideoSegment from "./VideoSegment";
import VideoTimelineEditor from "./VideoTimelineEditor";
import MultiSplitEditor from "./MultiSplitEditor";
import { createVideoSegment, downloadFile, formatTime } from "@/lib/videoUtils";
import { removeVideoSegment } from "@/lib/VideoProcessor";
import { generateOutputFileName } from "@/lib/formatUtils";
import { createZipFromBlobs, downloadZip, VIDEO_FORMATS, getSupportedFormats, VideoFormat } from "@/lib/downloadUtils";
import { FastVideoProcessor, streamingDownload } from "@/lib/fastVideoProcessor";

interface VideoSplitterProps {
  videoFile: File;
  videoUrl: string;
  videoDuration: number;
}

interface Segment {
  id: string;
  startTime: number;
  endTime: number;
  type?: "cut" | "remove";
}

const VideoSplitter = ({ videoFile, videoUrl, videoDuration }: VideoSplitterProps) => {
  const [numSegments, setNumSegments] = useState<number>(2);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [splitComplete, setSplitComplete] = useState<boolean>(false);
  const [customStartTime, setCustomStartTime] = useState<number>(0);
  const [customEndTime, setCustomEndTime] = useState<number>(Math.min(10, videoDuration)); 
  const [editorMode, setEditorMode] = useState<"simple" | "timeline" | "multi">("simple");
  const [editedVideoUrl, setEditedVideoUrl] = useState<string | null>(null);
  const [remainingDuration, setRemainingDuration] = useState<number>(videoDuration);
  const [processedVideoFile, setProcessedVideoFile] = useState<File | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<VideoFormat>('webm');
  const [supportedFormats] = useState<VideoFormat[]>(getSupportedFormats());
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [processor, setProcessor] = useState<FastVideoProcessor | null>(null);
  const [isInitializingProcessor, setIsInitializingProcessor] = useState(false);
  const [memoryInfo, setMemoryInfo] = useState<{ videoDataMB: number; isUsingMemoryMode: boolean } | null>(null);
  
  // Generate a unique ID for this video to use with localStorage
  const videoId = React.useMemo(() => {
    // Use file name and size as part of the ID to make it unique
    return `video_${videoFile.name.replace(/\W/g, '_')}_${videoFile.size}`;
  }, [videoFile]);

  // Load segments from localStorage on component mount
  useEffect(() => {
    try {
      const savedSegments = localStorage.getItem(`segments_${videoId}`);
      if (savedSegments) {
        const parsedSegments = JSON.parse(savedSegments);
        if (Array.isArray(parsedSegments) && parsedSegments.length > 0) {
          setSegments(parsedSegments);
          setSplitComplete(true);
        }
      }
    } catch (error) {
      console.error("Failed to load segments from localStorage:", error);
    }
  }, [videoId]);

  // Save segments to localStorage whenever they change
  useEffect(() => {
    if (segments.length > 0) {
      try {
        localStorage.setItem(`segments_${videoId}`, JSON.stringify(segments));
      } catch (error) {
        console.error("Failed to save segments to localStorage:", error);
      }
    }
  }, [segments, videoId]);

  // Initialize fast processor when video is loaded
  useEffect(() => {
    if (videoFile && !processor && !isInitializingProcessor) {
      setIsInitializingProcessor(true);
      const fileSizeMB = videoFile.size / (1024 * 1024);
      
      const newProcessor = new FastVideoProcessor({
        maxConcurrentWorkers: Math.min(navigator.hardwareConcurrency || 4, fileSizeMB > 1000 ? 3 : 6),
        useStreamingDownload: true,
        memoryThreshold: 1000 // 1GB threshold
      });
      
      newProcessor.initialize(videoFile)
        .then(() => {
          setProcessor(newProcessor);
          setMemoryInfo(newProcessor.memoryUsage);
          toast.success(`High-speed processor initialized for ${fileSizeMB.toFixed(0)}MB file!`);
        })
        .catch((error) => {
          console.error("Failed to initialize processor:", error);
          toast.error("Fast processor unavailable, using fallback method");
          setProcessor(null);
        })
        .finally(() => {
          setIsInitializingProcessor(false);
        });
    }
    
    return () => {
      if (processor) {
        processor.destroy();
      }
    };
  }, [videoFile]);

  const handleSplitVideo = () => {
    if (numSegments < 2) {
      toast.error("Please enter at least 2 segments");
      return;
    }

    if (numSegments > 500) {
      toast.error("Maximum 500 segments allowed");
      return;
    }

    // Warning for very large numbers of segments
    if (numSegments > 100) {
      toast.warning(`Creating ${numSegments} segments may take longer to process`);
    }

    setIsProcessing(true);
    
    // Calculate segment duration
    const segmentDuration = videoDuration / numSegments;
    
    // Create segments
    const newSegments = Array.from({ length: numSegments }, (_, index) => ({
      id: `segment-${index}`,
      startTime: index * segmentDuration,
      endTime: (index + 1) * segmentDuration,
      type: "cut" as const
    }));
    
    setSegments(newSegments);
    setSplitComplete(true);
    setIsProcessing(false);
    toast.success(`Video split into ${numSegments} segments`);
  };

  const handleMultiSplit = (splitPoints: number[]) => {
    if (splitPoints.length === 0) {
      toast.error("No split points defined");
      return;
    }

    setIsProcessing(true);
    
    // Create segments based on split points
    // Start with segment from 0 to first split point
    const allPoints = [0, ...splitPoints, videoDuration];
    
    const newSegments = [];
    for (let i = 0; i < allPoints.length - 1; i++) {
      newSegments.push({
        id: `segment-${i}`,
        startTime: allPoints[i],
        endTime: allPoints[i + 1],
        type: "cut" as const
      });
    }
    
    setSegments(newSegments);
    setSplitComplete(true);
    setIsProcessing(false);
    toast.success(`Video split into ${newSegments.length} segments`);
  };

  const handleAddCustomPart = () => {
    // Validate custom times
    if (customStartTime >= customEndTime) {
      toast.error("Start time must be before end time");
      return;
    }
    
    if (customEndTime > videoDuration) {
      toast.error(`End time cannot exceed video duration (${formatTime(videoDuration)})`);
      return;
    }
    
    // Create a new segment with custom times
    const newSegment = {
      id: `segment-${Date.now()}`,
      startTime: customStartTime,
      endTime: customEndTime,
      type: "cut" as const
    };
    
    // Add to segments list
    setSegments([...segments, newSegment]);
    
    // If this is the first segment, set splitComplete to true
    if (!splitComplete) {
      setSplitComplete(true);
    }
    
    toast.success("Custom segment added");
  };

  const handleCutSegment = (startTime: number, endTime: number) => {
    // Create a new segment with the cut times
    const newSegment = {
      id: `segment-${Date.now()}`,
      startTime,
      endTime,
      type: "cut" as const
    };
    
    // Add to segments list
    setSegments([...segments, newSegment]);
    
    // If this is the first segment, set splitComplete to true
    if (!splitComplete) {
      setSplitComplete(true);
    }
    
    toast.success(`Cut segment added: ${formatTime(startTime)} - ${formatTime(endTime)}`);
  };

  const handleRemoveSegment = async (startTime: number, endTime: number) => {
    try {
      toast.info("Processing video removal...");
      setIsProcessing(true);
      
      // Create a "removal" segment for tracking purposes
      const removalSegment = {
        id: `remove-${Date.now()}`,
        startTime,
        endTime,
        type: "remove" as const
      };
      
      // Add to segments list
      setSegments(prev => [...prev, removalSegment]);
      
      // Process the video to remove this segment
      const processedBlob = await removeVideoSegment(videoFile, {
        startTime,
        endTime
      });
      
      // Create a new file from the blob
      const processedFile = new File([processedBlob], videoFile.name, {
        type: processedBlob.type
      });
      
      // Update the video source with the new processed video
      const newVideoUrl = URL.createObjectURL(processedBlob);
      setEditedVideoUrl(newVideoUrl);
      setProcessedVideoFile(processedFile);
      
      // If this is the first segment, set splitComplete to true
      if (!splitComplete) {
        setSplitComplete(true);
      }
      
      toast.success(`Segment removed: ${formatTime(startTime)} - ${formatTime(endTime)}`);
      setIsProcessing(false);
    } catch (error) {
      console.error("Error removing segment:", error);
      toast.error("Failed to remove segment");
      setIsProcessing(false);
    }
  };

  const handleDeleteSegment = (segmentId: string) => {
    setSegments(segments.filter(segment => segment.id !== segmentId));
    if (selectedSegment === segmentId) {
      setSelectedSegment(null);
    }
    toast.success("Segment deleted");
  };

  const handleDownloadSegment = async (segment: Segment, index: number) => {
    try {
      toast.info("Preparing segment for download...");
      
      const formatConfig = VIDEO_FORMATS[selectedFormat];
      
      if (processor && processor.isAvailable) {
        // Use fast processor
        const results = await processor.processSegments(
          [{
            id: segment.id,
            startTime: segment.startTime,
            endTime: segment.endTime,
            index
          }],
          formatConfig.extension
        );
        
        const data = results.get(segment.id);
        if (data) {
          const blob = new Blob([data], { type: formatConfig.mimeType });
          const fileName = generateOutputFileName(
            videoFile.name,
            `part${index + 1}`,
            formatConfig.extension
          );
          streamingDownload(blob, fileName);
          toast.success(`Segment ${index + 1} downloaded using fast processor!`);
        }
      } else {
        // Fallback to original method
        const blob = await createVideoSegment(
          videoFile,
          segment.startTime,
          segment.endTime,
          formatConfig.mimeType
        );
        
        const fileName = generateOutputFileName(
          videoFile.name,
          `part${index + 1}`,
          formatConfig.extension
        );
        
        downloadFile(blob, fileName);
        toast.success(`Segment ${index + 1} downloaded`);
      }
    } catch (error) {
      console.error("Error downloading segment:", error);
      toast.error("Failed to download segment");
    }
  };

  const handleDownloadAll = async () => {
    if (segments.length === 0) {
      toast.error("No segments to download");
      return;
    }

    const cutSegments = segments.filter(segment => segment.type !== "remove");
    
    if (cutSegments.length === 0) {
      toast.error("No segments available for download");
      return;
    }

    setIsDownloading(true);
    setDownloadProgress({ current: 0, total: cutSegments.length });
    
    try {
      const formatConfig = VIDEO_FORMATS[selectedFormat];
      
      if (processor && processor.isAvailable) {
        // Use high-speed parallel processing with automatic downloads
        toast.info("🚀 Starting lightning-fast processing with automatic downloads...");
        
        const segmentJobs = cutSegments.map((segment, index) => ({
          id: segment.id,
          startTime: segment.startTime,
          endTime: segment.endTime,
          index
        }));
        
        try {
          await processor.processAndDownloadSegments(
            segmentJobs,
            formatConfig.extension,
            videoFile.name,
            (completed, total) => {
              setDownloadProgress({ current: completed, total });
              toast.info(`⚡ Auto-downloading: ${completed}/${total} segments`, {
                id: 'fast-download-progress'
              });
            },
            (segmentId, filename) => {
              console.log(`Segment ${filename} processed and auto-downloaded`);
            }
          );
          
          toast.success(`⚡ Lightning-fast processing completed! ${cutSegments.length} segments automatically downloaded!`);
        } catch (processorError) {
          console.error("Fast processor failed:", processorError);
          toast.error("Fast processor failed, switching to fallback method...");
          
          // Fall back to slow method
          await fallbackDownloadMethod(cutSegments, formatConfig);
        }
      } else {
        // Use fallback method
        await fallbackDownloadMethod(cutSegments, formatConfig);
      }
      
    } catch (error) {
      console.error("Error during batch download:", error);
      toast.error("Download process encountered errors");
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const fallbackDownloadMethod = async (cutSegments: Segment[], formatConfig: any) => {
    toast.warning("Using slower fallback method. Processing one segment at a time...");
    
    for (let i = 0; i < cutSegments.length; i++) {
      const segment = cutSegments[i];
      
      setDownloadProgress({ current: i + 1, total: cutSegments.length });
      
      toast.info(`Processing and downloading segment ${i + 1}/${cutSegments.length}...`, {
        id: 'download-progress'
      });
      
      try {
        const blob = await createVideoSegment(
          videoFile,
          segment.startTime,
          segment.endTime,
          formatConfig.mimeType
        );
        
        const fileName = generateOutputFileName(
          videoFile.name,
          `part${i + 1}`,
          formatConfig.extension
        );
        
        downloadFile(blob, fileName);
        
        // Longer delay between segments to prevent browser throttling
        if (i < cutSegments.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (segmentError) {
        console.error(`Error processing segment ${i + 1}:`, segmentError);
        toast.error(`Failed to process segment ${i + 1}`);
      }
    }
    
    toast.success(`Successfully processed and downloaded ${cutSegments.length} segments using fallback method!`);
  };

  const handleDownloadAsZip = async () => {
    if (segments.length === 0) {
      toast.error("No segments to download");
      return;
    }

    const cutSegments = segments.filter(segment => segment.type !== "remove");
    
    if (cutSegments.length === 0) {
      toast.error("No segments available for download");
      return;
    }

    setIsDownloading(true);
    setDownloadProgress({ current: 0, total: cutSegments.length });
    
    try {
      const formatConfig = VIDEO_FORMATS[selectedFormat];
      
      toast.info("Processing segments for individual download...");
      
      for (let i = 0; i < cutSegments.length; i++) {
        const segment = cutSegments[i];
        
        // Update progress
        setDownloadProgress({ current: i + 1, total: cutSegments.length });
        
        toast.info(`Processing segment ${i + 1}/${cutSegments.length} for download...`, {
          id: 'zip-progress'
        });
        
        try {
          const blob = await createVideoSegment(
            videoFile,
            segment.startTime,
            segment.endTime,
            formatConfig.mimeType
          );
          
          const fileName = generateOutputFileName(
            videoFile.name,
            `part${i + 1}`,
            formatConfig.extension
          );
          
          downloadFile(blob, fileName);
          
          // Small delay to prevent browser overload
          if (i < cutSegments.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 150));
          }
          
        } catch (segmentError) {
          console.error(`Error processing segment ${i + 1}:`, segmentError);
          toast.error(`Failed to process segment ${i + 1}`);
        }
      }
      
      toast.success(`${cutSegments.length} segments downloaded individually!`);
      
    } catch (error) {
      console.error("Error during ZIP download:", error);
      toast.error("Failed to process segments");
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const handleDownloadProcessed = () => {
    if (!editedVideoUrl || !processedVideoFile) {
      toast.error("No processed video available");
      return;
    }

    try {
      const formatConfig = VIDEO_FORMATS[selectedFormat];
      const fileName = generateOutputFileName(
        videoFile.name,
        "processed",
        formatConfig.extension
      );
      
      const blob = new Blob([processedVideoFile], { type: processedVideoFile.type });
      
      downloadFile(blob, fileName);
      
      toast.success("Processed video downloaded");
    } catch (error) {
      console.error("Error downloading processed video:", error);
      toast.error("Failed to download processed video");
    }
  };

  const handleSegmentClick = (segmentId: string) => {
    setSelectedSegment(selectedSegment === segmentId ? null : segmentId);
  };

  // Use edited video URL if available, otherwise use original
  const currentVideoUrl = editedVideoUrl || videoUrl;
  const fileSizeMB = videoFile.size / (1024 * 1024);

  return (
    <div className="space-y-6">
      {/* Large File Info Banner */}
      {fileSizeMB > 500 && (
        <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <HardDrive className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-900">Large File Detected</h3>
              <p className="text-sm text-blue-700 mt-1">
                File size: {fileSizeMB.toFixed(0)}MB. 
                {memoryInfo?.isUsingMemoryMode 
                  ? " Loaded into memory for fastest processing." 
                  : " Using streaming mode to optimize memory usage."
                }
              </p>
              {memoryInfo && (
                <p className="text-xs text-blue-600 mt-1">
                  Processing mode: {memoryInfo.isUsingMemoryMode ? "⚡ Memory" : "💾 Streaming"} 
                  {memoryInfo.videoDataMB > 0 && ` (${memoryInfo.videoDataMB.toFixed(0)}MB in memory)`}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!splitComplete ? (
        <div className="space-y-4">
          <div className="tabs flex flex-wrap space-x-2 mb-6">
            <Button
              variant={editorMode === "simple" ? "default" : "outline"}
              onClick={() => setEditorMode("simple")}
              className="rounded-full mb-2"
            >
              Simple Split
            </Button>
            <Button
              variant={editorMode === "multi" ? "default" : "outline"}
              onClick={() => setEditorMode("multi")}
              className="rounded-full mb-2"
            >
              Advanced Split
            </Button>
            <Button
              variant={editorMode === "timeline" ? "default" : "outline"}
              onClick={() => setEditorMode("timeline")}
              className="rounded-full mb-2"
            >
              Timeline Editor
            </Button>
          </div>

          {editorMode === "timeline" ? (
            <VideoTimelineEditor 
              videoUrl={currentVideoUrl}
              videoDuration={videoDuration}
              onCutSegment={handleCutSegment}
              onRemoveSegment={handleRemoveSegment}
              videoId={videoId}
            />
          ) : editorMode === "multi" ? (
            <MultiSplitEditor
              videoUrl={currentVideoUrl}
              videoDuration={videoDuration}
              onSplitApply={handleMultiSplit}
              videoId={videoId}
            />
          ) : (
            <div className="p-6 border rounded-lg bg-card">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Equal Splitting</h3>
                  <div className="space-y-2">
                    <Label htmlFor="numSegments">Split video into how many parts?</Label>
                    <Input
                      id="numSegments"
                      type="number"
                      min={2}
                      max={500}
                      value={numSegments}
                      onChange={(e) => setNumSegments(parseInt(e.target.value) || 2)}
                      className="max-w-[150px]"
                    />
                    <p className="text-sm text-muted-foreground">
                      Each segment will be approximately {(videoDuration / numSegments).toFixed(1)} seconds
                    </p>
                    {numSegments > 100 && (
                      <p className="text-sm text-amber-600">
                        ⚠️ Large number of segments may take longer to process
                      </p>
                    )}
                  </div>
                  
                  <Button 
                    onClick={handleSplitVideo}
                    disabled={isProcessing}
                    className="w-full sm:w-auto"
                  >
                    <Scissors className="mr-2 h-4 w-4" />
                    Split Video Equally
                  </Button>
                </div>
                
                <div className="space-y-4 border-t pt-6 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                  <h3 className="text-lg font-medium">Custom Segments</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time (seconds)</Label>
                    <Input
                      id="startTime"
                      type="number"
                      min={0}
                      max={videoDuration - 1}
                      step={0.1}
                      value={customStartTime}
                      onChange={(e) => setCustomStartTime(parseFloat(e.target.value) || 0)}
                      className="max-w-[150px]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time (seconds)</Label>
                    <Input
                      id="endTime"
                      type="number"
                      min={0.1}
                      max={videoDuration}
                      step={0.1}
                      value={customEndTime}
                      onChange={(e) => setCustomEndTime(parseFloat(e.target.value) || Math.min(10, videoDuration))}
                      className="max-w-[150px]"
                    />
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    Duration: {(customEndTime - customStartTime).toFixed(1)} seconds
                  </p>
                  
                  <Button 
                    onClick={handleAddCustomPart}
                    variant="secondary"
                    className="w-full sm:w-auto"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Custom Segment
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-bold tracking-tight">
              {segments.length} Video {segments.length === 1 ? "Segment" : "Segments"}
            </h2>
            
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => {
                  setSegments([]);
                  setSplitComplete(false);
                  setEditedVideoUrl(null);
                  setProcessedVideoFile(null);
                  setSelectedSegment(null);
                  setDownloadProgress(null);
                  setIsDownloading(false);
                  localStorage.removeItem(`segments_${videoId}`);
                }}
                variant="outline"
                disabled={isDownloading}
              >
                Start Over
              </Button>
              
              <Button 
                onClick={() => setSplitComplete(false)}
                variant="secondary"
                disabled={isDownloading}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add More Segments
              </Button>
            </div>
          </div>

          {/* Download Progress Display */}
          {downloadProgress && (
            <div className="p-4 border rounded-lg bg-primary/5">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-2">
                    <span>
                      {processor && processor.isAvailable 
                        ? `Processing ${fileSizeMB.toFixed(0)}MB file with auto-download...` 
                        : "Processing with fallback method..."
                      }
                    </span>
                    <span>{downloadProgress.current}/{downloadProgress.total}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {processor && processor.isAvailable 
                  ? `⚡ Each segment auto-downloads immediately! (${memoryInfo?.isUsingMemoryMode ? 'Memory' : 'Streaming'} mode)`
                  : "🐌 Using slower method due to processor unavailability"
                }
              </p>
            </div>
          )}

          {/* Enhanced Format Selection and Download Options */}
          <div className="p-4 border rounded-lg bg-secondary/20">
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <Label htmlFor="format-select" className="text-sm font-medium">Export Format:</Label>
                <Select 
                  value={selectedFormat} 
                  onValueChange={(value: VideoFormat) => setSelectedFormat(value)}
                  disabled={isDownloading}
                >
                  <SelectTrigger className="w-24" id="format-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedFormats.map((format) => (
                      <SelectItem key={format} value={format}>
                        {VIDEO_FORMATS[format].name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {processor && processor.isAvailable && (
                <div className="flex items-center gap-2 text-green-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-xs font-medium">
                    ⚡ Fast Processor ({memoryInfo?.isUsingMemoryMode ? 'Memory' : 'Streaming'})
                  </span>
                </div>
              )}
              
              {fileSizeMB > 1000 && (
                <div className="flex items-center gap-2 text-blue-600">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span className="text-xs font-medium">💾 Large File Optimized</span>
                </div>
              )}
              
              {!processor && !isInitializingProcessor && (
                <div className="flex items-center gap-2 text-amber-600">
                  <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                  <span className="text-xs font-medium">🐌 Fallback Mode Only</span>
                </div>
              )}
              
              {isInitializingProcessor && (
                <div className="flex items-center gap-2 text-blue-600">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                  <span className="text-xs">Initializing fast processor...</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleDownloadAll}
                disabled={segments.length === 0 || isProcessing || isDownloading}
                variant="default"
              >
                <Download className="mr-2 h-4 w-4" />
                {isDownloading 
                  ? "Processing..." 
                  : `${processor?.isAvailable ? "⚡ Fast" : "🐌 Slow"} Download All (${segments.filter(s => s.type !== "remove").length})`
                }
              </Button>
              
              <Button
                onClick={handleDownloadAsZip}
                disabled={segments.length === 0 || isProcessing || isDownloading}
                variant="secondary"
              >
                <Archive className="mr-2 h-4 w-4" />
                {isDownloading ? "Processing..." : "Download as ZIP"}
              </Button>
              
              {editedVideoUrl && (
                <Button
                  onClick={handleDownloadProcessed}
                  disabled={isProcessing || isDownloading}
                  variant="outline"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Processed Video
                </Button>
              )}
            </div>
            
            {processor?.isAvailable && segments.filter(s => s.type !== "remove").length > 50 && (
              <p className="text-sm text-green-600 mt-2">
                ⚡ Fast mode: Each segment downloads immediately after processing! 
                {fileSizeMB > 1000 && " Optimized for large files."}
              </p>
            )}
            
            {(!processor || !processor.isAvailable) && segments.filter(s => s.type !== "remove").length > 50 && (
              <p className="text-sm text-amber-600 mt-2">
                🐌 Fallback mode: Processing segments one at a time to prevent browser throttling
              </p>
            )}
          </div>
          
          {segments.length === 0 ? (
            <div className="text-center p-12 border rounded-lg bg-muted/40">
              <p className="text-muted-foreground">No segments created yet</p>
              <Button 
                onClick={() => setSplitComplete(false)} 
                variant="outline"
                className="mt-4"
              >
                Start Over
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedSegment && (
                <div className="p-4 bg-secondary/20 rounded-lg border">
                  <h3 className="text-lg font-medium mb-2">Selected Segment</h3>
                  {(() => {
                    const segment = segments.find(s => s.id === selectedSegment);
                    if (!segment) return null;
                    
                    return (
                      <div className="flex flex-wrap gap-4 items-center">
                        <div>
                          <p className="text-sm font-medium">Time Range</p>
                          <p className="text-sm text-muted-foreground">
                            {formatTime(segment.startTime)} - {formatTime(segment.endTime)} 
                            ({(segment.endTime - segment.startTime).toFixed(1)}s)
                          </p>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleDeleteSegment(segment.id)}
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            Delete Segment
                          </Button>
                          
                          {segment.type !== "remove" && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                const index = segments.findIndex(s => s.id === segment.id);
                                handleDownloadSegment(segment, index);
                              }}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download This Segment
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <h3 className="text-lg font-medium">Segments:</h3>
                {segments.some(s => s.type === "remove") && (
                  <span className="text-sm bg-destructive/20 text-destructive px-2 py-1 rounded-md">
                    {segments.filter(s => s.type === "remove").length} segments marked for removal
                  </span>
                )}
                <span className="text-sm text-muted-foreground">
                  (Click on a segment to select it)
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {segments.map((segment, index) => (
                  <VideoSegment
                    key={segment.id}
                    index={index}
                    videoUrl={segment.type === "remove" ? videoUrl : currentVideoUrl}
                    startTime={segment.startTime}
                    endTime={segment.endTime}
                    onDelete={() => handleDeleteSegment(segment.id)}
                    onDownload={() => segment.type !== "remove" && handleDownloadSegment(segment, index)}
                    type={segment.type}
                    isSelected={segment.id === selectedSegment}
                    onClick={() => handleSegmentClick(segment.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoSplitter;
