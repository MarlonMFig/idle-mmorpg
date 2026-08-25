import { motion } from 'motion/react';
import React, { useMemo } from 'react';
import { ShinobiCharacter } from '../types';

interface BackgroundEffectsProps {
  activeCharacter: ShinobiCharacter;
}

export const BackgroundEffects: React.FC<BackgroundEffectsProps> = ({ activeCharacter }) => {
  // Generate stable random particles
  const particles = useMemo(() => {
    return Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      x: (i * 19) % 100,
      y: (i * 31) % 100,
      size: 2 + (i % 3) * 1.5,
      duration: 6 + (i % 4) * 2,
      delay: (i % 5) * 0.7,
    }));
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Deep Midnight Obsidian Radial Base (#020617) */}
      <div className="absolute inset-0 bg-[#020617]" />
      
      {/* Immersive UI Radial Atmospheric Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,_#1e293b_0%,_#020617_70%)] opacity-70" />
      
      {/* Bottom Gradient Fade */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(2,6,23,0.85)_100%)]" />

      {/* Cyber Grid Lines */}
      <div 
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(255, 255, 255, 0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.2) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Dynamic Aura Orb behind active character */}
      <motion.div
        animate={{
          background: `radial-gradient(circle 360px at 50% 45%, ${activeCharacter.themeColor.primary}28 0%, ${activeCharacter.themeColor.accent}0d 50%, transparent 80%)`,
        }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="absolute inset-0"
      />

      {/* Giant Ambient Center Glow */}
      <div 
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] blur-[120px] rounded-full pointer-events-none opacity-40 transition-colors duration-700"
        style={{ backgroundColor: activeCharacter.themeColor.primary }}
      />

      {/* Floating Ambient Sparks / Chakra Motes */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.id % 2 === 0 ? activeCharacter.themeColor.accent : '#38bdf8',
            boxShadow: `0 0 8px ${activeCharacter.themeColor.primary}`,
          }}
          animate={{
            y: [-10, -45, -10],
            x: [0, (p.id % 2 === 0 ? 12 : -12), 0],
            opacity: [0.1, 0.75, 0.1],
            scale: [0.8, 1.3, 0.8],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};
