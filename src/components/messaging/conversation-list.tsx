import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ConversationListProps {
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string, otherUser: any) => void;
}

export function ConversationList({ selectedConversationId, onSelectConversation }: ConversationListProps) {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });
      
      if (!data) return [];
      
      // Get other participant profiles
      const otherUserIds = data.map(c => 
        c.participant1_id === user.id ? c.participant2_id : c.participant1_id
      );
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', otherUserIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) ?? []);
      
      return data.map(c => ({
        ...c,
        otherUser: profileMap.get(c.participant1_id === user.id ? c.participant2_id : c.participant1_id)
      }));
    },
    enabled: !!user
  });

  const filteredConversations = conversations.filter(c =>
    c.otherUser?.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-24" />
              <div className="h-3 bg-muted rounded w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
            <MessageCircle className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs">Start chatting with other players!</p>
          </div>
        ) : (
          filteredConversations.map(conversation => (
            <button
              key={conversation.id}
              onClick={() => onSelectConversation(conversation.id, conversation.otherUser)}
              className={cn(
                "w-full flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors border-b border-border/30",
                selectedConversationId === conversation.id && "bg-accent"
              )}
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={conversation.otherUser?.avatar_url} />
                <AvatarFallback>
                  {conversation.otherUser?.username?.charAt(0).toUpperCase() ?? '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="font-medium">{conversation.otherUser?.username ?? 'Unknown'}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
