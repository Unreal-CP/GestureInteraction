import React, { useEffect, useState } from 'react';
import { HandState } from '../types';
import { MousePointer2, Move3d, Maximize2 } from 'lucide-react';

interface UIOverlayProps {
  status: string;
  isReady: boolean;
  handStateRef: React.MutableRefObject<HandState>;
}

export const UIOverlay: React.FC<UIOverlayProps> = ({ status, isReady, handStateRef }) => {
  const [activeMode, setActiveMode] = useState<'IDLE' | 'ZOOM' | 'ROTATE'>('IDLE');

  // Poll the ref for UI updates (lower frequency than 60fps is fine for UI)
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMode(handStateRef.current.mode);
    }, 100);
    return () => clearInterval(interval);
  }, [handStateRef]);

  return (
    <div className="absolute inset-0 pointer-events-none p-8 flex flex-col justify-between z-20">
      
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            手势工坊 3D
          </h1>
          <p className="text-slate-400 text-sm mt-1 uppercase tracking-widest font-semibold">
            空间计算交互界面
          </p>
        </div>
        
        <div className={`flex items-center space-x-2 px-4 py-2 rounded-full border backdrop-blur-md transition-colors ${
          isReady ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${isReady ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
          <span className="text-xs font-bold uppercase">{status}</span>
        </div>
      </div>

      {/* Mode Indicators - Centered */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex gap-8">
        {/* Zoom Indicator */}
        <div className={`flex flex-col items-center transition-all duration-300 ${
          activeMode === 'ZOOM' ? 'opacity-100 scale-110' : 'opacity-20 scale-90'
        }`}>
          <div className="w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-400/50 flex items-center justify-center backdrop-blur-sm mb-2">
            <Maximize2 className="w-8 h-8 text-blue-400" />
          </div>
          <span className="text-blue-300 font-bold tracking-wider text-sm">缩放模式</span>
          <span className="text-blue-400/60 text-xs">握拳拉开</span>
        </div>

        {/* Rotate Indicator */}
        <div className={`flex flex-col items-center transition-all duration-300 ${
          activeMode === 'ROTATE' ? 'opacity-100 scale-110' : 'opacity-20 scale-90'
        }`}>
          <div className="w-16 h-16 rounded-2xl bg-pink-500/20 border border-pink-400/50 flex items-center justify-center backdrop-blur-sm mb-2">
            <Move3d className="w-8 h-8 text-pink-400" />
          </div>
          <span className="text-pink-300 font-bold tracking-wider text-sm">旋转模式</span>
          <span className="text-pink-400/60 text-xs">捏合移动</span>
        </div>
      </div>

      {/* Instructions / Footer */}
      <div className="flex justify-between items-end">
        <div className="space-y-4 max-w-md">
          <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl backdrop-blur-md">
            <h3 className="text-slate-200 font-bold mb-2 flex items-center gap-2">
              <MousePointer2 className="w-4 h-4" /> 
              操作说明
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <span><strong className="text-blue-300">缩放：</strong> 双手握拳并靠近以激活，然后拉开距离放大。张开手掌可停止缩放。</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-400 mt-1.5 shrink-0" />
                <span><strong className="text-pink-300">旋转：</strong> 单手食指拇指捏合。移动手掌旋转物体。</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Tech Stack Badge */}
        <div className="flex gap-4 opacity-50">
            <div className="text-right">
                <div className="text-xs text-slate-500 font-mono">技术驱动</div>
                <div className="text-sm font-bold text-slate-300">MediaPipe x R3F</div>
            </div>
        </div>
      </div>
    </div>
  );
};
