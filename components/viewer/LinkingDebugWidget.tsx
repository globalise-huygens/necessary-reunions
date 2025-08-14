'use client';

import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import { AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import React, { useState } from 'react';

interface DebugLogEntry {
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  operation: string;
  details: any;
  id: string;
}

interface LinkingDebugWidgetProps {
  isVisible?: boolean;
  onToggleVisibility?: () => void;
}

export function LinkingDebugWidget({
  isVisible = false,
  onToggleVisibility,
}: LinkingDebugWidgetProps) {
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);

  // Listen for custom debug events from the linking system
  React.useEffect(() => {
    if (!isCapturing) return;

    const handleDebugEvent = (event: CustomEvent) => {
      const entry: DebugLogEntry = {
        timestamp: new Date().toISOString(),
        type: event.detail.type || 'info',
        operation: event.detail.operation || 'unknown',
        details: event.detail.data || {},
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };

      setLogs((prev) => [entry, ...prev.slice(0, 49)]); // Keep last 50 entries
    };

    // Listen for debug events from the linking system
    window.addEventListener('linkingDebug', handleDebugEvent as EventListener);

    return () => {
      window.removeEventListener(
        'linkingDebug',
        handleDebugEvent as EventListener,
      );
    };
  }, [isCapturing]);

  const clearLogs = () => setLogs([]);

  const getTypeColor = (type: DebugLogEntry['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-600 bg-green-50';
      case 'warning':
        return 'text-orange-600 bg-orange-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  const getTypeIcon = (type: DebugLogEntry['type']) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return 'ℹ️';
    }
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={onToggleVisibility}
          size="sm"
          variant="outline"
          className="shadow-lg"
        >
          <Eye className="h-4 w-4 mr-1" />
          Debug
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-96">
      <Card className="p-4 shadow-lg bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Linking Debug Console</h3>
          <div className="flex gap-1">
            <Button
              onClick={() => setIsCapturing(!isCapturing)}
              size="sm"
              variant={isCapturing ? 'default' : 'outline'}
              className="h-6 px-2 text-xs"
            >
              {isCapturing ? 'Recording' : 'Start'}
            </Button>
            <Button
              onClick={clearLogs}
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs"
            >
              Clear
            </Button>
            <Button
              onClick={onToggleVisibility}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
            >
              <EyeOff className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {isCapturing && (
          <div className="mb-2 text-xs text-green-600 flex items-center gap-1">
            <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
            Capturing linking operations...
          </div>
        )}

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              {isCapturing
                ? 'Waiting for linking operations...'
                : 'Click "Start" to begin capturing debug info'}
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="text-xs border rounded p-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <span>{getTypeIcon(log.type)}</span>
                    <span className="font-medium">{log.operation}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  {typeof log.details === 'string'
                    ? log.details
                    : JSON.stringify(log.details, null, 1).slice(0, 100) +
                      '...'}
                </div>
              </div>
            ))
          )}
        </div>

        {logs.length > 0 && (
          <div className="mt-2 text-xs text-muted-foreground">
            {logs.length} events captured
          </div>
        )}
      </Card>
    </div>
  );
}
