/**
 * Multimodal Interaction Types for PSU SportsTrack
 * Capstone Project Specification for HCI & Voice User Interfaces
 */

export type VoiceCommandIntent =
  | 'score'
  | 'deduct'
  | 'timeout'
  | 'foul'
  | 'commentary'
  | 'undo'
  | 'help'
  | 'unknown';

export interface ParsedVoiceCommand {
  rawTranscript: string;
  intent: VoiceCommandIntent;
  team: 'a' | 'b' | null;
  teamName: string | null;
  points: number | null;
  actionType: string | null;
  playerNumber: number | null;
  notes?: string;
  confidence: number;
  timestamp: number;
}

export interface VoiceScoringOptions {
  teamAName: string;
  teamBName: string;
  sport?: string;
  onScore?: (team: 'a' | 'b', points: number, actionType: string, description?: string) => void;
  onDeduct?: (team: 'a' | 'b') => void;
  onTimeout?: (team?: 'a' | 'b') => void;
  onFoul?: (team: 'a' | 'b', playerNumber?: number) => void;
  onCommentary?: (text: string) => void;
  onUndo?: () => void;
  enableSpeechFeedback?: boolean;
}

export interface VoiceRecognitionState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  lastCommand: ParsedVoiceCommand | null;
  error: string | null;
  feedbackMessage: string | null;
  history: ParsedVoiceCommand[];
}
