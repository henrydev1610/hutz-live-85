
import React from 'react';
import BackButton from '@/components/common/BackButton';

const LivePageHeader: React.FC = () => {
  return (
    <div className="relative mb-8">
      <BackButton />
      <h1 className="text-3xl font-bold hutz-gradient-text text-center">Momento Live</h1>
    </div>
  );
};

export default LivePageHeader;
