/**
 * Voice Scoring Control Widget for Courtside Table Officials
 * PSU SportsTrack - Multimodal Interaction System (HCI Capstone)
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
    <Card className="rounded-2xl border border-white/10 bg-slate-950 text-white shadow-xl overflow-hidden transition-all">
      <CardHeader className="py-3 px-4 border-b border-white/10 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div
              className={`size-3 rounded-full ${
                isListening ? 'bg-emerald-500 animate-ping absolute inset-0' : ''
              }`}
            />
            <div
              className={`size-3 rounded-full relative z-10 ${
                isListening ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
            />
          </div>
          <CardTitle className="text-sm sm:text-base font-black uppercase tracking-wider flex items-center gap-2">
            <span>Multimodal Voice Scoring</span>
            <Badge
              variant="outline"
              className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border ${
                !isSupported
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : isListening
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {!isSupported ? 'Browser Unsupported' : isListening ? 'Listening Live' : 'Voice Standby'}
            </Badge>
          </CardTitle>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="size-8 p-0 text-slate-400 hover:text-white hover:bg-white/10 rounded-full"
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? 'Unmute Audio Speech Confirmation' : 'Mute Audio Speech Confirmation'}
          >
            {isMuted ? <VolumeX className="size-4 text-red-400" /> : <Volume2 className="size-4 text-emerald-400" />}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="size-8 p-0 text-slate-400 hover:text-white hover:bg-white/10 rounded-full"
            onClick={() => setShowGuide(!showGuide)}
            title="View Voice Commands Guide"
          >
            <HelpCircle className="size-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Main Controls & Live Visualizer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/5 p-3.5 rounded-xl border border-white/10">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              size="lg"
              data-testid="btn-toggle-voice-scoring"
              onClick={toggleListening}
              className={`font-black uppercase tracking-wide gap-2.5 h-12 px-6 rounded-xl transition-colors shadow-lg active:scale-[0.98] ${
                isListening
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/40 ring-2 ring-red-500/40'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/40'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="size-5" />
                  Stop Voice
                </>
              ) : (
                <>
                  <Mic className="size-5" />
                  Start Voice (Hands-Free)
                </>
              )}
            </Button>

            {isListening && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                <Activity className="size-4" />
                <span className="hidden sm:inline">Microphone Active</span>
              </div>
            )}
          </div>

          {/* Quick Preset Voice Testing Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-[11px] font-bold uppercase text-slate-400 mr-1 hidden sm:inline">
              Quick Test:
            </span>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 bg-white/5 border-white/20 hover:bg-white/15 text-slate-200"
              onClick={() => handleManualSimulate(`Add 2 points to ${teamAName || 'Team A'}`)}
            >
              +2 {teamAName?.slice(0, 8) || 'Team A'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 bg-white/5 border-white/20 hover:bg-white/15 text-slate-200"
              onClick={() => handleManualSimulate(`Add 3 points to ${teamBName || 'Team B'}`)}
            >
              +3 {teamBName?.slice(0, 8) || 'Team B'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 bg-white/5 border-white/20 hover:bg-white/15 text-amber-300"
              onClick={() => handleManualSimulate(`Timeout ${teamAName || 'Team A'}`)}
            >
              Timeout
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 bg-slate-900 border-white/15 hover:bg-slate-800 text-slate-200 inline-flex items-center"
              onClick={() => handleManualSimulate(`Substitute player 1 to player 2 from ${teamAName || 'Team A'}`)}
            >
              <span>Sub #1</span>
              <ArrowRight className="size-3 mx-1 text-orange-400" />
              <span>#2</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 bg-slate-900 border-white/15 hover:bg-slate-800 text-emerald-400"
              onClick={() => handleManualSimulate('Pause game')}
            >
              <Pause className="size-3 mr-1" />
              Pause
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 bg-slate-900 border-white/15 hover:bg-slate-800 text-rose-400"
              onClick={() => handleManualSimulate(`Deduct 1 point from ${teamAName || 'Team A'}`)}
            >
              <MinusCircle className="size-3 mr-1" />
              Deduct -1
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 bg-slate-900 border-white/15 hover:bg-slate-800 text-amber-300"
              onClick={() => handleManualSimulate('Undo last score')}
            >
              <RotateCcw className="size-3 mr-1" />
              Undo
            </Button>
          </div>
        </div>

        {/* Live Audio Transcript Box (Fixed minimum height prevents mobile scroll jumping) */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-white/10 font-mono text-xs min-h-[5.5rem] flex flex-col justify-between gap-1.5">
          <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-bold tracking-wider">
            <span>Real-time Speech Recognition Feed</span>
            {lastCommand && (
              <span className="text-emerald-400 font-bold">
                Intent: {lastCommand.intent} ({Math.round(lastCommand.confidence * 100)}% match)
              </span>
            )}
          </div>

          <div className="min-h-6 flex items-center text-slate-200 text-sm">
            {interimTranscript ? (
              <span className="text-amber-400 italic font-sans flex items-center gap-1.5">
                <span className="size-1.5 bg-amber-400 rounded-full shrink-0" />
                "{interimTranscript}"
              </span>
            ) : transcript ? (
              <span className="text-emerald-300 font-sans font-semibold">
                "{transcript}"
              </span>
            ) : (
              <span className="text-slate-500 italic font-sans text-xs">
                {isListening
                  ? 'Listening... say e.g. "Add 2 points Team A" or "Timeout Team B"'
                  : 'Click "Start Voice" or use the quick test buttons to issue commands.'}
              </span>
            )}
          </div>

          <div className="pt-1 border-t border-white/10 min-h-[1.35rem] flex items-center gap-2 text-[11px] font-medium font-sans">
            {error ? (
              <div className="flex items-center gap-1.5 text-red-400">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : feedbackMessage ? (
              <div className="flex items-center gap-1.5 text-primary-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                <span>{feedbackMessage}</span>
              </div>
            ) : (
              <span className="text-slate-500 text-[10px]">
                Ready for voice or quick-test input
              </span>
            )}
          </div>
        </div>

        {/* Manual Voice Simulator Input for Fallback or Testing */}
        <form onSubmit={handleCustomSubmit} className="flex gap-2">
          <input
            type="text"
            data-testid="input-simulate-voice-command"
            value={customPhrase}
            onChange={(e) => setCustomPhrase(e.target.value)}
            placeholder='Type command to test parser, e.g. "Add 3 points to Team B" or "Foul player 12"'
            className="flex-1 bg-slate-950 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Button
            type="submit"
            size="sm"
            data-testid="btn-submit-simulate-voice"
            variant="outline"
            className="text-xs bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold"
          >
            <Sparkles className="size-3.5 mr-1 text-amber-400" />
            Test Parser
          </Button>
        </form>

        {/* Collapsible Multimodal Voice Cheatsheet Guide */}
        {showGuide && (
          <div className="bg-slate-900/90 rounded-xl p-3 border border-white/15 text-xs space-y-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between font-bold text-slate-200">
              <span className="uppercase tracking-wider text-[11px] text-primary flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-amber-400" />
                Multimodal Voice Interaction Guide (Capstone Rubric)
              </span>
              <button
                onClick={() => setShowGuide(false)}
                className="text-slate-400 hover:text-white"
              >
                <ChevronUp className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="bg-slate-950/60 p-2 rounded-lg border border-white/5 space-y-1">
                <span className="font-bold text-orange-400 block uppercase">Scoring & Player Selection</span>
                <p className="text-slate-400">"Add 2 points to Team A player 1"</p>
                <p className="text-slate-400">"3 pointer for {teamBName || 'Team B'}"</p>
                <p className="text-slate-400">"Pick player 12 Team A"</p>
                <p className="text-slate-400">"Deduct 2 points from {teamAName || 'Team A'}"</p>
              </div>

              <div className="bg-slate-950/60 p-2 rounded-lg border border-white/5 space-y-1">
                <span className="font-bold text-emerald-400 block uppercase">Game Flow & Subs</span>
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
      </CardContent>
    </Card>
  );
};
