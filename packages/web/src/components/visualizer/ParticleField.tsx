import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';

const PARTICLE_COUNT = 2000;

function Particles() {
  const meshRef = useRef<THREE.Points>(null);
  const audioFeatures = useStore((s) => s.audioFeatures);
  const isBeat = useStore((s) => s.isBeat);
  const accentColor = useStore((s) => s.accentColor);

  const beatPulse = useRef(0);

  const { positions, velocities, colors } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2 + Math.random() * 6;

      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);

      velocities[i3] = (Math.random() - 0.5) * 0.01;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.01;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.01;

      colors[i3] = 0.55;
      colors[i3 + 1] = 0.36;
      colors[i3 + 2] = 0.96;
    }

    return { positions, velocities, colors };
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    const geo = meshRef.current.geometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;
    const col = colAttr.array as Float32Array;

    // Update accent color
    const tempColor = new THREE.Color(accentColor);
    const targetR = tempColor.r;
    const targetG = tempColor.g;
    const targetB = tempColor.b;

    const bass = audioFeatures?.bass ?? 0;
    const mid = audioFeatures?.mid ?? 0;
    const high = audioFeatures?.high ?? 0;
    const energy = audioFeatures?.energy ?? 0;

    if (isBeat) beatPulse.current = 1;
    beatPulse.current *= 0.92;

    const expansionForce = energy * 0.05 + beatPulse.current * 0.15;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // Distance from center
      const dx = pos[i3];
      const dy = pos[i3 + 1];
      const dz = pos[i3 + 2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Normalized direction
      const nx = dist > 0 ? dx / dist : 0;
      const ny = dist > 0 ? dy / dist : 0;
      const nz = dist > 0 ? dz / dist : 0;

      // Push outward with bass, pull inward gently
      const radialForce = expansionForce - (dist - 4) * 0.002;
      velocities[i3] += nx * radialForce * delta;
      velocities[i3 + 1] += ny * radialForce * delta;
      velocities[i3 + 2] += nz * radialForce * delta;

      // Rotation around Y axis with mid
      const rotSpeed = mid * 0.3 + 0.05;
      velocities[i3] += -dz * rotSpeed * delta * 0.1;
      velocities[i3 + 2] += dx * rotSpeed * delta * 0.1;

      // Vertical oscillation with high
      velocities[i3 + 1] += Math.sin(Date.now() * 0.001 + i * 0.1) * high * 0.02 * delta;

      // Damping
      velocities[i3] *= 0.98;
      velocities[i3 + 1] *= 0.98;
      velocities[i3 + 2] *= 0.98;

      // Apply velocity
      pos[i3] += velocities[i3];
      pos[i3 + 1] += velocities[i3 + 1];
      pos[i3 + 2] += velocities[i3 + 2];

      // Color: blend between accent and white based on energy
      const brightness = Math.min(1, bass * 2 + beatPulse.current);
      col[i3] = targetR + (1 - targetR) * brightness * 0.3;
      col[i3 + 1] = targetG + (1 - targetG) * brightness * 0.3;
      col[i3 + 2] = targetB + (1 - targetB) * brightness * 0.3;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export default function ParticleField() {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 60 }}
      style={{ background: 'transparent' }}
      gl={{ alpha: true, antialias: true }}
    >
      <Particles />
    </Canvas>
  );
}
