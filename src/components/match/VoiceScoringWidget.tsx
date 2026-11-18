/**
 * Voice Scoring Control Widget for Courtside Table Officials
 * PSU SportsTrack - Multimodal Interaction System (HCI Capstone)
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  HelpCircle,
  Activity,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ChevronUp,
  ArrowRight,
  Pause,
  MinusCircle,
} from 'lucide-react';
import type { useVoiceScoring } from '@/hooks/useVoiceScoring';

interface VoiceScoringWidgetProps {
  voice: ReturnType<typeof useVoiceScoring>;
  teamAName: string;
  teamBName: string;
}

export const VoiceScoringWidget: React.FC<VoiceScoringWidgetProps> = ({
  voice,
  teamAName,
  teamBName,
}) => {
  const [showGuide, setShowGuide] = useState(false);
  const [customPhrase, setCustomPhrase] = useState('');

  const {
    isListening,
    isSupported,
    interimTranscript,
    transcript,
    lastCommand,
    feedbackMessage,
    error,
    isMuted,
    setIsMuted,
    toggleListening,
    simulateVoiceCommand,
    history,
  } = voice;

  const handleManualSimulate = (phrase: string) => {
    simulateVoiceCommand(phrase);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPhrase.trim()) return;
    simulateVoiceCommand(customPhrase.trim());
    setCustomPhrase('');
  };

  return (
    <div
      data-testid="voice-scoring-widget"
      className="rounded-2xl border border-white/10 bg-slate-950 text-white shadow-xl overflow-hidden"
    >
      {/* Locked 1-Line Header Bar (Never wraps or resizes on mobile) */}
      <div className="h-12 px-3.5 border-b border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={`size-2.5 rounded-full shrink-0 ${
              isListening ? 'bg-emerald-400' : 'bg-slate-500'
            }`}
          />
          <span className="text-xs sm:text-sm font-black uppercase tracking-wider truncate">
            Multimodal Voice Scoring
          </span>
          <Badge
            variant="outline"
            className={`w-28 justify-center shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border ${
              !isSupported
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : isListening
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {!isSupported ? 'Unsupported' : isListening ? 'Listening Live' : 'Voice Standby'}
          </Badge>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="size-8 p-0 text-slate-400 hover:text-white hover:bg-white/10 rounded-full"
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? 'Unmute Audio Speech Confirmation' : 'Mute Audio Speech Confirmation'}
          >
            {isMuted ? (
              <VolumeX className="size-4 text-red-400" />
            ) : (
              <Volume2 className="size-4 text-emerald-400" />
            )}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="size-8 p-0 text-slate-400 hover:text-white hover:bg-white/10 rounded-full"
            onClick={() => setShowGuide(!showGuide)}
            title="View Voice Commands Guide"
          >
            <HelpCircle className="size-4" />
          </Button>
        </div>
      </div>

      <div className="p-3 space-y-2.5">
        {/* Primary Voice Control + Live Audio Transcript Box (Strict equal heights prevent mobile jump/glitch) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch">
          <div className="lg:col-span-4 h-[5.5rem] flex flex-col justify-between bg-slate-900/90 p-3 rounded-xl border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span className="inline-flex items-center gap-1.5 truncate">
                <Activity className="size-3.5 text-orange-400 shrink-0" />
                <span className="truncate">Microphone Control</span>
              </span>
              <span className={`shrink-0 ${isListening ? 'text-emerald-400' : 'text-slate-500'}`}>
                {isListening ? 'Active' : 'Standby'}
              </span>
            </div>

            <Button
              type="button"
              size="lg"
              data-testid="btn-toggle-voice-scoring"
              onClick={toggleListening}
              className={`w-full justify-center font-black uppercase tracking-wide gap-2 h-10 px-4 rounded-xl transition-colors shadow-lg active:scale-[0.98] ${
                isListening
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/40 ring-2 ring-red-500/40'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/40'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="size-4 shrink-0" />
                  <span className="truncate">Stop Voice</span>
                </>
              ) : (
                <>
                  <Mic className="size-4 shrink-0" />
                  <span className="truncate">Start Voice (Hands-Free)</span>
                </>
              )}
            </Button>
          </div>

          {/* Live Audio Transcript Box (Strict 5.5rem height prevents mobile scroll or layout jumping) */}
          <div className="lg:col-span-8 h-[5.5rem] bg-slate-900/90 rounded-xl p-3 border border-white/10 font-mono text-xs flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between gap-2 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
              <span className="truncate">Real-time Speech Recognition Feed</span>
              {lastCommand && (
                <span className="text-emerald-400 font-bold shrink-0">
                  {lastCommand.intent} ({Math.round(lastCommand.confidence * 100)}%)
                </span>
              )}
            </div>

            <div className="h-5 flex items-center text-slate-200 text-xs overflow-hidden">
              {interimTranscript ? (
                <span className="text-amber-400 italic font-sans flex items-center gap-1.5 truncate">
                  <span className="size-1.5 bg-amber-400 rounded-full shrink-0" />
                  "{interimTranscript}"
                </span>
              ) : transcript ? (
                <span className="text-emerald-300 font-sans font-semibold truncate">
                  "{transcript}"
                </span>
              ) : (
                <span className="text-slate-500 italic font-sans text-xs truncate">
                  {isListening
                    ? 'Listening... say "Give 2 points to Team A" or "Timeout Team B"'
                    : 'Tap "Start Voice" or use the balanced Quick Test grid below.'}
                </span>
              )}
            </div>

            <div className="pt-1 border-t border-white/10 h-5 flex items-center gap-2 text-[11px] font-medium font-sans overflow-hidden">
              {error ? (
                <div className="flex items-center gap-1.5 text-red-400 truncate">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span className="truncate">{error}</span>
                </div>
              ) : feedbackMessage ? (
                <div className="flex items-center gap-1.5 text-primary-foreground truncate">
                  <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{feedbackMessage}</span>
                </div>
              ) : (
                <span className="text-slate-500 text-[10px] truncate">
                  Ready for voice or quick-test input
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Symmetric 8-Button Quick Test Grid (2x4 on mobile, 4x2 on tablet, 8x1 on wide desktop) */}
        <div className="bg-slate-900/60 border border-white/10 rounded-xl p-2.5 space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
            Quick Command Test Grid:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-1.5 w-full">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-full justify-center px-2 text-[11px] font-bold bg-slate-950 border-white/15 hover:bg-slate-800 text-orange-400 rounded-lg truncate active:scale-[0.98]"
              onClick={() => handleManualSimulate(`Add 2 points to ${teamAName || 'Team A'}`)}
            >
              <span className="truncate">+2 {(teamAName || 'Team A').slice(0, 7)}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-full justify-center px-2 text-[11px] font-bold bg-slate-950 border-white/15 hover:bg-slate-800 text-cyan-400 rounded-lg truncate active:scale-[0.98]"
              onClick={() => handleManualSimulate(`Add 3 points to ${teamBName || 'Team B'}`)}
            >
              <span className="truncate">+3 {(teamBName || 'Team B').slice(0, 7)}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-full justify-center px-2 text-[11px] font-bold bg-slate-950 border-white/15 hover:bg-slate-800 text-slate-200 rounded-lg truncate active:scale-[0.98]"
              onClick={() => handleManualSimulate(`Pick player 1 ${teamAName || 'Team A'}`)}
            >
              <span className="truncate">Pick #1</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-full justify-center px-2 text-[11px] font-bold bg-slate-950 border-white/15 hover:bg-slate-800 text-slate-200 inline-flex items-center rounded-lg truncate active:scale-[0.98]"
              onClick={() =>
                handleManualSimulate(
                  `Substitute player 1 to player 2 from ${teamAName || 'Team A'}`
                )
              }
            >
              <span>Sub #1</span>
              <ArrowRight className="size-3 mx-0.5 text-orange-400 shrink-0" />
              <span>#2</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-full justify-center px-2 text-[11px] font-bold bg-slate-950 border-white/15 hover:bg-slate-800 text-amber-300 rounded-lg truncate active:scale-[0.98]"
              onClick={() => handleManualSimulate(`Timeout ${teamAName || 'Team A'}`)}
            >
              <span className="truncate">Timeout</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-full justify-center px-2 text-[11px] font-bold bg-slate-950 border-white/15 hover:bg-slate-800 text-emerald-400 rounded-lg truncate active:scale-[0.98]"
              onClick={() => handleManualSimulate('Pause game')}
            >
              <Pause className="size-3 mr-1 shrink-0" />
              <span className="truncate">Pause</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-full justify-center px-2 text-[11px] font-bold bg-slate-950 border-white/15 hover:bg-slate-800 text-rose-400 rounded-lg truncate active:scale-[0.98]"
              onClick={() => handleManualSimulate(`Deduct 1 point from ${teamAName || 'Team A'}`)}
            >
              <MinusCircle className="size-3 mr-1 shrink-0" />
              <span className="truncate">Deduct -1</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-full justify-center px-2 text-[11px] font-bold bg-slate-950 border-white/15 hover:bg-slate-800 text-amber-300 rounded-lg truncate active:scale-[0.98]"
              onClick={() => handleManualSimulate('Undo last score')}
            >
              <RotateCcw className="size-3 mr-1 shrink-0" />
              <span className="truncate">Undo</span>
            </Button>
          </div>
        </div>

        {/* Manual Voice Simulator Input for Fallback or Testing */}
        <form onSubmit={handleCustomSubmit} className="flex items-center gap-2">
          <input
            type="text"
            data-testid="input-simulate-voice-command"
            value={customPhrase}
            onChange={(e) => setCustomPhrase(e.target.value)}
            placeholder='Type command, e.g. "Add 3 points to Team B" or "Foul player 12"'
            className="flex-1 h-9 bg-slate-900 border border-white/15 rounded-xl px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Button
            type="submit"
            size="sm"
            data-testid="btn-submit-simulate-voice"
            variant="outline"
            className="h-9 px-3.5 text-xs bg-slate-900 hover:bg-slate-800 border-white/20 text-white font-bold rounded-xl shrink-0"
          >
            <Sparkles className="size-3.5 mr-1 text-amber-400" />
            Test Parser
          </Button>
        </form>

        {/* Collapsible Multimodal Voice Cheatsheet Guide */}
        {showGuide && (
          <div className="bg-slate-900/90 rounded-xl p-3 border border-white/15 text-xs space-y-2">
            <div className="flex items-center justify-between font-bold text-slate-200">
              <span className="uppercase tracking-wider text-[11px] text-primary flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-amber-400" />
                Multimodal Voice Interaction Guide (Capstone Rubric)
              </span>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="text-slate-400 hover:text-white"
              >
                <ChevronUp className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="bg-slate-950/60 p-2 rounded-lg border border-white/5 space-y-1">
                <span className="font-bold text-orange-400 block uppercase">
                  Scoring &amp; Player Selection
                </span>
                <p className="text-slate-400">"Add 2 points to Team A player 1"</p>
                <p className="text-slate-400">"3 pointer for {teamBName || 'Team B'}"</p>
                <p className="text-slate-400">"Pick player 12 Team A"</p>
                <p className="text-slate-400">"Deduct 2 points from {teamAName || 'Team A'}"</p>
              </div>

              <div className="bg-slate-950/60 p-2 rounded-lg border border-white/5 space-y-1">
                <span className="font-bold text-emerald-400 block uppercase">
                  Game Flow &amp; Subs
                </span>
                <p className="text-slate-400">"Pause game" / "Resume game"</p>
                <p className="text-slate-400">"Substitute player 1 to player 2 from Team A"</p>
                <p className="text-slate-400">"Timeout Team A" / "Foul on Player 24"</p>
                <p className="text-slate-400">"Undo last score"</p>
              </div>
            </div>
          </div>
        )}

        {/* Recent Voice Command Audit Trail */}
        {history.length > 0 && (
          <div className="space-y-1 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Recent Voice Actions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {history.slice(0, 4).map((cmd, idx) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  className="bg-white/10 text-slate-300 text-[10px] font-mono px-2 py-0.5 border border-white/10"
                >
                  {cmd.intent.toUpperCase()}: "{cmd.rawTranscript}"
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
