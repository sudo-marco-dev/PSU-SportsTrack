import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, FileText, Building, Mail, CheckCircle2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { PRIVACY_POLICY, TERMS_AND_CONDITIONS } from '@/data/legalContent';

export const Legal: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'privacy' ? 'privacy' : 'terms';
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(initialTab);

  const handleTabChange = (val: string) => {
    const nextTab = val as 'privacy' | 'terms';
    setActiveTab(nextTab);
    setSearchParams({ tab: nextTab }, { replace: true });
  };

  return (
    <div className="min-h-full w-full py-6 sm:py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Hero Showcase Header */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-[2.5rem] bg-slate-950 border border-white/10 p-6 sm:p-10 text-white shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-1 bg-orange-500" />

        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] sm:text-xs font-black uppercase tracking-widest">
            <Building className="size-3.5" />
            <span>Palawan State University • Sports Department</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black italic uppercase tracking-tight text-white leading-tight">
            Official Legal &amp; <span className="text-orange-500">Governance Policies</span>
          </h1>

          <p className="text-slate-300 font-medium text-xs sm:text-sm lg:text-base leading-relaxed">
            Review the official terms of service, acceptable use policies, and Philippine Data Privacy Act (RA 10173) compliance standards governing PSU SportsTrack.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span>Effective: <strong>School Year 2026-2027</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Mail className="size-3.5 text-orange-400" />
              <span>DPO Contact: <strong>janiceno@psu.palawan.edu.ph</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-white/10 p-1.5 rounded-2xl h-12 shadow-sm">
            <TabsTrigger
              value="terms"
              className="rounded-xl text-xs sm:text-sm font-black uppercase italic tracking-wider data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all gap-2"
            >
              <FileText className="size-4" />
              Terms and Conditions
            </TabsTrigger>
            <TabsTrigger
              value="privacy"
              className="rounded-xl text-xs sm:text-sm font-black uppercase italic tracking-wider data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all gap-2"
            >
              <ShieldCheck className="size-4" />
              Privacy Policy
            </TabsTrigger>
          </TabsList>

          {/* Terms & Conditions Content */}
          <TabsContent value="terms" className="mt-8 space-y-6">
            <Card className="border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-md rounded-2xl p-6 sm:p-8 space-y-8">
              <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-slate-800 dark:text-orange-200 text-xs sm:text-sm space-y-1">
                <div className="font-bold flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <CheckCircle2 className="size-4 shrink-0" />
                  PSU SportsTrack Platform Agreement
                </div>
                <p className="leading-relaxed text-slate-600 dark:text-slate-300 text-xs">
                  All athletes, coaches, match facilitators, and tournament administrators agree to abide by these Terms and university sports integrity rules.
                </p>
              </div>

              {TERMS_AND_CONDITIONS.sections.map((section, idx) => (
                <div key={idx} className="space-y-3 border-t border-slate-200 dark:border-white/10 pt-6 first:border-t-0 first:pt-0">
                  <h3 className="text-base sm:text-lg font-black italic uppercase tracking-tight text-slate-900 dark:text-white">
                    {section.title}
                  </h3>
                  <div className="space-y-2 text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-normal leading-relaxed">
                    {section.content.map((p, pIdx) => (
                      <p key={pIdx}>{p}</p>
                    ))}
                  </div>
                </div>
              ))}
            </Card>
          </TabsContent>

          {/* Privacy Policy Content */}
          <TabsContent value="privacy" className="mt-8 space-y-6">
            <Card className="border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-md rounded-2xl p-6 sm:p-8 space-y-8">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-slate-800 dark:text-emerald-200 text-xs sm:text-sm space-y-1">
                <div className="font-bold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="size-4 shrink-0" />
                  Philippine Data Privacy Act of 2012 (RA 10173) Statement
                </div>
                <p className="leading-relaxed text-slate-600 dark:text-slate-300 text-xs">
                  This policy outlines how personal details and athletic credentials are processed securely on PSU SportsTrack. Data is strictly utilized for official university athletic operations.
                </p>
              </div>

              {PRIVACY_POLICY.sections.map((section, idx) => (
                <div key={idx} className="space-y-3 border-t border-slate-200 dark:border-white/10 pt-6 first:border-t-0 first:pt-0">
                  <h3 className="text-base sm:text-lg font-black italic uppercase tracking-tight text-slate-900 dark:text-white">
                    {section.title}
                  </h3>

                  <div className="space-y-2 text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-normal leading-relaxed">
                    {section.content.map((p, pIdx) => (
                      <p key={pIdx}>{p}</p>
                    ))}
                  </div>

                  {section.table && (
                    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/50 p-1">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-white/10 text-orange-600 dark:text-orange-400 font-black uppercase tracking-wider">
                            {section.table.headers.map((h, hIdx) => (
                              <th key={hIdx} className="p-3">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-slate-700 dark:text-slate-300">
                          {section.table.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-100/50 dark:hover:bg-white/5">
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="p-3 align-top leading-relaxed">
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
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
