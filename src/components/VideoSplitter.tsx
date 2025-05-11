import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, Scissors, Plus, Trash } from "lucide-react";
import VideoSegment from "./VideoSegment";
import VideoTimelineEditor from "./VideoTimelineEditor";
import MultiSplitEditor from "./MultiSplitEditor";
import { createVideoSegment, downloadFile, formatTime } from "@/lib/videoUtils";
import { removeVideoSegment } from "@/lib/VideoProcessor";

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

  const handleSplitVideo = () => {
    if (numSegments < 2) {
      toast.error("Please enter at least 2 segments");
      return;
    }

    if (numSegments > 20) {
      toast.error("Maximum 20 segments allowed");
      return;
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
      
      const blob = await createVideoSegment(
        videoFile,
        segment.startTime,
        segment.endTime
      );
      
      // Generate a filename based on the original filename and segment index
      const originalName = videoFile.name.replace(/\.[^/.]+$/, ""); // Remove extension
      const fileName = `${originalName}-part${index + 1}.webm`;
      
      downloadFile(blob, fileName);
      
      toast.success(`Segment ${index + 1} downloaded`);
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

    toast.info(`Preparing ${segments.length} segments for download...`);
    
    try {
      // Process segments sequentially to avoid memory issues
      const cutSegments = segments.filter(segment => segment.type !== "remove");
      
      for (let i = 0; i < cutSegments.length; i++) {
        const segment = cutSegments[i];
        
        toast.info(`Processing segment ${i + 1}/${cutSegments.length}...`);
        
        const blob = await createVideoSegment(
          videoFile,
          segment.startTime,
          segment.endTime
        );
        
        const originalName = videoFile.name.replace(/\.[^/.]+$/, "");
        const fileName = `${originalName}-part${i + 1}.webm`;
        
        downloadFile(blob, fileName);
      }
      
      toast.success("All segments downloaded");
    } catch (error) {
      console.error("Error downloading segments:", error);
      toast.error("Failed to download all segments");
    }
  };

  const handleDownloadProcessed = () => {
    if (!editedVideoUrl || !processedVideoFile) {
      toast.error("No processed video available");
      return;
    }

    try {
      const originalName = videoFile.name.replace(/\.[^/.]+$/, "");
      const fileName = `${originalName}-processed.webm`;
      
      // Create a blob from the processed file
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

  return (
    <div className="space-y-6">
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
            />
          ) : editorMode === "multi" ? (
            <MultiSplitEditor
              videoUrl={currentVideoUrl}
              videoDuration={videoDuration}
              onSplitApply={handleMultiSplit}
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
                      max={20}
                      value={numSegments}
                      onChange={(e) => setNumSegments(parseInt(e.target.value) || 2)}
                      className="max-w-[150px]"
                    />
                    <p className="text-sm text-muted-foreground">
                      Each segment will be approximately {(videoDuration / numSegments).toFixed(1)} seconds
                    </p>
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
                }}
                variant="outline"
              >
                Start Over
              </Button>
              
              <Button 
                onClick={() => {
                  setSplitComplete(false);
                }}
                variant="secondary"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add More Segments
              </Button>
              
              <Button
                onClick={handleDownloadAll}
                disabled={segments.length === 0 || isProcessing}
                variant="default"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Segments ({segments.filter(s => s.type !== "remove").length})
              </Button>
              
              {editedVideoUrl && (
                <Button
                  onClick={handleDownloadProcessed}
                  disabled={isProcessing}
                  variant="secondary"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Processed Video
                </Button>
              )}
            </div>
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
