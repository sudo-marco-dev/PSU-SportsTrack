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
  };
};

export const AdminDashboard = () => {
  const { role, isLoading } = useAuth();
  const [documents, setDocuments] = useState<PendingDocument[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (role === 'Admin') {
      fetchPendingDocuments();
    }
  }, [role]);

  const fetchPendingDocuments = async () => {
    setIsFetching(true);
    const { data, error } = await supabase
      .from('verification_documents')
      .select('*, users(full_name, role)')
      .eq('status', 'Pending')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch pending documents: ' + error.message);
    } else {
      setDocuments((data as unknown) as PendingDocument[]);
    }
    setIsFetching(false);
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
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (error: any) {
      toast.error('Error rejecting document: ' + error.message);
    }
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  if (role !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin Verification Dashboard</h1>
        <Badge variant="secondary">{documents.length} Pending</Badge>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Player Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Document Type</TableHead>
              <TableHead>Action Links</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-gray-500">
                  {isFetching ? 'Loading documents...' : 'No pending documents.'}
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{doc.users?.full_name || 'Unknown'}</TableCell>
                  <TableCell>{doc.users?.role || 'Unknown'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{doc.document_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="link"
                      onClick={() => handleViewDocument(doc.storage_path)}
                      className="px-0"
                    >
                      View Document
                    </Button>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleApprove(doc.id, doc.user_id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleReject(doc.id)}
                    >
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
