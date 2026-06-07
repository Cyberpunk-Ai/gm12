import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useState, useEffect, useRef } from 'react';
import { Send, Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { encryptMessage, decryptMessage } from '@/lib/encryption';
import { cn } from '@/lib/utils';

interface ChatWindowProps {
  conversationId: string;
  otherUser: { user_id: string; username: string; avatar_url?: string } | null;
  onBack?: () => void;
}

export function ChatWindow({ conversationId, otherUser, onBack }: ChatWindowProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const [decryptedMessages, setDecryptedMessages] = useState<Map<string, string>>(new Map());
  const [isOtherOnline, setIsOtherOnline] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      return data ?? [];
    },
    enabled: !!conversationId
  });

  // Decrypt messages
  useEffect(() => {
    async function decrypt() {
      const decrypted = new Map<string, string>();
      for (const msg of messages) {
        if (msg.is_encrypted) {
          decrypted.set(msg.id, await decryptMessage(msg.content));
        } else {
          decrypted.set(msg.id, msg.content);
        }
      }
      setDecryptedMessages(decrypted);
    }
    decrypt();
  }, [messages]);

  // Subscribe to new messages
  useEffect(() => {
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  // Presence + typing channel
  useEffect(() => {
    if (!user || !conversationId) return;
    const channel = supabase.channel(`presence-${conversationId}`, {
      config: { presence: { key: user.id } },
    });
    presenceChannelRef.current = channel;
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setIsOtherOnline(!!(otherUser?.user_id && state[otherUser.user_id]));
      })
      .on('broadcast', { event: 'typing' }, (payload: any) => {
        if (payload.payload?.userId === otherUser?.user_id) {
          setIsOtherTyping(!!payload.payload?.typing);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ online_at: Date.now() });
      });

    return () => {
      supabase.removeChannel(channel);
      presenceChannelRef.current = null;
    };
  }, [conversationId, user, otherUser?.user_id]);

  const sendTyping = (typing: boolean) => {
    presenceChannelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user?.id, typing },
    });
  };

  const handleTypingChange = (value: string) => {
    setNewMessage(value);
    sendTyping(true);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => sendTyping(false), 1500);
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [decryptedMessages]);

  // Mark messages as read
  useEffect(() => {
    if (messages.length > 0 && user) {
      const unreadMessages = messages.filter(m => !m.is_read && m.sender_id !== user.id);
      if (unreadMessages.length > 0) {
        supabase
          .from('messages')
          .update({ is_read: true })
          .in('id', unreadMessages.map(m => m.id))
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
          });
      }
    }
  }, [messages, user, conversationId, queryClient]);

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const encrypted = await encryptMessage(content);
      
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: encrypted,
        is_encrypted: true
      });
      
      if (error) throw error;
      
      // Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  });

  const handleSend = () => {
    if (newMessage.trim()) {
      sendMessageMutation.mutate(newMessage.trim());
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/50 bg-card">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <Avatar className="h-10 w-10">
          <AvatarImage src={otherUser?.avatar_url} />
          <AvatarFallback>{otherUser?.username?.charAt(0).toUpperCase() ?? '?'}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">{otherUser?.username ?? 'Unknown'}</p>
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                isOtherOnline ? 'bg-green-500' : 'bg-muted-foreground/40'
              )}
              title={isOtherOnline ? 'Online' : 'Offline'}
            />
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {isOtherTyping ? (
              <span className="text-primary animate-pulse">typing…</span>
            ) : (
              <>
                <Lock className="h-3 w-3" />
                <span>End-to-end encrypted</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Lock className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Start a secure conversation</p>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.sender_id === user?.id ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[70%] rounded-2xl px-4 py-2",
                  message.sender_id === user?.id
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted rounded-bl-md"
                )}
              >
                <p className="text-sm break-words">
                  {decryptedMessages.get(message.id) ?? '...'}
                </p>
                <p className={cn(
                  "text-xs mt-1",
                  message.sender_id === user?.id ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border/50 bg-card">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => handleTypingChange(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sendMessageMutation.isPending}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
