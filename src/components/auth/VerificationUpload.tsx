import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { extractTextFromPdf, parsePsuCor, type ParsedPsuCor } from '@/lib/corParser';
import { CheckCircle2, AlertTriangle, Info, Loader2, Upload, ExternalLink } from 'lucide-react';

export const VerificationUpload = ({ onUploadSuccess }: { onUploadSuccess?: () => void }) => {
  const { user, profile, refetchProfile } = useAuth();
  const [corFile, setCorFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedPsuCor | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setCorFile(null);
      setParsedData(null);
      return;
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Invalid file type: Please select an official PDF document.');
      e.target.value = '';
      return;
    }

    setCorFile(file);
    setIsParsing(true);

    try {
      const rawText = await extractTextFromPdf(file);
      const parsed = parsePsuCor(rawText, {
        fullName: profile?.full_name || user?.email?.split('@')[0] || '',
        collegeName: profile?.college_name || null,
        email: user?.email || null,
      });
      setParsedData(parsed);

      if (parsed.isParsable) {
        toast.success(`COR Read Successfully! Confidence match: ${parsed.confidenceScore}%`);
      } else {
        toast.warning('Warning: Could not detect text layers. Ensure this is an official digital PDF from the PSU Portal.');
      }
    } catch (err: any) {
      console.error('PDF parsing error:', err);
      toast.error('Could not parse PDF text layers. You may still upload for manual admin review.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleUpload = async () => {
    if (!user) return;
    if (!corFile) {
      toast.error('Please select your official Certificate of Registration (COR) PDF.');
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = corFile.name.split('.').pop() || 'pdf';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('verification_documents')
        .upload(filePath, corFile);

      if (uploadError) throw uploadError;

      // 2. Insert into verification_documents with parsed fields
      const { error: dbError } = await supabase.from('verification_documents').insert({
        user_id: user.id,
        document_type: 'COR',
        storage_path: filePath,
        status: 'Pending',
        extracted_student_no: parsedData?.studentNo || null,
        extracted_full_name: parsedData?.fullName || null,
        extracted_college: parsedData?.college || null,
        extracted_program: parsedData?.program || null,
        extracted_school_year: parsedData?.schoolYear || null,
        extracted_year_level: parsedData?.yearLevel || null,
        extracted_total_units: parsedData?.totalUnits || null,
        ocr_raw_text: parsedData?.rawText || null,
        auto_match_status: parsedData?.confidenceLevel || (parsedData?.isParsable ? 'Moderate' : 'Non-Parsable'),
        confidence_score: parsedData?.confidenceScore ?? 0,
        extracted_age: parsedData?.age || null,
      });

      if (dbError) throw dbError;

      // 3. Immediately auto-populate academic details on user profile so player can view/edit
      const profileUpdates: Record<string, any> = {};
      if (parsedData?.studentNo) profileUpdates.student_number = parsedData.studentNo;
      if (parsedData?.program) profileUpdates.program = parsedData.program;
      if (parsedData?.yearLevel) profileUpdates.year_level = parsedData.yearLevel;
      if (parsedData?.age) profileUpdates.age = parsedData.age;

      if (Object.keys(profileUpdates).length > 0) {
        await supabase.from('users').update(profileUpdates).eq('id', user.id);
        if (refetchProfile) {
          await refetchProfile();
        }
      }

      toast.success('Certificate of Registration submitted! Your profile has been updated and sent for clearance.');
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Upload failed: ${message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-xl mx-auto shadow-xl border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden bg-white dark:bg-slate-900">
      <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600" />
      <CardHeader className="p-6 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Badge className="bg-orange-500/10 text-orange-600 border border-orange-500/20 text-[10px] font-black uppercase tracking-wider">
            Student Athlete Clearance
          </Badge>
        </div>
        <CardTitle className="text-2xl font-black italic tracking-tight uppercase text-slate-900 dark:text-white">
          VERIFY <span className="text-orange-500">ELIGIBILITY</span>
        </CardTitle>
        <CardDescription className="text-slate-500 dark:text-slate-400 text-xs font-normal leading-relaxed">
          Palawan State University student athletes must submit their official Certificate of Registration (COR) for enrollment verification. Valid PSU ID is no longer required.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6 pt-0 space-y-4">
        {/* Official PSU Portal Advisory Notice */}
        <div className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 text-slate-800 dark:text-slate-200 text-xs leading-relaxed space-y-2">
          <div className="flex items-center gap-2 font-bold text-orange-600 dark:text-orange-400 uppercase text-[11px] tracking-wider">
            <Info className="size-4 shrink-0" />
            <span>Official Portal PDF Required</span>
          </div>
          <p className="text-slate-600 dark:text-slate-300">
            You can obtain your official digital COR PDF directly through the official{' '}
            <a
              href="https://oes.psu.palawan.edu.ph/aims/students/"
              target="_blank"
              rel="noreferrer"
              className="text-orange-600 dark:text-orange-400 font-bold underline inline-flex items-center gap-1 hover:text-orange-700"
            >
              PSU Student Portal (AIMS) <ExternalLink className="size-3" />
            </a>.
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Please upload the original digital PDF downloaded from the portal. Do not upload photos, camera scans, or PNG images converted to PDF, as non-parsable files will be rejected.
          </p>
        </div>

        {/* File Input */}
        <div className="space-y-2">
          <Label htmlFor="cor" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Certificate of Registration (PDF)</span>
            {corFile && (
              <span className="text-[10px] text-slate-400 font-normal truncate max-w-[200px]">
                {corFile.name}
              </span>
            )}
          </Label>
          <div className="relative">
            <Input
              id="cor"
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              disabled={isUploading || isParsing}
              className="h-12 file:bg-orange-500 file:text-white file:font-bold file:text-xs file:border-0 file:rounded-lg file:mr-3 file:px-3 file:py-1 cursor-pointer bg-slate-50 dark:bg-white/5 rounded-2xl border-slate-200 dark:border-white/10"
            />
          </div>
        </div>

        {/* Parsing Progress */}
        {isParsing && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex items-center gap-3">
            <Loader2 className="size-5 text-orange-500 animate-spin shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Reading COR Document...
              </p>
              <p className="text-[10px] text-slate-400 font-normal">
                Extracting student number, name, program, and academic units.
              </p>
            </div>
          </div>
        )}

        {/* Live Parse Preview Feedback */}
        {!isParsing && parsedData && (
          <div className={`p-4 rounded-2xl border transition-all ${
            parsedData.isParsable
              ? 'bg-emerald-50/60 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
              : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {parsedData.isParsable ? (
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                )}
                <span className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                  {parsedData.isParsable ? 'Document Successfully Parsed' : 'Non-Parsable Document Detected'}
                </span>
              </div>
              <Badge
                className={`font-black text-[10px] uppercase tracking-wider ${
                  parsedData.confidenceScore >= 90
                    ? 'bg-emerald-600 text-white'
                    : parsedData.confidenceScore >= 60
                    ? 'bg-amber-500 text-white'
                    : 'bg-red-500 text-white'
                }`}
              >
                {parsedData.confidenceScore}% Confidence
              </Badge>
            </div>

            {parsedData.isParsable ? (
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-emerald-200/50 dark:border-emerald-500/20">
                <div>
                  <span className="text-slate-400 uppercase text-[9px] font-bold block">Parsed Name</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                    {parsedData.fullName || 'Not Detected'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] font-bold block">Student No</span>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                      {parsedData.studentNo || 'Not Detected'}
                    </span>
                    {parsedData.matchDetails?.emailMatch === 'Exact' && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                        CORP
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] font-bold block">College</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                    {parsedData.college || 'Not Detected'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] font-bold block">Program / Year</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                    {parsedData.yearLevel ? `${parsedData.yearLevel}` : 'Not Detected'}
                  </span>
                </div>
                <div className="col-span-2 pt-1 border-t border-emerald-200/30 dark:border-emerald-500/10 flex items-center justify-between">
                  <span className="text-slate-400 uppercase text-[9px] font-bold">University Corp Email</span>
                  <span className="font-bold text-[10px] text-emerald-600 dark:text-emerald-400">
                    {parsedData.matchDetails?.emailMatch === 'Exact'
                      ? 'Verified Student Corporate Email'
                      : parsedData.matchDetails?.isPsuEmail
                      ? 'PSU Email Domain Detected'
                      : 'Non-Corporate Email Used'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                {parsedData.errorMessage || 'No readable text layers found. This file appears to be a scanned image or photo converted to PDF.'}
              </p>
            )}
          </div>
        )}

        <Button
          className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider text-xs rounded-xl shadow-lg shadow-orange-500/20 transition-all active:scale-[0.99] gap-2"
          onClick={handleUpload}
          disabled={!corFile || isUploading || isParsing}
        >
          {isUploading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Uploading &amp; Verifying...
            </>
          ) : (
            <>
              <Upload className="size-4" /> Submit COR for Verification
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
