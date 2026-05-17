import { useEffect, useState } from 'react';
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
import { toast } from 'sonner';
import { DataToolbar } from '@/components/admin/DataToolbar';
import { ViewToggle } from '@/components/admin/ViewToggle';
import { ShieldCheck, FileText, ExternalLink, CheckCircle, XCircle, ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useMemo } from 'react';
import { logAudit } from '@/lib/audit';

type PendingDocument = {
  id: string;
  user_id: string;
  document_type: string;
  storage_path: string;
  status: string;
  created_at: string;
  users: {
    full_name: string;
    role: string;
    colleges?: { college_name: string } | { college_name: string }[];
  } | null;
};

export const SystemVerifications = () => {
  const { role, isLoading } = useAuth();
  const [documents, setDocuments] = useState<PendingDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  useEffect(() => {
    if (role === 'Admin') {
      fetchPendingDocuments();
    }
  }, [role]);

  const fetchPendingDocuments = async () => {
    const { data, error } = await supabase
      .from('verification_documents')
      .select('*, users(full_name, role, colleges(college_name))')
      .eq('status', 'Pending')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch pending documents: ' + error.message);
    } else {
      setDocuments((data as unknown) as PendingDocument[]);
    }
  };

  const handleViewDocument = async (path: string) => {
    const { data, error } = await supabase.storage
      .from('verification_documents')
      .createSignedUrl(path, 60);

    if (error) {
      toast.error('Could not open document: ' + error.message);
      return;
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  const handleApprove = async (docId: string, userId: string) => {
    try {
      // 1. Update document status
      const { error: docError } = await supabase
        .from('verification_documents')
        .update({ status: 'Approved' })
        .eq('id', docId);

      if (docError) throw docError;

      // 2. Update user verification status
      const { error: userError } = await supabase
        .from('users')
        .update({ is_verified: true })
        .eq('id', userId);

      if (userError) throw userError;

      toast.success('Document approved and user verified successfully.');
      
      // Audit Log
      logAudit({
        action: 'APPROVE_DOCUMENT',
        entity_type: 'verification_documents',
        entity_id: docId,
        details: `Approved document and verified user ${userId}`
      });

      // Remove from list
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (error: any) {
      toast.error('Error approving document: ' + error.message);
    }
  };

  const handleReject = async (docId: string) => {
    try {
      const { error } = await supabase
        .from('verification_documents')
        .update({ status: 'Rejected' })
        .eq('id', docId);

      if (error) throw error;

      toast.success('Document rejected successfully.');
      
      // Audit Log
      logAudit({
        action: 'REJECT_DOCUMENT',
        entity_type: 'verification_documents',
        entity_id: docId,
        details: `Rejected document ${docId}`
      });

      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (error: any) {
      toast.error('Error rejecting document: ' + error.message);
    }
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchesSearch = doc.users?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            doc.document_type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [documents, searchQuery, statusFilter]);

  if (isLoading) return <div className="p-8">Loading...</div>;

  if (role !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6 relative min-h-screen max-w-[1600px] mx-auto px-4">
      {/* Subtle Grain Texture Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.015] mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/p6.png')]" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-950 text-white py-6 md:py-8 px-6 md:px-10 rounded-[2rem] shadow-2xl border border-white/5 relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-orange-500" />
            <span className="text-orange-500 font-bold text-xs tracking-[0.2em] uppercase">
              Verification Command
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-sans font-black tracking-tight uppercase leading-tight">
            SECURITY <span className="text-orange-500">CLEARANCE</span>
          </h1>
          <p className="text-slate-400 font-sans font-medium text-sm tracking-wide mt-2 max-w-2xl opacity-80">
            Review institutional eligibility documents and manage user verification status.
          </p>
        </div>
        <div className="relative z-10 flex flex-col items-end gap-3">
          <div className="px-5 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-right group-hover:border-orange-500/30 transition-all duration-500">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Pending Requests</p>
            <p className="text-3xl font-black text-orange-500 tracking-tighter leading-none">{documents.length}</p>
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
          searchPlaceholder="Search player name or document..."
          filterOptions={[
            { value: 'all', label: 'All Status' },
            { value: 'Pending', label: 'Pending' },
            { value: 'Approved', label: 'Approved' },
            { value: 'Rejected', label: 'Rejected' }
          ]}
          actions={
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => fetchPendingDocuments()}
              className="h-10 rounded-xl font-bold uppercase tracking-widest text-[10px]"
            >
              Refresh Data
            </Button>
          }
        >
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
        </DataToolbar>

        {filteredDocuments.length === 0 ? (
          <Card className="p-20 text-center bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[2.5rem]">
            <div className="size-20 bg-slate-50 dark:bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="size-10 text-slate-300" />
            </div>
            <h3 className="text-2xl font-black italic uppercase tracking-tighter text-slate-400">No Pending Clearance</h3>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-2">All institutional documents have been processed.</p>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredDocuments.map((doc, idx) => {
              const colleges = doc.users?.colleges;
              const collegeName = Array.isArray(colleges)
                ? colleges[0]?.college_name
                : colleges?.college_name || 'N/A';

              return (
                <Card key={doc.id} className="group hover:border-orange-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl rounded-3xl overflow-hidden border-2 border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${idx * 50}ms` }}>
                  <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl group-hover:bg-orange-500 transition-colors duration-500">
                        <FileText className="size-6 text-slate-400 group-hover:text-white" />
                      </div>
                      <Badge className="bg-orange-500 text-[10px] font-black uppercase tracking-widest py-1 px-3 rounded-full shadow-lg shadow-orange-500/10">
                        {doc.document_type}
                      </Badge>
                    </div>
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter group-hover:text-orange-500 transition-colors">{doc.users?.full_name || 'Unknown'}</h3>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1 mb-6">{doc.users?.role || 'Unknown'} • {collegeName} • {new Date(doc.created_at).toLocaleDateString()}</p>
                    
                    <div className="space-y-3">
                      <Button 
                        variant="outline"
                        className="w-full h-12 rounded-xl font-black uppercase italic tracking-widest text-[10px] border-2 border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5"
                        onClick={() => handleViewDocument(doc.storage_path)}
                      >
                        <ExternalLink className="size-4 mr-2" /> View Document
                      </Button>
                      <div className="grid grid-cols-2 gap-3">
                        <Button 
                          className="h-12 bg-green-500 hover:bg-green-600 text-white rounded-xl font-black uppercase italic tracking-widest text-[10px] shadow-lg shadow-green-500/10"
                          onClick={() => handleApprove(doc.id, doc.user_id)}
                        >
                          Approve
                        </Button>
                        <Button 
                          variant="destructive"
                          className="h-12 rounded-xl font-black uppercase italic tracking-widest text-[10px] shadow-lg shadow-red-500/10"
                          onClick={() => handleReject(doc.id)}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="rounded-[2rem] border-2 border-slate-100 dark:border-white/5 overflow-hidden shadow-2xl">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-white/5">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="font-black uppercase tracking-widest text-[10px] h-14 pl-8">Player Name</TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[10px] h-14">Role</TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[10px] h-14">Type</TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[10px] h-14">Submitted</TableHead>
                  <TableHead className="font-black uppercase tracking-widest text-[10px] h-14 text-right pr-8">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc, idx) => {
                  const colleges = doc.users?.colleges;
                  const collegeName = Array.isArray(colleges)
                    ? colleges[0]?.college_name
                    : colleges?.college_name || 'N/A';

                  return (
                    <TableRow 
                      key={doc.id} 
                      className="hover:bg-orange-50/30 dark:hover:bg-orange-500/5 transition-colors border-slate-100 dark:border-white/5 group animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                      style={{ animationDelay: `${idx * 40}ms` }}
                    >
                      <TableCell className="font-black italic uppercase tracking-tighter text-lg pl-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center font-black text-xs text-slate-500">
                            {doc.users?.full_name?.charAt(0) || '?'}
                          </div>
                          <div className="flex flex-col">
                            <span>{doc.users?.full_name || 'Unknown'}</span>
                            <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase not-italic">{collegeName}</span>
                          </div>
                        </div>
                      </TableCell>
                    <TableCell className="font-bold text-slate-500 uppercase text-[10px] tracking-widest">{doc.users?.role || 'Unknown'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter px-2 border-orange-500/20 text-orange-600">
                        {doc.document_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-xs text-slate-400">{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right pr-8">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-10 w-10 p-0 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"
                          onClick={() => handleViewDocument(doc.storage_path)}
                        >
                          <ExternalLink className="size-4 text-slate-400" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-10 w-10 p-0 rounded-xl hover:bg-green-50 dark:hover:bg-green-500/10 text-green-600"
                          onClick={() => handleApprove(doc.id, doc.user_id)}
                        >
                          <CheckCircle className="size-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-10 w-10 p-0 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600"
                          onClick={() => handleReject(doc.id)}
                        >
                          <XCircle className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
};
