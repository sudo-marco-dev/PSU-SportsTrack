import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export const VerificationUpload = ({ onUploadSuccess }: { onUploadSuccess?: () => void }) => {
  const { user } = useAuth();
  const [corFile, setCorFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (!user) return;
    if (!corFile || !idFile) {
      toast.error('Please select both your COR and Valid ID');
      return;
    }

    setIsUploading(true);

    try {
      // Helper function to upload and create record
      const uploadDocument = async (file: File, type: 'COR' | 'Valid ID') => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`; // Structured as {user_id}/{uuid}-{filename}

        const { error: uploadError } = await supabase.storage
          .from('verification_documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase.from('verification_documents').insert({
          user_id: user.id,
          document_type: type,
          storage_path: filePath,
          status: 'Pending',
        });

        if (dbError) throw dbError;
      };

      await uploadDocument(corFile, 'COR');
      await uploadDocument(idFile, 'Valid ID');

      toast.success('Documents uploaded successfully. Please wait for admin approval.');
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle>Verify Your Account</CardTitle>
        <CardDescription>
          As a player, you must upload your Certificate of Registration (COR) and a Valid PSU ID to be verified.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cor">Certificate of Registration (COR)</Label>
          <Input id="cor" type="file" onChange={(e) => setCorFile(e.target.files?.[0] || null)} />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="id">Valid PSU ID</Label>
          <Input id="id" type="file" onChange={(e) => setIdFile(e.target.files?.[0] || null)} />
        </div>

        <Button 
          className="w-full" 
          onClick={handleUpload} 
          disabled={!corFile || !idFile || isUploading}
        >
          {isUploading ? 'Uploading...' : 'Upload Documents'}
        </Button>
      </CardContent>
    </Card>
  );
};
