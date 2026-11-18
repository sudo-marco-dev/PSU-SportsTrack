/**
 * Multimodal Interaction Types for PSU SportsTrack
 * Capstone Project Specification for HCI & Voice/Gesture Interfaces
 */

export type VoiceCommandIntent =
  | 'score'
  | 'substitution'
  | 'select_player'
  | 'deduct'
  | 'timeout'
  | 'foul'
  | 'commentary'
  | 'clock'
  | 'period'
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
  // Period fields
  periodAction?: 'next' | 'prev' | null;
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
  onSelectPlayer?: (team: 'a' | 'b', playerNumber?: number) => void;
  onDeduct?: (team: 'a' | 'b', points?: number) => void;
  onTimeout?: (team?: 'a' | 'b') => void;
  onFoul?: (team: 'a' | 'b', playerNumber?: number) => void;
  onClockControl?: (action: 'pause' | 'resume') => void;
  onPeriodChange?: (direction: 'next' | 'prev') => void;
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

// Touchless Gesture Types (21-Landmark Hand & Finger Tracking)
export type TouchlessActionMode = 'score' | 'select_player' | 'deduct' | 'sub_foul';

export type HandSide = 'left' | 'right';

export type HandPoseName =
  | 'one_finger'
  | 'two_fingers'
  | 'three_fingers'
  | 'four_fingers'
  | 'open_palm'
  | 'closed_fist'
  | 'thumbs_up'
  | 'shaka'
  | 'none';

export type HandTrackingPhase = 'idle' | 'charging' | 'locked_until_release';

export type TouchlessModelStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface TrackedHandState {
  detected: boolean;
  pose: HandPoseName;
  fingerCount: number;
  score: number;
  chargePercent: number;
  phase: HandTrackingPhase;
  actionLabel: string;
}

export type GestureType =
  | 'one_finger'
  | 'two_fingers'
  | 'three_fingers'
  | 'four_fingers'
  | 'closed_fist'
  | 'shaka'
  | 'swipe_left'
  | 'swipe_right'
  | 'open_palm'
  | 'thumbs_up'
  | 'peace_sign'
  | 'wave'
  | 'none';

export interface GestureState {
  detectedGesture: GestureType;
  detectedHandSide?: HandSide | null;
  confidence: number;
  isCameraActive: boolean;
  modelStatus: TouchlessModelStatus;
  isArmed: boolean;
  lastTriggered: number;
  motionVelocity: { x: number; y: number };
  error: string | null;
  leftHand: TrackedHandState;
  rightHand: TrackedHandState;
  leftHandDetected?: boolean;
  rightHandDetected?: boolean;
  topZoneDetected?: boolean;
  leftChargePercent?: number;
  rightChargePercent?: number;
  topChargePercent?: number;
}
