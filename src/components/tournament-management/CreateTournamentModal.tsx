import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trophy, Plus, Sparkles, CheckCircle2, AlertTriangle, Info, ShieldCheck } from 'lucide-react';
import { logAudit } from '@/lib/audit';
import { BINTURUNGAN_DEFAULT_SPORTS } from './types';

interface CreateTournamentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTournamentCreated: () => void;
}

export const CreateTournamentModal: React.FC<CreateTournamentModalProps> = ({
  isOpen,
  onOpenChange,
  onTournamentCreated,
}) => {
  const [creationMode, setCreationMode] = useState<'binturungan' | 'single'>('binturungan');
  const [selectedSports, setSelectedSports] = useState<string[]>(BINTURUNGAN_DEFAULT_SPORTS.map(s => s.name));
  const [eventName, setEventName] = useState('PSU Binturungan 2026');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [singleSport, setSingleSport] = useState('Basketball');
  const [singleType, setSingleType] = useState('Binturungan');
  const [enforceConflictOfInterest, setEnforceConflictOfInterest] = useState(true);
  const [isCreatingTournaments, setIsCreatingTournaments] = useState(false);

  const toggleSport = (sportName: string) => {
    setSelectedSports(prev =>
      prev.includes(sportName) ? prev.filter(s => s !== sportName) : [...prev, sportName]
    );
  };

  const handleCreateTournament = async () => {
    const trimmedName = eventName.trim();
    if (!trimmedName) {
      toast.error('Please specify the event master name.');
      return;
    }
    if (!startDate || !endDate) {
      toast.error('Please specify both kickoff and finals dates.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error('Kickoff date cannot be scheduled after the finals date.');
      return;
    }

    setIsCreatingTournaments(true);
    try {
      const proposedNames = creationMode === 'binturungan'
        ? selectedSports.map(sport => `${trimmedName} - ${sport}`)
        : [trimmedName];

      if (creationMode === 'binturungan' && selectedSports.length === 0) {
        toast.error('Please select at least one ballgame for the Binturungan event.');
        setIsCreatingTournaments(false);
        return;
      }

      const { data: existingTournaments, error: checkError } = await supabase
        .from('tournaments')
        .select('name');

      if (checkError) throw checkError;

      const existingNamesLower = new Set(
        (existingTournaments || []).map(t => t.name.trim().toLowerCase())
      );

      const duplicate = proposedNames.find(name => existingNamesLower.has(name.toLowerCase()));
      if (duplicate) {
        toast.error(`An event named "${duplicate}" already exists. Please choose a unique event name.`);
        setIsCreatingTournaments(false);
        return;
      }

      if (creationMode === 'binturungan') {
        const payloads = selectedSports.map(sport => ({
          name: `${trimmedName} - ${sport}`,
          sport: sport,
          type: 'Binturungan',
          status: 'Draft',
          start_date: startDate,
          end_date: endDate,
          enforce_conflict_of_interest: enforceConflictOfInterest,
        }));

        const { error } = await supabase.from('tournaments').insert(payloads);
        if (error) throw error;

        toast.success(`Successfully initialized ${selectedSports.length} Binturungan ballgame tournaments in Draft mode!`);
        
        logAudit({
          action: 'CREATE_TOURNAMENT',
          entity_type: 'tournaments',
          details: `Initialized Binturungan event "${trimmedName}" across ${selectedSports.length} ballgames (${selectedSports.join(', ')}) in Draft mode (COI Enforced: ${enforceConflictOfInterest})`
        });
      } else {
        const { error } = await supabase.from('tournaments').insert({
          name: trimmedName,
          sport: singleSport,
          type: singleType,
          status: 'Draft',
          start_date: startDate,
          end_date: endDate,
          enforce_conflict_of_interest: enforceConflictOfInterest,
        });

        if (error) throw error;
        toast.success(`Tournament "${trimmedName}" created in Draft mode.`);
        
        logAudit({
          action: 'CREATE_TOURNAMENT',
          entity_type: 'tournaments',
          details: `Created single tournament "${trimmedName}" (${singleSport} ballgame) in Draft mode (COI Enforced: ${enforceConflictOfInterest})`
        });
      }

      onOpenChange(false);
      setEventName('PSU Binturungan 2026');
      setStartDate('');
      setEndDate('');
      setSelectedSports(BINTURUNGAN_DEFAULT_SPORTS.map(s => s.name));
      onTournamentCreated();
    } catch (err: any) {
      toast.error('Error creating tournament(s): ' + err.message);
    } finally {
      setIsCreatingTournaments(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl max-w-[95vw] max-h-[88dvh] overflow-y-auto rounded-3xl border-slate-200 dark:border-white/10 p-6 shadow-2xl bg-white dark:bg-slate-950">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-orange-500 rounded-lg text-white shadow-sm shadow-orange-500/20">
                <Sparkles className="size-3.5" />
              </div>
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tight text-slate-900 dark:text-white">
                Host <span className="text-orange-500">Tournament</span>
              </DialogTitle>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-black uppercase tracking-wider border border-orange-500/20">
              Draft Phase
            </span>
          </div>
          <DialogDescription className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-widest">
            Initialized tournaments enter Draft status ("Coming Soon") for team enrollment.
          </DialogDescription>
        </DialogHeader>

        {/* Mode Selector */}
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl gap-1.5 border border-slate-200/60 dark:border-white/5 my-1">
          <button
            type="button"
            onClick={() => { setCreationMode('binturungan'); setEventName('PSU Binturungan 2026'); setSingleType('Binturungan'); }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase italic tracking-wider transition-all duration-150 cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 ${
              creationMode === 'binturungan' 
                ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20 scale-[1.01]' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'
            }`}
          >
            <Trophy className="size-3.5" /> One-Click Binturungan (All 9 Ballgames)
          </button>
          <button
            type="button"
            onClick={() => { setCreationMode('single'); setEventName('PSU Friendly Games'); setSingleType('Friendly'); }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase italic tracking-wider transition-all duration-150 cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 ${
              creationMode === 'single' 
                ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20 scale-[1.01]' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'
            }`}
          >
            <Plus className="size-3.5" /> Custom Single Ballgame
          </button>
        </div>

        <div className="space-y-3.5 py-1">
          {/* Event Name */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-[0.2em]">
                Event Master Name
              </Label>
              <span className="text-[9px] font-black uppercase tracking-widest text-orange-500">Unique Name</span>
            </div>
            <Input 
              placeholder="e.g., PSU Binturungan 2026" 
              value={eventName} 
              onChange={(e) => setEventName(e.target.value)} 
              className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 focus:ring-orange-500 rounded-xl font-bold text-sm text-slate-900 dark:text-white transition-all" 
            />
          </div>

          {creationMode === 'binturungan' ? (
            /* ===== BINTURUNGAN BALLGAMES CHECKLIST ===== */
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-[0.2em] flex items-center gap-1">
                  <CheckCircle2 className="size-3 text-orange-500" /> 
                  Ballgames Checklist
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[9px] font-black">
                    {selectedSports.length}/{BINTURUNGAN_DEFAULT_SPORTS.length}
                  </span>
                </Label>
                <div className="flex items-center gap-2">
                  <button 
                    type="button" 
                    onClick={() => setSelectedSports(BINTURUNGAN_DEFAULT_SPORTS.map(s => s.name))} 
                    className="text-[10px] font-black uppercase text-orange-500 hover:underline tracking-wider transition-colors cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <button 
                    type="button" 
                    onClick={() => setSelectedSports([])} 
                    className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 tracking-wider transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10">
                {BINTURUNGAN_DEFAULT_SPORTS.map((sport) => {
                  const isChecked = selectedSports.includes(sport.name);
                  const SportIcon = sport.icon;
                  return (
                    <button
                      type="button"
                      key={sport.name}
                      onClick={() => toggleSport(sport.name)}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-xl border text-left transition-all duration-150 cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                        isChecked 
                          ? 'bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-500/20 font-bold' 
                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300 hover:border-orange-500/40 hover:bg-orange-50/50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`size-5 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          isChecked ? 'bg-white/20 text-white' : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                        }`}>
                          <SportIcon className="size-3.5 stroke-[2.2]" />
                        </div>
                        <span className="text-xs truncate">{sport.name}</span>
                      </div>
                      {isChecked && <CheckCircle2 className="size-3.5 shrink-0 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ===== SINGLE BALLGAME SETUP ===== */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-[0.2em]">Ballgame Discipline</Label>
                <Select value={singleSport} onValueChange={(val) => setSingleSport(val ?? 'Basketball')}>
                  <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs text-slate-900 dark:text-white">
                    <SelectValue placeholder="Select ballgame..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl font-bold text-xs">
                    {BINTURUNGAN_DEFAULT_SPORTS.map(s => (
                      <SelectItem key={s.name} value={s.name}>{s.name} ({s.category})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-[0.2em]">Tournament Category</Label>
                <Select value={singleType} onValueChange={(val) => setSingleType(val ?? 'Binturungan')}>
                  <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs text-slate-900 dark:text-white">
                    <SelectValue placeholder="Select category...">
                      {singleType === 'Binturungan'
                        ? 'Binturungan (Tribal Fest)'
                        : singleType === 'Inter-Collegiate'
                        ? 'Inter-Collegiate League'
                        : singleType === 'Friendly'
                        ? 'Friendly Match'
                        : singleType === 'Faculty and Staff Friendly Games'
                        ? 'Faculty & Staff Friendly Games'
                        : singleType === 'STRASUC'
                        ? 'STRASUC Regional Meet'
                        : singleType}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl font-bold text-xs">
                    <SelectItem value="Binturungan">Binturungan (Tribal Fest)</SelectItem>
                    <SelectItem value="Inter-Collegiate">Inter-Collegiate League</SelectItem>
                    <SelectItem value="Friendly">Friendly Match</SelectItem>
                    <SelectItem value="Faculty and Staff Friendly Games">Faculty & Staff Friendly Games</SelectItem>
                    <SelectItem value="STRASUC">STRASUC Regional Meet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="space-y-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-[0.2em]">Kickoff Date</Label>
                <Input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs text-slate-900 dark:text-white" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-[0.2em]">Finals Date</Label>
                <Input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs text-slate-900 dark:text-white" 
                />
              </div>
            </div>
            {startDate && endDate && new Date(startDate) > new Date(endDate) && (
              <div className="flex items-center gap-1.5 text-red-500 text-[11px] font-bold px-1 pt-0.5 animate-in fade-in">
                <AlertTriangle className="size-3 shrink-0" />
                <span>Kickoff date cannot be after finals date.</span>
              </div>
            )}
          </div>

          {/* Conflict of Interest Policy Toggle */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-orange-500" />
                  <Label htmlFor="coi-toggle" className="text-xs font-black uppercase text-slate-900 dark:text-white cursor-pointer">
                    Enforce Conflict of Interest Rules
                  </Label>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Requires neutral scorekeepers. Toggle OFF if there is an institutional shortage of facilitators.
                </p>
              </div>
              <input
                id="coi-toggle"
                type="checkbox"
                checked={enforceConflictOfInterest}
                onChange={(e) => setEnforceConflictOfInterest(e.target.checked)}
                className="size-4 accent-orange-500 rounded cursor-pointer"
              />
            </div>
            {!enforceConflictOfInterest && (
              <div className="flex items-center gap-1.5 text-amber-500 text-[10px] font-bold bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                <AlertTriangle className="size-3 shrink-0" />
                <span>Facilitator Shortage Policy: Officials may preside over matches involving their own college without blocking.</span>
              </div>
            )}
          </div>

          {/* Status Notice */}
          <div className="py-2 px-3 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center gap-2">
            <Info className="size-4 text-orange-500 shrink-0" />
            <p className="text-[11px] text-orange-600 dark:text-orange-400 font-medium">
              Events launch in <strong>Draft Status ("Coming Soon")</strong>. Coaches can immediately enroll squads.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-3 border-t border-slate-100 dark:border-white/5">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)} 
            className="h-11 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
            disabled={isCreatingTournaments}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateTournament} 
            disabled={isCreatingTournaments}
            className="h-11 flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl font-black uppercase italic tracking-wider text-xs shadow-md shadow-orange-500/20 gap-2 transition-all active:scale-[0.98]"
          >
            {isCreatingTournaments ? (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
            ) : (
              <Trophy className="size-4" />
            )}
            {isCreatingTournaments ? 'Initializing Events...' : creationMode === 'binturungan' ? `Launch ${selectedSports.length} Binturungan Ballgames (Draft)` : 'Launch Ballgame Event (Draft)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
