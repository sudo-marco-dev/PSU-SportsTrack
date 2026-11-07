/**
 * Multimodal Interaction Types for PSU SportsTrack
 * Capstone Project Specification for HCI & Voice/Gesture Interfaces
 */

export type VoiceCommandIntent =
  | 'score'
  | 'substitution'
  | 'deduct'
  | 'timeout'
  | 'foul'
  | 'commentary'
  | 'clock'
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
  // Substitution fields
  subOutPlayerNumber?: number | null;
  subInPlayerNumber?: number | null;
  // Clock fields
  clockAction?: 'pause' | 'resume' | 'reset' | null;
  notes?: string;
  confidence: number;
  timestamp: number;
}

export interface VoiceScoringOptions {
  teamAName: string;
  teamBName: string;
  sport?: string;
  onScore?: (team: 'a' | 'b', points: number, actionType: string, description?: string, playerNumber?: number) => void;
  onSubstitution?: (team: 'a' | 'b', subOutJersey: number, subInJersey: number) => void;
  onDeduct?: (team: 'a' | 'b') => void;
  onTimeout?: (team?: 'a' | 'b') => void;
  onFoul?: (team: 'a' | 'b', playerNumber?: number) => void;
  onClockControl?: (action: 'pause' | 'resume') => void;
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

// Public Voice Assistant Query Types
export type PublicVoiceQueryType =
  | 'upcoming_games'
  | 'player_search'
  | 'highest_stars'
  | 'sport_schedule'
  | 'navigation'
  | 'general_search'
  | 'help'
  | 'unknown';

export interface ParsedPublicVoiceQuery {
  rawTranscript: string;
  queryType: PublicVoiceQueryType;
  searchTerm?: string;
  sport?: string;
  targetRoute?: string;
  spokenResponse: string;
  confidence: number;
}

// Touchless Gesture Types
export type GestureType =
  | 'swipe_left'
  | 'swipe_right'
  | 'open_palm'
  | 'thumbs_up'
  | 'peace_sign'
  | 'wave'
  | 'none';

export interface GestureState {
  detectedGesture: GestureType;
  confidence: number;
  isCameraActive: boolean;
  lastTriggered: number;
  motionVelocity: { x: number; y: number };
  error: string | null;
}
