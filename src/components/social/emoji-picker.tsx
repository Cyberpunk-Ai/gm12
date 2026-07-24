import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';
import { EMOJI_GROUPS, EMOJI_QUICK } from '@/lib/emojis';
import { cn } from '@/lib/utils';

interface Props {
  onPick: (emoji: string) => void;
  className?: string;
}

export function EmojiPicker({ onPick, className }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<string>('Quick');
  const groups = { Quick: EMOJI_QUICK, ...EMOJI_GROUPS };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8 text-muted-foreground', className)}>
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="flex gap-1 mb-2 overflow-x-auto pb-1 scrollbar-none">
          {Object.keys(groups).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setTab(g)}
              className={cn(
                'text-xs px-2 py-1 rounded-full whitespace-nowrap',
                tab === g ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              )}
            >{g}</button>
          ))}
        </div>
        <div className="grid grid-cols-8 gap-1 max-h-52 overflow-y-auto">
          {groups[tab].map((e, i) => (
            <button
              key={`${e}-${i}`}
              type="button"
              onClick={() => { onPick(e); setOpen(false); }}
              className="text-xl hover:bg-secondary rounded p-1"
            >{e}</button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
