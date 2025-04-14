
import React from 'react';
import { useLightShowLogic } from '@/hooks/useLightShowLogic';
import Header from '@/components/lightshow/Header';
import MainContent from '@/components/lightshow/MainContent';

const LightShowPage = () => {
  const {
    audioFile,
    audioUrl,
    showName,
    setShowName,
    isPlaying,
    currentTime,
    duration,
    timelineItems,
    selectedItemIndex,
    selectedImages,
    imageSelector,
    handleAudioUpload,
    generateAutoSyncPatterns,
    addImageToTimeline,
    handleAddSelectedImages,
    addFlashlightPattern,
    updateTimelineItem,
    removeTimelineItem,
    handlePlayPause,
    handleGenerateFile,
    handleReset,
    setCurrentTime,
    setDuration,
    setSelectedItemIndex,
    setSelectedImages
  } = useLightShowLogic();

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <div className="container mx-auto py-4 px-4">
        <h1 className="text-3xl font-bold mb-4 hutz-gradient-text">Momento Light Show</h1>
        
        <Header 
          showName={showName}
          onShowNameChange={setShowName}
          handleGenerateFile={handleGenerateFile}
          audioFile={audioFile}
          timelineItems={timelineItems}
        />
        
        <MainContent 
          audioFile={audioFile}
          audioUrl={audioUrl}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          timelineItems={timelineItems}
          selectedItemIndex={selectedItemIndex}
          selectedImages={selectedImages}
          imageSelector={imageSelector}
          onAudioUpload={handleAudioUpload}
          onPlayPause={handlePlayPause}
          addFlashlightPattern={addFlashlightPattern}
          addImageToTimeline={addImageToTimeline}
          generateAutoSyncPatterns={generateAutoSyncPatterns}
          handleReset={handleReset}
          onAddSelectedImages={handleAddSelectedImages}
          setCurrentTime={setCurrentTime}
          setDuration={setDuration}
          updateTimelineItem={updateTimelineItem}
          removeTimelineItem={removeTimelineItem}
          setSelectedItemIndex={setSelectedItemIndex}
          setSelectedImages={setSelectedImages}
        />
      </div>
    </div>
  );
};

export default LightShowPage;
