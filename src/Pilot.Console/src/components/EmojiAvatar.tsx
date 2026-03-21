import * as React from 'react';
import { FluentEmoji } from '@lobehub/fluent-emoji';
import { cn } from '@/src/lib/utils';

interface EmojiAvatarProps {
  emoji: string;
  size?: number;
  className?: string;
}

export function EmojiAvatar({ emoji, size = 40, className }: EmojiAvatarProps) {
  // If emoji starts with 'emoji:', remove the prefix
  const emojiName = emoji.startsWith('emoji:') ? emoji.substring(6) : emoji;
  
  return (
    <div className={cn("flex items-center justify-center overflow-hidden rounded-full bg-muted/20", className)}>
      <FluentEmoji emoji={emojiName} size={size} type="3d" />
    </div>
  );
}
