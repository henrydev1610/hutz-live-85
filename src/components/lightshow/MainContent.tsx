
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimelineItem } from "@/types/lightshow";

import Timeline from "@/components/lightshow/Timeline";
import PhonePreview from "@/components/lightshow/PhonePreview";
import AudioUploader from "@/components/lightshow/AudioUploader";
import ImageSelector from "@/components/lightshow/ImageSelector";
import ControlPanel from "@/components/lightshow/ControlPanel";
import PropertiesPanel from "@/components/lightshow/PropertiesPanel";

interface MainContentProps {
  audioFile: File | null;
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  timelineItems: TimelineItem[];
  selectedItemIndex: number | null;
  selectedImages: string[];
  imageSelector: React.RefObject<HTMLDivElement>;
  onAudioUpload: (file: File) => void;
  onPlayPause: () => void;
  addFlashlightPattern: () => void;
  addImageToTimeline: (imageUrl: string, duration?: number, startTime?: number) => void;
  generateAutoSyncPatterns: () => void;
  handleReset: () => void;
  onAddSelectedImages: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  updateTimelineItem: (id: string, updates: Partial<TimelineItem>) => void;
  removeTimelineItem: (id: string) => void;
  setSelectedItemIndex: (index: number | null) => void;
  setSelectedImages: (images: string[]) => void;
}

const MainContent = ({
  audioFile,
  audioUrl,
  isPlaying,
  currentTime,
  duration,
  timelineItems,
  selectedItemIndex,
  selectedImages,
  imageSelector,
  onAudioUpload,
  onPlayPause,
  addFlashlightPattern,
  addImageToTimeline,
  generateAutoSyncPatterns,
  handleReset,
  onAddSelectedImages,
  setCurrentTime,
  setDuration,
  updateTimelineItem,
  removeTimelineItem,
  setSelectedItemIndex,
  setSelectedImages
}: MainContentProps) => {
  const selectedItem = selectedItemIndex !== null ? timelineItems[selectedItemIndex] : null;

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="min-h-[calc(100vh-200px)] border rounded-lg border-white/10 bg-secondary/40 backdrop-blur-lg"
    >
      <ResizablePanel defaultSize={65} minSize={30}>
        <div className="h-full flex flex-col p-4">
          <ControlPanel 
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            audioFile={audioFile}
            onPlayPause={onPlayPause}
            addFlashlightPattern={addFlashlightPattern}
            addImageToTimeline={addImageToTimeline}
            generateAutoSyncPatterns={generateAutoSyncPatterns}
            handleReset={handleReset}
            selectedImages={selectedImages}
            onAddSelectedImages={onAddSelectedImages}
          />
          
          {!audioFile ? (
            <AudioUploader onAudioUploaded={onAudioUpload} />
          ) : (
            <Timeline 
              audioUrl={audioUrl}
              isPlaying={isPlaying}
              timelineItems={timelineItems}
              currentTime={currentTime}
              setCurrentTime={setCurrentTime}
              duration={duration}
              setDuration={setDuration}
              onUpdateItem={updateTimelineItem}
              onRemoveItem={removeTimelineItem}
              onItemSelect={setSelectedItemIndex}
              selectedItemIndex={selectedItemIndex}
            />
          )}
        </div>
      </ResizablePanel>
      
      <ResizableHandle withHandle />
      
      <ResizablePanel defaultSize={35} minSize={30}>
        <Tabs defaultValue="properties" className="h-full flex flex-col">
          <TabsList className="mx-4 mt-4 grid grid-cols-3">
            <TabsTrigger value="properties">Lights</TabsTrigger>
            <TabsTrigger value="images">Imagens</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          
          <TabsContent value="properties" className="flex-1 p-4 overflow-y-auto">
            <PropertiesPanel 
              selectedItem={selectedItem}
              updateTimelineItem={updateTimelineItem}
              removeTimelineItem={removeTimelineItem}
              duration={duration}
            />
          </TabsContent>
          
          <TabsContent value="images" className="flex-1 p-4 overflow-y-auto">
            <div ref={imageSelector}>
              <ImageSelector 
                onImageSelect={addImageToTimeline} 
                timelineItems={timelineItems}
                onSelectedImagesChange={setSelectedImages}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="preview" className="flex-1 p-4 overflow-y-auto flex items-center justify-center">
            <PhonePreview 
              isPlaying={isPlaying}
              currentTime={currentTime}
              timelineItems={timelineItems}
            />
          </TabsContent>
        </Tabs>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export default MainContent;
