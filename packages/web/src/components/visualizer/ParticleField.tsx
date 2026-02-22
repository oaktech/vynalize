import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { getLowPowerCount, getVisDpr, isLowPower } from '../../utils/perfConfig';

const PARTICLE_COUNT_FULL = 2000;
const PARTICLE_COUNT_LOW = 500;

/** Boost quiet signals and compress dynamic range */
function boost(value: number): number {
  return Math.min(1, Math.pow(value * 3.5, 0.6));
}

const REST_RADIUS = 4; // target orbital distance
const MAX_RADIUS = 8; // hard clamp — never drift beyond this

function Particles() {
  const meshRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const audioFeatures = useStore((s) => s.audioFeatures);
  const isBeat = useStore((s) => s.isBeat);
  const accentColor = useStore((s) => s.accentColor);
  const particleCount = getLowPowerCount(PARTICLE_COUNT_FULL, PARTICLE_COUNT_LOW);

  const beatPulse = useRef(0);
  const smoothEnergy = useRef(0);

  const { positions, velocities, colors } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.5 + Math.random() * 4;

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
  }, [particleCount]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    const geo = meshRef.current.geometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;
    const col = colAttr.array as Float32Array;

    const tempColor = new THREE.Color(accentColor);
    const targetR = tempColor.r;
    const targetG = tempColor.g;
    const targetB = tempColor.b;

    const bass = boost(audioFeatures?.bass ?? 0);
    const mid = boost(audioFeatures?.mid ?? 0);
    const high = boost(audioFeatures?.high ?? 0);
    const energy = boost(audioFeatures?.energy ?? 0);

    // Smooth energy so particles stay lively between beats
    smoothEnergy.current += (energy - smoothEnergy.current) * 0.15;
    const sEnergy = smoothEnergy.current;

    if (isBeat) beatPulse.current = 1;
    beatPulse.current *= 0.88;
    const pulse = beatPulse.current;

    // Beat-reactive particle size: bigger on beats, always visible
    if (matRef.current) {
      matRef.current.size = 0.1 + pulse * 0.15 + sEnergy * 0.06;
      matRef.current.opacity = 0.7 + pulse * 0.3;
    }

    // On beat: strong outward burst. Otherwise: spring back toward REST_RADIUS.
    const burstForce = pulse * 0.4;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      const dx = pos[i3];
      const dy = pos[i3 + 1];
      const dz = pos[i3 + 2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;

      const nx = dx / dist;
      const ny = dy / dist;
      const nz = dz / dist;

      // Spring force: always pulls toward REST_RADIUS
      const displacement = dist - REST_RADIUS;
      const springForce = -displacement * 0.025;

      // Beat burst pushes outward; spring pulls back
      const radialForce = springForce + burstForce + sEnergy * 0.03;
      velocities[i3] += nx * radialForce * delta;
      velocities[i3 + 1] += ny * radialForce * delta;
      velocities[i3 + 2] += nz * radialForce * delta;

      // Rotation around Y axis — faster with mid energy
      const rotSpeed = mid * 0.6 + 0.1;
      velocities[i3] += -dz * rotSpeed * delta * 0.12;
      velocities[i3 + 2] += dx * rotSpeed * delta * 0.12;

      // Vertical oscillation with high
      velocities[i3 + 1] += Math.sin(Date.now() * 0.001 + i * 0.1) * high * 0.04 * delta;

      // Damping — stronger to prevent runaway drift
      velocities[i3] *= 0.95;
      velocities[i3 + 1] *= 0.95;
      velocities[i3 + 2] *= 0.95;

      // Apply velocity
      pos[i3] += velocities[i3];
      pos[i3 + 1] += velocities[i3 + 1];
      pos[i3 + 2] += velocities[i3 + 2];

      // Hard clamp: if a particle escapes, nudge it back
      const newDist = Math.sqrt(pos[i3] ** 2 + pos[i3 + 1] ** 2 + pos[i3 + 2] ** 2);
      if (newDist > MAX_RADIUS) {
        const scale = MAX_RADIUS / newDist;
        pos[i3] *= scale;
        pos[i3 + 1] *= scale;
        pos[i3 + 2] *= scale;
        // Kill outward velocity
        velocities[i3] *= 0.3;
        velocities[i3 + 1] *= 0.3;
        velocities[i3 + 2] *= 0.3;
      }

      // Color: brighter on beats, accent-tinted
      const brightness = Math.min(1, bass * 1.5 + pulse * 0.8);
      col[i3] = targetR + (1 - targetR) * brightness * 0.5;
      col[i3 + 1] = targetG + (1 - targetG) * brightness * 0.5;
      col[i3 + 2] = targetB + (1 - targetB) * brightness * 0.5;
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
        ref={matRef}
        size={0.1}
        vertexColors
        transparent
        opacity={0.85}
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
      dpr={getVisDpr()}
      gl={{ alpha: true, antialias: !isLowPower() }}
    >
      <Particles />
    </Canvas>
  );
}
