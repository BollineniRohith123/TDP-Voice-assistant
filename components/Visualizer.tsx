import React from 'react';
import TdpLogo from './TdpLogo';

interface VisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, isSpeaking }) => {
  return (
    <div className="relative h-48 w-full flex items-center justify-center">
      {/* Ambient Glow Background */}
      <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ${
        isActive ? 'w-64 h-64 opacity-20' : 'w-32 h-32 opacity-5'
      }`}>
        <div className="absolute inset-0 bg-tdp-yellow rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute inset-0 bg-tdp-red rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Central Identity Sphere */}
      <div className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-700 ${
        isActive 
          ? 'bg-gradient-to-b from-tdp-yellow to-yellow-600 shadow-[0_0_50px_rgba(252,238,33,0.4)] scale-110' 
          : 'bg-slate-800 border-2 border-slate-700 shadow-inner'
      }`}>
        {/* Spinning Ring */}
        {isActive && (
          <div className="absolute inset-0 rounded-full border-4 border-t-tdp-red border-r-transparent border-b-tdp-red border-l-transparent animate-spin-slow opacity-60"></div>
        )}
        
        <div className={`w-28 h-28 rounded-full flex items-center justify-center bg-slate-900 transition-all ${
          isActive ? 'border-2 border-white/20' : 'border-0'
        }`}>
           <TdpLogo 
             className={`w-16 h-16 transition-all duration-500 ${isActive ? 'opacity-100 drop-shadow-[0_0_10px_rgba(218,37,28,0.8)]' : 'opacity-30 grayscale'}`} 
             color={isActive ? "#DA251C" : "#64748b"}
           />
        </div>
      </div>

      {/* Audio Waveforms (Left) */}
      <div className="absolute left-1/2 -translate-x-24 flex items-center justify-end gap-1.5 h-16 w-32 pr-20">
        {isActive && [...Array(5)].map((_, i) => (
          <div
            key={`l-bar-${i}`}
            className={`w-1.5 bg-tdp-yellow rounded-full transition-all duration-75 ${
              isSpeaking ? 'animate-wave' : 'h-1.5 opacity-30'
            }`}
            style={{
              height: isSpeaking ? `${Math.random() * 40 + 10}px` : '4px',
              animationDuration: '0.8s',
              animationDelay: `-${i * 0.1}s`
            }}
          />
        ))}
      </div>

      {/* Audio Waveforms (Right) */}
      <div className="absolute right-1/2 translate-x-24 flex items-center justify-start gap-1.5 h-16 w-32 pl-20">
        {isActive && [...Array(5)].map((_, i) => (
          <div
            key={`r-bar-${i}`}
            className={`w-1.5 bg-tdp-yellow rounded-full transition-all duration-75 ${
              isSpeaking ? 'animate-wave' : 'h-1.5 opacity-30'
            }`}
            style={{
              height: isSpeaking ? `${Math.random() * 40 + 10}px` : '4px',
              animationDuration: '0.8s',
              animationDelay: `-${i * 0.1}s`
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default Visualizer;