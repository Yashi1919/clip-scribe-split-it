import React, { useRef, useEffect, useState } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  src: string;
  startTime?: number;
  endTime?: number;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
  loop?: boolean;
  onLoadedMetadata?: (duration: number) => void;
}

const VideoPlayer = ({
  src,
  startTime = 0,
  endTime,
  className,
  autoPlay = false,
  controls = true,
  loop = false,
  onLoadedMetadata,
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      
      // If we're using a clip with an end time, pause when we reach it
      if (endTime && video.currentTime >= endTime) {
        video.pause();
        video.currentTime = startTime;
        setIsPlaying(false);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if (onLoadedMetadata) {
        onLoadedMetadata(video.duration);
      }
      
      // Set the start time if specified
      if (startTime > 0) {
        video.currentTime = startTime;
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (loop) {
        video.currentTime = startTime;
        video.play();
        setIsPlaying(true);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("ended", handleEnded);
    
    if (autoPlay) {
      video.play().catch(() => {
        // Autoplay was prevented
        setIsPlaying(false);
      });
    }

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("ended", handleEnded);
    };
  }, [src, startTime, endTime, autoPlay, loop, onLoadedMetadata]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      // If we're at the end and trying to play, reset to start time
      if (endTime && video.currentTime >= endTime) {
        video.currentTime = startTime;
      }
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

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const effectiveEndTime = endTime || duration;
  const effectiveDuration = effectiveEndTime - startTime;

  return (
    <div className={cn("video-container", className)}>
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        playsInline
      />
      
      {controls && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white p-1 h-auto" 
              onClick={togglePlayPause}
            >
              {isPlaying ? 
                <Pause className="h-4 w-4" /> : 
                <Play className="h-4 w-4" />
              }
            </Button>
            <div className="text-xs text-white">
              {formatTime(currentTime - startTime)} / {formatTime(effectiveDuration)}
            </div>
          </div>
          
          <Slider 
            value={[currentTime]}
            min={startTime}
            max={effectiveEndTime}
            step={0.01}
            onValueChange={handleSliderChange}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
