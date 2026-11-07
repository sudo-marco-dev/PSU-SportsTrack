/**
 * Touchless Gesture Radar HUD Component for Kiosks
 * PSU SportsTrack - Multimodal Interaction System (HCI Capstone)
 */

import React, { useState } from 'react';
import {
  Camera,
  CameraOff,
  Hand,
  ArrowLeft,
  ArrowRight,
  ThumbsUp,
  HelpCircle,
  Activity,
  Scissors,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { useTouchlessGestures } from '@/hooks/useTouchlessGestures';
import type { GestureType } from '@/types/multimodal';

interface TouchlessGestureHUDProps {
  gestures: ReturnType<typeof useTouchlessGestures>;
  onTabChange?: (direction: 'next' | 'prev') => void;
  onClockToggle?: () => void;
  onSubstitutionTrigger?: () => void;
}

export const TouchlessGestureHUD: React.FC<TouchlessGestureHUDProps> = ({
  gestures,
}) => {
  const [showCheatSheet, setShowCheatSheet] = useState(false);

  const {
    isCameraActive,
    detectedGesture,
    confidence,
    error,
    toggleCamera,
    simulateGesture,
  } = gestures;

  const getGestureIcon = (g: GestureType) => {
    switch (g) {
      case 'open_palm':
        return <Hand className="size-6 text-amber-400 animate-bounce" />;
      case 'swipe_left':
        return <ArrowLeft className="size-6 text-cyan-400 animate-pulse" />;
      case 'swipe_right':
        return <ArrowRight className="size-6 text-cyan-400 animate-pulse" />;
      case 'thumbs_up':
        return <ThumbsUp className="size-6 text-emerald-400 animate-bounce" />;
      case 'peace_sign':
        return <Scissors className="size-6 text-purple-400 animate-pulse" />;
      default:
        return <Activity className="size-5 text-slate-400" />;
    }
  };

  const getGestureLabel = (g: GestureType) => {
    switch (g) {
      case 'open_palm':
        return 'Open Palm (Pause / Play Clock)';
      case 'swipe_left':
        return 'Swipe Left (Previous View)';
      case 'swipe_right':
        return 'Swipe Right (Next View)';
      case 'thumbs_up':
        return 'Thumbs Up (Confirm / Point)';
      case 'peace_sign':
        return 'Peace Sign (Open Substitutions)';
      default:
        return 'No Gesture Active';
    }
  };

  return (
    <div className="bg-slate-950/90 border-2 border-primary/30 rounded-2xl p-3 text-white shadow-xl backdrop-blur">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Radar Status & Camera Toggle */}
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            data-testid="btn-toggle-touchless-camera"
            variant="outline"
            onClick={toggleCamera}
            className={`h-9 px-3.5 text-xs font-bold gap-2 rounded-xl transition-all border ${
              isCameraActive
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 shadow-lg shadow-emerald-900/30'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/20'
            }`}
          >
            {isCameraActive ? (
              <>
                <CameraOff className="size-4" /> Stop Gesture Sensor
              </>
            ) : (
              <>
                <Camera className="size-4" /> Enable Touchless Sensor
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            <span
              className={`size-2.5 rounded-full ${
                isCameraActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'
              }`}
            />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {isCameraActive ? 'Optical Radar Active' : 'Touchless Standby'}
            </span>
          </div>
        </div>

        {/* Active Detected Gesture Banner */}
        {detectedGesture !== 'none' && (
          <div className="bg-primary/20 border border-primary/50 px-3 py-1.5 rounded-xl flex items-center gap-2 animate-in zoom-in-95">
            {getGestureIcon(detectedGesture)}
            <div>
              <span className="text-xs font-black text-amber-300 uppercase block">
                {getGestureLabel(detectedGesture)}
              </span>
              <span className="text-[10px] text-slate-300 font-mono">
                Confidence: {Math.round(confidence * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* Quick Simulator Buttons for Fallback or Testing */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <span className="text-[10px] font-bold uppercase text-slate-400 mr-1 hidden md:inline">
            Simulate:
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px] bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10"
            onClick={() => simulateGesture('swipe_left')}
            title="Simulate Swipe Left"
          >
            👈 Left
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px] bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10"
            onClick={() => simulateGesture('swipe_right')}
            title="Simulate Swipe Right"
          >
            👉 Right
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px] bg-white/5 hover:bg-white/10 text-amber-300 border border-white/10"
            onClick={() => simulateGesture('open_palm')}
            title="Simulate Open Palm (Clock Toggle)"
          >
            ✋ Palm
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px] bg-white/5 hover:bg-white/10 text-purple-300 border border-white/10"
            onClick={() => simulateGesture('peace_sign')}
            title="Simulate Peace Sign (Substitution)"
          >
            ✌️ Sub
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="size-7 p-0 text-slate-400 hover:text-white"
            onClick={() => setShowCheatSheet(!showCheatSheet)}
            title="Gesture Guide"
          >
            <HelpCircle className="size-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-2 text-[11px] text-red-400 font-mono bg-red-950/30 p-2 rounded-lg border border-red-900/50">
          {error}
        </div>
      )}

      {/* Collapsible Gesture Cheat Sheet */}
      {showCheatSheet && (
        <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] animate-in fade-in">
          <div className="bg-slate-900 p-2 rounded-lg border border-white/5">
            <span className="font-bold text-cyan-400 block">👈 Wave Hand Left</span>
            <span className="text-slate-400">Previous match or navigation tab</span>
          </div>
          <div className="bg-slate-900 p-2 rounded-lg border border-white/5">
            <span className="font-bold text-cyan-400 block">👉 Wave Hand Right</span>
            <span className="text-slate-400">Next match or navigation tab</span>
          </div>
          <div className="bg-slate-900 p-2 rounded-lg border border-white/5">
            <span className="font-bold text-amber-400 block">✋ Hold Open Palm</span>
            <span className="text-slate-400">Pause / Resume match clock</span>
          </div>
          <div className="bg-slate-900 p-2 rounded-lg border border-white/5">
            <span className="font-bold text-purple-400 block">✌️ Peace Sign / Two Fingers</span>
            <span className="text-slate-400">Launch substitution dialogue</span>
          </div>
        </div>
      )}
    </div>
  );
};
