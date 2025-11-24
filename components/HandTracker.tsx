import React, { useEffect, useRef } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { HandState, PINCH_THRESHOLD, INITIAL_HAND_STATE } from '../types';

interface HandTrackerProps {
  onStatusChange: (status: string) => void;
  onCameraReady: () => void;
  handStateRef: React.MutableRefObject<HandState>;
}

// Helper to determine if a hand is "open" (fingers extended)
const isHandOpen = (landmarks: any[]) => {
  const wrist = landmarks[0];
  // Check fingers: Index(8), Middle(12), Ring(16), Pinky(20)
  // Compare distance from wrist to tip vs wrist to PIP (joint before tip)
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  
  let extendedCount = 0;
  for(let i=0; i<4; i++) {
     const tip = landmarks[tips[i]];
     const pip = landmarks[pips[i]];
     // Using 2D distance for simplicity as depth can be noisy
     const dTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
     const dPip = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
     if (dTip > dPip) extendedCount++;
  }
  // If 3 or more fingers are extended, consider it open
  return extendedCount >= 3;
};

export const HandTracker: React.FC<HandTrackerProps> = ({ onStatusChange, onCameraReady, handStateRef }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);
  const isZoomActiveRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const setupMediaPipe = async () => {
      try {
        onStatusChange('正在加载视觉模型...');
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        if (!mounted) return;

        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2 // Enable 2-hand tracking
        });

        landmarkerRef.current = handLandmarker;
        onStatusChange('正在启动摄像头...');
        startWebcam();
      } catch (error) {
        console.error(error);
        onStatusChange('AI 初始化失败');
      }
    };

    const startWebcam = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        onStatusChange('不支持摄像头');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener("loadeddata", () => {
             if (mounted) {
               onCameraReady();
               onStatusChange('追踪已就绪');
               predictWebcam();
             }
          });
        }
      } catch (err) {
        console.error(err);
        onStatusChange('权限被拒绝');
      }
    };

    setupMediaPipe();

    return () => {
      mounted = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
      landmarkerRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const predictWebcam = () => {
    if (!landmarkerRef.current || !videoRef.current || !canvasRef.current) return;

    // Detect
    const startTimeMs = performance.now();
    const result = landmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

    // Draw & Process
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Mirror the drawing context
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    const drawingUtils = new DrawingUtils(ctx);

    if (result.landmarks && result.landmarks.length > 0) {
      // Draw all hands
      for (const landmarks of result.landmarks) {
        drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
          color: "#22c55e",
          lineWidth: 3
        });
        drawingUtils.drawLandmarks(landmarks, {
          color: "#ffffff",
          lineWidth: 1,
          radius: 3
        });
      }

      // Handle Interactions
      if (result.landmarks.length === 2) {
        // --- ZOOM MODE (Two Hands) ---
        const h1 = result.landmarks[0][0]; // Wrist
        const h2 = result.landmarks[1][0];
        
        // Calculate Distance
        const dx = h1.x - h2.x;
        const dy = h1.y - h2.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        const cx = (h1.x + h2.x) / 2 * canvas.width;
        const cy = (h1.y + h2.y) / 2 * canvas.height;

        // Gesture Detection
        const hand1Open = isHandOpen(result.landmarks[0]);
        const hand2Open = isHandOpen(result.landmarks[1]);
        const bothHandsOpen = hand1Open && hand2Open;
        const bothHandsClosed = !hand1Open && !hand2Open;

        // Activation Logic
        const ZOOM_ACTIVATION_THRESHOLD = 0.2; // Slightly more forgiving threshold
        
        // Activate if: Hands are close AND Both hands are closed (fist/pinch)
        if (!isZoomActiveRef.current) {
          if (dist < ZOOM_ACTIVATION_THRESHOLD && bothHandsClosed) {
             isZoomActiveRef.current = true;
          }
        } 
        // Deactivate if: Both hands are open
        else {
          if (bothHandsOpen) {
            isZoomActiveRef.current = false;
          }
        }

        // Visual Feedback for Zoom
        ctx.beginPath();
        ctx.moveTo(h1.x * canvas.width, h1.y * canvas.height);
        ctx.lineTo(h2.x * canvas.width, h2.y * canvas.height);
        ctx.lineWidth = 4;

        if (isZoomActiveRef.current) {
          // Active State
          ctx.strokeStyle = '#3b82f6'; // Blue
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          
          updateHandState(result, 'ZOOM');
        } else {
          // Waiting/Idle State
          ctx.strokeStyle = '#eab308'; // Yellow
          ctx.setLineDash([2, 4]);
          ctx.stroke();

          // Text Feedback
          ctx.save();
          ctx.scale(-1, 1); 
          ctx.fillStyle = '#eab308';
          ctx.font = 'bold 16px Arial';
          
          let statusText = "";
          if (dist >= ZOOM_ACTIVATION_THRESHOLD) {
             statusText = "靠近双手";
          } else if (!bothHandsClosed) {
             statusText = "握拳以激活";
          }

          if (statusText) {
             ctx.fillText(statusText, -cx - 40, cy - 20);
          }
          ctx.restore();
          
          updateHandState(result, 'IDLE'); 
        }
        ctx.setLineDash([]);

      } else {
        // Reset Zoom state if hands lost
        isZoomActiveRef.current = false;

        // --- ROTATE/IDLE MODE (One Hand) ---
        const landmarks = result.landmarks[0];
        const thumb = landmarks[4];
        const index = landmarks[8];

        // Draw Threshold Indicator
        const midX = (thumb.x + index.x) / 2 * canvas.width;
        const midY = (thumb.y + index.y) / 2 * canvas.height;
        
        const dx = (thumb.x - index.x);
        const dy = (thumb.y - index.y);
        const dz = (thumb.z - index.z);
        const currentDist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const isPinched = currentDist < PINCH_THRESHOLD;

        const radius = 30; 

        // Draw Circle Background
        ctx.beginPath();
        ctx.arc(midX, midY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; 
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw Pinch Progress (Threshold Marker)
        // Map distance 0..0.15 to 0..1 progress
        const maxDist = 0.15;
        const progress = Math.min(1, Math.max(0, 1 - (currentDist / maxDist)));
        
        ctx.beginPath();
        // Start from top (-PI/2) and draw arc based on closeness
        ctx.arc(midX, midY, radius, -Math.PI/2, -Math.PI/2 + (progress * Math.PI * 2));
        ctx.strokeStyle = isPinched ? '#ec4899' : '#ffffff';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Visual text
        if (isPinched) {
          ctx.save();
          ctx.scale(-1, 1);
          ctx.fillStyle = '#ec4899';
          ctx.font = 'bold 16px Arial';
          ctx.fillText("旋转", -midX - 20, midY + 50);
          ctx.restore();
        }

        updateHandState(result, isPinched ? 'ROTATE' : 'IDLE');
      }
    } else {
      // Reset
      isZoomActiveRef.current = false;
      handStateRef.current = { ...INITIAL_HAND_STATE };
    }

    ctx.restore();
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const updateHandState = (result: any, detectedMode: 'IDLE' | 'ZOOM' | 'ROTATE') => {
    let pinchDistance = 1;
    let handDistance = 0;
    let position = { x: 0, y: 0 };
    let isPinched = false;

    if (detectedMode === 'ZOOM' && result.landmarks.length === 2) {
        const h1 = result.landmarks[0][0]; 
        const h2 = result.landmarks[1][0];
        
        const dx = h1.x - h2.x;
        const dy = h1.y - h2.y;
        handDistance = Math.sqrt(dx*dx + dy*dy);
        
        const cx = (h1.x + h2.x) / 2;
        const cy = (h1.y + h2.y) / 2;
        
        position = {
            x: (0.5 - cx) * 2,
            y: (cy - 0.5) * 2 
        };
    } else if (result.landmarks.length > 0) {
        const lm = result.landmarks[0];
        const thumb = lm[4];
        const index = lm[8];
        const wrist = lm[0];

        const dx = thumb.x - index.x;
        const dy = thumb.y - index.y;
        const dz = thumb.z - index.z;
        pinchDistance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        isPinched = pinchDistance < PINCH_THRESHOLD;

        const rawX = (thumb.x + wrist.x) / 2;
        const rawY = (thumb.y + wrist.y) / 2;
        
        position = {
            x: (0.5 - rawX) * 2,
            y: (rawY - 0.5) * 2 
        };
    }

    handStateRef.current = {
      pinchDistance,
      handDistance,
      isPinched,
      position,
      isDetected: true,
      mode: detectedMode
    };
  };

  return (
    <div className="absolute bottom-4 right-4 z-50 w-48 h-36 bg-black/50 rounded-lg overflow-hidden border border-white/20 shadow-xl backdrop-blur-sm transform transition-all hover:scale-105">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 opacity-60"
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="absolute inset-0 w-full h-full object-cover"
      />
    </div>
  );
};
