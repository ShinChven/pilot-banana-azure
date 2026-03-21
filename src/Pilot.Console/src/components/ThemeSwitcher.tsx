import React from 'react';
import { useAccent } from '../context/ThemeContext';
import { useTheme } from 'next-themes';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuGroup
} from '@/src/components/ui/dropdown-menu';
import { Button } from '@/src/components/ui/button';
import { Palette, Check, Sun, Moon, Laptop, Sparkles } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export function ThemeSwitcher() {
  const { 
    accentColor, 
    setAccentColor, 
    availableColors,
    glassEnabled,
    setGlassEnabled,
    transparencyEnabled,
    setTransparencyEnabled,
    flickerEnabled,
    setFlickerEnabled
  } = useAccent();
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" title="Theme and Accent" />} nativeButton={true}>
        <Palette className="w-5 h-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className={cn(
          "w-56",
          transparencyEnabled ? "bg-background/80" : "bg-background",
          glassEnabled && "backdrop-blur-xl"
        )}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setTheme('light')} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4" />
              <span>Light</span>
            </div>
            {theme === 'light' && <Check className="w-4 h-4" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('dark')} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4" />
              <span>Dark</span>
            </div>
            {theme === 'dark' && <Check className="w-4 h-4" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('system')} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4" />
              <span>System</span>
            </div>
            {theme === 'system' && <Check className="w-4 h-4" />}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Visual Effects</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setGlassEnabled(!glassEnabled)}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">Frosted Glass</span>
            </div>
            {glassEnabled && <Check className="w-4 h-4" />}
          </DropdownMenuItem>

          <DropdownMenuItem 
            onClick={() => setTransparencyEnabled(!transparencyEnabled)}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">Transparency</span>
            </div>
            {transparencyEnabled && <Check className="w-4 h-4" />}
          </DropdownMenuItem>

          <DropdownMenuItem 
            onClick={() => setFlickerEnabled(!flickerEnabled)}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">Background Glow</span>
            </div>
            {flickerEnabled && <Check className="w-4 h-4" />}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuGroup>
          <DropdownMenuLabel>Accent Color</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {availableColors.map((color) => (
            <DropdownMenuItem 
              key={color.name} 
              onClick={() => setAccentColor(color)}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: color.primary }}
                />
                <span>{color.name}</span>
              </div>
              {accentColor.name === color.name && <Check className="w-4 h-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
