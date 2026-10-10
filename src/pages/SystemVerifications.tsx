import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Navigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { DataToolbar } from '@/components/admin/DataToolbar';
import { ViewToggle } from '@/components/admin/ViewToggle';
import {
  ShieldCheck,
  FileText,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  RotateCcw,
  Eye,
  AlertTriangle,
  GraduationCap,
  Calendar,
  Layers,
  BookOpen,
  Check,
  Building,
  Mail,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { logAudit } from '@/lib/audit';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CanvasPdfViewer } from '@/components/admin/CanvasPdfViewer';

type PendingDocument = {
  id: string;
  user_id: string;
  document_type: string;
  storage_path: string;
  status: string;
  created_at: string;
  confidence_score: number | null;
  extracted_student_no: string | null;
  extracted_full_name: string | null;
  extracted_college: string | null;
  extracted_program: string | null;
  extracted_school_year: string | null;
  extracted_year_level: string | null;
  extracted_total_units: string | null;
  extracted_age: number | null;
  ocr_raw_text: string | null;
  auto_match_status: string | null;
  rejection_reason: string | null;
  users: {
    full_name: string;
    email?: string | null;
    role: string;
    account_status?: string;
    student_number?: string | null;
    program?: string | null;
    year_level?: string | null;
    age?: number | null;
    colleges?: { college_name: string } | { college_name: string }[];
  } | null;
};

const REJECTION_PRESETS = [
  'Non-parsable file (Image or scanned document converted to PDF — please download original PDF directly from PSU Portal: https://oes.psu.palawan.edu.ph/aims/students/)',
  'Outdated Certificate of Registration (COR must be for the current academic semester)',
  'Student Name mismatch with registered account',
  'College department mismatch with registered profile',
  'Invalid or unreadable document (Not an official Palawan State University COR)',
  'Other / Custom reason',
];

export const SystemVerifications = () => {
  const { isSuperAdmin, isLoading } = useAuth();
  const [documents, setDocuments] = useState<PendingDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isRevalidateModalOpen, setIsRevalidateModalOpen] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);

  // In-Screen PDF Preview Modal State (Rendered directly via Canvas, immune to download managers)
  const [previewDoc, setPreviewDoc] = useState<PendingDocument | null>(null);

  // Rejection Modal State
  const [rejectDoc, setRejectDoc] = useState<PendingDocument | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>(REJECTION_PRESETS[0]);
  const [customNote, setCustomNote] = useState<string>('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchDocuments();
    }
  }, [isSuperAdmin, statusFilter]);

  const fetchDocuments = async () => {
    let query = supabase
      .from('verification_documents')
      .select('*, users(full_name, email, role, account_status, student_number, program, year_level, age, colleges(college_name))')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      toast.error('Failed to fetch verification documents: ' + error.message);
    } else {
      setDocuments((data as unknown) as PendingDocument[]);
    }
  };

  const handleOpenPreview = (doc: PendingDocument) => {
    setPreviewDoc(doc);
  };

  const handleApprove = async (doc: PendingDocument) => {
    try {
      // 1. Update document status
      const { error: docError } = await supabase
        .from('verification_documents')
        .update({ status: 'Approved' })
        .eq('id', doc.id);

      if (docError) throw docError;

      // 2. Update user verification status and synchronize profile details
      const userUpdates: Record<string, any> = { is_verified: true };
      if (doc.extracted_student_no) userUpdates.student_number = doc.extracted_student_no;
      if (doc.extracted_program) userUpdates.program = doc.extracted_program;
      if (doc.extracted_year_level) userUpdates.year_level = doc.extracted_year_level;
      if (doc.extracted_age) userUpdates.age = doc.extracted_age;

      const { error: userError } = await supabase
        .from('users')
        .update(userUpdates)
        .eq('id', doc.user_id);

      if (userError) throw userError;

      toast.success(`Clearance approved for ${doc.users?.full_name || 'Athlete'}. Profile updated.`);

      // Audit Log
      logAudit({
        action: 'APPROVE_DOCUMENT',
        entity_type: 'verification_documents',
        entity_id: doc.id,
        details: `Approved COR clearance and verified user ${doc.user_id} with confidence ${doc.confidence_score ?? 0}%`,
      });

      // Update state
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      if (previewDoc?.id === doc.id) {
        setPreviewDoc(null);
      }
    } catch (error: any) {
      toast.error('Error approving clearance: ' + error.message);
    }
  };

  const handleOpenRejectModal = (doc: PendingDocument) => {
    setRejectDoc(doc);
    // If the file was non-parsable or 0 confidence, default to non-parsable reason
    if (doc.confidence_score === 0 || doc.auto_match_status === 'Non-Parsable') {
      setSelectedReason(REJECTION_PRESETS[0]);
    } else {
      setSelectedReason(REJECTION_PRESETS[0]);
    }
    setCustomNote('');
  };

  const handleConfirmReject = async () => {
    if (!rejectDoc) return;
    setIsSubmittingReject(true);

    try {
      const fullReason =
        selectedReason === 'Other / Custom reason'
          ? customNote || 'Document could not be verified by administration.'
          : selectedReason + (customNote.trim() ? ` — Guidance: ${customNote.trim()}` : '');

      const { error } = await supabase
        .from('verification_documents')
        .update({
          status: 'Rejected',
          rejection_reason: fullReason,
        })
        .eq('id', rejectDoc.id);

      if (error) throw error;

      toast.info('Clearance rejected. Player has been notified with rejection feedback.');

      // Audit Log
      logAudit({
        action: 'REJECT_DOCUMENT',
        entity_type: 'verification_documents',
        entity_id: rejectDoc.id,
        details: `Rejected clearance for user ${rejectDoc.user_id}. Reason: ${fullReason}`,
      });

      setDocuments((prev) => prev.filter((d) => d.id !== rejectDoc.id));
      setRejectDoc(null);
      if (previewDoc?.id === rejectDoc.id) {
        setPreviewDoc(null);
      }
    } catch (error: any) {
      toast.error('Error rejecting document: ' + error.message);
    } finally {
      setIsSubmittingReject(false);
    }
  };

  const handleTriggerAnnualRevalidation = async () => {
    setIsRevalidating(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          account_status: 'inactive',
          is_verified: false,
          revalidated_at: new Date().toISOString(),
        })
        .in('role', ['player_student', 'player_faculty', 'Player']);

      if (error) throw error;

      await logAudit({
        action: 'ANNUAL_REVALIDATION',
        entity_type: 'users',
        details: 'Super Admin triggered annual revalidation cycle: all athletes marked inactive awaiting new COR submission.',
      });

      toast.success('Annual Revalidation triggered! Athletes marked inactive until renewed COR documents are approved.');
      setIsRevalidateModalOpen(false);
      fetchDocuments();
    } catch (err: any) {
      toast.error('Failed to trigger revalidation: ' + err.message);
    } finally {
      setIsRevalidating(false);
    }
  };

  const formatRole = (r?: string) => {
    if (!r) return 'Unknown';
    if (r === 'player_student' || r === 'Player') return 'Student Athlete';
    if (r === 'player_faculty' || r === 'faculty' || r === 'Faculty') return 'Faculty Athlete';
    if (r === 'coach' || r === 'Coach') return 'Coach';
    if (r === 'facilitator') return 'Facilitator';
    if (r === 'super_admin' || r === 'Admin') return 'Super Admin';
    return r;
  };

  const getCollegeName = (doc?: PendingDocument | null) => {
    if (!doc?.users) return 'Unassigned';
    const colleges = doc.users.colleges;
    if (Array.isArray(colleges)) return colleges[0]?.college_name || 'Unassigned';
    return colleges?.college_name || 'Unassigned';
  };

  const checkNameMatch = (regName?: string | null, extName?: string | null): boolean => {
    if (!regName || !extName) return false;
    const regClean = regName.toUpperCase().trim();
    const extClean = extName.toUpperCase().trim();
    if (regClean === extClean) return true;

    // Check structured Last Name if comma is present
    if (regName.includes(',')) {
      const regLastName = regName.split(',')[0].trim().toUpperCase();
      if (extClean.includes(regLastName)) return true;
    }

    const tokens = regClean.replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/).filter((t) => t.length > 1);
    return tokens.some((t) => extClean.includes(t));
  };

  const checkEmailStudentIdMatch = (email?: string | null, studentNo?: string | null) => {
    if (!email) return { isMatch: false, isPsuDomain: false, label: 'No Email' };
    const emailLower = email.toLowerCase().trim();
    const isPsuDomain = emailLower.endsWith('@psu.palawan.edu.ph') || emailLower.endsWith('psu.palawan.edu.ph');
    if (!studentNo) return { isMatch: false, isPsuDomain, label: isPsuDomain ? 'PSU Email (No ID Parsed)' : 'Non-Corporate' };

    const cleanEmailPrefix = emailLower.split('@')[0].replace(/[^0-9a-z]/g, '');
    const cleanId = studentNo.replace(/[^0-9a-z]/g, '').toLowerCase();

    const isMatch = cleanId.length >= 5 && cleanEmailPrefix === cleanId;
    return {
      isMatch,
      isPsuDomain,
      label: isMatch
        ? (isPsuDomain ? 'Verified PSU Corp Email' : 'ID Matches Email Prefix')
        : (isPsuDomain ? 'PSU Email (ID Differs)' : 'Non-Corporate Email'),
    };
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const search = searchQuery.toLowerCase();
      const matchesSearch =
        doc.users?.full_name?.toLowerCase().includes(search) ||
        doc.extracted_student_no?.toLowerCase().includes(search) ||
        doc.extracted_program?.toLowerCase().includes(search) ||
        doc.document_type?.toLowerCase().includes(search);
      return matchesSearch;
    });
  }, [documents, searchQuery]);

  const renderConfidenceBadge = (score: number | null, status: string | null) => {
    if (score === null || score === undefined) {
      return (
        <Badge variant="outline" className="text-[10px] font-bold text-slate-400">
          Unscored
        </Badge>
      );
    }
    if (score >= 90) {
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider gap-1 shadow-sm">
          <CheckCircle2 className="size-3" /> {score}% High Match
        </Badge>
      );
    }
    if (score >= 60) {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider gap-1 shadow-sm">
          <AlertTriangle className="size-3" /> {score}% Review Match
        </Badge>
      );
    }
    if (score === 0 || status === 'Non-Parsable') {
      return (
        <Badge className="bg-red-500 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-wider gap-1 shadow-sm">
          <XCircle className="size-3" /> 0% Non-Parsable
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-500 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-wider gap-1 shadow-sm">
        <AlertTriangle className="size-3" /> {score}% Discrepancy
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-[50vh] w-full gap-4 animate-in fade-in duration-300">
        <div className="animate-spin rounded-full h-11 w-11 border-3 border-orange-500/20 border-t-orange-500" />
        <p className="text-slate-500 font-bold tracking-widest uppercase text-xs">Loading Clearance Records...</p>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6 relative max-w-[1600px] mx-auto px-4 pb-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-950 text-white py-6 md:py-8 px-6 md:px-10 rounded-[2rem] shadow-2xl border border-white/5 relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-orange-500" />
            <span className="text-orange-500 font-bold text-xs tracking-[0.2em] uppercase">
              Eligibility Command Center
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black italic tracking-tighter uppercase leading-none">
            COR CLEARANCE <span className="text-orange-500">SYSTEM</span>
          </h1>
          <p className="text-slate-400 font-sans font-medium text-sm tracking-wide mt-2 max-w-2xl opacity-80">
            Automated Certificate of Registration verification with confidence matching and in-screen document preview.
          </p>
        </div>
        <div className="relative z-10 flex flex-col items-end gap-3">
          <div className="px-5 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-right group-hover:border-orange-500/30 transition-all duration-500">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Pending Requests</p>
            <p className="text-3xl font-black text-orange-500 tabular-nums tracking-tighter leading-none">
              {documents.filter((d) => d.status === 'Pending').length}
            </p>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 size-96 bg-orange-500/10 rounded-full blur-[100px] group-hover:bg-orange-500/20 transition-all duration-1000" />
      </div>

      <div className="relative z-10 space-y-6">
        <DataToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterValue={statusFilter}
          onFilterChange={setStatusFilter}
          searchPlaceholder="Search athlete name, student ID, program..."
          filterOptions={[
            { value: 'all', label: 'All Status' },
            { value: 'Pending', label: 'Pending Clearance' },
            { value: 'Approved', label: 'Approved' },
            { value: 'Rejected', label: 'Rejected' },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsRevalidateModalOpen(true)}
                className="h-10 rounded-xl font-bold uppercase tracking-widest text-[10px] gap-2 shadow-lg shadow-red-500/10"
              >
                <RotateCcw className="size-3.5" />
                Annual Revalidation
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchDocuments()}
                className="h-10 rounded-xl font-bold uppercase tracking-widest text-[10px]"
              >
                Refresh Data
              </Button>
            </div>
          }
        >
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
        </DataToolbar>

        {filteredDocuments.length === 0 ? (
          <Card className="p-20 text-center bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[2.5rem]">
            <div className="size-20 bg-slate-50 dark:bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="size-10 text-slate-300" />
            </div>
            <h3 className="text-2xl font-black italic uppercase tracking-tighter text-slate-400">
              No Clearance Records Found
            </h3>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-2">
              No matching submission records found for this view.
            </p>
          </Card>
        ) : viewMode === 'grid' ? (
          /* Grid View with At-a-Glance Cards */
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredDocuments.map((doc, idx) => {
              const collegeName = getCollegeName(doc);
              const isNameMatch = checkNameMatch(doc.users?.full_name, doc.extracted_full_name);
              const emailCheck = checkEmailStudentIdMatch(doc.users?.email, doc.extracted_student_no);

              return (
                <Card
                  key={doc.id}
                  className="group hover:border-orange-500/50 transition-all duration-300 shadow-sm hover:shadow-2xl rounded-3xl overflow-hidden border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-4"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2.5 bg-slate-50 dark:bg-white/5 rounded-xl group-hover:bg-orange-500 transition-colors duration-300">
                        <FileText className="size-5 text-slate-400 group-hover:text-white" />
                      </div>
                      {renderConfidenceBadge(doc.confidence_score, doc.auto_match_status)}
                    </div>

                    <h3 className="text-xl font-black italic uppercase tracking-tight group-hover:text-orange-500 transition-colors">
                      {doc.users?.full_name || 'Unknown Athlete'}
                    </h3>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-wider mt-0.5 mb-4">
                      {formatRole(doc.users?.role)} • {collegeName}
                    </p>

                    {/* At-a-Glance Comparison Box */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 space-y-2 mb-5 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Student No</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {doc.extracted_student_no || 'Unparsed'}
                          </span>
                          {emailCheck.isMatch ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 font-black tracking-wide" title={emailCheck.label}>
                              CORP MATCH
                            </span>
                          ) : emailCheck.isPsuDomain ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 font-medium" title={emailCheck.label}>
                              PSU DOMAIN
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Account Email</span>
                        <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300 truncate max-w-[170px]" title={doc.users?.email || 'N/A'}>
                          {doc.users?.email || 'No Email'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Parsed Name</span>
                        <div className="flex items-center gap-1 max-w-[170px]">
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            {doc.extracted_full_name || 'Non-parsable'}
                          </span>
                          {isNameMatch ? (
                            <Check className="size-3 text-emerald-500 shrink-0" />
                          ) : (
                            <AlertTriangle className="size-3 text-amber-500 shrink-0" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Program</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
                          {doc.extracted_program || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-bold uppercase text-[9px]">Academic Term</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
                          {doc.extracted_school_year || 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        className="w-full h-11 rounded-xl font-black uppercase italic tracking-wider text-[10px] border-2 border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 gap-1.5"
                        onClick={() => handleOpenPreview(doc)}
                      >
                        <Eye className="size-3.5 text-orange-500" /> Preview In-Screen
                      </Button>
                      {doc.status === 'Pending' && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase italic tracking-wider text-[10px] shadow-lg shadow-emerald-600/10 gap-1"
                            onClick={() => handleApprove(doc)}
                          >
                            <CheckCircle2 className="size-3.5" /> Approve
                          </Button>
                          <Button
                            variant="destructive"
                            className="h-11 rounded-xl font-black uppercase italic tracking-wider text-[10px] shadow-lg shadow-red-500/10 gap-1"
                            onClick={() => handleOpenRejectModal(doc)}
                          >
                            <XCircle className="size-3.5" /> Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Table View with At-a-Glance Details */
          <Card className="rounded-[2rem] border-2 border-slate-100 dark:border-white/5 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto scrollbar-thin">
              <Table className="min-w-[960px] w-full">
                <TableHeader className="bg-slate-50 dark:bg-white/5">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="font-black uppercase tracking-widest text-[10px] h-14 pl-6 min-w-[210px]">Athlete Credentials</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] h-14 min-w-[130px]">Confidence Rate</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] h-14 min-w-[160px]">At-A-Glance COR Match</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] h-14 min-w-[160px]">Academic Program</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] h-14 min-w-[90px]">Submitted</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[10px] h-14 text-right pr-6 w-[250px] min-w-[250px] sticky right-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur z-20">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc, idx) => {
                    const collegeName = getCollegeName(doc);
                    const isNameMatch = checkNameMatch(doc.users?.full_name, doc.extracted_full_name);
                    const emailCheck = checkEmailStudentIdMatch(doc.users?.email, doc.extracted_student_no);

                    return (
                      <TableRow
                        key={doc.id}
                        className="hover:bg-orange-50/30 dark:hover:bg-orange-500/5 transition-colors border-slate-100 dark:border-white/5 group animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        <TableCell className="pl-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center font-black text-xs text-slate-500 shrink-0">
                              {doc.users?.full_name?.charAt(0) || '?'}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-black italic uppercase tracking-tight text-sm text-slate-900 dark:text-white truncate max-w-[150px]">
                                {doc.users?.full_name || 'Unknown'}
                              </span>
                              <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase not-italic truncate max-w-[150px]">
                                {collegeName} • {formatRole(doc.users?.role)}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          {renderConfidenceBadge(doc.confidence_score, doc.auto_match_status)}
                        </TableCell>

                        <TableCell className="text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {doc.extracted_student_no || 'No ID Parsed'}
                              </span>
                              {emailCheck.isMatch ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black tracking-wider uppercase" title={emailCheck.label}>
                                  CORP MATCH
                                </span>
                              ) : emailCheck.isPsuDomain ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium" title={emailCheck.label}>
                                  PSU DOMAIN
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                              <span className="truncate max-w-[140px]">{doc.extracted_full_name || 'Non-parsable'}</span>
                              {isNameMatch ? (
                                <Check className="size-3 text-emerald-500 shrink-0" />
                              ) : (
                                <AlertTriangle className="size-3 text-amber-500 shrink-0" />
                              )}
                            </div>
                            {doc.users?.email && (
                              <div className="text-[10px] font-mono text-slate-400 truncate max-w-[150px]" title={doc.users.email}>
                                {doc.users.email}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-xs">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 dark:text-slate-200 block truncate max-w-[150px]">
                              {doc.extracted_program || 'N/A'}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[150px]">
                              {doc.extracted_year_level ? `${doc.extracted_year_level} • ` : ''}
                              {doc.extracted_school_year || 'Term N/A'}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="font-bold text-xs text-slate-400 whitespace-nowrap">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </TableCell>

                        <TableCell className="text-right pr-6 w-[250px] min-w-[250px] sticky right-0 bg-white/95 dark:bg-slate-900/95 group-hover:bg-slate-50 dark:group-hover:bg-[#1a1410] transition-colors z-10 shadow-[-10px_0_12px_-4px_rgba(0,0,0,0.06)]">
                          <div className="flex justify-end items-center gap-1.5 shrink-0 whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8.5 px-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 font-bold text-xs gap-1 shrink-0"
                              onClick={() => handleOpenPreview(doc)}
                            >
                              <Eye className="size-3.5 text-orange-500" />
                              <span>Preview</span>
                            </Button>
                            {doc.status === 'Pending' && (
                              <>
                                <Button
                                  size="sm"
                                  className="h-8.5 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-wider gap-1 shrink-0 shadow-md shadow-emerald-600/10"
                                  onClick={() => handleApprove(doc)}
                                >
                                  <CheckCircle2 className="size-3.5" /> Approve
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-8.5 px-2.5 rounded-xl font-black uppercase text-[10px] tracking-wider gap-1 shrink-0 shadow-md shadow-red-500/10"
                                  onClick={() => handleOpenRejectModal(doc)}
                                >
                                  <XCircle className="size-3.5" /> Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. IN-SCREEN EMBEDDED PDF PREVIEW MODAL (NO DOWNLOAD, NO ALT-TAB) */}
      {/* ========================================================================= */}
      <Dialog
        open={!!previewDoc}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewDoc(null);
          }
        }}
      >
        <DialogContent className="max-w-6xl w-[96vw] h-[92vh] max-h-[92vh] p-0 rounded-3xl overflow-hidden flex flex-col bg-slate-950 text-white border border-white/10 shadow-2xl">
          {previewDoc && (
            <>
              {/* Header */}
              <div className="p-5 px-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-orange-500 text-white shadow-md shadow-orange-500/20">
                    <FileText className="size-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black uppercase italic tracking-tight flex items-center gap-2">
                      <span>{previewDoc.users?.full_name || 'Athlete'}</span>
                      <span className="text-orange-500">•</span>
                      <span className="text-orange-500">Certificate of Registration</span>
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-400 font-medium mt-0.5">
                      In-screen preview mode — inspect document text and institutional stamps.
                    </DialogDescription>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {renderConfidenceBadge(previewDoc.confidence_score, previewDoc.auto_match_status)}
                </div>
              </div>

              {/* Modal Body: Split Screen */}
              <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
                {/* Left: Canvas PDF Viewer (Direct memory rendering, prevents download manager hooks) */}
                <div className="flex-1 h-full min-h-0 bg-slate-900 relative p-3 overflow-hidden">
                  <CanvasPdfViewer storagePath={previewDoc.storage_path} />
                </div>

                {/* Right: Clearance Match Dossier */}
                <div className="w-full md:w-96 border-t md:border-t-0 md:border-l border-white/10 p-6 overflow-y-auto bg-slate-950 flex flex-col justify-between shrink-0">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-orange-500 mb-1">
                      At-A-Glance Match Dossier
                    </h4>
                    <p className="text-xs text-slate-400">
                      Comparison between registered profile credentials and parsed COR metadata.
                    </p>
                  </div>

                  {/* Confidence Score Panel */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Match Confidence
                      </span>
                      <span className="text-xl font-black text-orange-500 tabular-nums">
                        {previewDoc.confidence_score ?? 0}%
                      </span>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          (previewDoc.confidence_score ?? 0) >= 90
                            ? 'bg-emerald-500'
                            : (previewDoc.confidence_score ?? 0) >= 60
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${previewDoc.confidence_score ?? 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Side-by-Side Comparison */}
                  <div className="space-y-3">
                    {/* Student Full Name Card */}
                    {(() => {
                      const nameMatches = checkNameMatch(previewDoc.users?.full_name, previewDoc.extracted_full_name);
                      return (
                        <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                              Student Full Name
                            </span>
                            {nameMatches ? (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
                                <Check className="size-2.5" /> Name Match
                              </span>
                            ) : (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 flex items-center gap-1">
                                <AlertTriangle className="size-2.5" /> Review
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div>
                              <p className="text-slate-400 text-[10px]">Registered:</p>
                              <p className="font-bold text-white">{previewDoc.users?.full_name || 'N/A'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-slate-400 text-[10px]">On COR:</p>
                              <p className="font-bold text-orange-400">{previewDoc.extracted_full_name || 'Non-parsable'}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* PSU Corporate Email Card */}
                    {(() => {
                      const emailCheck = checkEmailStudentIdMatch(previewDoc.users?.email, previewDoc.extracted_student_no);
                      return (
                        <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                              <Mail className="size-3 text-orange-400" /> PSU Corporate Email
                            </span>
                            {emailCheck.isMatch ? (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
                                <Check className="size-2.5" /> ID Matched
                              </span>
                            ) : emailCheck.isPsuDomain ? (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                                PSU Domain
                              </span>
                            ) : (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                                Non-Corporate
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="min-w-0 pr-2">
                              <p className="text-slate-400 text-[10px]">Account Email:</p>
                              <p className="font-mono text-white text-[11px] truncate max-w-[150px]" title={previewDoc.users?.email || 'N/A'}>
                                {previewDoc.users?.email || 'N/A'}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-slate-400 text-[10px]">COR Student ID:</p>
                              <p className="font-bold text-orange-400 text-[11px]">
                                {previewDoc.extracted_student_no || 'Unparsed'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                        College Department
                      </span>
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <p className="text-slate-400 text-[10px]">Registered:</p>
                          <p className="font-bold text-white">{getCollegeName(previewDoc)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-400 text-[10px]">On COR:</p>
                          <p className="font-bold text-orange-400">{previewDoc.extracted_college || 'Non-parsable'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[10px] flex items-center gap-1">
                          <GraduationCap className="size-3 text-orange-400" /> Student Number:
                        </span>
                        <span className="font-bold text-white">{previewDoc.extracted_student_no || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[10px] flex items-center gap-1">
                          <BookOpen className="size-3 text-orange-400" /> Degree Program:
                        </span>
                        <span className="font-bold text-white truncate max-w-[150px]">{previewDoc.extracted_program || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[10px] flex items-center gap-1">
                          <Layers className="size-3 text-orange-400" /> Year Level:
                        </span>
                        <span className="font-bold text-white">{previewDoc.extracted_year_level || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[10px] flex items-center gap-1">
                          <Calendar className="size-3 text-orange-400" /> School Year:
                        </span>
                        <span className="font-bold text-white">{previewDoc.extracted_school_year || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[10px] flex items-center gap-1">
                          <Building className="size-3 text-orange-400" /> Total Units:
                        </span>
                        <span className="font-bold text-white">{previewDoc.extracted_total_units || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons in Preview Modal */}
                  {previewDoc.status === 'Pending' && (
                    <div className="pt-4 border-t border-white/10 space-y-2 mt-4 shrink-0">
                      <Button
                        className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase italic tracking-wider text-xs rounded-xl shadow-lg shadow-emerald-600/20 gap-1.5"
                        onClick={() => handleApprove(previewDoc)}
                      >
                        <CheckCircle2 className="size-4" /> One-Click Approve Clearance
                      </Button>
                      <Button
                        variant="destructive"
                        className="w-full h-11 font-black uppercase italic tracking-wider text-xs rounded-xl shadow-lg shadow-red-500/20 gap-1.5"
                        onClick={() => handleOpenRejectModal(previewDoc)}
                      >
                        <XCircle className="size-4" /> Reject Document...
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 2. STRUCTURED REJECTION REASONS MODAL */}
      {/* ========================================================================= */}
      <Dialog
        open={!!rejectDoc}
        onOpenChange={(open) => {
          if (!open) setRejectDoc(null);
        }}
      >
        <DialogContent className="max-w-lg rounded-3xl p-6 bg-slate-950 text-white border border-white/10 shadow-2xl">
          {rejectDoc && (
            <>
              <DialogHeader className="space-y-2">
                <div className="size-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mb-1">
                  <XCircle className="size-6" />
                </div>
                <DialogTitle className="text-xl font-black uppercase italic tracking-tight">
                  Reject Verification Clearance
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 font-medium">
                  Select standard feedback to notify{' '}
                  <span className="font-bold text-white">{rejectDoc.users?.full_name || 'the player'}</span>{' '}
                  why their Certificate of Registration was rejected.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Select Reason for Rejection
                  </Label>
                  <div className="space-y-2">
                    {REJECTION_PRESETS.map((reason) => {
                      const isSelected = selectedReason === reason;
                      return (
                        <div
                          key={reason}
                          onClick={() => setSelectedReason(reason)}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                            isSelected
                              ? 'bg-red-500/10 border-red-500 text-white font-semibold'
                              : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          <div
                            className={`size-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-red-500 bg-red-500 text-white' : 'border-slate-500'
                            }`}
                          >
                            {isSelected && <Check className="size-2.5 stroke-[3]" />}
                          </div>
                          <span className="leading-tight">{reason}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="customNote" className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Additional Guidance (Optional)
                  </Label>
                  <Textarea
                    id="customNote"
                    rows={3}
                    placeholder="Specific instructions or note for the athlete..."
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    className="bg-white/5 border-white/10 text-white text-xs rounded-xl focus:border-red-500"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 mt-2">
                <Button
                  variant="outline"
                  className="rounded-xl font-bold uppercase text-xs h-11 border-white/10 bg-white/5"
                  onClick={() => setRejectDoc(null)}
                  disabled={isSubmittingReject}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="rounded-xl font-black uppercase italic tracking-wider text-xs h-11 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20"
                  onClick={handleConfirmReject}
                  disabled={isSubmittingReject}
                >
                  {isSubmittingReject ? 'Rejecting Clearance...' : 'Confirm Rejection'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 3. ANNUAL REVALIDATION MODAL */}
      {/* ========================================================================= */}
      <Dialog open={isRevalidateModalOpen} onOpenChange={setIsRevalidateModalOpen}>
        <DialogContent className="w-full sm:max-w-md max-w-[95vw] max-h-[88dvh] overflow-y-auto rounded-3xl p-6 bg-slate-950 text-white border border-white/10">
          <DialogHeader className="space-y-2">
            <div className="size-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mb-2">
              <RotateCcw className="size-6 animate-spin-reverse" />
            </div>
            <DialogTitle className="text-xl font-black uppercase tracking-tight">
              Trigger Annual Revalidation
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 font-medium leading-relaxed">
              This institutional action will set all student and faculty athlete accounts to{' '}
              <span className="font-bold text-red-400">Inactive</span> and revoke their active eligibility. They will be restricted from tournament participation until renewed COR documents are submitted and approved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button
              variant="outline"
              className="w-full sm:w-1/2 rounded-xl font-bold h-11 border-white/10 bg-white/5"
              onClick={() => setIsRevalidateModalOpen(false)}
              disabled={isRevalidating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-1/2 bg-red-600 hover:bg-red-700 font-bold h-11 rounded-xl shadow-lg shadow-red-500/20"
              onClick={handleTriggerAnnualRevalidation}
              disabled={isRevalidating}
            >
              {isRevalidating ? 'Processing...' : 'Confirm Revalidation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
