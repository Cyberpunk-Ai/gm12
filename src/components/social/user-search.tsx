import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search } from 'lucide-react';
import { FollowButton } from './follow-button';
import { useAuth } from '@/lib/auth-context';

export function UserSearch() {
  const [q, setQ] = useState('');
  const { user } = useAuth();
  const { data: users = [] } = useQuery({
    queryKey: ['user-search', q],
    queryFn: async () => {
      let query = supabase.from('profiles').select('user_id, username, avatar_url, followers_count').order('followers_count', { ascending: false }).limit(30);
      if (q.trim()) query = query.ilike('username', `%${q.trim()}%`);
      const { data } = await query;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search users" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-11 rounded-xl" />
      </div>
      <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
        {users.map((u: any) => (
          <div key={u.user_id} className="flex items-center gap-3 p-3">
            <Link to={`/player/${u.user_id}`} className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar className="h-11 w-11">
                <AvatarImage src={u.avatar_url ?? undefined} />
                <AvatarFallback>{u.username?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{u.username}</div>
                <div className="text-xs text-muted-foreground">{u.followers_count ?? 0} followers</div>
              </div>
            </Link>
            {user && user.id !== u.user_id && (
              <FollowButton userId={u.user_id} username={u.username} size="sm" />
            )}
          </div>
        ))}
        {users.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No users found</div>}
      </div>
    </div>
  );
}
