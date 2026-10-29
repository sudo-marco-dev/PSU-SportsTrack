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
import { compressImage } from '@/lib/imageCompression';
import { CheckCircle2, AlertTriangle, Info, Loader2, Upload, ExternalLink, Sparkles } from 'lucide-react';

export const VerificationUpload = ({ onUploadSuccess }: { onUploadSuccess?: () => void }) => {
  const { user, profile } = useAuth();
  const [corFile, setCorFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedPsuCor | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<{ originalMb: string; compressedMb: string; reduction: number } | null>(null);

  const isStaff = profile?.role === 'player_staff';
  const isFaculty = profile?.role === 'player_faculty';
  const isCoach = profile?.role === 'coach';
  const isStaffOrFaculty = isStaff || isFaculty;
  const isIdPhotoRole = isStaff || isFaculty || isCoach;

  const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit for digital PDF COR documents
  const MAX_RAW_IMAGE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB forgiving limit for high-res phone camera photos
  const MAX_STORAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB target ceiling for storage bucket

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setCorFile(null);
      setImagePreviewUrl(null);
      setParsedData(null);
      setCompressionInfo(null);
      return;
    }

    const fileNameLower = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || fileNameLower.endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(fileNameLower);

    if (isIdPhotoRole) {
      if (!isImage) {
        toast.error(
          isCoach
            ? 'Invalid file format. Coach athletic clearance requires an official coach / employee ID card photo (PNG, JPG, WEBP).'
            : 'Invalid file format. Faculty & staff athletic clearance requires an employee ID card photo (PNG, JPG, WEBP).'
        );
        e.target.value = '';
        setCorFile(null);
        setImagePreviewUrl(null);
        setParsedData(null);
        setCompressionInfo(null);
        return;
      }

      // Check against generous 20MB phone capture limit
      if (file.size > MAX_RAW_IMAGE_SIZE_BYTES) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        toast.error(`Image exceeds 20MB limit (${sizeMb} MB). Please choose or take a photo under 20MB.`);
        e.target.value = '';
        setCorFile(null);
        setImagePreviewUrl(null);
        setParsedData(null);
        setCompressionInfo(null);
        return;
      }

      // Automatic client-side compression to < 1.5MB at 85% quality
      const compResult = await compressImage(file, {
        maxDimension: 1920,
        quality: 0.85,
        maxTargetBytes: 1.5 * 1024 * 1024,
      });

      const processedFile = compResult.compressedFile;
      setCorFile(processedFile);

      if (compResult.wasCompressed) {
        const origMb = (compResult.originalSize / (1024 * 1024)).toFixed(1);
        const compMb = (compResult.compressedSize / (1024 * 1024)).toFixed(1);
        setCompressionInfo({ originalMb: origMb, compressedMb: compMb, reduction: compResult.reductionPercentage });
        toast.success(`Photo auto-optimized: ${origMb}MB ➔ ${compMb}MB (${compResult.reductionPercentage}% smaller)`);
      } else {
        setCompressionInfo(null);
      }

      const preview = URL.createObjectURL(processedFile);
      setImagePreviewUrl(preview);
      setParsedData(null);
      return;
    } else {
      if (!isPdf) {
        toast.error('Invalid file format. Certificate of Registration (COR) verification strictly accepts official digital PDF documents (.pdf) only for automated parsing.');
        e.target.value = '';
        setCorFile(null);
        setImagePreviewUrl(null);
        setParsedData(null);
        setCompressionInfo(null);
        return;
      }

      if (file.size > MAX_PDF_SIZE_BYTES) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        toast.error(`PDF document exceeds 10MB limit (${sizeMb} MB). Please upload an official digital COR under 10MB.`);
        e.target.value = '';
        setCorFile(null);
        setImagePreviewUrl(null);
        setParsedData(null);
        setCompressionInfo(null);
        return;
      }

      setCompressionInfo(null);
      setCorFile(file);
      setImagePreviewUrl(null);
    }

    if (isPdf) {
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
    }
  };

  const handleUpload = async () => {
    if (!user) return;
    if (!corFile) {
      toast.error(
        isCoach
          ? 'Please select your official PSU Coach / Employee ID Card photo.'
          : isStaffOrFaculty
          ? 'Please select your official PSU Employee ID Card photo.'
          : 'Please select your official Certificate of Registration (COR) PDF.'
      );
      return;
    }

    if (corFile.size > MAX_STORAGE_FILE_SIZE_BYTES) {
      toast.error('Selected file exceeds the 5MB storage quota. Please upload an optimized file under 5MB.');
      return;
    }

    setIsUploading(true);

    try {
      // 0. Remove prior unverified (Pending or Rejected) documents and storage files for this user to prevent storage overflow
      const { data: priorUnverified } = await supabase
        .from('verification_documents')
        .select('id, storage_path')
        .eq('user_id', user.id)
        .in('status', ['Pending', 'Rejected']);

      if (priorUnverified && priorUnverified.length > 0) {
        const pathsToPrune = priorUnverified.map(p => p.storage_path).filter(Boolean);
        if (pathsToPrune.length > 0) {
          try {
            await supabase.storage.from('verification_documents').remove(pathsToPrune);
          } catch (storageCleanupErr) {
            console.warn('Non-fatal prior file cleanup warning:', storageCleanupErr);
          }
        }
        await supabase.from('verification_documents').delete().in('id', priorUnverified.map(p => p.id));
      }

      const fileExt = corFile.name.split('.').pop() || (isIdPhotoRole ? 'png' : 'pdf');
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('verification_documents')
        .upload(filePath, corFile);

      if (uploadError) throw uploadError;

      // 2. Insert into verification_documents with role-aware fields
      const docType = isCoach ? 'COACH_ID' : isStaff ? 'STAFF_ID' : isFaculty ? 'FACULTY_ID' : 'COR';
      const { error: dbError } = await supabase.from('verification_documents').insert({
        user_id: user.id,
        document_type: docType,
        storage_path: filePath,
        status: 'Pending',
        extracted_student_no: isIdPhotoRole ? (profile?.employee_id || null) : (parsedData?.studentNo || null),
        extracted_full_name: profile?.full_name || parsedData?.fullName || null,
        extracted_college: profile?.college_name || parsedData?.college || null,
        extracted_program: isIdPhotoRole ? (profile?.department || null) : (parsedData?.program || null),
        extracted_school_year: isIdPhotoRole ? null : (parsedData?.schoolYear || null),
        extracted_year_level: isIdPhotoRole ? null : (parsedData?.yearLevel || null),
        extracted_total_units: isIdPhotoRole ? null : (parsedData?.totalUnits || null),
        ocr_raw_text: isCoach
          ? `[Coach ID Verification] Submitted by ${profile?.full_name || 'Coach'} (${profile?.college_name || 'Athletics Department'})`
          : isStaffOrFaculty
          ? `[Employee ID Verification] Submitted by ${profile?.full_name || 'Employee'} (ID: ${profile?.employee_id || 'N/A'}, Dept: ${profile?.department || 'N/A'})`
          : (parsedData?.rawText || null),
        auto_match_status: isIdPhotoRole ? 'Manual Review' : (parsedData?.confidenceLevel || (parsedData?.isParsable ? 'Moderate' : 'Non-Parsable')),
        confidence_score: isIdPhotoRole ? 100 : (parsedData?.confidenceScore ?? 0),
        extracted_age: profile?.age || parsedData?.age || null,
      });

      if (dbError) throw dbError;

      toast.success('Clearance document submitted! It has been routed to sports administrators for review and approval.');
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
      <div className={`h-1.5 w-full ${
        isCoach
          ? 'bg-gradient-to-r from-orange-500 via-emerald-500 to-teal-600'
          : isStaff
          ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600'
          : isFaculty
          ? 'bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600'
          : 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600'
      }`} />
      <CardHeader className="p-6 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Badge className={`${
            isCoach
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : isStaff
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              : isFaculty
              ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
              : 'bg-orange-500/10 text-orange-600 border border-orange-500/20'
          } text-[10px] font-black uppercase tracking-wider`}>
            {isCoach ? 'Athletic Coach Clearance' : isStaff ? 'Staff Athlete Clearance' : isFaculty ? 'Faculty Athlete Clearance' : 'Student Athlete Clearance'}
          </Badge>
        </div>
        <CardTitle className="text-2xl font-black italic tracking-tight uppercase text-slate-900 dark:text-white">
          VERIFY <span className={isCoach ? 'text-emerald-500' : isStaff ? 'text-amber-500' : isFaculty ? 'text-indigo-500' : 'text-orange-500'}>ELIGIBILITY</span>
        </CardTitle>
        <CardDescription className="text-slate-500 dark:text-slate-400 text-xs font-normal leading-relaxed">
          {isCoach
            ? 'Palawan State University athletic coaches must submit a clear photo of their official PSU Coach / Employee ID Card for coaching clearance and team roster privileges.'
            : isStaff
            ? 'Palawan State University staff athletes must submit a clear photo of their official PSU Employee ID Card for athletic clearance.'
            : isFaculty
            ? 'Palawan State University faculty athletes must submit a clear photo of their official PSU Faculty/Employee ID Card for athletic clearance.'
            : 'Palawan State University student athletes must submit their official Certificate of Registration (COR) for enrollment verification. Valid PSU ID is no longer required.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6 pt-0 space-y-4">
        {/* Role-Adaptive Advisory Notice */}
        {isCoach ? (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-slate-800 dark:text-slate-200 text-xs leading-relaxed space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400 uppercase text-[11px] tracking-wider">
              <Info className="size-4 shrink-0" />
              <span>Official PSU Coach / Employee ID Required</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Please upload a clear, legible photo of your official PSU Coach or Employee ID Card (PNG/JPG/WEBP).
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Ensure your full name and photo are visible. An athletics administrator will inspect your ID card to grant coaching clearance and unlock squad creation and roster management.
            </p>
          </div>
        ) : isStaffOrFaculty ? (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-slate-800 dark:text-slate-200 text-xs leading-relaxed space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400 uppercase text-[11px] tracking-wider">
              <Info className="size-4 shrink-0" />
              <span>Official PSU Employee ID Required</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Please upload a clear, legible photo of your official PSU Employee ID Card (PNG/JPG).
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Ensure your full name, employee ID number, and photo are visible. An athletics administrator will inspect your ID card to grant tournament clearance.
            </p>
          </div>
        ) : (
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
        )}

        {/* File Input */}
        <div className="space-y-2">
          <Label htmlFor="cor" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>
              {isCoach
                ? 'PSU Coach / Employee ID Card Photo (PNG/JPG)'
                : isStaffOrFaculty
                ? 'PSU Employee ID Card Photo (PNG/JPG)'
                : 'Certificate of Registration (PDF)'}
            </span>
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
              accept={isIdPhotoRole ? 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg' : '.pdf,application/pdf'}
              onChange={handleFileChange}
              disabled={isUploading || isParsing}
              className={`h-12 ${
                isCoach
                  ? 'file:bg-emerald-600 hover:file:bg-emerald-700'
                  : isStaff
                  ? 'file:bg-amber-600 hover:file:bg-amber-700'
                  : isFaculty
                  ? 'file:bg-indigo-600 hover:file:bg-indigo-700'
                  : 'file:bg-orange-500 hover:file:bg-orange-600'
              } file:text-white file:font-bold file:text-xs file:border-0 file:rounded-lg file:mr-3 file:px-3 file:py-1 cursor-pointer bg-slate-50 dark:bg-white/5 rounded-2xl border-slate-200 dark:border-white/10`}
            />
            <div className="flex items-center justify-between px-1 text-[10px] text-slate-400 font-medium">
              <span>Formats: {isIdPhotoRole ? 'PNG, JPG, WEBP' : 'Official PDF (.pdf)'}</span>
              <span className="font-bold text-orange-500">
                {isIdPhotoRole ? 'Up to 20 MB (Auto-optimized)' : 'Max 10 MB PDF'}
              </span>
            </div>
          </div>
        </div>

        {/* Image Preview for Employee or Coach ID */}
        {imagePreviewUrl && (
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
              <span className={`flex items-center gap-1.5 uppercase text-[10px] tracking-wider ${
                isCoach ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
              }`}>
                <CheckCircle2 className="size-3.5" /> Selected {isCoach ? 'Coach' : 'Employee'} ID Photo Preview
              </span>
              <span className="text-[10px] text-slate-400 font-normal truncate max-w-[200px]">{corFile?.name}</span>
            </div>
            {compressionInfo && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                <Sparkles className="size-3 shrink-0" />
                <span>Auto-optimized: {compressionInfo.originalMb}MB ➔ {compressionInfo.compressedMb}MB ({compressionInfo.reduction}% smaller)</span>
              </div>
            )}
            <div className="relative rounded-xl overflow-hidden max-h-52 flex items-center justify-center bg-black/5 dark:bg-black/30 border border-slate-200 dark:border-white/10 p-1">
              <img
                src={imagePreviewUrl}
                alt={isCoach ? 'Coach ID Preview' : 'Employee ID Preview'}
                className="max-h-48 w-auto object-contain rounded-lg shadow-sm"
              />
            </div>
          </div>
        )}

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
          className={`w-full h-12 ${
            isCoach
              ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              : isStaff
              ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
              : isFaculty
              ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
              : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20'
          } text-white font-black uppercase italic tracking-wider text-xs rounded-xl shadow-lg transition-all active:scale-[0.99] gap-2`}
          onClick={handleUpload}
          disabled={!corFile || isUploading || isParsing}
        >
          {isUploading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Uploading &amp; Submitting...
            </>
          ) : (
            <>
              <Upload className="size-4" /> {
                isCoach
                  ? 'Submit Coach ID for Verification'
                  : isStaff
                  ? 'Submit Employee ID for Verification'
                  : isFaculty
                  ? 'Submit Faculty ID for Verification'
                  : 'Submit COR for Verification'
              }
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
