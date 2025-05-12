
import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { StorageSegment } from "@/lib/storageUtils";
import { formatTime } from "@/lib/videoUtils";

interface VideoTimelineProps {
  duration: number;
  currentTime: number;
  markers?: number[];
  segments?: StorageSegment[];
  zoomLevel?: number;
  onScrub: (time: number) => void;
  onMarkerAdd?: (time: number) => void;
  onMarkerDelete?: (index: number) => void;
  onSegmentClick?: (segmentId: string) => void;
  className?: string;
}

const VideoTimeline: React.FC<VideoTimelineProps> = ({
  duration,
  currentTime,
  markers = [],
  segments = [],
  zoomLevel = 1,
  onScrub,
  onMarkerAdd,
  onMarkerDelete,
  onSegmentClick,
  className
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [visibleTimeWindow, setVisibleTimeWindow] = useState({ start: 0, end: duration });
  const [scrollPosition, setScrollPosition] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // Calculate visible window based on zoom level
  useEffect(() => {
    const windowSize = duration / zoomLevel;
    
    // Center on current time if possible
    let start = currentTime - (windowSize / 2);
    
    // Ensure we don't go beyond limits
    start = Math.max(0, Math.min(start, duration - windowSize));
    const end = Math.min(duration, start + windowSize);
    
    setVisibleTimeWindow({ start, end });
  }, [zoomLevel, duration, currentTime]);

  // Convert timeline position to time
  const positionToTime = (clientX: number): number => {
    if (!timelineRef.current) return 0;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const percent = Math.max(0, Math.min(1, relativeX / rect.width));
    
    // Calculate time based on visible window
    return visibleTimeWindow.start + percent * (visibleTimeWindow.end - visibleTimeWindow.start);
  };
  
  // Convert time to position percentage
  const timeToPercent = (time: number): number => {
    if (time < visibleTimeWindow.start || time > visibleTimeWindow.end) {
      return -1; // Outside visible range
    }
    
    const windowSize = visibleTimeWindow.end - visibleTimeWindow.start;
    return ((time - visibleTimeWindow.start) / windowSize) * 100;
  };

  // Handle mouse events for scrubbing
  const handleMouseDown = (e: React.MouseEvent) => {
    const time = positionToTime(e.clientX);
    onScrub(time);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const time = positionToTime(e.clientX);
    onScrub(time);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Handle scrolling for timeline navigation
  const handleScroll = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Zoom in/out with Ctrl+Wheel
      e.preventDefault();
      return;
    }
    
    const windowSize = visibleTimeWindow.end - visibleTimeWindow.start;
    const scrollAmount = windowSize * 0.1 * (e.deltaY > 0 ? 1 : -1);
    
    let newStart = visibleTimeWindow.start + scrollAmount;
    
    // Ensure we don't go beyond limits
    newStart = Math.max(0, Math.min(newStart, duration - windowSize));
    const newEnd = Math.min(duration, newStart + windowSize);
    
    setVisibleTimeWindow({ start: newStart, end: newEnd });
    setScrollPosition(newStart / (duration - windowSize));
  };

  // Generate time ticks
  const generateTimeTicks = () => {
    const windowSize = visibleTimeWindow.end - visibleTimeWindow.start;
    const tickInterval = determineTickInterval(windowSize);
    
    const ticks = [];
    let currentTick = Math.ceil(visibleTimeWindow.start / tickInterval) * tickInterval;
    
    while (currentTick <= visibleTimeWindow.end) {
      const percent = timeToPercent(currentTick);
      if (percent >= 0) {
        ticks.push({ time: currentTick, percent });
      }
      currentTick += tickInterval;
    }
    
    return ticks;
  };
  
  // Determine appropriate interval for ticks based on zoom
  const determineTickInterval = (windowSize: number): number => {
    if (windowSize <= 10) return 1; // 1 second intervals
    if (windowSize <= 60) return 5; // 5 second intervals
    if (windowSize <= 300) return 30; // 30 second intervals
    if (windowSize <= 900) return 60; // 1 minute intervals
    if (windowSize <= 3600) return 300; // 5 minute intervals
    return 600; // 10 minute intervals
  };
  
  const visibleMarkers = markers.filter(
    time => time >= visibleTimeWindow.start && time <= visibleTimeWindow.end
  );
  
  const visibleSegments = segments.filter(
    segment => segment.endTime >= visibleTimeWindow.start && segment.startTime <= visibleTimeWindow.end
  );
  
  const ticks = generateTimeTicks();
  
  // Calculate playhead position
  const playheadPosition = timeToPercent(currentTime);

  return (
    <div 
      className={cn("video-timeline relative h-16 bg-gray-900 rounded-md overflow-hidden", className)}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleScroll}
      ref={timelineRef}
    >
      {/* Time ticks */}
      <div className="absolute top-0 left-0 right-0 h-5 border-b border-gray-700">
        {ticks.map((tick, index) => (
          <div 
            key={index}
            className="absolute h-2 border-l border-gray-600"
            style={{ left: `${tick.percent}%` }}
          >
            <div className="absolute top-2 left-0 transform -translate-x-1/2 text-xs text-gray-400">
              {formatTime(tick.time)}
            </div>
          </div>
        ))}
      </div>
      
      {/* Segments visualization */}
      <div className="absolute top-5 left-0 right-0 h-6">
        {visibleSegments.map((segment) => {
          const startPercent = timeToPercent(Math.max(segment.startTime, visibleTimeWindow.start));
          const endPercent = timeToPercent(Math.min(segment.endTime, visibleTimeWindow.end));
          
          if (startPercent === -1 || endPercent === -1) return null;
          
          const width = endPercent - startPercent;
          
          return (
            <div
              key={segment.id}
              className={cn(
                "absolute h-6 rounded-sm cursor-pointer border border-transparent transition-colors hover:border-white",
                segment.type === "cut" ? "bg-primary/40" : "bg-destructive/40"
              )}
              style={{ 
                left: `${startPercent}%`, 
                width: `${width}%` 
              }}
              onClick={() => onSegmentClick && onSegmentClick(segment.id)}
              title={`${formatTime(segment.startTime)} - ${formatTime(segment.endTime)}`}
            />
          );
        })}
      </div>
      
      {/* Markers */}
      <div className="absolute top-0 left-0 right-0 h-full">
        {visibleMarkers.map((markerTime, index) => {
          const percent = timeToPercent(markerTime);
          if (percent === -1) return null;
          
          return (
            <div 
              key={index}
              className="absolute top-5 bottom-0 border-l-2 border-red-500 cursor-pointer group"
              style={{ left: `${percent}%` }}
              title={`Marker at ${formatTime(markerTime)}`}
            >
              <button 
                className="absolute top-0 -translate-x-1/2 bg-red-500 text-white rounded-full w-3 h-3 
                           opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkerDelete && onMarkerDelete(index);
                }}
              >
                &times;
              </button>
            </div>
          );
        })}
      </div>
      
      {/* Playhead */}
      {playheadPosition >= 0 && (
        <div 
          className="absolute top-0 bottom-0 border-l-2 border-white"
          style={{ left: `${playheadPosition}%` }}
        >
          <div className="absolute -top-1 -translate-x-1/2 w-3 h-3 bg-white rounded-full" />
        </div>
      )}
      
      {/* Zoom and scroll indicators */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
        <div 
          className="absolute h-1 bg-gray-600"
          style={{ 
            left: `${(scrollPosition * 100)}%`,
            width: `${(visibleTimeWindow.end - visibleTimeWindow.start) / duration * 100}%`
          }}
        />
      </div>
    </div>
  );
};

export default VideoTimeline;
