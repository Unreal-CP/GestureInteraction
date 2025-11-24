export interface HandState {
  // Normalized 0-1 pinch distance (distance between thumb and index)
  pinchDistance: number;
  
  // Distance between two hands (0-1 normalized)
  handDistance: number;
  
  // Boolean flag if currently "pinched" (distance < threshold)
  isPinched: boolean;
  
  // Current position of the hand (palm centroid) normalized -1 to 1
  position: { x: number; y: number };
  
  // Is the hand currently detected in frame
  isDetected: boolean;

  // Interaction mode derived from gesture
  mode: 'IDLE' | 'ZOOM' | 'ROTATE';
}

export const INITIAL_HAND_STATE: HandState = {
  pinchDistance: 1,
  handDistance: 0,
  isPinched: false,
  position: { x: 0, y: 0 },
  isDetected: false,
  mode: 'IDLE',
};

export const PINCH_THRESHOLD = 0.05; // Distance threshold to consider fingers "touching"
export const ACTIVATION_DELAY = 100; // ms to debounce state changes