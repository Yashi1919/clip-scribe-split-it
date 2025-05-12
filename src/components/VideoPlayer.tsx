import React, { forwardRef, useRef, useEffect, useState, useCallback } from "react";
import { Play, Pause, SkipForward, SkipBack, Maximize, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useHotkeys } from "@/hooks/useHotkeys";

interface VideoPlayerProps {
  src: string;
  startTime?: number;
  endTime?: number;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
  loop?: boolean;
  seekable?: boolean;
  onLoadedMetadata?: (duration: number) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onSeeked?: (time: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(({
  src,
  startTime = 0,
  endTime,
  className,
  autoPlay = false,
  controls = true,
  loop = false,
  seekable = true,
  onLoadedMetadata,
  onTimeUpdate,
  onSeeked,
  onPlayStateChange
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<number | null>(null);

  // Combine the forwarded ref with our local ref
  const combinedRef = (node: HTMLVideoElement) => {
    videoRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  const effectiveEndTime = endTime || duration;
  const effectiveDuration = effectiveEndTime - startTime;

  // Function to toggle play/pause
  const togglePlayPause = useCallback(() => {
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
    
    if (onPlayStateChange) {
      onPlayStateChange(!isPlaying);
    }
  }, [isPlaying, endTime, startTime, onPlayStateChange]);

  // Function to seek forward/backward
  const seekOffset = useCallback((offsetSeconds: number) => {
    const video = videoRef.current;
    if (!video || !seekable) return;
    
    let newTime = video.currentTime + offsetSeconds;
    
    // Keep within bounds
    newTime = Math.max(startTime, Math.min(newTime, effectiveEndTime));
    
    video.currentTime = newTime;
    setCurrentTime(newTime);
    
    if (onSeeked) {
      onSeeked(newTime);
    }
  }, [seekable, startTime, effectiveEndTime, onSeeked]);

  // Function to seek to a specific percentage
  const seekToPercent = useCallback((percent: number) => {
    const video = videoRef.current;
    if (!video || !seekable) return;
    
    const newTime = startTime + (effectiveDuration * percent / 100);
    video.currentTime = newTime;
    setCurrentTime(newTime);
    
    if (onSeeked) {
      onSeeked(newTime);
    }
  }, [seekable, startTime, effectiveDuration, onSeeked]);

  // Function to toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    const container = videoRef.current?.parentElement;
    if (!container) return;
    
    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Function to toggle mute
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  // Function to change volume
  const changeVolume = useCallback((newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    video.volume = newVolume;
    setVolume(newVolume);
    
    // Update muted state based on volume
    if (newVolume === 0) {
      video.muted = true;
      setIsMuted(true);
    } else if (video.muted) {
      video.muted = false;
      setIsMuted(false);
    }
  }, []);

  // Handle slider change for seeking
  const handleSliderChange = useCallback((value: number[]) => {
    if (!seekable) return;
    
    const video = videoRef.current;
    if (!video) return;
    
    const newTime = value[0];
    setIsSeeking(true);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  }, [seekable]);
  
  // Auto-hide controls after inactivity
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000) as unknown as number;
  }, [isPlaying]);

  // Register keyboard shortcuts
  useHotkeys([
    { key: " ", callback: togglePlayPause },
    { key: "ArrowLeft", callback: () => seekOffset(-5) },
    { key: "ArrowRight", callback: () => seekOffset(5) },
    { key: "f", callback: toggleFullscreen },
    { key: "m", callback: toggleMute }
  ], videoRef);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!isSeeking) {
        setCurrentTime(video.currentTime);
        if (onTimeUpdate) {
          onTimeUpdate(video.currentTime);
        }
      }
      
      // If we're using a clip with an end time, pause when we reach it
      if (endTime && video.currentTime >= endTime) {
        video.pause();
        video.currentTime = startTime;
        setIsPlaying(false);
        if (onPlayStateChange) {
          onPlayStateChange(false);
        }
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setVolume(video.volume);
      setIsMuted(video.muted);
      
      if (onLoadedMetadata) {
        onLoadedMetadata(video.duration);
      }
      
      // Set the start time if specified
      if (startTime > 0) {
        video.currentTime = startTime;
        setCurrentTime(startTime);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (onPlayStateChange) {
        onPlayStateChange(false);
      }
      
      if (loop) {
        video.currentTime = startTime;
        video.play().then(() => {
          setIsPlaying(true);
          if (onPlayStateChange) {
            onPlayStateChange(true);
          }
        }).catch(err => console.error(err));
      }
    };
    
    const handleSeeked = () => {
      if (onSeeked) {
        onSeeked(video.currentTime);
      }
      setIsSeeking(false);
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    // Event listeners for the video element
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("seeked", handleSeeked);
    
    // Event listeners for fullscreen changes
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    
    // Mouse move listener for showing controls
    const container = video.parentElement;
    if (container) {
      container.addEventListener("mousemove", showControlsTemporarily);
    }
    
    if (autoPlay) {
      video.play().catch(() => {
        // Autoplay was prevented
        setIsPlaying(false);
        if (onPlayStateChange) {
          onPlayStateChange(false);
        }
      });
    }

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("seeked", handleSeeked);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      
      if (container) {
        container.removeEventListener("mousemove", showControlsTemporarily);
      }
      
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [
    src, startTime, endTime, autoPlay, loop, onLoadedMetadata, onTimeUpdate, 
    onSeeked, isSeeking, onPlayStateChange, showControlsTemporarily
  ]);

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  return (
    <div 
      className={cn("video-player-container relative group", className)}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={combinedRef}
        src={src}
        className="w-full h-full object-contain bg-black"
        playsInline
      />
      
      {controls && (
        <div className={cn(
          "absolute bottom-0 left-0 right-0 bg-black/60 p-2 flex flex-col space-y-2 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
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
              
              {seekable && (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-white p-1 h-auto" 
                    onClick={() => seekOffset(-5)}
                  >
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-white p-1 h-auto" 
                    onClick={() => seekOffset(5)}
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </>
              )}
              
              <div className="text-xs text-white ml-2">
                {formatTime(currentTime - startTime)} / {formatTime(effectiveDuration)}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="hidden sm:flex items-center space-x-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-white p-1 h-auto" 
                  onClick={toggleMute}
                >
                  {isMuted ? 
                    <VolumeX className="h-4 w-4" /> : 
                    <Volume2 className="h-4 w-4" />
                  }
                </Button>
                
                <Slider 
                  value={[isMuted ? 0 : volume]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={(value) => changeVolume(value[0])}
                  className="w-20"
                />
              </div>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white p-1 h-auto" 
                onClick={toggleFullscreen}
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {seekable && (
            <Slider 
              value={[currentTime]}
              min={startTime}
              max={effectiveEndTime}
              step={0.01}
              onValueChange={handleSliderChange}
              className="w-full"
            />
          )}
        </div>
      )}
    </div>
  );
});

VideoPlayer.displayName = "VideoPlayer";

export default VideoPlayer;
