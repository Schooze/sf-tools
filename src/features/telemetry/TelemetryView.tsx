import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Trash2, 
  Download, 
  Circle, 
  Activity, 
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowRight,
  Sliders,
  Sparkles
} from 'lucide-react';
import { useTelemetryStore, AVAILABLE_SIGNALS } from '../../stores/useTelemetryStore';
import { useConnectionStore } from '../../stores/useConnectionStore';
import { TelemetrySample } from '../../types';
import { freshValue } from '../../lib/config-model';

export const TelemetryView: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { 
    isStreaming, 
    isPaused, 
    setPaused, 
    clearHistory, 
    startStreaming, 
    history, 
    latestSample, 
    activeSignalIds, 
    toggleSignal,
    fps,
    isRecording,
    startRecording,
    stopRecording,
    exportCSV
  } = useTelemetryStore();
  const { isConnected, busy } = useConnectionStore();

  const [autoscale, setAutoscale] = useState(true);

  // Pan & Zoom states
  // pointsVisible: how many samples fit across the canvas width
  const [pointsVisible, setPointsVisible] = useState(400); 
  // panOffset: 0 means snapped to the newest sample. > 0 means scrolled back in time.
  const [panOffset, setPanOffset] = useState(0);
  const [isLive, setIsLive] = useState(true);

  // Dragging interaction state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);

  // Hover crosshair state
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverSample, setHoverSample] = useState<TelemetrySample | null>(null);

  // ConnectionStore owns streaming across navigation and node changes.

  // Handle Mouse Drag for Horizontal Pan
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (history.length === 0) return;
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartOffsetRef.current = panOffset;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging) {
      const deltaX = e.clientX - dragStartXRef.current;
      const samplesPerPixel = pointsVisible / canvas.clientWidth;
      const deltaSamples = Math.round(deltaX * samplesPerPixel);

      // Moving mouse right (positive deltaX) scrolls back in time (increases panOffset)
      const maxOffset = Math.max(0, history.length - pointsVisible);
      const newOffset = Math.max(0, Math.min(maxOffset, dragStartOffsetRef.current + deltaSamples));
      
      setPanOffset(newOffset);
      if (newOffset === 0) {
        setIsLive(true);
      } else {
        setIsLive(false);
      }
    }

    setHoverPos({ x, y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoverPos(null);
    setHoverSample(null);
  };

  // Handle Mouse Wheel for Horizontal Zoom & Pan
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      // Horizontal pan with Shift + Scroll or Trackpad
      const delta = (e.deltaX || e.deltaY) > 0 ? 25 : -25;
      const maxOffset = Math.max(0, history.length - pointsVisible);
      const newOffset = Math.max(0, Math.min(maxOffset, panOffset + delta));
      setPanOffset(newOffset);
      setIsLive(newOffset === 0);
    } else {
      // Zoom in / out time axis
      const zoomFactor = e.deltaY > 0 ? 1.2 : 0.8;
      const newPoints = Math.max(50, Math.min(3000, Math.round(pointsVisible * zoomFactor)));
      setPointsVisible(newPoints);
    }
  };

  const handleSnapLive = () => {
    setPanOffset(0);
    setIsLive(true);
  };

  const handleZoomIn = () => {
    setPointsVisible((prev) => Math.max(50, Math.round(prev * 0.75)));
  };

  const handleZoomOut = () => {
    setPointsVisible((prev) => Math.min(3000, Math.round(prev * 1.35)));
  };

  const handleResetZoom = () => {
    setPointsVisible(400);
    setPanOffset(0);
    setIsLive(true);
  };

  // High-performance Canvas Rendering Loop (60 FPS)
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Background
      ctx.fillStyle = '#121214';
      ctx.fillRect(0, 0, width, height);

      // Grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      const gridRows = 8;
      const gridCols = 10;
      for (let i = 1; i < gridRows; i++) {
        const y = (height / gridRows) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      for (let j = 1; j < gridCols; j++) {
        const x = (width / gridCols) * j;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Center zero reference line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (history.length > 1) {
        const activeSignals = AVAILABLE_SIGNALS.filter((s) => activeSignalIds.includes(s.id));

        // Determine slice of data to render based on panOffset & pointsVisible
        const total = history.length;
        const endIndex = isLive ? total : Math.max(1, total - panOffset);
        const startIndex = Math.max(0, endIndex - pointsVisible);
        const visibleSlice = history.slice(startIndex, endIndex);

        // Find min and max for scaling
        let minY = Infinity;
        let maxY = -Infinity;

        if (autoscale) {
          activeSignals.forEach((sig) => {
            visibleSlice.forEach((sample) => {
              const val = freshValue(sample, sig.id, sample.timestamp_ms);
              if (val !== undefined) {
                if (val < minY) minY = val;
                if (val > maxY) maxY = val;
              }
            });
          });
          if (minY === Infinity || maxY === -Infinity || minY === maxY) {
            minY = -10;
            maxY = 10;
          }
          const margin = (maxY - minY) * 0.1 || 2;
          minY -= margin;
          maxY += margin;
        } else {
          minY = -100;
          maxY = 3000;
        }

        // Draw each active signal waveform
        if (visibleSlice.length > 1) {
          const stepX = width / Math.max(visibleSlice.length - 1, 1);

          activeSignals.forEach((sig) => {
            ctx.strokeStyle = sig.color;
            ctx.lineWidth = 1.8;
            ctx.beginPath();

            let drawing = false;
            for (let i = 0; i < visibleSlice.length; i++) {
              const val = freshValue(visibleSlice[i], sig.id, visibleSlice[i].timestamp_ms);
              if (val === undefined) { drawing = false; continue; }
              const x = i * stepX;
              const normY = (val - minY) / (maxY - minY);
              const y = height - normY * height;

              if (!drawing) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
              drawing = true;
            }
            ctx.stroke();
          });

          // Hover cursor inspection line
          if (hoverPos && hoverPos.x >= 0 && hoverPos.x <= width) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(hoverPos.x, 0);
            ctx.lineTo(hoverPos.x, height);
            ctx.stroke();
            ctx.setLineDash([]);

            // Find closest sample to hover position
            const sampleIdx = Math.min(
              visibleSlice.length - 1,
              Math.max(0, Math.round(hoverPos.x / stepX))
            );
            const sample = visibleSlice[sampleIdx];
            if (sample) {
              setHoverSample(sample);
            }
          }
        }

        // Y-axis labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.font = '10px monospace';
        ctx.fillText(maxY.toFixed(1), 8, 14);
        ctx.fillText(((maxY + minY) / 2).toFixed(1), 8, height / 2 - 4);
        ctx.fillText(minY.toFixed(1), 8, height - 8);

        // Time span label at bottom right
        const timeSec = ((visibleSlice[visibleSlice.length - 1].timestamp_ms - visibleSlice[0].timestamp_ms) / 1000).toFixed(1);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillText(`Window: ${visibleSlice.length} samples (~${timeSec}s)`, width - 170, height - 8);
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [history, activeSignalIds, autoscale, pointsVisible, panOffset, isLive, hoverPos]);

  return (
    <div ref={containerRef} className="h-full flex flex-col justify-between overflow-hidden select-none bg-background">
      {/* Top Toolbar */}
      <div className="p-3 border-b border-border bg-sidebar/60 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Activity size={16} className="text-blue-400" />
            <span className="font-semibold text-white text-xs">Realtime Plotter</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface border border-border text-sf-subtle">
              {fps} FPS
            </span>
          </div>

          {/* Live / Paused / Panned Indicator */}
          {isLive && isConnected && !isPaused && latestSample && Date.now() - latestSample.timestamp_ms < 1000 ? (
            <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE</span>
            </div>
          ) : (
            <button
              onClick={handleSnapLive}
              title="Click to snap back to live incoming data"
              className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-mono font-medium transition-colors shadow-sm animate-pulse-subtle"
            >
              <span>{isPaused ? "PAUSED" : !isConnected ? "DISCONNECTED" : isLive ? "WAITING / STALE" : "SNAP TO LIVE"}</span>
              <ArrowRight size={10} />
            </button>
          )}

          {isRecording && (
            <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-mono animate-pulse">
              <Circle size={8} fill="currentColor" />
              <span>RECORDING</span>
            </div>
          )}
        </div>

        {/* Controls Toolbar */}
        <div className="flex items-center space-x-2">
          {/* Zoom Controls */}
          <div className="flex items-center space-x-1 bg-surface rounded-lg border border-border p-0.5">
            <button
              onClick={handleZoomIn}
              className="p-1 rounded hover:bg-surface-hover text-sf-muted hover:text-white transition-colors"
              title="Zoom In Time Base"
            >
              <ZoomIn size={13} />
            </button>
            <span className="px-1.5 text-[10px] font-mono text-sf-subtle">
              {pointsVisible} pts
            </span>
            <button
              onClick={handleZoomOut}
              className="p-1 rounded hover:bg-surface-hover text-sf-muted hover:text-white transition-colors"
              title="Zoom Out Time Base"
            >
              <ZoomOut size={13} />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1 rounded hover:bg-surface-hover text-sf-muted hover:text-white transition-colors border-l border-border pl-1"
              title="Reset View"
            >
              <RotateCcw size={12} />
            </button>
          </div>

          <button
            onClick={() => setPaused(!isPaused)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center space-x-1.5 transition-colors ${
              isPaused 
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' 
                : 'bg-surface hover:bg-surface-hover border-border text-sf-text'
            }`}
          >
            {isPaused ? <Play size={12} /> : <Pause size={12} />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          <button
            onClick={() => (isRecording ? stopRecording() : startRecording())}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center space-x-1.5 transition-colors ${
              isRecording
                ? 'bg-red-500/20 border-red-500 text-red-300'
                : 'bg-surface hover:bg-surface-hover border-border text-sf-muted hover:text-white'
            }`}
          >
            <Circle size={10} fill={isRecording ? 'currentColor' : 'none'} />
            <span>{isRecording ? 'Stop Rec' : 'Record'}</span>
          </button>

          <button
            onClick={() => setAutoscale(!autoscale)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              autoscale ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-surface border-border text-sf-subtle'
            }`}
          >
            Autoscale
          </button>

          <button
            onClick={clearHistory}
            className="p-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-border text-sf-subtle hover:text-white transition-colors"
            title="Clear buffer"
          >
            <Trash2 size={13} />
          </button>

          <button
            onClick={exportCSV}
            className="px-2.5 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-border text-sf-muted hover:text-white text-xs flex items-center space-x-1.5 transition-colors"
            title="Export CSV"
          >
            <Download size={12} />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Waveform View with Draggable Pan & Cursor */}
      <div className="flex-1 relative bg-background overflow-hidden">
        <canvas 
          ref={canvasRef} 
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          onDoubleClick={handleResetZoom}
          className={`w-full h-full block ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          title="Drag horizontally to pan through history • Scroll wheel to zoom • Double-click to snap live"
        />

        {/* Pan Instruction Overlay Badge (When hovering or panned) */}
        {!isLive && (
          <div className="absolute top-3 left-3 flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-surface-raised/90 backdrop-blur-md border border-blue-500/40 text-xs shadow-xl animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-white font-medium">
              Viewing History ({panOffset} samples back)
            </span>
            <button
              onClick={handleSnapLive}
              className="text-blue-400 hover:text-blue-300 underline font-mono text-[11px] ml-1"
            >
              Snap Live ➔
            </button>
          </div>
        )}

        {/* Live / Hover numerical inspection badges */}
        <div className="absolute top-3 right-3 flex flex-col space-y-1.5 pointer-events-none">
          {AVAILABLE_SIGNALS.filter((s) => activeSignalIds.includes(s.id)).map((sig) => {
            const displayVal = freshValue(hoverSample ?? latestSample, sig.id, hoverSample?.timestamp_ms ?? Date.now());
            return (
              <div 
                key={sig.id} 
                className="px-2.5 py-1 rounded-lg bg-surface/85 backdrop-blur-md border border-border flex items-center justify-between space-x-3 text-xs shadow-lg"
              >
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sig.color }} />
                  <span className="text-sf-muted font-medium text-[11px]">{sig.name}</span>
                </div>
                <div className="font-mono font-semibold text-white text-xs">
                  {displayVal === undefined ? '—' : displayVal.toFixed(2)} <span className="text-[10px] text-sf-subtle font-normal">{sig.unit}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mini-map Scrubber along bottom of canvas */}
        {history.length > pointsVisible && (
          <div className="absolute bottom-1 left-4 right-4 h-1.5 bg-surface/80 rounded-full overflow-hidden border border-border/40 pointer-events-none">
            <div 
              style={{
                width: `${Math.max(5, (pointsVisible / history.length) * 100)}%`,
                left: `${Math.min(95, ((history.length - panOffset - pointsVisible) / history.length) * 100)}%`,
              }}
              className="h-full bg-blue-500/80 rounded-full relative transition-[left] duration-75 shadow-[0_0_6px_rgba(59,130,246,0.6)]"
            />
          </div>
        )}
      </div>

      {/* Signal Channel Selector Footer Bar */}
      <div className="p-3 border-t border-border bg-sidebar/80 flex flex-col space-y-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-sf-subtle">
            Telemetry Signals ({activeSignalIds.length}/10 active)
          </div>
          <div className="text-[10px] text-sf-muted font-mono">
            💡 Drag canvas horizontally to pan • Mouse wheel to zoom time base
          </div>
        </div>
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
          {AVAILABLE_SIGNALS.map((sig) => {
            const isActive = activeSignalIds.includes(sig.id);
            return (
              <button
                key={sig.id}
                onClick={() => void toggleSignal(sig.id)}
                disabled={busy}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 border transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-surface border-border text-white shadow-sm'
                    : 'bg-background/40 border-border/60 text-sf-subtle hover:text-sf-muted'
                }`}
              >
                <span 
                  className={`w-2 h-2 rounded-full ${isActive ? '' : 'opacity-40'}`} 
                  style={{ backgroundColor: sig.color }} 
                />
                <span>{sig.name}</span>
                <span className="text-[10px] font-mono text-sf-subtle">({sig.unit})</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
