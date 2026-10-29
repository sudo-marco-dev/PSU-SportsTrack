import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  FileText,
  Building,
  Mail,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { PRIVACY_POLICY, TERMS_AND_CONDITIONS } from '@/data/legalContent';

export const LEGAL_ACCEPTANCE_STORAGE_KEY = 'psu_legal_acceptance_result';
export const REGISTER_DRAFT_STORAGE_KEY = 'psu_register_form_draft';

export const Legal: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAdmin, isCoach, isDev } = useAuth();

  const initialTab = searchParams.get('tab') === 'privacy' ? 'privacy' : 'terms';
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(initialTab);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
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

  const handleCloseOrReturn = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else if (user) {
      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else if (isCoach) {
        navigate('/coach', { replace: true });
      } else if (isDev) {
        navigate('/dev', { replace: true });
      } else {
        navigate('/player', { replace: true });
      }
    } else {
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="min-h-dvh w-full py-3 xs:py-4 sm:py-8 px-3 xs:px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 pb-20 lg:pb-8">
      {/* Compact Hero Showcase Header */}
      <div
        data-testid="legal-page-header"
        className="relative overflow-hidden rounded-xl sm:rounded-[2rem] bg-slate-950 border border-white/15 p-2.5 sm:p-6 md:p-8 text-white shadow-2xl"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-orange-500" />

        <div className="relative z-10 space-y-1.5 sm:space-y-3">
          <div className="flex items-center justify-between gap-1.5 sm:gap-2 min-w-0">
            <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-400 text-[9px] xs:text-[10px] sm:text-xs font-black uppercase tracking-wider min-w-0 shrink">
              <Building className="size-3 sm:size-3.5 shrink-0" />
              <span className="truncate">Palawan State University • Sports Department</span>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Back"
                onClick={handleCloseOrReturn}
                className="h-8 min-h-[32px] px-2.5 sm:px-3 rounded-lg sm:rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 text-[10px] sm:text-[11px] font-bold gap-1 sm:gap-1.5 cursor-pointer shrink-0"
              >
                <ArrowLeft className="size-3 sm:size-3.5 shrink-0" />
                <span>Back</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Close"
                onClick={handleCloseOrReturn}
                className="h-8 min-h-[32px] px-2.5 rounded-lg sm:rounded-xl border border-white/15 bg-white/5 hover:bg-orange-500 hover:border-orange-500 text-slate-200 hover:text-white text-[10px] sm:text-[11px] font-bold gap-1 cursor-pointer shrink-0"
              >
                <X className="size-3 sm:size-3.5 shrink-0" />
                <span>Close</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1 sm:gap-2">
            <div>
              <h1 className="text-xs sm:text-2xl md:text-3xl font-black italic uppercase tracking-tight text-white leading-tight">
                Official Legal &amp; <span className="text-orange-500">Governance Policies</span>
              </h1>
              {/* Explicit active section heading for screen readers & tests */}
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-orange-400 mt-0.5 sm:mt-1 flex items-center gap-1 sm:gap-1.5">
                {activeTab === 'terms' ? (
                  <>
                    <FileText className="size-3 sm:size-4 shrink-0" />
                    <span>Terms and Conditions</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-3 sm:size-4 shrink-0" />
                    <span>Privacy Policy</span>
                  </>
                )}
              </h2>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-slate-400 min-w-0">
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <span className="size-1.5 sm:size-2 rounded-full bg-emerald-500 shrink-0" />
                <span>
                  Effective: <strong>School Year 2026-2027</strong>
                </span>
              </div>
              <span className="text-white/20 shrink-0 hidden xs:inline">•</span>
              <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 truncate">
                <Mail className="size-3 sm:size-3.5 text-orange-400 shrink-0" />
                <span className="truncate">
                  <span className="hidden sm:inline">Contact: <strong>Janice G.</strong> (</span>
                  <a href="mailto:janiceno@psu.palawan.edu.ph" className="hover:underline text-slate-300">
                    janiceno@psu.palawan.edu.ph
                  </a>
                  <span className="hidden sm:inline">)</span>
                </span>
              </div>
            </div>
          </div>

          <p className="hidden sm:block text-slate-300 font-medium text-xs sm:text-sm leading-relaxed max-w-3xl">
            Review the official terms of service, acceptable use policies, and Philippine Data Privacy Act (RA 10173) compliance standards governing PSU SportsTrack.
          </p>
        </div>
      </div>

      {/* Tabs Switcher & Reading Container */}
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-lg mx-auto bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-white/15 p-1 rounded-2xl h-auto min-h-11 sm:min-h-12 shadow-sm">
            <TabsTrigger
              value="terms"
              className="rounded-xl text-[10px] xs:text-[11px] sm:text-xs font-black uppercase italic tracking-normal sm:tracking-wider flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 sm:px-2.5 py-1 sm:py-1.5 h-auto min-h-[38px] sm:min-h-10 data-[active]:bg-orange-500 data-[active]:text-white data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all cursor-pointer"
            >
              <FileText className="size-3.5 sm:size-4 shrink-0" />
              <span>Terms &amp; Conditions</span>
            </TabsTrigger>
            <TabsTrigger
              value="privacy"
              className="rounded-xl text-[10px] xs:text-[11px] sm:text-xs font-black uppercase italic tracking-normal sm:tracking-wider flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 sm:px-2.5 py-1 sm:py-1.5 h-auto min-h-[38px] sm:min-h-10 data-[active]:bg-orange-500 data-[active]:text-white data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all cursor-pointer"
            >
              <ShieldCheck className="size-3.5 sm:size-4 shrink-0" />
              <span>Privacy Policy</span>
            </TabsTrigger>
          </TabsList>

          <div
            ref={scrollContainerRef}
            data-testid="legal-scroll-container"
            className="rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-white/15 shadow-xl backdrop-blur-sm overflow-hidden"
          >
            {/* Terms and Conditions Content */}
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
                        <span>Terms &amp; Conditions Complete</span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Proceed to review the Privacy Policy and data protection commitments.
                      </p>
                    </div>
                    <Button
                      type="button"
                      data-testid="next-read-privacy-btn"
                      onClick={() => handleTabChange('privacy')}
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

                {/* Return or Switch to Terms at Bottom of Privacy */}
                <div className="pt-4 border-t border-slate-200 dark:border-white/15">
                  <div className="p-4 rounded-2xl bg-slate-950 text-white border border-emerald-500/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-lg">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-black uppercase tracking-wider">
                        <CheckCircle2 className="size-4 shrink-0" />
                        <span>Privacy Policy Complete</span>
                      </div>
                      <p className="text-xs text-slate-300">
                        You have reviewed the PSU SportsTrack Privacy Policy.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => handleTabChange('terms')}
                      className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs h-10 px-5 rounded-xl shrink-0 gap-2 cursor-pointer border border-white/10"
                    >
                      <span>Review Terms &amp; Conditions</span>
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};
