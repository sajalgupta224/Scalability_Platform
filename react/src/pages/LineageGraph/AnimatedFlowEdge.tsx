import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

/**
 * Custom edge component with animated particle flowing along the path.
 * Shows a colored dot moving from source to target to indicate data flow direction.
 * Edges automatically recompute their path when connected nodes are dragged.
 */
export default function AnimatedFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
  });

  const edgeColor = (style?.stroke as string) || '#94a3b8';

  // Use a key derived from rounded positions so animation restarts when path changes significantly
  const pathKey = `${Math.round(sourceX)}-${Math.round(sourceY)}-${Math.round(targetX)}-${Math.round(targetY)}`;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ ...style, strokeWidth: 2 }}
        markerEnd={markerEnd}
      />
      {/* Animated particle - key forces re-mount when path changes */}
      <circle key={`p1-${pathKey}`} r="4" fill={edgeColor} filter="drop-shadow(0 0 3px rgba(0,0,0,0.3))">
        <animateMotion
          dur="2.5s"
          repeatCount="indefinite"
          path={edgePath}
        />
      </circle>
      {/* Trailing glow particle */}
      <circle key={`p2-${pathKey}`} r="2.5" fill={edgeColor} opacity="0.4">
        <animateMotion
          dur="2.5s"
          repeatCount="indefinite"
          path={edgePath}
          begin="0.15s"
        />
      </circle>
    </>
  );
}
