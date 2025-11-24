import React, { useRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Stars } from '@react-three/drei';
import { SceneContent } from './components/SceneContent';
import { HandTracker } from './components/HandTracker';
import { UIOverlay } from './components/UIOverlay';
import { HandState, INITIAL_HAND_STATE } from './types';

export default function App() {
  // Shared mutable state for high-frequency updates without re-renders
  const handStateRef = useRef<HandState>(INITIAL_HAND_STATE);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [trackerStatus, setTrackerStatus] = useState<string>('正在初始化 AI...');

  return (
    <div className="relative w-full h-screen bg-slate-900 text-white overflow-hidden font-sans select-none">
      
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-10">
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
          <color attach="background" args={['#0f172a']} />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />
          
          <SceneContent handStateRef={handStateRef} />
          
          <Environment preset="city" />
        </Canvas>
      </div>

      {/* Hand Tracking Logic (Invisible/PiP) */}
      <HandTracker 
        onStatusChange={setTrackerStatus} 
        onCameraReady={() => setIsCameraReady(true)}
        handStateRef={handStateRef} 
      />

      {/* UI Overlay */}
      <UIOverlay 
        status={trackerStatus} 
        isReady={isCameraReady}
        handStateRef={handStateRef}
      />
    </div>
  );
}