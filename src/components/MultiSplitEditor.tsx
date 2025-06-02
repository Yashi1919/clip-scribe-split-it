
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Scissors, Play, Pause, Trash } from "lucide-react";
import { formatTime } from "@/lib/videoUtils";
import VideoPlayer from "./VideoPlayer";

interface MultiSplitEditorProps {
  videoUrl: string;
  videoDuration: number;
  onSplitApply: (splitPoints: number[]) => void;
  videoId?: string; // Optional ID to use for localStorage persistence
}

const MultiSplitEditor = ({ videoUrl, videoDuration, onSplitApply, videoId }: MultiSplitEditorProps) => {
  const [numSplits, setNumSplits] = useState<number>(2);
  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  
  const localStorageKey = videoId ? `splitPoints_${videoId}` : null;

  // Load saved split points from localStorage if available
  useEffect(() => {
    if (localStorageKey) {
      try {
        const savedSplitPoints = localStorage.getItem(localStorageKey);
        if (savedSplitPoints) {
          const parsedPoints = JSON.parse(savedSplitPoints);
          // Validate the points are within video duration
          const validPoints = parsedPoints.filter((point: number) => 
            point > 0 && point < videoDuration
          );
          setSplitPoints(validPoints);
          setNumSplits(validPoints.length);
        }
      } catch (error) {
        console.error("Failed to load split points from localStorage:", error);
      }
    }
  }, [localStorageKey, videoDuration]);

  // When numSplits changes, calculate the equal division points
  React.useEffect(() => {
    if (splitPoints.length === numSplits) return;
    
    // Calculate split points (exclude 0 and videoDuration)
    const segmentDuration = videoDuration / (numSplits + 1);
    const newSplitPoints = Array.from({ length: numSplits }, (_, i) => 
      (i + 1) * segmentDuration
    );
    setSplitPoints(newSplitPoints);
    
    // Save to localStorage if we have a key
    if (localStorageKey) {
      localStorage.setItem(localStorageKey, JSON.stringify(newSplitPoints));
    }
  }, [numSplits, videoDuration, localStorageKey]);

  // Handle video playback
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play();
      setIsPlaying(true);
    }
  };

  // Handle time updates from the video player
  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  // Apply the split points
  const handleApplySplits = () => {
    onSplitApply(splitPoints);
    
    // Save to localStorage if we have a key
    if (localStorageKey) {
      localStorage.setItem(localStorageKey, JSON.stringify(splitPoints));
    }
  };

  // Adjust a specific split point
  const handleSplitPointChange = (index: number, value: number) => {
    const newSplitPoints = [...splitPoints];
    newSplitPoints[index] = value;
    // Sort split points to maintain order
    const sortedPoints = newSplitPoints.sort((a, b) => a - b);
    setSplitPoints(sortedPoints);
    
    // Save to localStorage if we have a key
    if (localStorageKey) {
      localStorage.setItem(localStorageKey, JSON.stringify(sortedPoints));
    }
  };

  // Delete a specific split point
  const handleDeleteSplitPoint = (index: number) => {
    const newSplitPoints = splitPoints.filter((_, i) => i !== index);
    setSplitPoints(newSplitPoints);
    setNumSplits(newSplitPoints.length);
    
    // Save to localStorage if we have a key
    if (localStorageKey) {
      localStorage.setItem(localStorageKey, JSON.stringify(newSplitPoints));
    }
  };

  // Add a split point at the current time
  const handleAddSplitPoint = () => {
    // Don't add if too close to another split point or at the start/end
    if (currentTime < 0.5 || currentTime > videoDuration - 0.5) return;
    
    // Check if too close to an existing split point
    const isTooClose = splitPoints.some(point => 
      Math.abs(point - currentTime) < 1
    );
    
    if (!isTooClose) {
      const newSplitPoints = [...splitPoints, currentTime].sort((a, b) => a - b);
      setSplitPoints(newSplitPoints);
      setNumSplits(newSplitPoints.length);
      
      // Save to localStorage if we have a key
      if (localStorageKey) {
        localStorage.setItem(localStorageKey, JSON.stringify(newSplitPoints));
      }
    }
  };

  return (
    <div className="space-y-6 border rounded-lg p-4 bg-card">
      <div className="aspect-video bg-black rounded-md overflow-hidden relative">
        <VideoPlayer
          ref={videoRef}
          src={videoUrl}
          onTimeUpdate={handleTimeUpdate}
          className="w-full h-full"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={togglePlayPause}
          >
            {isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {isPlaying ? "Pause" : "Play"}
          </Button>
          
          <div className="text-sm text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(videoDuration)}
          </div>
        </div>

        <div className="relative">
          <Slider 
            value={[currentTime]}
            min={0}
            max={videoDuration}
            step={0.01}
            onValueChange={(value) => {
              if (videoRef.current) {
                videoRef.current.currentTime = value[0];
                setCurrentTime(value[0]);
              }
            }}
            className="w-full"
          />
          
          {/* Render split points */}
          <div className="absolute inset-0 pointer-events-none">
            {splitPoints.map((point, index) => (
              <div 
                key={index}
                className="absolute top-0 flex flex-col items-center pointer-events-auto"
                style={{ left: `${(point / videoDuration) * 100}%` }}
              >
                <div 
                  className="w-0.5 h-5 bg-primary cursor-pointer"
                  title={`Split at ${formatTime(point)}`}
                />
              </div>
            ))}
          </div>
        </div>

        <Button 
          variant="secondary" 
          size="sm" 
          onClick={handleAddSplitPoint}
        >
          <Scissors className="h-4 w-4 mr-2" />
          Add Split at {formatTime(currentTime)}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Equal Splitting</h3>
          <div className="space-y-2">
            <Label htmlFor="numSplits">Number of split points:</Label>
            <Input
              id="numSplits"
              type="number"
              min={1}
              max={500}
              value={numSplits}
              onChange={(e) => setNumSplits(parseInt(e.target.value) || 1)}
              className="max-w-[150px]"
            />
            <p className="text-sm text-muted-foreground">
              This will create {numSplits + 1} equal video segments
            </p>
            {numSplits > 100 && (
              <p className="text-sm text-amber-600">
                ⚠️ Large number of segments may take longer to process
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Custom Split Points</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {splitPoints.length === 0 ? (
              <p className="text-sm text-muted-foreground">No split points added yet</p>
            ) : (
              splitPoints.map((point, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <span className="text-sm">{index + 1}.</span>
                  <Input
                    type="number"
                    min={0}
                    max={videoDuration}
                    step={0.1}
                    value={point.toFixed(1)}
                    onChange={(e) => handleSplitPointChange(index, parseFloat(e.target.value) || 0)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">{formatTime(point)}</span>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={() => handleDeleteSplitPoint(index)}
                  >
                    <Trash className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Button
        onClick={handleApplySplits}
        disabled={splitPoints.length === 0}
        className="w-full"
      >
        <Scissors className="mr-2 h-4 w-4" />
        Apply Split ({splitPoints.length + 1} segments)
      </Button>
    </div>
  );
};

export default MultiSplitEditor;
