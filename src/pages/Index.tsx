
import { useState, useEffect } from "react";
import { Scissors, File, Video, Info, Brush, History, Download, RotateCcw } from "lucide-react";
import VideoUploader from "@/components/VideoUploader";
import VideoPlayer from "@/components/VideoPlayer";
import VideoSplitter from "@/components/VideoSplitter";
import VideoMetadataPanel from "@/components/VideoMetadataPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

const Index = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoWidth, setVideoWidth] = useState<number | undefined>(undefined);
  const [videoHeight, setVideoHeight] = useState<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string>("edit");
  const { toast } = useToast();
  
  // Check for URL parameters to restore session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session');
    
    if (sessionId) {
      // In a real app, you could restore a saved session here
      toast({
        title: "Session Restored",
        description: `Welcome back to your editing session`,
      });
    }
  }, [toast]);

  const handleVideoUploaded = (file: File, url: string) => {
    setVideoFile(file);
    setVideoUrl(url);
    // Reset other state values
    setVideoDuration(0);
    setVideoWidth(undefined);
    setVideoHeight(undefined);
  };

  const handleVideoMetadata = (duration: number) => {
    setVideoDuration(duration);
    
    // Get video dimensions when metadata is loaded
    const video = document.createElement('video');
    video.onloadedmetadata = () => {
      setVideoWidth(video.videoWidth);
      setVideoHeight(video.videoHeight);
    };
    video.src = videoUrl || '';
  };

  const shareSession = () => {
    if (!videoFile) return;
    
    // Generate a session ID (in a real app, you'd save this to a database)
    const sessionId = `session_${Date.now()}`;
    
    // Create a shareable URL
    const url = new URL(window.location.href);
    url.searchParams.set('session', sessionId);
    
    // Copy to clipboard
    navigator.clipboard.writeText(url.toString()).then(() => {
      toast({
        title: "Link Copied",
        description: "Share this link to collaborate on this video project",
      });
    });
  };

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4 min-h-screen">
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Scissors className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                Clip<span className="text-accent">Scribe</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Advanced video editing in your browser
              </p>
            </div>
          </div>
          
          {videoFile && (
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={shareSession}>
                      <History className="h-4 w-4 mr-2" />
                      Share Session
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Create a shareable link for this editing session
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <Badge variant="outline" className="bg-primary/10">
                {videoFile?.name}
              </Badge>
            </div>
          )}
        </div>
      </header>

      <div className="space-y-10">
        {!videoFile && (
          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4 flex items-center">
              <File className="mr-2 h-5 w-5" />
              Upload Video
            </h2>
            <VideoUploader onVideoUploaded={handleVideoUploaded} />
          </section>
        )}

        {videoUrl && (
          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4 flex items-center">
              <Video className="mr-2 h-5 w-5" />
              Video Preview
            </h2>
            <div className="max-w-3xl mx-auto">
              <VideoPlayer
                src={videoUrl}
                className="rounded-lg shadow-lg border"
                onLoadedMetadata={handleVideoMetadata}
              />
              {videoDuration > 0 && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  Video duration: {Math.floor(videoDuration / 60)}:{Math.floor(videoDuration % 60)
                    .toString()
                    .padStart(2, "0")}
                  {videoWidth && videoHeight && (
                    <span className="ml-2">
                      Resolution: {videoWidth} × {videoHeight}
                    </span>
                  )}
                </p>
              )}
              
              <div className="mt-4 flex justify-end">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setVideoFile(null);
                    setVideoUrl(null);
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Upload Different Video
                </Button>
              </div>
            </div>
          </section>
        )}

        {videoFile && videoUrl && videoDuration > 0 && (
          <section>
            <Tabs defaultValue="edit" value={activeTab} onValueChange={setActiveTab}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold tracking-tight flex items-center">
                  <Scissors className="mr-2 h-5 w-5" />
                  Video Editor
                </h2>
                <TabsList>
                  <TabsTrigger value="edit" className="flex items-center">
                    <Brush className="h-4 w-4 mr-2" />
                    Editor
                  </TabsTrigger>
                  <TabsTrigger value="info" className="flex items-center">
                    <Info className="h-4 w-4 mr-2" />
                    Info
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="edit" className="mt-0">
                <VideoSplitter
                  videoFile={videoFile}
                  videoUrl={videoUrl}
                  videoDuration={videoDuration}
                />
              </TabsContent>
              
              <TabsContent value="info" className="mt-0">
                <div className="grid md:grid-cols-2 gap-6">
                  <VideoMetadataPanel 
                    file={videoFile}
                    duration={videoDuration}
                    width={videoWidth}
                    height={videoHeight}
                    format={videoFile.type || undefined}
                  />
                  
                  <div className="bg-card rounded-lg p-4 border">
                    <h3 className="text-lg font-medium mb-3 flex items-center">
                      <Download className="mr-2 h-5 w-5 text-primary" />
                      Export Options
                    </h3>
                    
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        This browser-based editor uses WebM format for export. For best results:
                      </p>
                      
                      <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                        <li>Use Chrome or Edge for best compatibility</li>
                        <li>Keep source videos under 500MB for best performance</li>
                        <li>Supported input formats include MP4, WebM, and MOV</li>
                        <li>Export quality depends on your browser and device capabilities</li>
                      </ul>
                      
                      <div className="pt-2">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          onClick={() => setActiveTab("edit")}
                        >
                          <Scissors className="mr-2 h-4 w-4" />
                          Return to Editor
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </section>
        )}
      </div>
      
      <footer className="mt-16 border-t pt-6 text-center text-sm text-muted-foreground">
        <p>ClipScribe Video Splitter &copy; 2025</p>
        <p className="mt-1">Split, manage, and download video segments with ease</p>
        <div className="flex justify-center mt-2 space-x-2">
          <Button variant="link" size="sm" className="text-xs h-auto p-0">Help</Button>
          <span className="text-gray-400">•</span>
          <Button variant="link" size="sm" className="text-xs h-auto p-0">Privacy</Button>
          <span className="text-gray-400">•</span>
          <Button variant="link" size="sm" className="text-xs h-auto p-0">Terms</Button>
        </div>
      </footer>
    </div>
  );
};

export default Index;
