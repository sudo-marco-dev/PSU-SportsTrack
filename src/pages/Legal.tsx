import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  FileText,
  Building,
  Mail,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Lock,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { PRIVACY_POLICY, TERMS_AND_CONDITIONS } from '@/data/legalContent';

export const LEGAL_ACCEPTANCE_STORAGE_KEY = 'psu_legal_acceptance_result';
export const REGISTER_DRAFT_STORAGE_KEY = 'psu_register_form_draft';

export const Legal: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialTab = searchParams.get('tab') === 'privacy' ? 'privacy' : 'terms';
  const mode = searchParams.get('mode'); // 'accept' | 'view' | null
  const fromSource = searchParams.get('from'); // 'register' | 'login-modal' | null
  const returnToParam = searchParams.get('returnTo');
  const isAcceptanceMode = mode === 'accept' || Boolean(fromSource);

  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(initialTab);
  const [termsProgress, setTermsProgress] = useState<number>(0);
  const [privacyProgress, setPrivacyProgress] = useState<number>(0);
  const [hasReadTerms, setHasReadTerms] = useState<boolean>(false);
  const [hasReadPrivacy, setHasReadPrivacy] = useState<boolean>(false);
  const [termsChecked, setTermsChecked] = useState<boolean>(false);
  const [privacyChecked, setPrivacyChecked] = useState<boolean>(false);
  const [isDrawerExpanded, setIsDrawerExpanded] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const computeCurrentTabProgress = useCallback((tab: 'privacy' | 'terms') => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const maxScroll = el.scrollHeight - el.clientHeight;
    let pct = 0;
    if (maxScroll > 20) {
      pct = Math.min(100, Math.max(0, Math.round((el.scrollTop / (maxScroll - 16)) * 100)));
    } else if (el.scrollHeight > 0 && el.clientHeight > 0 && maxScroll <= 20) {
      // Short content or ultra-tall display where the entire document fits inside the container without scrolling
      pct = 100;
    }

    if (tab === 'terms') {
      setTermsProgress((prev) => {
        const next = Math.max(prev, pct);
        if (next >= 98) {
          setHasReadTerms(true);
          return 100;
        }
        return next;
      });
      if (pct >= 98) {
        setHasReadTerms(true);
      }
    } else {
      setPrivacyProgress((prev) => {
        const next = Math.max(prev, pct);
        if (next >= 98) {
          setHasReadPrivacy(true);
          return 100;
        }
        return next;
      });
      if (pct >= 98) {
        setHasReadPrivacy(true);
      }
    }
  }, []);

  // Reset window and container scroll position to top when entering /legal, and mark draft as having visited /legal
  useEffect(() => {
    window.scrollTo(0, 0);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    try {
      const rawDraft = sessionStorage.getItem(REGISTER_DRAFT_STORAGE_KEY);
      if (rawDraft) {
        const parsed = JSON.parse(rawDraft);
        sessionStorage.setItem(
          REGISTER_DRAFT_STORAGE_KEY,
          JSON.stringify({
            ...parsed,
            visitedLegalPage: true,
          })
        );
      }
    } catch {
      // ignore storage error
    }
  }, []);

  useEffect(() => {
    const paramTab = searchParams.get('tab');
    if (paramTab === 'privacy' || paramTab === 'terms') {
      setActiveTab((prev) => {
        if (prev !== paramTab && scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
        return paramTab;
      });
    }
  }, [searchParams]);

  // Listen to resize and orientation events to keep scroll progress responsive across viewport changes
  useEffect(() => {
    const handleResize = () => {
      computeCurrentTabProgress(activeTab);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && scrollContainerRef.current) {
      observer = new ResizeObserver(() => {
        computeCurrentTabProgress(activeTab);
      });
      observer.observe(scrollContainerRef.current);
      if (scrollContainerRef.current.firstElementChild) {
        observer.observe(scrollContainerRef.current.firstElementChild);
      }
    }

    const timer = setTimeout(() => {
      computeCurrentTabProgress(activeTab);
    }, 80);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      observer?.disconnect();
      clearTimeout(timer);
    };
  }, [activeTab, computeCurrentTabProgress]);

  // Auto-expand sticky bottom drawer once both documents reach 100%
  useEffect(() => {
    if (hasReadTerms && hasReadPrivacy) {
      setIsDrawerExpanded(true);
    }
  }, [hasReadTerms, hasReadPrivacy]);

  const handleTabChange = (val: string) => {
    const nextTab = val as 'privacy' | 'terms';
    setActiveTab(nextTab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', nextTab);
    setSearchParams(nextParams, { replace: true });

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextToPrivacy = () => {
    setHasReadTerms(true);
    setTermsProgress(100);
    handleTabChange('privacy');
  };

  const getReturnDestination = () => {
    if (fromSource === 'register') {
      return '/register';
    }
    if (returnToParam) {
      return returnToParam;
    }
    try {
      const rawDraft = sessionStorage.getItem(REGISTER_DRAFT_STORAGE_KEY);
      if (rawDraft) {
        const parsed = JSON.parse(rawDraft);
        if (parsed.source === 'register') return '/register';
        if (parsed.returnTo) return parsed.returnTo;
      }
    } catch {
      // ignore storage parse error
    }
    return '/register';
  };

  const handleCloseOrReturn = () => {
    if (fromSource === 'login-modal') {
      sessionStorage.setItem(
        LEGAL_ACCEPTANCE_STORAGE_KEY,
        JSON.stringify({
          accepted: false,
          closedOnly: true,
          timestamp: null,
          from: 'login-modal',
          returnTo: returnToParam || '/',
        })
      );
      navigate(returnToParam || '/', { replace: true });
      return;
    }
    if (isAcceptanceMode) {
      navigate(getReturnDestination(), { replace: true });
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/register');
    }
  };

  const handleDecline = () => {
    const targetFrom = fromSource || 'register';
    sessionStorage.setItem(
      LEGAL_ACCEPTANCE_STORAGE_KEY,
      JSON.stringify({
        accepted: false,
        timestamp: null,
        from: targetFrom,
        returnTo: getReturnDestination(),
      })
    );
    try {
      const rawDraft = sessionStorage.getItem(REGISTER_DRAFT_STORAGE_KEY);
      if (rawDraft) {
        const parsed = JSON.parse(rawDraft);
        sessionStorage.setItem(
          REGISTER_DRAFT_STORAGE_KEY,
          JSON.stringify({
            ...parsed,
            termsAccepted: false,
            termsAcceptedAt: null,
            awaitingLegalReturn: targetFrom === 'login-modal',
          })
        );
      }
    } catch {
      // ignore storage error
    }
    toast.info('You must accept the Terms & Conditions and Privacy Policy to complete registration.');
    navigate(getReturnDestination(), { replace: true });
  };

  const handleAccept = () => {
    if (!hasReadTerms || !hasReadPrivacy || !termsChecked || !privacyChecked) return;
    const now = new Date().toISOString();
    const targetFrom = fromSource || 'register';

    sessionStorage.setItem(
      LEGAL_ACCEPTANCE_STORAGE_KEY,
      JSON.stringify({
        accepted: true,
        timestamp: now,
        from: targetFrom,
        returnTo: getReturnDestination(),
      })
    );

    try {
      const rawDraft = sessionStorage.getItem(REGISTER_DRAFT_STORAGE_KEY);
      if (rawDraft) {
        const parsed = JSON.parse(rawDraft);
        sessionStorage.setItem(
          REGISTER_DRAFT_STORAGE_KEY,
          JSON.stringify({
            ...parsed,
            termsAccepted: true,
            termsAcceptedAt: now,
            awaitingLegalReturn: targetFrom === 'login-modal',
          })
        );
      }
    } catch {
      // ignore storage error
    }

    navigate(getReturnDestination(), { replace: true });
  };

  return (
    <div className="min-h-dvh w-full py-3 xs:py-4 sm:py-8 px-3 xs:px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 pb-28 sm:pb-32">
      {/* Compact Hero Showcase Header */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-[2rem] bg-slate-950 border border-white/15 p-4 xs:p-5 sm:p-8 text-white shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-1 bg-orange-500" />

        <div className="relative z-10 space-y-2.5 sm:space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-400 text-[10px] sm:text-xs font-black uppercase tracking-widest">
              <Building className="size-3.5 shrink-0" />
              <span>Palawan State University • Sports Department</span>
            </div>

            <div className="flex items-center gap-2">
              {isAcceptanceMode && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCloseOrReturn}
                  className="h-8 px-3 rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 text-[11px] font-bold gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Back to Registration</span>
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Close"
                onClick={handleCloseOrReturn}
                className="h-8 px-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-orange-500 hover:border-orange-500 text-slate-200 hover:text-white text-[11px] font-bold gap-1 cursor-pointer"
              >
                <X className="size-3.5" />
                <span>Close</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <h1 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl font-black italic uppercase tracking-tight text-white leading-tight">
                Official Legal &amp; <span className="text-orange-500">Governance Policies</span>
              </h1>
              {/* Explicit active section heading for screen readers & tests */}
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-orange-400 mt-1 flex items-center gap-1.5">
                {activeTab === 'terms' ? (
                  <>
                    <FileText className="size-4 shrink-0" />
                    <span>Terms and Conditions</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4 shrink-0" />
                    <span>Privacy Policy</span>
                  </>
                )}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] sm:text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>
                  Effective: <strong>School Year 2026-2027</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="size-3.5 text-orange-400" />
                <span>
                  Contact: <strong>Janice G.</strong> (janiceno@psu.palawan.edu.ph)
                </span>
              </div>
            </div>
          </div>

          <p className="text-slate-300 font-medium text-xs sm:text-sm leading-relaxed max-w-3xl short:hidden">
            Review the official terms of service, acceptable use policies, and Philippine Data Privacy Act (RA 10173) compliance standards governing PSU SportsTrack.
          </p>
        </div>
      </div>

      {/* Tabs Switcher & Sequential Reading Container */}
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-lg mx-auto bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-white/15 p-1 rounded-2xl h-11 sm:h-12 shadow-sm">
            <TabsTrigger
              value="terms"
              className="rounded-xl text-[11px] xs:text-xs sm:text-sm font-black uppercase italic tracking-wider data-[active]:bg-orange-500 data-[active]:text-white data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all gap-1.5"
            >
              <FileText className="size-3.5 sm:size-4 shrink-0" />
              <span className="truncate">Terms &amp; Conditions</span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md shrink-0 ${
                  hasReadTerms
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    : 'bg-black/20 dark:bg-white/10 text-current'
                }`}
              >
                {hasReadTerms ? '100%' : `${termsProgress}%`}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="privacy"
              className="rounded-xl text-[11px] xs:text-xs sm:text-sm font-black uppercase italic tracking-wider data-[active]:bg-orange-500 data-[active]:text-white data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all gap-1.5"
            >
              <ShieldCheck className="size-3.5 sm:size-4 shrink-0" />
              <span className="truncate">Privacy Policy</span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md shrink-0 ${
                  hasReadPrivacy
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    : 'bg-black/20 dark:bg-white/10 text-current'
                }`}
              >
                {hasReadPrivacy ? '100%' : `${privacyProgress}%`}
              </span>
            </TabsTrigger>
          </TabsList>

          {/* Scrollable Document Area */}
          <div
            ref={scrollContainerRef}
            data-testid="legal-scroll-container"
            onScroll={() => computeCurrentTabProgress(activeTab)}
            className="mt-4 max-h-[62dvh] sm:max-h-[66dvh] overflow-y-auto rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 shadow-lg scrollbar-thin scrollbar-thumb-slate-400 dark:scrollbar-thumb-white/15"
          >
            {/* Terms & Conditions Content */}
            <TabsContent value="terms" className="m-0">
              <Card className="border-0 bg-transparent shadow-none rounded-none p-4 xs:p-5 sm:p-8 space-y-6">
                <div className="p-3.5 sm:p-4 rounded-xl bg-orange-500/10 border border-orange-500/25 text-slate-800 dark:text-orange-200 text-xs sm:text-sm space-y-1">
                  <div className="font-bold flex items-center gap-2 text-orange-600 dark:text-orange-400">
                    <CheckCircle2 className="size-4 shrink-0" />
                    Official Collegiate Platform Agreement
                  </div>
                  <p className="leading-relaxed text-slate-600 dark:text-slate-300 text-xs">
                    All athletes, coaches, match facilitators, and tournament administrators agree to abide by these Terms and university sports integrity rules.
                  </p>
                </div>

                {TERMS_AND_CONDITIONS.sections.map((section, idx) => (
                  <div key={idx} className="space-y-2.5 border-t border-slate-200 dark:border-white/10 pt-5 first:border-t-0 first:pt-0">
                    <h3 className="text-sm xs:text-base sm:text-lg font-black italic uppercase tracking-tight text-slate-900 dark:text-white">
                      {section.title}
                    </h3>
                    <div className="space-y-2 text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-normal leading-relaxed">
                      {section.content.map((p, pIdx) => (
                        <p key={pIdx}>{p}</p>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Step 1 -> Step 2 Guided Action Card at Bottom of Terms */}
                <div className="pt-4 border-t border-slate-200 dark:border-white/15">
                  <div className="p-4 rounded-2xl bg-slate-950 text-white border border-orange-500/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-lg">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-orange-400 text-xs font-black uppercase tracking-wider">
                        <CheckCircle2 className="size-4 shrink-0" />
                        <span>Step 1 of 2 • Terms &amp; Conditions</span>
                      </div>
                      <p className="text-xs text-slate-300">
                        You have reached the end of the Terms &amp; Conditions. Continue to Step 2 to read the Privacy Policy.
                      </p>
                    </div>
                    <Button
                      type="button"
                      data-testid="next-read-privacy-btn"
                      onClick={handleNextToPrivacy}
                      className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider text-xs h-10 px-5 rounded-xl shrink-0 gap-2 cursor-pointer shadow-md shadow-orange-500/25"
                    >
                      <span>Next: Read Privacy Policy</span>
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Privacy Policy Content */}
            <TabsContent value="privacy" className="m-0">
              <Card className="border-0 bg-transparent shadow-none rounded-none p-4 xs:p-5 sm:p-8 space-y-6">
                <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-slate-800 dark:text-emerald-200 text-xs sm:text-sm space-y-1">
                  <div className="font-bold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="size-4 shrink-0" />
                    Philippine Data Privacy Act of 2012 (RA 10173) Statement
                  </div>
                  <p className="leading-relaxed text-slate-600 dark:text-slate-300 text-xs">
                    This policy outlines how personal details and athletic credentials are processed securely on PSU SportsTrack. Data is strictly utilized for official university athletic operations.
                  </p>
                </div>

                {PRIVACY_POLICY.sections.map((section, idx) => (
                  <div key={idx} className="space-y-2.5 border-t border-slate-200 dark:border-white/10 pt-5 first:border-t-0 first:pt-0">
                    <h3 className="text-sm xs:text-base sm:text-lg font-black italic uppercase tracking-tight text-slate-900 dark:text-white">
                      {section.title}
                    </h3>

                    <div className="space-y-2 text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-normal leading-relaxed">
                      {section.content.map((p, pIdx) => (
                        <p key={pIdx}>{p}</p>
                      ))}
                    </div>

                    {section.table && (
                      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-950/60 p-1">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-white/10 text-orange-600 dark:text-orange-400 font-black uppercase tracking-wider">
                              {section.table.headers.map((h, hIdx) => (
                                <th key={hIdx} className="p-2.5 sm:p-3">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-slate-700 dark:text-slate-300">
                            {section.table.rows.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-slate-100/50 dark:hover:bg-white/5">
                                {row.map((cell, cIdx) => (
                                  <td key={cIdx} className="p-2.5 sm:p-3 align-top leading-relaxed">
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

                {/* End of Privacy Policy Confirmation Banner */}
                <div className="pt-4 border-t border-slate-200 dark:border-white/15">
                  <div className="p-4 rounded-2xl bg-slate-950 text-white border border-emerald-500/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-black uppercase tracking-wider">
                        <CheckCircle2 className="size-4 shrink-0" />
                        <span>Step 2 of 2 • Privacy Policy Reviewed</span>
                      </div>
                      <p className="text-xs text-slate-300">
                        {hasReadTerms
                          ? 'Both documents have been reviewed. Check the boxes in the bottom bar to accept and return to registration.'
                          : 'You have reached the end of the Privacy Policy. Please also scroll through the Terms & Conditions tab to unlock acceptance.'}
                      </p>
                    </div>
                    {!hasReadTerms && (
                      <Button
                        type="button"
                        onClick={() => handleTabChange('terms')}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider text-xs h-10 px-4 rounded-xl shrink-0 cursor-pointer"
                      >
                        Read Terms &amp; Conditions
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Adaptive Collapsible Sticky Bottom Bar */}
      <div
        data-testid="legal-sticky-bottom-bar"
        className="fixed bottom-0 left-0 right-0 z-[60] bg-slate-950/95 backdrop-blur-xl border-t border-white/15 text-white shadow-[0_-10px_30px_rgba(0,0,0,0.6)] transition-all duration-300 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="max-w-5xl mx-auto px-3 xs:px-4 sm:px-6">
          {/* Slim Top Status Row (~52px) */}
          <div className="h-[52px] flex items-center justify-between gap-1.5 sm:gap-2 flex-nowrap">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 overflow-x-auto scrollbar-hide">
              <button
                type="button"
                onClick={() => handleTabChange('terms')}
                className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg font-bold text-[10px] xs:text-[11px] transition-colors cursor-pointer border whitespace-nowrap shrink-0 ${
                  hasReadTerms
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : activeTab === 'terms'
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                    : 'bg-white/5 text-slate-300 border-white/15'
                }`}
              >
                {hasReadTerms ? <CheckCircle2 className="size-3 text-emerald-400 shrink-0" /> : <Lock className="size-3 text-orange-400 shrink-0" />}
                <span>Terms: {hasReadTerms ? '100%' : `${termsProgress}%`}</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('privacy')}
                className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg font-bold text-[10px] xs:text-[11px] transition-colors cursor-pointer border whitespace-nowrap shrink-0 ${
                  hasReadPrivacy
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : activeTab === 'privacy'
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                    : 'bg-white/5 text-slate-300 border-white/15'
                }`}
              >
                {hasReadPrivacy ? <CheckCircle2 className="size-3 text-emerald-400 shrink-0" /> : <Lock className="size-3 text-orange-400 shrink-0" />}
                <span>Privacy: {hasReadPrivacy ? '100%' : `${privacyProgress}%`}</span>
              </button>

              <span className="text-[11px] text-slate-300 font-medium hidden md:inline truncate">
                {hasReadTerms && hasReadPrivacy
                  ? 'Unlocked — Check both boxes below to accept'
                  : 'Scroll to bottom to unlock'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                data-testid="toggle-legal-drawer-btn"
                onClick={() => setIsDrawerExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-[10px] xs:text-[11px] font-black uppercase tracking-wider text-orange-400 cursor-pointer transition-colors whitespace-nowrap"
              >
                <span>{isDrawerExpanded ? 'Minimize' : 'Review & Accept'}</span>
                {isDrawerExpanded ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronUp className="size-3.5 shrink-0" />}
              </button>
            </div>
          </div>

          {/* Expandable Checkboxes & Action Drawer */}
          {isDrawerExpanded && (
            <div className="pb-3.5 pt-2 border-t border-white/10 space-y-3 animate-in slide-in-from-bottom-2 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {/* Terms Checkbox Card */}
                <label
                  htmlFor="legal-page-terms-checkbox"
                  className={`flex items-start gap-2.5 p-2.5 sm:p-3 rounded-xl border text-xs select-none transition-colors ${
                    hasReadTerms
                      ? 'bg-slate-900 border-white/20 cursor-pointer hover:border-orange-500/50'
                      : 'bg-slate-900/50 border-white/10 opacity-75 cursor-not-allowed'
                  }`}
                >
                  <Checkbox
                    id="legal-page-terms-checkbox"
                    data-testid="legal-terms-checkbox"
                    disabled={!hasReadTerms}
                    checked={termsChecked}
                    onCheckedChange={(c) => {
                      if (hasReadTerms) setTermsChecked(Boolean(c));
                    }}
                    className="mt-0.5 border-orange-400 data-[checked]:bg-orange-500 data-[checked]:border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  />
                  <div className="space-y-1 min-w-0 flex-1">
                    <span className="text-slate-200 leading-snug block text-[11px] sm:text-xs">
                      I have read, understood, and agree to the <strong>Terms and Conditions</strong> of Palawan State University SportsTrack.
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                        hasReadTerms ? 'text-emerald-400' : 'text-orange-400'
                      }`}
                    >
                      {hasReadTerms ? (
                        <>
                          <CheckCircle2 className="size-3" />
                          <span>Unlocked (100% Read)</span>
                        </>
                      ) : (
                        <>
                          <Lock className="size-3" />
                          <span>Scroll Terms &amp; Conditions to 100% to unlock ({termsProgress}%)</span>
                        </>
                      )}
                    </span>
                  </div>
                </label>

                {/* Privacy Checkbox Card */}
                <label
                  htmlFor="legal-page-privacy-checkbox"
                  className={`flex items-start gap-2.5 p-2.5 sm:p-3 rounded-xl border text-xs select-none transition-colors ${
                    hasReadPrivacy
                      ? 'bg-slate-900 border-white/20 cursor-pointer hover:border-orange-500/50'
                      : 'bg-slate-900/50 border-white/10 opacity-75 cursor-not-allowed'
                  }`}
                >
                  <Checkbox
                    id="legal-page-privacy-checkbox"
                    data-testid="legal-privacy-checkbox"
                    disabled={!hasReadPrivacy}
                    checked={privacyChecked}
                    onCheckedChange={(c) => {
                      if (hasReadPrivacy) setPrivacyChecked(Boolean(c));
                    }}
                    className="mt-0.5 border-orange-400 data-[checked]:bg-orange-500 data-[checked]:border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  />
                  <div className="space-y-1 min-w-0 flex-1">
                    <span className="text-slate-200 leading-snug block text-[11px] sm:text-xs">
                      I have read, understood, and agree to the <strong>Privacy Policy</strong> in accordance with Philippine RA 10173 (Data Privacy Act of 2012).
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                        hasReadPrivacy ? 'text-emerald-400' : 'text-orange-400'
                      }`}
                    >
                      {hasReadPrivacy ? (
                        <>
                          <CheckCircle2 className="size-3" />
                          <span>Unlocked (100% Read)</span>
                        </>
                      ) : (
                        <>
                          <Lock className="size-3" />
                          <span>Scroll Privacy Policy to 100% to unlock ({privacyProgress}%)</span>
                        </>
                      )}
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  data-testid="legal-decline-btn"
                  onClick={handleDecline}
                  className="border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs h-10 px-4 rounded-xl cursor-pointer"
                >
                  Decline &amp; Cancel
                </Button>

                <Button
                  type="button"
                  data-testid="legal-accept-btn"
                  disabled={!hasReadTerms || !hasReadPrivacy || !termsChecked || !privacyChecked}
                  onClick={handleAccept}
                  className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black uppercase italic tracking-wider text-xs h-10 px-6 rounded-xl cursor-pointer shadow-lg shadow-orange-500/25 transition-all"
                >
                  Accept &amp; Return to Registration
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

