import * as React from 'react';
import { FluentEmoji } from '@lobehub/fluent-emoji';
import { cn } from '@/src/lib/utils';
import { 
  Smile, 
  Hand, 
  Heart, 
  Cat, 
  Leaf, 
  Car, 
  Lightbulb, 
  Search,
  User as UserIcon,
  Image as ImageIcon,
  Check,
  Dices,
  RotateCw,
  Save,
  X
} from 'lucide-react';
import { Input } from './ui/input';
import { Tabs } from '@base-ui/react/tabs';
import { Button } from './ui/button';

const EMOJI_CATEGORIES = [
  { 
    id: 'smileys', 
    name: 'Smileys', 
    icon: <Smile className="w-4 h-4" />, 
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', 
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸',
      '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️',
      '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥',
      '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱',
      '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡',
      '👹', '👺', '👻', '👽', '👾', '🤖'
    ] 
  },
  { 
    id: 'gestures', 
    name: 'Gestures', 
    icon: <Hand className="w-4 h-4" />, 
    emojis: [
      '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
      '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
      '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
      '🙏', '✍️', '💅', '🤳', '💪', '🦾'
    ] 
  },
  { 
    id: 'hearts', 
    name: 'Hearts', 
    icon: <Heart className="w-4 h-4" />, 
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'
    ] 
  },
  { 
    id: 'animals', 
    name: 'Animals', 
    icon: <Cat className="w-4 h-4" />, 
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨',
      '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊',
      '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉',
      '🦇', '狼', '野', '马', '独', '蜂', '蚯', '毛', '蝴', '蜗',
      '瓢', '蚁', '蚊', '苍', '甲', '蟑', '蝎', '蜘', '蛛', '龟',
      '蛇', '蜥', '🦖', '🦕', '章', '乌', '虾', '龙', '蟹', '河',
      '热', '鱼', '海', '鲸', '鲸', '鲨', '鳄', '虎', '豹', '斑',
      '大', '猩', '猛', '象', '河', '犀', '单', '双', '长', '袋',
      '野', '水', '公', '母', '马', '猪', '公', '绵', '山', '鹿',
      '狗', '贵', '导', '服', '猫', '黑', '羽', '公', '火', '渡',
      '孔', '鹦', '天', '火', '鸽', '兔', '浣', '臭', '獾', '水',
      '树', '老', '鼠', '松', '刺', '爪', '龙', '龙'
    ] 
  }
];

const ILLUSTRATED_SEEDS = [
  // White/Light Group (40)
  'Felix', 'Aneka', 'Oliver', 'Jack', 'Harry', 'George', 'Charlie', 'Jacob', 'Thomas', 'William', 
  'Sophie', 'Emily', 'Grace', 'Lily', 'Chloe', 'Lucy', 'Hannah', 'Alice', 'Arthur', 'John', 
  'Peter', 'Steve', 'Tony', 'Logan', 'Wade', 'Bruce', 'Clark', 'Diana', 'Sarah', 'Jessica', 
  'Emma', 'Olivia', 'Isabella', 'Sophia', 'Mia', 'Ava', 'Noah', 'Liam', 'Mason', 'Lucas',
  
  // Asian Group (40)
  'Hiro', 'Yuki', 'Kenji', 'Akira', 'Sakura', 'Haruka', 'Wei', 'Li', 'Chen', 'Ming', 
  'Joon', 'Min', 'Ji', 'Soo', 'Kim', 'Lee', 'Park', 'Han', 'Choi', 'Jung', 
  'Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Ito', 'Watanabe', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato', 
  'Yoshida', 'Yamada', 'Sasaki', 'Inoue', 'Kimura', 'Hayashi', 'Saito', 'Shimizu', 'Yamaguchi', 'Abe',
  
  // Diverse Group (18)
  'Malik', 'Zaid', 'Omar', 'Amir', 'Jamal', 'Kwame', 'Kofi', 'Abebe', 'Zola', 'Zuri', 
  'Nia', 'Imani', 'Aaliyah', 'Layla', 'Amara', 'Anaya', 'Yara', 'Maya'
];

interface AvatarPickerProps {
  onSelect: (seedOrEmoji: string) => void;
  selectedSeed?: string;
  onCancel?: () => void;
  className?: string;
}

export function AvatarPicker({ onSelect, selectedSeed, onCancel, className }: AvatarPickerProps) {
  const [activeEmojiCategory, setActiveEmojiCategory] = React.useState('smileys');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isRandomizing, setIsRandomizing] = React.useState(false);
  
  // Local selection state for previewing before saving
  const [localSelection, setLocalSelection] = React.useState(selectedSeed || '');

  const handleSelectEmoji = (emoji: string) => {
    setLocalSelection(`emoji:${emoji}`);
  };

  const handleSelectSeed = (seed: string) => {
    setLocalSelection(seed);
  };

  const handleRandomize = () => {
    setIsRandomizing(true);
    const randomSeed = Math.random().toString(36).substring(7);
    setLocalSelection(randomSeed);
    // Visual feedback delay
    setTimeout(() => setIsRandomizing(false), 300);
  };

  const filteredEmojiCategories = EMOJI_CATEGORIES.map(category => ({
    ...category,
    emojis: searchQuery 
      ? category.emojis.filter(e => e.includes(searchQuery))
      : category.emojis
  })).filter(category => category.emojis.length > 0);

  const filteredIllustratedSeeds = searchQuery 
    ? ILLUSTRATED_SEEDS.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
    : ILLUSTRATED_SEEDS;

  const isCustomSeedSelected = localSelection && 
                               !localSelection.startsWith('emoji:') && 
                               !ILLUSTRATED_SEEDS.includes(localSelection);

  const hasChanged = localSelection !== selectedSeed;

  return (
    <div className={cn("flex flex-col h-[520px] w-full border rounded-xl overflow-hidden bg-background", className)}>
      <Tabs.Root defaultValue="dicebear" className="flex flex-col h-full min-h-0">
        <div className="flex border-b bg-muted/30">
          <Tabs.List className="flex-1 flex">
            <Tabs.Tab 
              value="dicebear" 
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all data-[selected]:bg-background data-[selected]:text-primary data-[selected]:shadow-[0_1px_0_0_var(--primary)] border-r"
            >
              <ImageIcon className="w-4 h-4" /> DiceBear
            </Tabs.Tab>
            <Tabs.Tab 
              value="emoji" 
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all data-[selected]:bg-background data-[selected]:text-primary data-[selected]:shadow-[0_1px_0_0_var(--primary)]"
            >
              <Smile className="w-4 h-4" /> Emojis
            </Tabs.Tab>
          </Tabs.List>
        </div>

        <div className="p-3 border-b bg-muted/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search..." 
              className="pl-9 bg-background h-9 text-sm rounded-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Tabs.Panel value="dicebear" className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="grid grid-cols-4 gap-4 pb-4">
            {!searchQuery && (
              <button
                onClick={handleRandomize}
                className={cn(
                  "aspect-square rounded-2xl p-1 transition-all border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center justify-center relative group",
                  isCustomSeedSelected ? "bg-primary/10 border-primary ring-1 ring-primary" : "bg-muted/10"
                )}
              >
                <div className="flex flex-col items-center gap-1">
                  {isCustomSeedSelected ? (
                    <img 
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${localSelection}`} 
                      alt="Custom" 
                      className="w-12 h-12 object-contain mb-1"
                    />
                  ) : (
                    <Dices className={cn("w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors", isRandomizing && "animate-bounce text-primary")} />
                  )}
                  <span className="text-[9px] font-bold text-muted-foreground group-hover:text-primary uppercase tracking-tighter">
                    {isCustomSeedSelected ? "Custom" : "Random"}
                  </span>
                </div>
                {isCustomSeedSelected && (
                  <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 shadow-md">
                    <Check className="w-2 h-2" />
                  </div>
                )}
                <div className="absolute bottom-1 right-1 opacity-40 group-hover:opacity-100">
                  <RotateCw className={cn("w-2.5 h-2.5", isRandomizing && "animate-spin")} />
                </div>
              </button>
            )}

            {filteredIllustratedSeeds.map((seed, idx) => (
              <button
                key={`${seed}-${idx}`}
                onClick={() => handleSelectSeed(seed)}
                className={cn(
                  "aspect-square rounded-2xl p-1 transition-all hover:bg-primary/10 hover:scale-105 flex flex-col items-center justify-center relative group",
                  localSelection === seed ? "bg-primary/20 ring-2 ring-primary" : "bg-muted/30"
                )}
              >
                <img 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`} 
                  alt={seed} 
                  className="w-full h-full object-contain"
                />
                <div className="absolute inset-0 bg-primary/40 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity flex items-center justify-center text-center p-1">
                  <span className="text-[10px] font-bold text-white uppercase">{seed}</span>
                </div>
                {localSelection === seed && (
                  <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 shadow-md">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="emoji" className="flex-1 flex flex-col min-h-0">
          <div className="flex border-b bg-muted/5 overflow-x-auto no-scrollbar">
            {EMOJI_CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveEmojiCategory(category.id)}
                className={cn(
                  "p-3 transition-colors hover:bg-muted/30 shrink-0",
                  activeEmojiCategory === category.id && !searchQuery ? "bg-muted/50 text-primary border-b-2 border-primary" : "text-muted-foreground"
                )}
                title={category.name}
              >
                {category.icon}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {filteredEmojiCategories.map((category) => (
              <div key={category.id} className={cn("mb-6", activeEmojiCategory !== category.id && !searchQuery && "hidden")}>
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">{category.name}</h3>
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                  {category.emojis.map((emoji, eIdx) => (
                    <button
                      key={`emoji-${emoji}-${eIdx}`}
                      onClick={() => handleSelectEmoji(emoji)}
                      className={cn(
                        "p-2 rounded-xl transition-all hover:bg-primary/10 hover:scale-110 flex items-center justify-center relative",
                        localSelection === `emoji:${emoji}` ? "bg-primary/20 ring-1 ring-primary" : "bg-muted/30"
                      )}
                    >
                      <FluentEmoji emoji={emoji} size={28} type="3d" />
                      {localSelection === `emoji:${emoji}` && (
                        <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Tabs.Panel>

        {/* Footer with Save/Cancel */}
        <div className="p-4 border-t bg-muted/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-background border shadow-sm flex items-center justify-center overflow-hidden shrink-0">
              {localSelection.startsWith('emoji:') ? (
                <FluentEmoji emoji={localSelection.substring(6)} size={24} type="3d" />
              ) : (
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${localSelection}`} alt="Preview" className="w-8 h-8" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Preview</p>
              <p className="text-xs font-semibold truncate text-foreground">{localSelection.startsWith('emoji:') ? 'Fluent Emoji' : localSelection}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-9 gap-2 font-bold px-4" onClick={onCancel}>
               Cancel
            </Button>
            <Button size="sm" className="h-9 gap-2 font-bold px-6 shadow-lg shadow-primary/20" onClick={() => onSelect(localSelection)} disabled={!hasChanged}>
               <Save className="w-3.5 h-3.5" /> Save Avatar
            </Button>
          </div>
        </div>
      </Tabs.Root>
    </div>
  );
}
