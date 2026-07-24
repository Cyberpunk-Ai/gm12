import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Image as ImageIcon, X, Loader2, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EmojiPicker } from './emoji-picker';

interface Selected { file: File; url: string; type: 'image' | 'video'; }

export function CreatePost({ onCreated }: { onCreated?: () => void }) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Selected[]>([]);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    const next: Selected[] = [];
    for (const f of list) {
      if (f.size > 25 * 1024 * 1024) { toast({ title: 'File too large', description: `${f.name} > 25MB`, variant: 'destructive' }); continue; }
      const isVideo = f.type.startsWith('video/');
      const isImage = f.type.startsWith('image/');
      if (!isVideo && !isImage) continue;
      next.push({ file: f, url: URL.createObjectURL(f), type: isVideo ? 'video' : 'image' });
    }
    setFiles((prev) => [...prev, ...next].slice(0, 10));
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeAt = (i: number) => setFiles((prev) => prev.filter((_, k) => k !== i));

  const publish = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sign in required');
      if (files.length === 0) throw new Error('Add at least one photo or video');
      const { data: post, error } = await supabase.from('posts').insert({
        user_id: user.id, caption: caption.trim() || null, location: location.trim() || null,
      }).select('id').single();
      if (error) throw error;

      const rows: { post_id: string; media_path: string; media_type: string; position: number }[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const ext = f.file.name.split('.').pop() || (f.type === 'video' ? 'mp4' : 'jpg');
        const path = `${user.id}/${post.id}/${i}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('posts').upload(path, f.file, { contentType: f.file.type });
        if (upErr) throw upErr;
        rows.push({ post_id: post.id, media_path: path, media_type: f.type, position: i });
      }
      const { error: mErr } = await supabase.from('post_media').insert(rows);
      if (mErr) throw mErr;
    },
    onSuccess: () => {
      setFiles([]); setCaption(''); setLocation('');
      qc.invalidateQueries({ queryKey: ['feed-posts'] });
      qc.invalidateQueries({ queryKey: ['profile-posts'] });
      toast({ title: 'Posted!' });
      onCreated?.();
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (!user) return null;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-sm font-bold">
            {profile?.username?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="text-sm font-semibold">{profile?.username ?? 'You'}</div>
        </div>

        {files.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {files.map((f, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                {f.type === 'video'
                  ? <video src={f.url} className="w-full h-full object-cover" muted />
                  : <img src={f.url} alt="" className="w-full h-full object-cover" />}
                <button onClick={() => removeAt(i)} className="absolute top-1 right-1 bg-black/70 rounded-full p-1">
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Textarea placeholder="Write a caption..." value={caption} onChange={(e) => setCaption(e.target.value)} className="min-h-[80px] resize-none" />

        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Add location" className="h-9 border-0 bg-transparent focus-visible:ring-0 px-0" />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-1">
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={onFiles} className="hidden" />
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              <ImageIcon className="h-4 w-4 mr-1" /> Photo / Video
            </Button>
            <EmojiPicker onPick={(e) => setCaption((c) => c + e)} />
          </div>
          <Button onClick={() => publish.mutate()} disabled={publish.isPending || files.length === 0}>
            {publish.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Share
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
