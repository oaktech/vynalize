import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';

/** Boost quiet signals and compress dynamic range */
function boost(value: number): number {
  return Math.min(1, Math.pow(value * 3.5, 0.6));
}

function ReactiveShape({
  geometry,
  position,
  bandKey,
}: {
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  bandKey: 'bass' | 'mid' | 'high';
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const audioFeatures = useStore((s) => s.audioFeatures);
  const isBeat = useStore((s) => s.isBeat);
  const accentColor = useStore((s) => s.accentColor);
  const beatScale = useRef(1);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const band = boost(audioFeatures?.[bandKey] ?? 0);

    if (isBeat) beatScale.current = 1.5;
    beatScale.current += (1 - beatScale.current) * 0.08;

    const scale = (0.8 + band * 2) * beatScale.current;
    meshRef.current.scale.setScalar(scale);

    meshRef.current.rotation.x = t * 0.3 + band * 3;
    meshRef.current.rotation.y = t * 0.2 + band * 1.5;
    meshRef.current.rotation.z = t * 0.1;

    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    const color = new THREE.Color(accentColor);
    color.offsetHSL(0, 0, band * 0.4);
    mat.color = color;
    mat.emissive = color.clone().multiplyScalar(0.3 + band * 0.7);
  });

  return (
    <mesh ref={meshRef} geometry={geometry} position={position}>
      <meshStandardMaterial
        color={accentColor}
        wireframe
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

function Scene() {
  const groupRef = useRef<THREE.Group>(null);
  const audioFeatures = useStore((s) => s.audioFeatures);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const energy = boost(audioFeatures?.energy ?? 0);
    groupRef.current.rotation.y = t * 0.1 + energy * 0.8;
  });

  const icosahedron = new THREE.IcosahedronGeometry(1, 1);
  const octahedron = new THREE.OctahedronGeometry(1, 0);
  const dodecahedron = new THREE.DodecahedronGeometry(1, 0);

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={1} />
      <pointLight position={[-5, -5, 3]} intensity={0.6} color="#4060ff" />

      <group ref={groupRef}>
        <ReactiveShape geometry={icosahedron} position={[-2.5, 0, 0]} bandKey="bass" />
        <ReactiveShape geometry={octahedron} position={[0, 0, 0]} bandKey="mid" />
        <ReactiveShape geometry={dodecahedron} position={[2.5, 0, 0]} bandKey="high" />
      </group>
    </>
  );
}

export default function GeometricShapes() {
  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 50 }}
      style={{ background: 'transparent' }}
      gl={{ alpha: true, antialias: true }}
    >
      <Scene />
    </Canvas>
  );
}
