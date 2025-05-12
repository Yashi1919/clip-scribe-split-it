import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatTime } from "@/lib/videoUtils";
import { Play, Pause, Scissors, Trash, X } from "lucide-react";

interface VideoTimelineEditorProps {
  videoUrl: string;
  videoDuration: number;
  onCutSegment: (startTime: number, endTime: number) => void;
  onRemoveSegment?: (startTime: number, endTime: number) => void;
  videoId?: string; // Optional ID to use for localStorage persistence
}

const VideoTimelineEditor = ({
  videoUrl,
  videoDuration,
  onCutSegment,
  onRemoveSegment,
  videoId
}: VideoTimelineEditorProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [markers, setMarkers] = useState<number[]>([]);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [mode, setMode] = useState<"cut" | "remove">("cut");
  
  const localStorageKey = videoId ? `timeline_${videoId}` : null;

  // Load markers from localStorage
  useEffect(() => {
    if (!localStorageKey) return;
    
    try {
      const savedData = localStorage.getItem(localStorageKey);
      if (savedData) {
        const data = JSON.parse(savedData);
        if (data.markers && Array.isArray(data.markers)) {
          // Filter out any markers that are outside the video duration
          const validMarkers = data.markers.filter(
            (marker: number) => marker >= 0 && marker <= videoDuration
          );
          setMarkers(validMarkers);
        }
      }
    } catch (error) {
      console.error("Error loading timeline data from localStorage:", error);
    }
  }, [localStorageKey, videoDuration]);

  // Save markers to localStorage whenever they change
  useEffect(() => {
    if (!localStorageKey) return;
    
    try {
      const dataToSave = { markers };
      localStorage.setItem(localStorageKey, JSON.stringify(dataToSave));
    } catch (error) {
      console.error("Error saving timeline data to localStorage:", error);
    }
  }, [markers, localStorageKey]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, []);

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

  const handleSliderChange = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;
    
    const newTime = value[0];
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const addMarker = () => {
    // Add current time as a marker if it doesn't exist already
    if (!markers.includes(currentTime)) {
      const newMarkers = [...markers, currentTime].sort((a, b) => a - b);
      setMarkers(newMarkers);
    }
  };

  const clearMarkers = () => {
    setMarkers([]);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const deleteMarker = (markerTime: number) => {
    // Remove the marker
    const newMarkers = markers.filter(time => time !== markerTime);
    setMarkers(newMarkers);
    
    // If the deleted marker was part of the selection, reset the selection
    if (markerTime === selectionStart) {
      setSelectionStart(null);
      if (selectionEnd !== null) {
        setSelectionEnd(null);
      }
    } else if (markerTime === selectionEnd) {
      setSelectionEnd(null);
    }
  };

  const handleMarkerClick = (markerTime: number, event: React.MouseEvent) => {
    // If ctrl/cmd key is pressed, delete the marker instead of selecting it
    if (event.ctrlKey || event.metaKey) {
      deleteMarker(markerTime);
      return;
    }

    if (selectionStart === null) {
      // First marker selected
      setSelectionStart(markerTime);
    } else if (selectionEnd === null) {
      // Second marker selected
      if (markerTime > selectionStart) {
        setSelectionEnd(markerTime);
      } else {
        // If second marker is before the first, swap them
        setSelectionEnd(selectionStart);
        setSelectionStart(markerTime);
      }
    } else {
      // Reset selection and start a new one
      setSelectionStart(markerTime);
      setSelectionEnd(null);
    }
  };

  const handleCutSegment = () => {
    if (selectionStart !== null && selectionEnd !== null) {
      if (mode === "cut") {
        onCutSegment(selectionStart, selectionEnd);
      } else if (mode === "remove" && onRemoveSegment) {
        onRemoveSegment(selectionStart, selectionEnd);
      }
      // Reset selection after cutting
      setSelectionStart(null);
      setSelectionEnd(null);
    }
  };

  const toggleMode = () => {
    setMode(mode === "cut" ? "remove" : "cut");
  };

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-card">
      <div className="aspect-video bg-black rounded-md overflow-hidden relative">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain"
        />
      </div>
      
      <div className="space-y-2">
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
            onValueChange={handleSliderChange}
            className="w-full"
          />
          
          {/* Render markers */}
          <div className="absolute inset-0 pointer-events-none">
            {markers.map((markerTime, index) => (
              <div 
                key={index}
                className="absolute top-0 flex flex-col items-center pointer-events-auto"
                style={{ left: `${(markerTime / videoDuration) * 100}%` }}
              >
                <div 
                  className={`w-0.5 h-5 cursor-pointer ${
                    markerTime === selectionStart || markerTime === selectionEnd 
                      ? 'bg-primary' 
                      : 'bg-red-500'
                  }`}
                  onClick={(e) => handleMarkerClick(markerTime, e)}
                  title="Click to select, Ctrl+Click to delete"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 opacity-60 hover:opacity-100"
                  onClick={() => deleteMarker(markerTime)}
                >
                  <Trash className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          
          {/* Render selection range */}
          {selectionStart !== null && (
            <div 
              className={`absolute top-0 h-5 ${
                mode === "cut" ? "bg-primary/30" : "bg-destructive/30"
              } pointer-events-none`}
              style={{ 
                left: `${(selectionStart / videoDuration) * 100}%`, 
                width: selectionEnd !== null 
                  ? `${((selectionEnd - selectionStart) / videoDuration) * 100}%` 
                  : '0'
              }}
            />
          )}
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={addMarker}
        >
          Add Marker at {formatTime(currentTime)}
        </Button>
        
        <Button
          variant="outline"
          size="sm" 
          onClick={clearMarkers}
        >
          Clear Markers
        </Button>
        
        <Button
          variant={mode === "cut" ? "secondary" : "destructive"}
          size="sm"
          onClick={toggleMode}
        >
          {mode === "cut" ? 
            <Scissors className="h-4 w-4 mr-1" /> : 
            <X className="h-4 w-4 mr-1" />
          }
          Mode: {mode === "cut" ? "Cut Segment" : "Remove Segment"}
        </Button>
        
        <Button
          variant={mode === "cut" ? "secondary" : "destructive"}
          size="sm"
          onClick={handleCutSegment}
          disabled={selectionStart === null || selectionEnd === null}
        >
          {mode === "cut" ? 
            <Scissors className="h-4 w-4 mr-1" /> : 
            <X className="h-4 w-4 mr-1" />
          }
          {mode === "cut" ? "Cut" : "Remove"} Segment ({selectionStart !== null && selectionEnd !== null
            ? `${formatTime(selectionStart)} - ${formatTime(selectionEnd)}`
            : "Select markers"}
          )
        </Button>
      </div>
      
      {markers.length > 0 && (
        <div className="text-sm text-muted-foreground">
          <p className="mb-1">Markers:</p>
          <div className="flex flex-wrap gap-1">
            {markers.map((marker, index) => (
              <div key={index} className="flex items-center gap-1">
                <Button 
                  size="sm"
                  variant="ghost"
                  className={`text-xs px-2 py-1 h-auto ${
                    marker === selectionStart || marker === selectionEnd 
                      ? 'bg-primary/20' 
                      : ''
                  }`}
                  onClick={(e) => handleMarkerClick(marker, e)}
                >
                  {formatTime(marker)}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 w-5 p-0"
                  onClick={() => deleteMarker(marker)}
                >
                  <Trash className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoTimelineEditor;
