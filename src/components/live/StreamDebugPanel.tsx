import React from 'react';
import { Participant } from './ParticipantGrid';

interface StreamDebugPanelProps {
  participantList: Participant[];
  participantStreams: {[id: string]: MediaStream};
}

const StreamDebugPanel: React.FC<StreamDebugPanelProps> = ({
  participantList,
  participantStreams
}) => {
  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-md z-50">
      <h3 className="font-bold mb-2">🔧 PHASE 4: Stream Debug</h3>
      <div className="space-y-1">
        <div>Total Participants: {participantList.length}</div>
        <div>Total Streams: {Object.keys(participantStreams).length}</div>
      </div>
      
      <div className="mt-3 space-y-2">
        {participantList.map(p => {
          const hasStream = !!participantStreams[p.id];
          const stream = participantStreams[p.id];
          
          return (
            <div key={p.id} className={`p-2 rounded ${hasStream ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
              <div className="font-bold">{p.id}</div>
              <div>Active: {p.active ? '✅' : '❌'}</div>
              <div>HasVideo: {p.hasVideo ? '✅' : '❌'}</div>
              <div>Selected: {p.selected ? '✅' : '❌'}</div>
              <div>Stream: {hasStream ? '✅' : '❌'}</div>
              {hasStream && (
                <div className="ml-2">
                  <div>Tracks: {stream.getTracks().length}</div>
                  <div>Video: {stream.getVideoTracks().length}</div>
                  <div>Audio: {stream.getAudioTracks().length}</div>
                  <div>Active: {stream.active ? '✅' : '❌'}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StreamDebugPanel;