// Server Connectivity Indicator - Check wss://server-hutz-live.onrender.com availability
import React, { useEffect, useState } from 'react';
import { testServerConnectivity } from '@/utils/connectionUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const ServerConnectivityIndicator: React.FC = () => {
  const [isServerReachable, setIsServerReachable] = useState<boolean | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const SERVER_URL = 'https://server-hutz-live.onrender.com';

  const checkServerConnectivity = async () => {
    console.log('🔍 SERVER-CHECK: Testing server connectivity...');
    
    try {
      const isReachable = await testServerConnectivity(SERVER_URL);
      setIsServerReachable(isReachable);
      setLastCheck(new Date());
      
      console.log(`${isReachable ? '✅' : '❌'} SERVER-CHECK: ${SERVER_URL} is ${isReachable ? 'reachable' : 'unreachable'}`);
      
      if (!isReachable) {
        // Try WebSocket connection test as fallback
        try {
          const ws = new WebSocket(`wss://server-hutz-live.onrender.com`);
          
          const wsTimeout = setTimeout(() => {
            ws.close();
            setIsServerReachable(false);
          }, 5000);
          
          ws.onopen = () => {
            clearTimeout(wsTimeout);
            setIsServerReachable(true);
            setLastCheck(new Date());
            console.log('✅ SERVER-CHECK: WebSocket connection successful');
            ws.close();
          };
          
          ws.onerror = () => {
            clearTimeout(wsTimeout);
            setIsServerReachable(false);
            console.log('❌ SERVER-CHECK: WebSocket connection failed');
          };
          
        } catch (wsError) {
          console.error('❌ SERVER-CHECK: WebSocket test failed:', wsError);
        }
      }
      
    } catch (error) {
      console.error('❌ SERVER-CHECK: Connectivity test failed:', error);
      setIsServerReachable(false);
      setLastCheck(new Date());
    }
  };

  useEffect(() => {
    // Initial check
    checkServerConnectivity();
    
    // Check every 30 seconds
    const interval = setInterval(checkServerConnectivity, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    if (isServerReachable === null) return 'bg-gray-500';
    return isServerReachable ? 'bg-green-500' : 'bg-red-500';
  };

  const getStatusText = () => {
    if (isServerReachable === null) return 'Testing...';
    return isServerReachable ? 'Online' : 'Offline';
  };

  if (!isExpanded) {
    return (
      <div 
        className="fixed top-4 right-4 cursor-pointer z-50"
        onClick={() => setIsExpanded(true)}
      >
        <Badge className={`${getStatusColor()} text-white text-xs`}>
          🌐 Server: {getStatusText()}
        </Badge>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 bg-white border border-gray-200 rounded-lg p-4 shadow-lg z-50 w-80">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-sm">Server Status</h3>
        <Button 
          onClick={() => setIsExpanded(false)}
          variant="ghost" 
          size="sm"
          className="h-6 w-6 p-0"
        >
          ×
        </Button>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span>Server URL:</span>
          <code className="text-xs bg-gray-100 px-1 rounded">
            {SERVER_URL}
          </code>
        </div>
        
        <div className="flex justify-between items-center">
          <span>Status:</span>
          <Badge className={`${getStatusColor()} text-white text-xs`}>
            {getStatusText()}
          </Badge>
        </div>
        
        {lastCheck && (
          <div className="flex justify-between items-center">
            <span>Last Check:</span>
            <span className="text-xs text-gray-500">
              {lastCheck.toLocaleTimeString()}
            </span>
          </div>
        )}
        
        <div className="pt-2 border-t">
          <Button 
            onClick={checkServerConnectivity}
            className="w-full"
            size="sm"
            variant="outline"
          >
            🔄 Test Now
          </Button>
        </div>
        
        {!isServerReachable && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            ⚠️ Server unreachable. WebRTC connections may fail.
            <br />
            Check your internet connection or try again later.
          </div>
        )}
      </div>
    </div>
  );
};