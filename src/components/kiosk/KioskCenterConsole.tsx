import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Minus,
  ArrowLeftRight,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCw,
  Undo2,
  Timer,
  Clock,
  X,
  CheckCircle2,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type MatchEvent = {
  id: string;
  match_id: string;
  description: string;
  created_at?: string;
};

type KioskCenterConsoleProps = {
  gameTimeSeconds: number;
  isClockRunning: boolean;
  onToggleClock: () => void;
  onAdjustClock: (deltaSeconds: number) => void;
  onResetClock: () => void;
  isClockEnabled: boolean;
  onToggleClockEnabled: () => void;
  currentPeriod: string;
  periods: string[];
  onSelectPeriod: (period: string) => void;
  isSwappedSides: boolean;
  onToggleSwapSides: () => void;
  orientationMode: 'auto' | 'landscape' | 'portrait';
  onChangeOrientationMode: (mode: 'auto' | 'landscape' | 'portrait') => void;
  activeTimeoutTeam: 'a' | 'b' | null;
  activeTimeoutTeamName?: string;
  activeTimeoutSeconds: number;
  onCancelTimeoutCountdown: () => void;
  recentEvents: MatchEvent[];
  onUndoLastScore?: () => void;
  canUndo?: boolean;
  onConcludeMatch?: () => void;
  isCompleted?: boolean;
  isAudioActive: boolean;
  onToggleAudio: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  compact?: boolean;
};

export const KioskCenterConsole = ({
  gameTimeSeconds,
  isClockRunning,
  onToggleClock,
  onAdjustClock,
  onResetClock,
  isClockEnabled,
  onToggleClockEnabled,
  currentPeriod,
  periods,
  onSelectPeriod,
  isSwappedSides,
  onToggleSwapSides,
  orientationMode,
  onChangeOrientationMode,
  activeTimeoutTeam,
  activeTimeoutTeamName,
  activeTimeoutSeconds,
  onCancelTimeoutCountdown,
  recentEvents,
  onUndoLastScore,
  canUndo = false,
  onConcludeMatch,
  isCompleted = false,
  isAudioActive,
  onToggleAudio,
  isFullscreen,
  onToggleFullscreen,
  compact = false,
}: KioskCenterConsoleProps) => {
  // Format game time (MM:SS)
  const formattedTime = useMemo(() => {
    const mins = Math.floor(Math.max(0, gameTimeSeconds) / 60);
    const secs = Math.max(0, gameTimeSeconds) % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [gameTimeSeconds]);

  return (
    <div
      className={`flex flex-col justify-between ${
        compact ? 'p-2 sm:p-2.5 rounded-2xl space-y-1.5' : 'p-4 sm:p-5 rounded-3xl space-y-4'
      } bg-slate-950/90 border border-white/10 shadow-2xl relative overflow-x-hidden overflow-y-auto scrollbar-hide min-h-0 select-none h-full`}
    >
      {/* Active Timeout Emergency Stopwatch Overlay */}
      {activeTimeoutSeconds > 0 && (
        <div
          className={`${
            compact ? 'p-1.5 rounded-xl' : 'p-3 rounded-2xl'
          } bg-slate-900/95 border-2 border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.35)] animate-in fade-in duration-300 flex items-center justify-between gap-2 shrink-0`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`${compact ? 'p-1 rounded-lg' : 'p-2 rounded-xl'} bg-cyan-500/20 text-cyan-400 shrink-0 animate-pulse`}>
              <Timer className={`${compact ? 'size-3.5' : 'size-5'}`} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400 truncate">
                  Timeout
                </span>
                <Badge className="bg-cyan-500 text-slate-950 font-black text-[8px] h-3.5 px-1">
                  {activeTimeoutTeamName || (activeTimeoutTeam === 'a' ? 'Team A' : 'Team B')}
                </Badge>
              </div>
              <span className={`${compact ? 'text-lg' : 'text-2xl sm:text-3xl'} font-black font-mono text-white tracking-tight leading-none block mt-0.5`}>
                00:{String(activeTimeoutSeconds).padStart(2, '0')}
              </span>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCancelTimeoutCountdown}
            className={`border-red-500/40 text-red-400 hover:bg-red-500/10 ${compact ? 'h-6 px-1.5 text-[10px]' : 'h-8 px-2.5 text-xs'} font-bold rounded-lg gap-1 shrink-0`}
          >
            <X className="size-3" /> End
          </Button>
        </div>
      )}

      {/* Realtime Game Clock Card */}
      <div
        className={`${
          compact ? 'p-2 rounded-xl space-y-1.5' : 'p-3.5 sm:p-4 rounded-2xl space-y-3'
        } bg-white/5 border border-white/10 flex flex-col items-center justify-center shrink-0`}
      >
        <div className="w-full flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <Clock className={`${compact ? 'size-3' : 'size-3.5'} text-orange-400`} />
            <span className={`${compact ? 'text-[9px]' : 'text-[10px] sm:text-[11px]'} font-black uppercase tracking-wider text-slate-300`}>
              Game Clock
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Period Selector */}
            <Select value={currentPeriod} onValueChange={(val) => onSelectPeriod(val || '')}>
              <SelectTrigger className={`${compact ? 'h-5 text-[9px] w-20 px-1.5' : 'h-7 text-[10px] sm:text-xs w-32 px-2.5'} font-bold uppercase tracking-wider bg-slate-900 border-white/10 text-orange-400 py-0`}>
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 border-white/10 text-white">
                {periods.map((p, idx) => (
                  <SelectItem key={idx} value={p} className="text-xs font-bold">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              type="button"
              onClick={onToggleClockEnabled}
              className={`text-[8px] uppercase font-black ${compact ? 'px-1' : 'px-2'} py-0.5 rounded border transition-colors ${
                isClockEnabled
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-white/5 border-white/10 text-slate-500'
              }`}
            >
              {isClockEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        {/* Big Digital Readout */}
        {isClockEnabled ? (
          <>
            <div className={`${compact ? 'my-0' : 'my-1'} flex items-center justify-center`}>
              <span className={`${compact ? 'text-3xl sm:text-4xl' : 'text-5xl sm:text-6xl md:text-7xl'} font-black font-mono tracking-tighter text-white tabular-nums drop-shadow-md`}>
                {formattedTime}
              </span>
            </div>

            {/* Main Clock Controls: Start/Stop & Adjust */}
            <div className="w-full flex items-center justify-center gap-1.5 flex-wrap">
              <Button
                type="button"
                size="sm"
                onClick={onToggleClock}
                className={`${compact ? 'h-7 px-3 text-[10px]' : 'h-10 px-5 text-xs'} rounded-xl font-black uppercase tracking-wider gap-1.5 shadow-lg transition-all active:scale-95 cursor-pointer ${
                  isClockRunning
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/20'
                }`}
              >
                {isClockRunning ? <Pause className={`${compact ? 'size-3' : 'size-4'}`} /> : <Play className={`${compact ? 'size-3 fill-slate-950' : 'size-4 fill-slate-950'}`} />}
                <span>{isClockRunning ? 'Pause' : 'Start'}</span>
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onResetClock}
                className={`${compact ? 'size-7' : 'size-10'} rounded-xl border-white/10 text-slate-400 hover:text-white hover:bg-white/10 p-0`}
                title="Reset Clock to Period Default"
              >
                <RotateCcw className={`${compact ? 'size-3' : 'size-4'}`} />
              </Button>
            </div>

            {/* Micro Time Nudges */}
            <div className={`w-full flex items-center justify-center gap-1 ${compact ? 'pt-0 text-[9px]' : 'pt-1 text-[10px]'} font-bold`}>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onAdjustClock(-60)}
                className={`${compact ? 'h-5 px-1 text-[9px]' : 'h-6 px-2 text-[10px]'} text-slate-400 hover:text-white`}
              >
                <Minus className="size-2 mr-0.5" /> 1m
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onAdjustClock(-10)}
                className={`${compact ? 'h-5 px-1 text-[9px]' : 'h-6 px-2 text-[10px]'} text-slate-400 hover:text-white`}
              >
                <Minus className="size-2 mr-0.5" /> 10s
              </Button>
              <span className="text-slate-600">|</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onAdjustClock(10)}
                className={`${compact ? 'h-5 px-1 text-[9px]' : 'h-6 px-2 text-[10px]'} text-slate-400 hover:text-white`}
              >
                <Plus className="size-2 mr-0.5" /> 10s
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onAdjustClock(60)}
                className={`${compact ? 'h-5 px-1 text-[9px]' : 'h-6 px-2 text-[10px]'} text-slate-400 hover:text-white`}
              >
                <Plus className="size-2 mr-0.5" /> 1m
              </Button>
            </div>
          </>
        ) : (
          <div className={`${compact ? 'py-1 text-[10px]' : 'py-4 text-xs'} text-center text-slate-500 italic`}>
            Physical stadium clock active
          </div>
        )}
      </div>

      {/* Center Tactile Utilities: Court Side Swap & Orientation Toggle */}
      <div className="grid grid-cols-2 gap-1.5 shrink-0">
        {/* Court Side Switch */}
        <button
          type="button"
          onClick={onToggleSwapSides}
          className={`${compact ? 'p-1.5 rounded-xl' : 'p-3 rounded-2xl'} border flex flex-col items-center justify-center text-center transition-all cursor-pointer active:scale-95 ${
            isSwappedSides
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
          }`}
          title="Swap Team A and Team B columns on screen to match your courtside view"
        >
          <div className="flex items-center gap-1 mb-0.5">
            <ArrowLeftRight className={`${compact ? 'size-3' : 'size-4'} text-orange-400`} />
            <span className={`${compact ? 'text-[9px]' : 'text-[11px]'} font-black uppercase tracking-wider`}>Swap</span>
          </div>
          <span className="text-[8px] text-slate-400 truncate max-w-full">
            {isSwappedSides ? 'B Left / A Right' : 'Standard (A Left)'}
          </span>
        </button>

        {/* Orientation Switcher */}
        <div className={`${compact ? 'p-1.5 rounded-xl' : 'p-3 rounded-2xl'} bg-white/5 border border-white/10 flex flex-col items-center justify-center text-center`}>
          <div className="flex items-center gap-1 mb-0.5">
            <RotateCw className={`${compact ? 'size-2.5' : 'size-3.5'} text-orange-400`} />
            <span className={`${compact ? 'text-[9px]' : 'text-[11px]'} font-black uppercase tracking-wider text-slate-300`}>Layout</span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onChangeOrientationMode('auto')}
              className={`px-1.5 py-0.5 rounded ${compact ? 'text-[8px]' : 'text-[10px]'} font-bold uppercase transition-colors ${
                orientationMode === 'auto'
                  ? 'bg-orange-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Auto
            </button>
            <button
              type="button"
              onClick={() => onChangeOrientationMode('landscape')}
              className={`px-1.5 py-0.5 rounded ${compact ? 'text-[8px]' : 'text-[10px]'} font-bold uppercase transition-colors ${
                orientationMode === 'landscape'
                  ? 'bg-orange-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Force Widescreen Console Layout"
            >
              Wide
            </button>
            <button
              type="button"
              onClick={() => onChangeOrientationMode('portrait')}
              className={`px-1.5 py-0.5 rounded ${compact ? 'text-[8px]' : 'text-[10px]'} font-bold uppercase transition-colors ${
                orientationMode === 'portrait'
                  ? 'bg-orange-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Force Vertical Thumb Layout"
            >
              Stack
            </button>
          </div>
        </div>
      </div>

      {/* Arena Tools: Audio, Fullscreen & Undo */}
      <div className={`flex items-center justify-between ${compact ? 'pt-1' : 'pt-2'} border-t border-white/10 gap-1.5 shrink-0`}>
        <div className="flex items-center gap-1.5">
          {/* Audio FX Toggle */}
          <button
            type="button"
            onClick={onToggleAudio}
            className={`${compact ? 'size-7 rounded-lg' : 'size-9 rounded-xl'} border flex items-center justify-center transition-all cursor-pointer ${
              isAudioActive
                ? 'bg-orange-500/15 border-orange-500/40 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.2)]'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
            title={isAudioActive ? 'Courtside Sound FX Active' : 'Sound Muted'}
          >
            {isAudioActive ? <Volume2 className={`${compact ? 'size-3.5' : 'size-4'}`} /> : <VolumeX className={`${compact ? 'size-3.5' : 'size-4'}`} />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={`${compact ? 'size-7 rounded-lg' : 'size-9 rounded-xl'} bg-white/5 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer`}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className={`${compact ? 'size-3.5' : 'size-4'}`} /> : <Maximize2 className={`${compact ? 'size-3.5' : 'size-4'}`} />}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Instant Undo Last Score Button */}
          {canUndo && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onUndoLastScore}
              className={`${compact ? 'h-7 px-2 text-[10px] rounded-lg' : 'h-9 px-3 text-xs rounded-xl'} border-amber-500/40 text-amber-300 hover:bg-amber-500/10 font-bold gap-1 active:scale-95`}
              title="Roll back the most recent recorded score event"
            >
              <Undo2 className="size-3" />
              <span>Undo</span>
            </Button>
          )}

          {/* Conclude Match Button */}
          {onConcludeMatch && !isCompleted && (
            <Button
              type="button"
              size="sm"
              onClick={onConcludeMatch}
              className={`${compact ? 'h-7 px-2 text-[10px] rounded-lg' : 'h-9 px-3 text-xs rounded-xl'} bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-wider gap-1 active:scale-95 shadow-md`}
              title="Finalize official match scores and advance tournament bracket"
            >
              <CheckCircle2 className="size-3" />
              <span>Conclude</span>
            </Button>
          )}
        </div>
      </div>

      {/* Mini Recent Event Ticker */}
      {!compact && (
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 text-[11px] text-slate-400 truncate shrink-0">
          <span className="font-bold text-orange-400 uppercase text-[10px] mr-1.5">Latest:</span>
          <span>{recentEvents[0]?.description || 'Awaiting live match actions...'}</span>
        </div>
      )}
    </div>
  );
};
