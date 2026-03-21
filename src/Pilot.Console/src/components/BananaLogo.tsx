import React from 'react';
import { Banana } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface BananaLogoProps {
  className?: string;
}

export const BananaLogo: React.FC<BananaLogoProps> = ({ className }) => {
  return (
    <div className={cn("relative flex items-center justify-center aspect-square rounded-full", className)}>
      {/* Soft circular glow - moved inward to avoid edge artifacts */}
      <div className="absolute inset-[10%] bg-primary/20 blur-lg rounded-full animate-pulse" />
      
      {/* The Banana Icon - increased contrast and added better depth */}
      <Banana 
        className="w-[80%] h-[80%] text-primary drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] fill-primary/10 relative z-10" 
        strokeWidth={2.5}
      />
      
      {/* Subtle shine highlight */}
      <div className="absolute top-[20%] right-[25%] w-[8%] h-[8%] bg-white/40 rounded-full blur-[0.5px] z-20" />
    </div>
  );
};
