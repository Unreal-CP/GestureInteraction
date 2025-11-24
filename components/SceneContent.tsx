import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Torus } from '@react-three/drei';
import * as THREE from 'three';
import { HandState } from '../types';

interface SceneContentProps {
  handStateRef: React.MutableRefObject<HandState>;
}

export const SceneContent: React.FC<SceneContentProps> = ({ handStateRef }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Independent rotation refs for sci-fi elements
  const gridRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  // Interaction state
  const currentRotation = useRef({ x: 0, y: 0 });
  const currentScale = useRef(1.5);
  const lerpFactor = 0.1;

  // Generate random particles for "data cloud" / satellites
  const particleCount = 400;
  const particlesPosition = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const r = 1.1 + Math.random() * 0.8; // Radius distribution
      
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    return positions;
  }, []);

  useFrame((state, delta) => {
    const hand = handStateRef.current;
    const time = state.clock.getElapsedTime();

    // --- Idle Animation ---
    // Rotate the holographic grid
    if (gridRef.current) {
      gridRef.current.rotation.y = time * 0.05;
    }
    // Rotate atmosphere counter-clockwise
    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.y = -time * 0.02;
    }
    // Rotate particle cloud
    if (particlesRef.current) {
      particlesRef.current.rotation.y = time * 0.03;
    }
    
    // Animate rings
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = Math.PI / 2 + Math.sin(time * 0.2) * 0.1;
      ring1Ref.current.rotation.y += delta * 0.2;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x = Math.PI / 2.2 + Math.cos(time * 0.15) * 0.1;
      ring2Ref.current.rotation.y -= delta * 0.15;
    }

    // --- Interaction Logic ---
    
    // Default drift if no hand detected
    if (!hand.isDetected && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.05;
      groupRef.current.rotation.x = Math.sin(time * 0.1) * 0.05;
    }

    if (hand.isDetected) {
      // ZOOM: Map Hand Distance (Two Hands) to Scale
      if (hand.mode === 'ZOOM') {
        // Hand distance usually 0.2 (close) to 0.8 (far)
        // Normalize roughly 0.2 -> 0.8
        const normalizedDist = Math.max(0, Math.min(1, (hand.handDistance - 0.2) * 2)); 
        // Target scale: 0.8 to 4.0
        const targetScale = 0.8 + (normalizedDist * 3.2);
        currentScale.current = THREE.MathUtils.lerp(currentScale.current, targetScale, lerpFactor);
      }

      // ROTATE: Map Hand Position to Rotation
      if (hand.mode === 'ROTATE') {
        // Map screen position (-1 to 1) to rotation angles
        // Flipped Y logic applied in HandTracker, so we just map directly
        const targetRotX = hand.position.y * 2.5; 
        const targetRotY = hand.position.x * 2.5;
        
        currentRotation.current.x = THREE.MathUtils.lerp(currentRotation.current.x, targetRotX, lerpFactor);
        currentRotation.current.y = THREE.MathUtils.lerp(currentRotation.current.y, targetRotY, lerpFactor);
      }
    }

    // Apply interaction transforms to main group
    if (groupRef.current) {
      // Apply scale
      groupRef.current.scale.setScalar(currentScale.current);

      // Apply rotation (override drift if rotating)
      if (hand.isDetected && hand.mode === 'ROTATE') {
        groupRef.current.rotation.x = currentRotation.current.x;
        groupRef.current.rotation.y = currentRotation.current.y;
      } else if (hand.isDetected) {
         // If just zooming, smooth back to 0 tilt on X, keep Y (or let it stay)
         groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, 0.05);
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* 1. Core Ocean Sphere (Dark Base) */}
      <Sphere args={[1, 64, 64]}>
        <meshStandardMaterial 
          color="#020617" 
          roughness={0.4} 
          metalness={0.8}
        />
      </Sphere>

      {/* 2. Holographic Tech Grid (The "Earth" Structure) */}
      <mesh ref={gridRef}>
        <icosahedronGeometry args={[1.01, 12]} />
        <meshBasicMaterial 
          color="#38bdf8" 
          wireframe 
          transparent 
          opacity={0.15} 
        />
      </mesh>

      {/* 3. Atmosphere Halo */}
      <mesh ref={atmosphereRef}>
        <sphereGeometry args={[1.25, 64, 64]} />
        <meshBasicMaterial 
          color="#0ea5e9" 
          transparent 
          opacity={0.06} 
          side={THREE.BackSide} 
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 4. Orbital Sci-Fi Rings */}
      <Torus ref={ring1Ref} args={[1.5, 0.015, 64, 100]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#7dd3fc" emissive="#7dd3fc" emissiveIntensity={0.8} transparent opacity={0.6} />
      </Torus>
      
      <Torus ref={ring2Ref} args={[1.7, 0.01, 64, 100]} rotation={[Math.PI / 2, Math.PI / 4, 0]}>
         <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={1} transparent opacity={0.4} />
      </Torus>

      {/* 5. Data Particles / Satellites */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute 
            attach="attributes-position" 
            count={particleCount} 
            array={particlesPosition} 
            itemSize={3} 
          />
        </bufferGeometry>
        <pointsMaterial 
          color="#bae6fd" 
          size={0.04} 
          transparent 
          opacity={0.7} 
          sizeAttenuation={true} 
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
};