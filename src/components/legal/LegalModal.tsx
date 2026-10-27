import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldCheck, FileText, CheckCircle2, Building, Mail } from 'lucide-react';
import { PRIVACY_POLICY, TERMS_AND_CONDITIONS } from '@/data/legalContent';

interface LegalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'privacy' | 'terms';
  mandatoryAcceptance?: boolean;
  onAccept?: (timestamp: string) => void;
  onDecline?: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  open,
  onOpenChange,
  defaultTab = 'terms',
  mandatoryAcceptance = false,
  onAccept,
  onDecline,
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(defaultTab);
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);

  useEffect(() => {
    if (open) {
      if (defaultTab) {
        setActiveTab(defaultTab);
      }
      if (mandatoryAcceptance) {
        setTermsChecked(false);
        setPrivacyChecked(false);
      }
    }
  }, [open, defaultTab, mandatoryAcceptance]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl lg:max-w-3xl rounded-2xl sm:rounded-3xl p-5 sm:p-7 bg-slate-950 text-white border border-white/10 max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="shrink-0 space-y-3 pb-3 border-b border-white/10">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-black uppercase tracking-widest">
              <Building className="size-3" />
              <span>Palawan State University • Sports Department</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Effective: SY 2026-2027</span>
          </div>

          <DialogTitle className="text-xl sm:text-2xl font-black italic uppercase tracking-tight text-white flex items-center gap-2">
            {activeTab === 'terms' ? (
              <>
                <FileText className="size-5 text-orange-500 shrink-0" />
                <span>Terms and Conditions</span>
              </>
            ) : (
              <>
                <ShieldCheck className="size-5 text-orange-500 shrink-0" />
                <span>Privacy Policy</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs font-normal">
            Official collegiate sports governance, data handling, and platform terms for PSU SportsTrack.
          </DialogDescription>

          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'privacy' | 'terms')}
            className="w-full pt-1"
          >
            <TabsList className="grid w-full grid-cols-2 bg-slate-900 border border-white/10 p-1 rounded-xl">
              <TabsTrigger
                value="terms"
                className="rounded-lg text-xs font-bold data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all gap-1.5"
              >
                <FileText className="size-3.5" />
                Terms &amp; Conditions
              </TabsTrigger>
              <TabsTrigger
                value="privacy"
                className="rounded-lg text-xs font-bold data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all gap-1.5"
              >
                <ShieldCheck className="size-3.5" />
                Privacy Policy
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed scrollbar-thin scrollbar-thumb-white/10">
          {activeTab === 'terms' ? (
            <div className="space-y-6">
              <div className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-200 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-orange-400">
                  <CheckCircle2 className="size-4 shrink-0" />
                  Official Collegiate Platform Agreement
                </div>
                <p className="text-[11px] leading-relaxed">
                  By registering or accessing PSU SportsTrack, participants and spectators agree to comply with PSU Sports Department rules, athletic integrity standards, and university policies.
                </p>
              </div>

              {TERMS_AND_CONDITIONS.sections.map((section, idx) => (
                <div key={idx} className="space-y-2 border-t border-white/5 pt-4 first:border-t-0 first:pt-0">
                  <h4 className="text-sm sm:text-base font-black italic uppercase tracking-tight text-white">
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
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-400">
                  <ShieldCheck className="size-4 shrink-0" />
                  Philippine Data Privacy Act of 2012 (RA 10173) Compliance
                </div>
                <p className="text-[11px] leading-relaxed">
                  Your personal records are collected strictly for legitimate tournament governance, eligibility verification, and match operations. Data is not sold or used for commercial marketing.
                </p>
              </div>

              {PRIVACY_POLICY.sections.map((section, idx) => (
                <div key={idx} className="space-y-2 border-t border-white/5 pt-4 first:border-t-0 first:pt-0">
                  <h4 className="text-sm sm:text-base font-black italic uppercase tracking-tight text-white">
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
                    <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-slate-900/60 p-1">
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
          <div className="shrink-0 pt-3 border-t border-white/10 space-y-3">
            <div className="p-3 sm:p-4 rounded-2xl bg-slate-900 border border-white/10 space-y-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs select-none">
                <Checkbox
                  checked={termsChecked}
                  onCheckedChange={(c) => setTermsChecked(Boolean(c))}
                  className="mt-0.5 border-orange-500/50 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                />
                <span className="text-slate-200 leading-snug">
                  I have read, understood, and agree to the <strong>Terms and Conditions</strong> of Palawan State University SportsTrack.
                </span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer text-xs select-none">
                <Checkbox
                  checked={privacyChecked}
                  onCheckedChange={(c) => setPrivacyChecked(Boolean(c))}
                  className="mt-0.5 border-orange-500/50 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                />
                <span className="text-slate-200 leading-snug">
                  I have read, understood, and agree to the <strong>Privacy Policy</strong> in accordance with Philippine RA 10173 (Data Privacy Act of 2012).
                </span>
              </label>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onDecline?.();
                  onOpenChange(false);
                }}
                className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs h-10 px-4 rounded-xl cursor-pointer"
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
                className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black uppercase italic tracking-wider text-xs h-10 px-6 rounded-xl cursor-pointer shadow-lg shadow-orange-500/25 transition-all"
              >
                Accept &amp; Continue Registration
              </Button>
            </div>
          </div>
        ) : (
          <div className="shrink-0 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Mail className="size-3.5 text-orange-500" />
              <span>
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
