import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Camera, Grid3x3, Bookmark, Play, Images, Plus, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MediaImage, MediaVideo } from './media-image';
import { PostCard, type PostRow } from './post-card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function SocialProfileView({ userId }: { userId?: string }) {
  const { user, profile: myProfile, refreshProfile } = useAuth();
  const targetId = userId ?? user?.id;
  const isMe = targetId === user?.id;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<'posts' | 'reels' | 'saved'>('posts');
  const [selected, setSelected] = useState<PostRow | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  const { data: profile } = useQuery({
    queryKey: ['social-profile', targetId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', targetId!).maybeSingle();
      return data;
    },
    enabled: !!targetId,
  });

  const { data: posts = [] } = useQuery({
    queryKey: ['profile-posts', targetId, tab],
    queryFn: async () => {
      if (tab === 'saved') {
        if (!isMe || !user) return [] as PostRow[];
        const { data: saved } = await supabase.from('saved_posts').select('post_id').eq('user_id', user.id);
        const ids = (saved ?? []).map((r: any) => r.post_id);
        if (ids.length === 0) return [];
        const { data } = await supabase.from('posts').select('*').in('id', ids);
        return await enrich(data ?? []);
      }
      let q = supabase.from('posts').select('*').eq('user_id', targetId!).eq('is_archived', false).order('created_at', { ascending: false });
      const { data } = await q;
      return await enrich(data ?? []);
    },
    enabled: !!targetId,
  });

  async function enrich(rows: any[]): Promise<PostRow[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((p) => p.id);
    const uIds = [...new Set(rows.map((p) => p.user_id))];
    const [{ data: media }, { data: profiles }] = await Promise.all([
      supabase.from('post_media').select('*').in('post_id', ids).order('position'),
      supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', uIds),
    ]);
    const mMap = new Map<string, any[]>();
    (media ?? []).forEach((m: any) => { const a = mMap.get(m.post_id) ?? []; a.push(m); mMap.set(m.post_id, a); });
    const pMap = new Map(profiles?.map((p: any) => [p.user_id, p]) ?? []);
    return rows.map((p) => ({ ...p, media: mMap.get(p.id) ?? [], profile: pMap.get(p.user_id) }));
  }

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      if (!user) return;
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = await supabase.storage.from('avatars').createSignedUrl(path, 60 * 60 * 24 * 365);
      await supabase.from('profiles').update({ avatar_url: data?.signedUrl ?? null }).eq('user_id', user.id);
    },
    onSuccess: () => { toast({ title: 'Avatar updated' }); refreshProfile?.(); qc.invalidateQueries({ queryKey: ['social-profile'] }); },
    onError: (e: any) => toast({ title: 'Upload failed', description: e.message, variant: 'destructive' }),
  });

  const { data: highlights = [] } = useQuery({
    queryKey: ['highlights', targetId],
    queryFn: async () => {
      const { data } = await supabase.from('highlights').select('*').eq('user_id', targetId!).order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!targetId,
  });

  const addHighlight = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const title = prompt('Highlight title')?.trim();
      if (!title) return;
      await supabase.from('highlights').insert({ user_id: user.id, title });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['highlights'] }),
  });

  if (!profile) return <div className="text-center py-10 text-muted-foreground">Loading profile...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start gap-6 md:gap-12 px-2 md:px-0">
        <div className="relative">
          <Avatar className="h-20 w-20 md:h-32 md:w-32 ring-2 ring-border">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="text-2xl">{profile.username?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
          </Avatar>
          {isMe && (
            <>
              <button onClick={() => avatarRef.current?.click()} className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1.5 border-2 border-card">
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadAvatar.mutate(e.target.files[0])} />
            </>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold">{profile.username}</h2>
            {isMe ? (
              <Link to="/settings"><Button variant="secondary" size="sm">Edit profile</Button></Link>
            ) : (
              <Button size="sm">Follow</Button>
            )}
            {isMe && <Link to="/settings"><Button variant="ghost" size="icon" className="h-8 w-8"><Settings2 className="h-5 w-5" /></Button></Link>}
          </div>
          <div className="flex gap-6 mt-3 text-sm">
            <div><b>{posts.length}</b> posts</div>
            <div><b>{profile.followers_count ?? 0}</b> followers</div>
            <div><b>{profile.following_count ?? 0}</b> following</div>
          </div>
          {profile.game_handle && <div className="mt-2 font-semibold text-sm">{profile.game_handle}</div>}
          {profile.bio && <div className="mt-1 text-sm whitespace-pre-wrap">{profile.bio}</div>}
        </div>
      </div>

      {/* Highlights */}
      <div className="flex gap-4 overflow-x-auto px-2 md:px-0 pb-2 scrollbar-none">
        {isMe && (
          <button onClick={() => addHighlight.mutate()} className="flex flex-col items-center gap-1 w-20 flex-shrink-0">
            <div className="h-16 w-16 rounded-full border-2 border-dashed border-border flex items-center justify-center">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <span className="text-xs text-muted-foreground">New</span>
          </button>
        )}
        {highlights.map((h: any) => (
          <div key={h.id} className="flex flex-col items-center gap-1 w-20 flex-shrink-0">
            <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
              <div className="h-full w-full rounded-full bg-card flex items-center justify-center text-xs font-semibold">
                {h.title[0]?.toUpperCase()}
              </div>
            </div>
            <span className="text-xs truncate w-full text-center">{h.title}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-t border-border flex justify-center gap-8">
        <button onClick={() => setTab('posts')} className={cn('py-3 flex items-center gap-2 text-xs font-semibold', tab === 'posts' ? 'text-foreground border-t-2 -mt-px border-foreground' : 'text-muted-foreground')}>
          <Grid3x3 className="h-4 w-4" /> POSTS
        </button>
        <button onClick={() => setTab('reels')} className={cn('py-3 flex items-center gap-2 text-xs font-semibold', tab === 'reels' ? 'text-foreground border-t-2 -mt-px border-foreground' : 'text-muted-foreground')}>
          <Play className="h-4 w-4" /> REELS
        </button>
        {isMe && (
          <button onClick={() => setTab('saved')} className={cn('py-3 flex items-center gap-2 text-xs font-semibold', tab === 'saved' ? 'text-foreground border-t-2 -mt-px border-foreground' : 'text-muted-foreground')}>
            <Bookmark className="h-4 w-4" /> SAVED
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1 md:gap-2">
        {(tab === 'reels' ? posts.filter((p) => p.media[0]?.media_type === 'video') : posts).map((p) => {
          const first = p.media?.[0]; if (!first) return null;
          return (
            <button key={p.id} onClick={() => setSelected(p)} className="relative aspect-square overflow-hidden bg-muted group">
              {first.media_type === 'video'
                ? <MediaImage bucket="posts" path={first.media_path} className="w-full h-full object-cover" />
                : <MediaImage bucket="posts" path={first.media_path} className="w-full h-full object-cover" />}
              <div className="absolute top-1.5 right-1.5 text-white drop-shadow flex items-center gap-1">
                {first.media_type === 'video' && <Play className="h-4 w-4 fill-white" />}
                {p.media.length > 1 && <Images className="h-4 w-4" />}
              </div>
            </button>
          );
        })}
      </div>
      {posts.length === 0 && <div className="text-center py-12 text-muted-foreground">No posts yet</div>}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-[500px] p-0 bg-transparent border-0 shadow-none">
          {selected && <PostCard post={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
