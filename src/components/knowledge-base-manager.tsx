
'use client';

import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { format } from 'date-fns';
import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { KnowledgeFile } from '@/types';
import { Badge } from './ui/badge';

export default function KnowledgeBaseManager() {
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/knowledge', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch knowledge files.');
      const data = await res.json();
      setFiles(data.sort((a: KnowledgeFile, b: KnowledgeFile) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileType = file.name.split('.').pop()?.toLowerCase() || '';
    const supportedTypes = ['pdf', 'docx', 'txt'];
    if (!supportedTypes.includes(fileType)) {
      toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please upload a .pdf, .docx, or .txt file.' });
      if (event.target) event.target.value = '';
      return;
    }

    setIsUploading(true);

    try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/knowledge/parse', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errorText = await res.text();
          let errorMessage = `Upload failed with status: ${res.status}`;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorMessage;
          } catch (parseError) {
             console.error("Could not parse error response as JSON. Server response:", errorText);
          }
          throw new Error(errorMessage);
        }

        toast({ title: 'Success', description: `File "${file.name}" uploaded and processed.` });
        await fetchFiles(); // Refresh list

      } catch (error) {
        toast({ variant: 'destructive', title: 'Upload Failed', description: (error as Error).message });
      } finally {
        setIsUploading(false);
        if (event.target) event.target.value = '';
      }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    try {
        const res = await fetch(`/api/knowledge?id=${fileId}`, { method: 'DELETE' });
        if(!res.ok) throw new Error('Failed to delete file.');
        toast({ title: 'File Deleted', description: `"${fileName}" has been removed.` });
        fetchFiles();
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-6 w-6" /> Upload Document
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input
              id="file-upload"
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileChange}
              disabled={isUploading}
              className="hidden"
            />
            <label htmlFor="file-upload" className="flex-1">
                <Button asChild variant="outline" className="w-full cursor-pointer" disabled={isUploading}>
                    <div>
                        {isUploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                            </>
                        ) : (
                            'Choose a file (.pdf, .docx, .txt)'
                        )}
                    </div>
                </Button>
            </label>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" /> Stored Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Size</TableHead>
                <TableHead className="hidden md:table-cell">Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    <Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : files.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No documents uploaded yet.
                  </TableCell>
                </TableRow>
              ) : (
                files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="max-w-[150px] truncate font-medium sm:max-w-xs">{file.fileName}</TableCell>
                    <TableCell><Badge variant="secondary">{file.fileType.toUpperCase()}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell">{formatBytes(file.size)}</TableCell>
                    <TableCell className="hidden md:table-cell">{format(new Date(file.createdAt), 'PPp')}</TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>{file.fileName}</DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="h-[60vh] rounded-md border p-4 font-mono text-sm">
                            {file.content}
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(file.id, file.fileName)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
