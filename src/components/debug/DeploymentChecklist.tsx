import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { signalingConfig } from '@/config/signalingConfig';
import { deploymentValidator, type DeploymentValidationResult } from '@/utils/deploymentValidation';

const DeploymentChecklist: React.FC = () => {
  const [validationResult, setValidationResult] = useState<DeploymentValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const runValidation = async () => {
    setIsValidating(true);
    try {
      const result = await deploymentValidator.validate();
      setValidationResult(result);
      deploymentValidator.logValidationResults(result);
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const getStatusColor = (status: 'pass' | 'fail' | 'warning') => {
    switch (status) {
      case 'pass': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'fail': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: 'pass' | 'fail' | 'warning') => {
    switch (status) {
      case 'pass': return '✅';
      case 'warning': return '⚠️';
      case 'fail': return '❌';
      default: return '❓';
    }
  };

  useEffect(() => {
    // Auto-run validation on mount
    runValidation();
  }, []);

  const config = signalingConfig.getConfig();

  return (
    <Card className="w-full max-w-4xl mx-auto bg-black/20 border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          🔍 Deployment Checklist
          <Badge variant={validationResult?.isValid ? 'default' : 'destructive'}>
            {validationResult?.isValid ? 'Valid' : 'Issues Found'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Configuration Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-black/10 p-3 rounded border border-white/5">
            <h4 className="text-white font-medium mb-2">Signaling Configuration</h4>
            <div className="text-sm text-white/70 space-y-1">
              <div>URL: <code className="text-blue-300">{config.url}</code></div>
              <div>Protocol: <code className="text-blue-300">{config.protocol}</code></div>
              <div>Environment: <code className="text-blue-300">
                {config.isDevelopment ? 'Development' : config.isPreview ? 'Preview' : 'Production'}
              </code></div>
            </div>
          </div>

          <div className="bg-black/10 p-3 rounded border border-white/5">
            <h4 className="text-white font-medium mb-2">Environment Info</h4>
            <div className="text-sm text-white/70 space-y-1">
              <div>Host: <code className="text-blue-300">{window.location.host}</code></div>
              <div>Protocol: <code className="text-blue-300">{window.location.protocol}</code></div>
              <div>Mode: <code className="text-blue-300">{import.meta.env.MODE}</code></div>
            </div>
          </div>
        </div>

        {/* Validation Controls */}
        <div className="flex gap-2">
          <Button 
            onClick={runValidation} 
            disabled={isValidating}
            size="sm"
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
          >
            {isValidating ? 'Validating...' : 'Run Validation'}
          </Button>
          <Button 
            onClick={() => signalingConfig.refreshConfig()} 
            size="sm"
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
          >
            Refresh Config
          </Button>
        </div>

        {/* Validation Results */}
        {validationResult && (
          <div className="space-y-3">
            <h4 className="text-white font-medium">Validation Results</h4>
            
            {validationResult.checks.map((check, index) => (
              <div key={index} className="bg-black/10 p-3 rounded border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{getStatusIcon(check.status)}</span>
                  <span className="text-white font-medium">{check.name}</span>
                  <Badge 
                    variant="outline" 
                    className={`${getStatusColor(check.status)} text-white border-0`}
                  >
                    {check.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-white/70 text-sm mb-2">{check.message}</p>
                {check.details && (
                  <details className="text-xs">
                    <summary className="text-white/50 cursor-pointer hover:text-white/70">
                      Show Details
                    </summary>
                    <pre className="mt-2 text-white/60 bg-black/20 p-2 rounded text-xs overflow-auto">
                      {JSON.stringify(check.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}

            {/* Summary */}
            <div className="bg-black/20 p-3 rounded border border-white/10">
              <h5 className="text-white font-medium mb-2">Summary</h5>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl text-green-400">
                    {validationResult.checks.filter(c => c.status === 'pass').length}
                  </div>
                  <div className="text-xs text-white/60">Passed</div>
                </div>
                <div>
                  <div className="text-2xl text-yellow-400">
                    {validationResult.checks.filter(c => c.status === 'warning').length}
                  </div>
                  <div className="text-xs text-white/60">Warnings</div>
                </div>
                <div>
                  <div className="text-2xl text-red-400">
                    {validationResult.checks.filter(c => c.status === 'fail').length}
                  </div>
                  <div className="text-xs text-white/60">Failed</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="border-t border-white/10 pt-4">
          <h4 className="text-white font-medium mb-2">Quick Actions</h4>
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => window.open('/network', '_blank')} 
              size="sm" 
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
            >
              Check Network Tab
            </Button>
            <Button 
              onClick={() => console.log('Current config:', signalingConfig.getConfig())} 
              size="sm" 
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
            >
              Log Config
            </Button>
            <Button 
              onClick={() => console.clear()} 
              size="sm" 
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
            >
              Clear Console
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeploymentChecklist;