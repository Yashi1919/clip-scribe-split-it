
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, Scissors, Plus, Trash } from "lucide-react";
import VideoSegment from "./VideoSegment";
import VideoTimelineEditor from "./VideoTimelineEditor";
import { createVideoSegment, downloadFile, formatTime } from "@/lib/videoUtils";

interface VideoSplitterProps {
  videoFile: File;
  videoUrl: string;
  videoDuration: number;
}

interface Segment {
  id: string;
  startTime: number;
  endTime: number;
}

const VideoSplitter = ({ videoFile, videoUrl, videoDuration }: VideoSplitterProps) => {
  const [numSegments, setNumSegments] = useState<number>(2);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [splitComplete, setSplitComplete] = useState<boolean>(false);
  const [customStartTime, setCustomStartTime] = useState<number>(0);
  const [customEndTime, setCustomEndTime] = useState<number>(Math.min(10, videoDuration)); 
  const [editorVisible, setEditorVisible] = useState<boolean>(false);
  const [editedVideoUrl, setEditedVideoUrl] = useState<string>(videoUrl);
  const [remainingDuration, setRemainingDuration] = useState<number>(videoDuration);

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
    }));
    
    setSegments(newSegments);
    setSplitComplete(true);
    setIsProcessing(false);
    toast.success(`Video split into ${numSegments} segments`);
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
      endTime: customEndTime
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
      endTime
    };
    
    // Add to segments list
    setSegments([...segments, newSegment]);
    
    // If this is the first segment, set splitComplete to true
    if (!splitComplete) {
      setSplitComplete(true);
    }
    
    toast.success(`Cut segment added: ${formatTime(startTime)} - ${formatTime(endTime)}`);
  };

  const handleRemoveSegment = (startTime: number, endTime: number) => {
    // For now, we'll just show a toast message since actual video editing requires more complex functionality
    toast.success(`Selected to remove segment: ${formatTime(startTime)} - ${formatTime(endTime)}`);
    // In a more advanced implementation, this would actually modify the video content
  };

  const handleDeleteSegment = (segmentId: string) => {
    setSegments(segments.filter(segment => segment.id !== segmentId));
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
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        
        toast.info(`Processing segment ${i + 1}/${segments.length}...`);
        
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

  return (
    <div className="space-y-6">
      {!splitComplete ? (
        <div className="space-y-4">
          <div className="tabs flex space-x-2 mb-6">
            <Button
              variant={!editorVisible ? "default" : "outline"}
              onClick={() => setEditorVisible(false)}
              className="rounded-full"
            >
              Simple Split
            </Button>
            <Button
              variant={editorVisible ? "default" : "outline"}
              onClick={() => setEditorVisible(true)}
              className="rounded-full"
            >
              Advanced Editor
            </Button>
          </div>

          {editorVisible ? (
            <VideoTimelineEditor 
              videoUrl={videoUrl}
              videoDuration={videoDuration}
              onCutSegment={handleCutSegment}
              onRemoveSegment={handleRemoveSegment}
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
            
            <div className="flex gap-2">
              <Button 
                onClick={() => {
                  setSegments([]);
                  setSplitComplete(false);
                }}
                variant="outline"
              >
                Start Over
              </Button>
              
              {splitComplete && (
                <Button 
                  onClick={() => {
                    setSplitComplete(false);
                  }}
                  variant="secondary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add More Segments
                </Button>
              )}
              
              <Button
                onClick={handleDownloadAll}
                disabled={segments.length === 0}
                variant="default"
              >
                <Download className="mr-2 h-4 w-4" />
                Download All ({segments.length})
              </Button>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {segments.map((segment, index) => (
                <VideoSegment
                  key={segment.id}
                  index={index}
                  videoUrl={videoUrl}
                  startTime={segment.startTime}
                  endTime={segment.endTime}
                  onDelete={() => handleDeleteSegment(segment.id)}
                  onDownload={() => handleDownloadSegment(segment, index)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoSplitter;
