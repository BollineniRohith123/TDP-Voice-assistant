import React from 'react';

interface TdpLogoProps {
  className?: string;
  color?: string;
}

const TdpLogo: React.FC<TdpLogoProps> = ({ className = "w-12 h-12", color = "#DA251C" }) => {
  return (
    <svg 
      className={className} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer Ring */}
      <circle cx="50" cy="50" r="45" stroke={color} strokeWidth="8" />
      
      {/* Inner Ring */}
      <circle cx="50" cy="50" r="15" stroke={color} strokeWidth="4" fill="transparent" />
      
      {/* Hub */}
      <circle cx="50" cy="50" r="6" fill={color} />
      
      {/* Spokes (24 spokes like a chakra/wheel) */}
      {[...Array(12)].map((_, i) => (
        <path
          key={i}
          d="M50 15 L50 85"
          stroke={color}
          strokeWidth="3"
          transform={`rotate(${i * 15} 50 50)`}
        />
      ))}
      
      {/* Decorative dots on rim */}
      {[...Array(12)].map((_, i) => (
        <circle
          key={`dot-${i}`}
          cx="50" 
          cy="4"
          r="1.5"
          fill={color}
          transform={`rotate(${i * 30} 50 50)`}
        />
      ))}
    </svg>
  );
};

export default TdpLogo;