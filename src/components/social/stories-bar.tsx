import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CreateStatus } from '@/components/status/create-status';

export function StoriesBar() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: statuses = [] } = useQuery({
    queryKey: ['stories-bar'],
    queryFn: async () => {
      const { data } = await supabase.from('user_statuses').select('*').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
      if (!data) return [];
      const userIds = [...new Set(data.map((s: any) => s.user_id))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', userIds);
      const pMap = new Map(profiles?.map((p: any) => [p.user_id, p]) ?? []);
      const grouped = new Map<string, any>();
      for (const s of data) {
        if (!grouped.has(s.user_id)) grouped.set(s.user_id, { ...s, profile: pMap.get(s.user_id) });
      }
      return Array.from(grouped.values());
    },
  });

  return (
    <>
      <div className="bg-card border border-border/60 rounded-xl p-3 mb-4 overflow-x-auto scrollbar-none">
        <div className="flex gap-4">
          {user && (
            <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-1 flex-shrink-0 w-16">
              <div className="relative">
                <Avatar className="h-14 w-14 ring-2 ring-border">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback>{profile?.username?.[0]?.toUpperCase() ?? 'U'}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-card">
                  <Plus className="h-3 w-3" />
                </div>
              </div>
              <span className="text-xs text-muted-foreground">Your story</span>
            </button>
          )}
          {statuses.map((s: any) => (
            <div key={s.user_id} className="flex flex-col items-center gap-1 flex-shrink-0 w-16">
              <div className={cn('rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600')}>
                <Avatar className="h-14 w-14 ring-2 ring-card">
                  <AvatarImage src={s.profile?.avatar_url ?? undefined} />
                  <AvatarFallback>{s.profile?.username?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                </Avatar>
              </div>
              <span className="text-xs truncate max-w-full">{s.profile?.username ?? 'user'}</span>
            </div>
          ))}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <CreateStatus />
        </DialogContent>
      </Dialog>
    </>
  );
}
