/**
 * Public Voice Assistant & Omni-Search HUD Component
 * PSU SportsTrack - Multimodal Public Access Interface
 */

import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Trophy,
  Calendar,
  Search,
  ArrowRight,
  ExternalLink,
  Star,
  Activity,
  GraduationCap,
  SearchX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePublicVoiceAssistant } from '@/hooks/usePublicVoiceAssistant';

export const PublicVoiceAssistantHUD: React.FC = () => {
  const assistant = usePublicVoiceAssistant();
  const [typedQuery, setTypedQuery] = useState('');

  const {
    isOpen,
    setIsOpen,
    isListening,
    transcript,
    interimTranscript,
    activeQuery,
    queryResults,
    isLoadingResults,
    isMuted,
    setIsMuted,
    startListening,
    stopListening,
    simulateQuery,
    navigateToResult,
  } = assistant;

  const handleQuickChip = (phrase: string) => {
    simulateQuery(phrase);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedQuery.trim()) return;
    simulateQuery(typedQuery.trim());
    setTypedQuery('');
  };

  return (
    <>
      {/* Universal Floating Microphone Action Button */}
      <aside aria-label="Universal Voice Search Assistant" className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
        <Button
          data-testid="btn-universal-voice-assistant"
          onClick={() => {
            if (!isOpen) {
              setIsOpen(true);
              startListening();
            } else {
              setIsOpen(false);
            }
          }}
          className={`size-14 rounded-full shadow-2xl p-0 transition-all duration-300 relative group flex items-center justify-center border-2 border-white/20 active:scale-95 ${
            isListening
              ? 'bg-red-600 hover:bg-red-700 ring-4 ring-red-500/40 animate-pulse'
              : 'bg-primary hover:bg-primary/90 hover:scale-105'
          }`}
          title="Open PSU SportsTrack Voice Assistant"
        >
          {isListening ? (
            <div className="relative flex items-center justify-center">
              <span className="size-8 rounded-full bg-red-400/30 animate-ping absolute" />
              <MicOff className="size-6 text-white relative z-10" />
            </div>
          ) : (
            <div className="relative flex items-center justify-center">
              <Mic className="size-6 text-white group-hover:scale-110 transition-transform" />
              <span className="absolute -top-1 -right-1 size-3 bg-amber-400 rounded-full border-2 border-background animate-pulse" />
            </div>
          )}
        </Button>
      </aside>

      {/* Interactive Voice Assistant Modal Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto bg-slate-950 text-white border-2 border-primary/30 p-0 rounded-2xl shadow-2xl">
          {/* Header */}
          <DialogHeader className="p-5 pb-3 border-b border-white/10 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                <Sparkles className="size-5 text-amber-400" />
              </div>
              <div>
                <DialogTitle className="text-base font-black uppercase tracking-wide flex items-center gap-2">
                  <span>SportsTrack Voice Assistant</span>
                  <Badge variant="outline" className="text-[10px] font-mono border-primary/50 text-primary">
                    HCI-2 Multimodal
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-slate-400 font-medium">Search fixtures, athletes, standings, and star leaders hands-free.</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsMuted(!isMuted)}
                className="size-8 p-0 text-slate-400 hover:text-white rounded-full"
                title={isMuted ? 'Unmute Speech Responses' : 'Mute Speech Responses'}
              >
                {isMuted ? <VolumeX className="size-4 text-red-400" /> : <Volume2 className="size-4 text-emerald-400" />}
              </Button>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-4">
            {/* Real-time Listening Soundwave Banner */}
            <div className="bg-slate-900/90 rounded-xl p-4 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Activity className="size-3.5 text-primary" />
                  {isListening ? 'Listening live...' : 'Voice Feed'}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={isListening ? stopListening : startListening}
                  className={`h-7 px-3 text-xs font-bold gap-1.5 border-white/20 rounded-lg ${
                    isListening ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-white/10 text-white'
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="size-3" /> Stop
                    </>
                  ) : (
                    <>
                      <Mic className="size-3" /> Speak
                    </>
                  )}
                </Button>
              </div>

              <div className="min-h-10 flex items-center text-slate-200">
                {interimTranscript ? (
                  <p className="text-amber-300 text-sm italic font-sans animate-pulse">
                    "{interimTranscript}"
                  </p>
                ) : transcript ? (
                  <p className="text-emerald-300 text-sm font-semibold font-sans">
                    "{transcript}"
                  </p>
                ) : (
                  <p className="text-slate-500 text-xs italic font-sans">
                    Try saying: "Search for upcoming games this week" or "Who has the most stars?"
                  </p>
                )}
              </div>

              {activeQuery?.spokenResponse && (
                <div className="pt-2 border-t border-white/10 text-xs text-primary-foreground font-medium flex items-center justify-between">
                  <span>{activeQuery.spokenResponse}</span>
                  {activeQuery.targetRoute && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigateToResult()}
                      className="h-6 text-[11px] font-bold text-amber-400 hover:text-amber-300 gap-1 p-0 px-2"
                    >
                      Go <ArrowRight className="size-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Dynamic Results Preview Section */}
            {isLoadingResults ? (
              <div className="py-8 text-center text-slate-400 text-xs animate-pulse">
                Fetching university sports data...
              </div>
            ) : queryResults && queryResults.items.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Preview Results</span>
                  {activeQuery?.targetRoute && (
                    <button
                      onClick={() => navigateToResult()}
                      className="text-primary hover:underline flex items-center gap-1 font-semibold"
                    >
                      View All in Portal <ExternalLink className="size-3" />
                    </button>
                  )}
                </div>

                {/* Upcoming Games & Match Search Previews */}
                {(queryResults.type === 'upcoming_games' || queryResults.type === 'match_search') && (
                  <div className="grid gap-2">
                    {queryResults.items.map((m: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between hover:bg-white/10 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px] uppercase font-bold border-primary/50 text-primary">
                              {m.tournament?.sport || 'Sport'}
                            </Badge>
                            <span className="text-[10px] text-slate-400">{m.venue || 'Main Gymnasium'}</span>
                          </div>
                          <p className="font-bold text-sm text-slate-100">
                            {m.team_a?.name || 'TBD'} vs {m.team_b?.name || 'TBD'}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`btn-preview-view-match-${idx}`}
                          onClick={() => navigateToResult(`/match/${m.id}`)}
                          className="text-xs h-8 bg-primary/20 border-primary/40 hover:bg-primary/30 text-white"
                        >
                          View Match
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Highest Stars MVP Previews */}
                {queryResults.type === 'highest_stars' && (
                  <div className="grid gap-2">
                    {queryResults.items.map((athlete: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-black text-amber-400 text-sm">#{idx + 1}</span>
                          <div>
                            <p className="font-bold text-sm text-slate-100">{athlete.name}</p>
                            <p className="text-[11px] text-slate-400">{athlete.college}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-bold gap-1">
                            <Star className="size-3 fill-amber-400" /> {athlete.gold} Gold
                          </Badge>
                          <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-xs font-bold gap-1">
                            <Star className="size-3 fill-red-400" /> {athlete.red} Red
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Player Search Previews */}
                {queryResults.type === 'player_search' && (
                  <div className="grid gap-2">
                    {queryResults.items.map((player: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold text-xs">
                            {player.full_name?.charAt(0) || 'P'}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-100">{player.full_name}</p>
                            <p className="text-[11px] text-slate-400">{player.college?.college_name || 'PSU Student Athlete'}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`btn-preview-view-player-${idx}`}
                          onClick={() => navigateToResult('/athletics')}
                          className="text-xs h-7 bg-white/10 border-white/20 hover:bg-white/20 text-white"
                        >
                          Scout Dossier
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sport Schedule Previews */}
                {queryResults.type === 'sport_schedule' && (
                  <div className="grid gap-2">
                    {queryResults.items.map((tourn: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px] uppercase font-bold border-primary/50 text-primary">
                              {tourn.sport || 'Sport'}
                            </Badge>
                            <span className="text-[10px] text-slate-400">{tourn.status || 'Active'}</span>
                          </div>
                          <p className="font-bold text-sm text-slate-100">{tourn.name}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`btn-preview-view-schedule-${idx}`}
                          onClick={() => navigateToResult('/explorer')}
                          className="text-xs h-7 bg-primary/20 border-primary/40 hover:bg-primary/30 text-white"
                        >
                          View Fixtures
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* College Search Previews */}
                {queryResults.type === 'college_search' && (
                  <div className="grid gap-2">
                    {queryResults.items.map((c: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-300">
                            <GraduationCap className="size-4" />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-100">{c.college_name}</p>
                            <p className="text-[11px] text-slate-400">{c.cluster?.name || 'Academic Unit'}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`btn-preview-view-college-${idx}`}
                          onClick={() => navigateToResult('/ranking')}
                          className="text-xs h-7 bg-sky-500/20 border-sky-500/40 hover:bg-sky-500/30 text-white"
                        >
                          View Standings
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* General Multi-Entity Search Previews */}
                {queryResults.type === 'general_search' && (
                  <div className="grid gap-2">
                    {queryResults.items.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px] uppercase font-bold border-white/20 text-slate-300">
                              {item.entityType || 'Record'}
                            </Badge>
                            {item.sport && <span className="text-[10px] text-slate-400">{item.sport}</span>}
                          </div>
                          <p className="font-bold text-sm text-slate-100">
                            {item.name || item.full_name || item.round || 'University Record'}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`btn-preview-view-general-${idx}`}
                          onClick={() =>
                            navigateToResult(
                              item.entityType === 'match'
                                ? `/match/${item.id}`
                                : item.entityType === 'player'
                                ? '/athletics'
                                : '/explorer'
                            )
                          }
                          className="text-xs h-7 bg-white/10 border-white/20 hover:bg-white/20 text-white"
                        >
                          Open Details
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : queryResults && queryResults.items.length === 0 ? (
              <div
                data-testid="hud-empty-state"
                className="py-6 px-4 text-center border border-white/10 rounded-xl bg-white/5 space-y-2"
              >
                <SearchX className="size-7 mx-auto text-slate-500 opacity-80" />
                <p className="font-bold text-sm text-slate-200">No matching athletic records found</p>
                <p className="text-[11px] text-slate-400">
                  Try asking for "upcoming games", "basketball schedule", or "players with highest stars".
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="btn-hud-open-search"
                  onClick={() => navigateToResult(`/search?q=${encodeURIComponent(transcript || '')}`)}
                  className="mt-2 text-xs bg-primary/20 border-primary/40 hover:bg-primary/30 text-white rounded-lg gap-1.5"
                >
                  Open Dedicated Search Hub <ExternalLink className="size-3" />
                </Button>
              </div>
            ) : null}

            {/* Quick Suggestion Pills */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Suggested Voice Commands:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 bg-white/5 border-white/15 hover:bg-white/15 text-slate-300 rounded-lg"
                  onClick={() => handleQuickChip('Search for upcoming games this week')}
                >
                  <Calendar className="size-3 mr-1 text-primary" /> Upcoming games this week
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 bg-white/5 border-white/15 hover:bg-white/15 text-slate-300 rounded-lg"
                  onClick={() => handleQuickChip('Search for players with highest stars')}
                >
                  <Trophy className="size-3 mr-1 text-amber-400" /> Players with highest stars
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 bg-white/5 border-white/15 hover:bg-white/15 text-slate-300 rounded-lg"
                  onClick={() => handleQuickChip('Show Basketball schedule')}
                >
                  Basketball schedule
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 bg-white/5 border-white/15 hover:bg-white/15 text-slate-300 rounded-lg"
                  onClick={() => handleQuickChip('Go to rankings')}
                >
                  College rankings
                </Button>
              </div>
            </div>

            {/* Manual Query Bar for Quiet/No-Mic Environments */}
            <form onSubmit={handleManualSubmit} className="flex gap-2 pt-2 border-t border-white/10">
              <input
                type="text"
                data-testid="input-public-voice-search"
                value={typedQuery}
                onChange={(e) => setTypedQuery(e.target.value)}
                placeholder='Type or speak: "Upcoming games this week", "Player Santos"...'
                className="flex-1 bg-slate-900 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button
                type="submit"
                size="sm"
                data-testid="btn-submit-public-voice-search"
                className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-4 rounded-xl"
              >
                <Search className="size-3.5 mr-1" /> Search
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
