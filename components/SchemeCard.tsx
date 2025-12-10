import React from 'react';
import { Scheme } from '../types';

interface SchemeCardProps {
  scheme: Scheme;
}

const SchemeCard: React.FC<SchemeCardProps> = ({ scheme }) => {
  return (
    <div className="group relative bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-slate-100 hover:border-tdp-yellow/50">
      {/* Top accent bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-tdp-yellow to-tdp-red"></div>
      
      <div className="p-6 flex gap-5">
        {/* Icon Container */}
        <div className="flex-shrink-0">
          <div className="w-14 h-14 rounded-full bg-yellow-50 border-2 border-tdp-yellow/20 flex items-center justify-center text-3xl group-hover:scale-110 group-hover:bg-tdp-yellow group-hover:border-tdp-yellow transition-all duration-300 shadow-sm">
            <span className="group-hover:text-red-700 transition-colors">{scheme.icon}</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex flex-col mb-2">
            <span className="text-xs font-bold text-tdp-red tracking-wider uppercase mb-1">Welfare Scheme</span>
            <h3 className="font-bold text-slate-800 text-lg group-hover:text-tdp-red transition-colors">
              {scheme.title}
            </h3>
            <h4 className="font-telugu text-lg font-medium text-slate-500 group-hover:text-slate-700">
              {scheme.teluguTitle}
            </h4>
          </div>
          
          <p className="text-sm text-slate-600 leading-relaxed">
            {scheme.description}
          </p>

          <div className="mt-4 flex items-center text-xs font-semibold text-tdp-gold opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
            ASK ABOUT THIS
            <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </div>
      </div>

      {/* Subtle Background Pattern */}
      <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-yellow-50 to-transparent rounded-tl-full -z-10 opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
    </div>
  );
};

export default SchemeCard;