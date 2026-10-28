import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ShieldCheck,
  FileText,
  CheckCircle2,
  Building,
  Mail,
  ArrowRight,
  ExternalLink,
  Lock,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { PRIVACY_POLICY, TERMS_AND_CONDITIONS } from '@/data/legalContent';

interface LegalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'privacy' | 'terms';
  mandatoryAcceptance?: boolean;
  onAccept?: (timestamp: string) => void;
  onDecline?: () => void;
  onReadFullPage?: (tab: 'privacy' | 'terms') => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  open,
  onOpenChange,
  defaultTab = 'terms',
  mandatoryAcceptance = false,
  onAccept,
  onDecline,
  onReadFullPage,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(defaultTab);
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [termsProgress, setTermsProgress] = useState(0);
  const [privacyProgress, setPrivacyProgress] = useState(0);
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [hasReadPrivacy, setHasReadPrivacy] = useState(false);
  const [isFooterExpanded, setIsFooterExpanded] = useState(true);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const evaluateScrollProgress = useCallback((tab: 'privacy' | 'terms') => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const maxScroll = el.scrollHeight - el.clientHeight;
    let pct = 0;
    if (maxScroll <= 24) {
      pct = 100;
    } else {
      pct = Math.min(100, Math.max(0, Math.round((el.scrollTop / (maxScroll - 16)) * 100)));
    }

    if (tab === 'terms') {
      setTermsProgress((prev) => Math.max(prev, pct));
      if (pct >= 98) {
        setHasReadTerms(true);
      }
    } else {
      setPrivacyProgress((prev) => Math.max(prev, pct));
      if (pct >= 98) {
        setHasReadPrivacy(true);
      }
    }
  }, []);

  useEffect(() => {
    if (open) {
      const initial = defaultTab || 'terms';
      setActiveTab(initial);
      if (mandatoryAcceptance) {
        setTermsChecked(false);
        setPrivacyChecked(false);
        setTermsProgress(0);
        setPrivacyProgress(0);
        setHasReadTerms(false);
        setHasReadPrivacy(false);
        setIsFooterExpanded(true);
      }
    }
  }, [open, defaultTab, mandatoryAcceptance]);

  useEffect(() => {
    if (!open) return;
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = 0;
    }

    const handleResize = () => {
      evaluateScrollProgress(activeTab);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && el) {
      observer = new ResizeObserver(() => {
        evaluateScrollProgress(activeTab);
      });
      observer.observe(el);
      if (el.firstElementChild) {
        observer.observe(el.firstElementChild);
      }
    }

    const timer = setTimeout(() => {
      evaluateScrollProgress(activeTab);
    }, 60);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      observer?.disconnect();
      clearTimeout(timer);
    };
  }, [open, activeTab, evaluateScrollProgress]);

  useEffect(() => {
    if (hasReadTerms && hasReadPrivacy) {
      setIsFooterExpanded(true);
    }
  }, [hasReadTerms, hasReadPrivacy]);

  const handleGoToPrivacyStep = () => {
    setHasReadTerms(true);
    setTermsProgress(100);
    setActiveTab('privacy');
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  const handleOpenFullPage = () => {
    if (onReadFullPage) {
      onReadFullPage(activeTab);
      return;
    }
    onOpenChange(false);
    navigate(`/legal?mode=${mandatoryAcceptance ? 'accept' : 'view'}&tab=${activeTab}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] sm:max-w-2xl lg:max-w-3xl rounded-2xl sm:rounded-3xl p-3.5 xs:p-4 sm:p-6 bg-slate-950 text-white border border-white/15 max-h-[90dvh] short:max-h-[94dvh] flex flex-col gap-2.5 sm:gap-3">
        {/* Compact Header (with pr-9 so Effective badge never overlaps DialogClose X button) */}
        <div className="shrink-0 space-y-2 pb-2.5 border-b border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-1.5 pr-9 sm:pr-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-400 text-[9px] xs:text-[10px] font-black uppercase tracking-widest max-w-full">
              <Building className="size-3 shrink-0" />
              <span className="truncate">Palawan State University • Sports Department</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                Effective: SY 2026-2027
              </span>
              <button
                type="button"
                onClick={handleOpenFullPage}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-400 hover:text-orange-300 underline underline-offset-2 cursor-pointer whitespace-nowrap"
              >
                <ExternalLink className="size-3" />
                <span>Read on Full Page</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle className="text-lg xs:text-xl sm:text-2xl font-black italic uppercase tracking-tight text-white flex items-center gap-2 leading-tight">
              {activeTab === 'terms' ? (
                <>
                  <FileText className="size-4 sm:size-5 text-orange-500 shrink-0" />
                  <span>Terms and Conditions</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="size-4 sm:size-5 text-orange-500 shrink-0" />
                  <span>Privacy Policy</span>
                </>
              )}
            </DialogTitle>
          </div>

          <DialogDescription className="text-slate-400 text-[11px] sm:text-xs font-normal leading-snug short:hidden">
            Official collegiate sports governance, data handling, and platform terms for PSU SportsTrack.
          </DialogDescription>

          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'privacy' | 'terms')}
            className="w-full pt-0.5"
          >
            <TabsList className="grid w-full grid-cols-2 bg-slate-900 border border-white/15 p-1 rounded-xl h-auto min-h-10 sm:min-h-11">
              <TabsTrigger
                value="terms"
                className="rounded-lg text-[10px] xs:text-[11px] sm:text-xs font-bold text-slate-300 data-[active]:bg-orange-500 data-[active]:text-white data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 xs:px-1.5 sm:px-2.5 py-1 sm:py-1.5 h-auto min-h-[36px] sm:min-h-[40px] leading-tight whitespace-normal sm:whitespace-nowrap cursor-pointer"
              >
                <div className="flex items-center justify-center gap-1 sm:gap-1.5 min-w-0">
                  <FileText className="size-3.5 shrink-0" />
                  <span className="whitespace-normal sm:whitespace-nowrap text-center">Terms &amp; Conditions</span>
                </div>
                {mandatoryAcceptance && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/30 text-white/90 shrink-0">
                    {hasReadTerms ? '100%' : `${termsProgress}%`}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="privacy"
                className="rounded-lg text-[10px] xs:text-[11px] sm:text-xs font-bold text-slate-300 data-[active]:bg-orange-500 data-[active]:text-white data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 xs:px-1.5 sm:px-2.5 py-1 sm:py-1.5 h-auto min-h-[36px] sm:min-h-[40px] leading-tight whitespace-normal sm:whitespace-nowrap cursor-pointer"
              >
                <div className="flex items-center justify-center gap-1 sm:gap-1.5 min-w-0">
                  <ShieldCheck className="size-3.5 shrink-0" />
                  <span className="whitespace-normal sm:whitespace-nowrap text-center">Privacy Policy</span>
                </div>
                {mandatoryAcceptance && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/30 text-white/90 shrink-0">
                    {hasReadPrivacy ? '100%' : `${privacyProgress}%`}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Scrollable Content */}
        <div
          ref={scrollContainerRef}
          onScroll={() => evaluateScrollProgress(activeTab)}
          className="flex-1 min-h-[160px] overflow-y-auto pr-1 py-2.5 sm:py-3 space-y-5 text-xs sm:text-sm text-slate-300 leading-relaxed scrollbar-thin scrollbar-thumb-white/15"
        >
          {activeTab === 'terms' ? (
            <div className="space-y-5">
              <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/25 text-orange-200 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-orange-400">
                  <CheckCircle2 className="size-4 shrink-0" />
                  Official Collegiate Platform Agreement
                </div>
                <p className="text-[11px] leading-relaxed">
                  By registering or accessing PSU SportsTrack, participants and spectators agree to comply with PSU Sports Department rules, athletic integrity standards, and university policies.
                </p>
              </div>

              {TERMS_AND_CONDITIONS.sections.map((section, idx) => (
                <div key={idx} className="space-y-1.5 border-t border-white/10 pt-3.5 first:border-t-0 first:pt-0">
                  <h4 className="text-xs sm:text-sm font-black italic uppercase tracking-tight text-white">
                    {section.title}
                  </h4>
                  <div className="space-y-1.5 text-slate-300 font-normal">
                    {section.content.map((p, pIdx) => (
                      <p key={pIdx} className="leading-relaxed">
                        {p}
                      </p>
                    ))}
                  </div>
                </div>
              ))}

              {/* Guided Sequential Step 1 -> Step 2 Action at the bottom of Terms */}
              <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-900/90 border border-orange-500/30">
                <div className="text-[11px] text-slate-300">
                  <span className="font-black uppercase text-orange-400 block">
                    Step 1 Complete • Terms &amp; Conditions Reviewed
                  </span>
                  <span>Proceed to read the Privacy Policy to unlock full registration acceptance.</span>
                </div>
                <Button
                  type="button"
                  onClick={handleGoToPrivacyStep}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider text-[11px] h-9 px-4 rounded-xl shrink-0 gap-1.5 cursor-pointer"
                >
                  <span>Next: Read Privacy Policy</span>
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-200 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-400">
                  <ShieldCheck className="size-4 shrink-0" />
                  Philippine Data Privacy Act of 2012 (RA 10173) Compliance
                </div>
                <p className="text-[11px] leading-relaxed">
                  Your personal records are collected strictly for legitimate tournament governance, eligibility verification, and match operations. Data is not sold or used for commercial marketing.
                </p>
              </div>

              {PRIVACY_POLICY.sections.map((section, idx) => (
                <div key={idx} className="space-y-1.5 border-t border-white/10 pt-3.5 first:border-t-0 first:pt-0">
                  <h4 className="text-xs sm:text-sm font-black italic uppercase tracking-tight text-white">
                    {section.title}
                  </h4>

                  <div className="space-y-1.5 text-slate-300 font-normal">
                    {section.content.map((p, pIdx) => (
                      <p key={pIdx} className="leading-relaxed">
                        {p}
                      </p>
                    ))}
                  </div>

                  {section.table && (
                    <div className="mt-2.5 overflow-x-auto rounded-xl border border-white/15 bg-slate-900/60 p-1">
                      <table className="w-full text-left text-[11px] sm:text-xs">
                        <thead>
                          <tr className="border-b border-white/10 text-orange-400 font-black uppercase tracking-wider">
                            {section.table.headers.map((h, hIdx) => (
                              <th key={hIdx} className="p-2 sm:p-2.5">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300">
                          {section.table.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-white/5">
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="p-2 sm:p-2.5 align-top">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {mandatoryAcceptance ? (
          <div className="shrink-0 pt-2 border-t border-white/15 space-y-2">
            {/* Slim Progress Bar & Collapsible Drawer Header */}
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/95 border border-white/15 text-[11px]">
              <div className="flex items-center flex-wrap gap-2 min-w-0">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] ${
                    hasReadTerms || termsChecked
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-white/5 text-slate-300 border border-white/10'
                  }`}
                >
                  {hasReadTerms || termsChecked ? <CheckCircle2 className="size-3 text-emerald-400" /> : <Lock className="size-3 text-orange-400" />}
                  Terms: {hasReadTerms || termsChecked ? '100%' : `${termsProgress}%`}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] ${
                    hasReadPrivacy || privacyChecked
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-white/5 text-slate-300 border border-white/10'
                  }`}
                >
                  {hasReadPrivacy || privacyChecked ? <CheckCircle2 className="size-3 text-emerald-400" /> : <Lock className="size-3 text-orange-400" />}
                  Privacy: {hasReadPrivacy || privacyChecked ? '100%' : `${privacyProgress}%`}
                </span>
                <span className="text-[10px] text-slate-400 hidden sm:inline">
                  {hasReadTerms && hasReadPrivacy
                    ? 'Both documents read — check boxes below to accept'
                    : 'Scroll to bottom to unlock'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsFooterExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-400 hover:text-orange-300 cursor-pointer shrink-0"
              >
                <span>{isFooterExpanded ? 'Compact' : 'Expand'}</span>
                {isFooterExpanded ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
              </button>
            </div>

            {isFooterExpanded && (
              <div className="space-y-2.5 animate-in fade-in duration-200">
                <div className="p-2.5 sm:p-3.5 rounded-2xl bg-slate-900 border border-white/15 space-y-2">
                  <label
                    onClick={() => {
                      if (!hasReadTerms) {
                        setHasReadTerms(true);
                        setTermsProgress(100);
                      }
                    }}
                    className="flex items-start gap-2.5 cursor-pointer text-[11px] sm:text-xs select-none"
                  >
                    <Checkbox
                      checked={termsChecked}
                      onCheckedChange={(c) => {
                        setHasReadTerms(true);
                        setTermsProgress(100);
                        setTermsChecked(Boolean(c));
                      }}
                      className="mt-0.5 border-orange-400 data-[checked]:bg-orange-500 data-[checked]:border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                    />
                    <span className="text-slate-200 leading-snug">
                      I have read, understood, and agree to the <strong>Terms and Conditions</strong> of Palawan State University SportsTrack.
                    </span>
                  </label>
                  <label
                    onClick={() => {
                      if (!hasReadPrivacy) {
                        setHasReadPrivacy(true);
                        setPrivacyProgress(100);
                      }
                    }}
                    className="flex items-start gap-2.5 cursor-pointer text-[11px] sm:text-xs select-none"
                  >
                    <Checkbox
                      checked={privacyChecked}
                      onCheckedChange={(c) => {
                        setHasReadPrivacy(true);
                        setPrivacyProgress(100);
                        setPrivacyChecked(Boolean(c));
                      }}
                      className="mt-0.5 border-orange-400 data-[checked]:bg-orange-500 data-[checked]:border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                    />
                    <span className="text-slate-200 leading-snug">
                      I have read, understood, and agree to the <strong>Privacy Policy</strong> in accordance with Philippine RA 10173 (Data Privacy Act of 2012).
                    </span>
                  </label>
                </div>

                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      onDecline?.();
                      onOpenChange(false);
                    }}
                    className="border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs h-9 sm:h-10 px-4 rounded-xl cursor-pointer"
                  >
                    Decline &amp; Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={!termsChecked || !privacyChecked}
                    onClick={() => {
                      const now = new Date().toISOString();
                      onAccept?.(now);
                      onOpenChange(false);
                    }}
                    className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black uppercase italic tracking-wider text-xs h-9 sm:h-10 px-5 rounded-xl cursor-pointer shadow-lg shadow-orange-500/25 transition-all"
                  >
                    Accept &amp; Continue Registration
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="shrink-0 pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Mail className="size-3.5 text-orange-500 shrink-0" />
              <span className="text-[11px] sm:text-xs">
                Contact: <strong>Janice G.</strong> (janiceno@psu.palawan.edu.ph)
              </span>
            </div>
            <Button
              onClick={() => onOpenChange(false)}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs h-9 px-5 rounded-xl cursor-pointer shadow-md shadow-orange-500/20"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

