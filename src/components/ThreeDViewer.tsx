import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ZonaDestino, RecursoTuristico, SensorIoT } from '../types/ontology';
import { sensorVisual } from '../services/sensorVisuals';

type ZonaSimulada = ZonaDestino & {
  capacidadCargaSimuladaPct?: number;
  afluenciaSimulada?: number;
  nivelRiesgo?: string;
};

type RecursoSimulado = RecursoTuristico & {
  visitantesSimuladosHora?: number;
  ocupacionSimuladaPct?: number;
};

type SensorSimulado = SensorIoT & {
  valorSimulado?: number;
  estadoSimulado?: string;
};

interface ThreeDViewerProps {
  zonas: ZonaSimulada[];
  recursos: RecursoSimulado[];
  sensores: SensorSimulado[];
  onWebglUnavailable?: () => void;
  rutasDesvio: {
    origen: string;
    destino: string;
    coordenadasRuta: [number, number][];
    capacidadDesvioHora: number;
    descripcion: string;
  }[];
}

const colorCapacidad = (pct: number) => {
  if (pct >= 90) return 0xdc2626;
  if (pct >= 75) return 0xf59e0b;
  return 0x10b981;
};

const randomDeterminista = (a: number, b: number) => {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export const ThreeDViewer: React.FC<ThreeDViewerProps> = ({ zonas, recursos, sensores, rutasDesvio, onWebglUnavailable }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    try {
      const probe = document.createElement('canvas');
      const hasWebGL = Boolean(
        probe.getContext('webgl2', { antialias: false }) ||
        probe.getContext('webgl', { antialias: false }),
      );
      if (!hasWebGL) {
        onWebglUnavailable?.();
        return;
      }
    } catch {
      onWebglUnavailable?.();
      return;
    }

    // Escala de coordenadas GIS a un mundo local 3D
    const puntos = zonas.flatMap((z) => z.coordenadasPoligono);
    const latitudes = puntos.map((p) => p[0]);
    const longitudes = puntos.map((p) => p[1]);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    const rangoLat = Math.max(maxLat - minLat, 0.001);
    const rangoLng = Math.max(maxLng - minLng, 0.001);

    const toWorld = ([lat, lng]: [number, number]): [number, number] => [
      ((lng - minLng) / rangoLng - 0.5) * 92,
      ((lat - minLat) / rangoLat - 0.5) * 74
    ];

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eef7f9');
    scene.fog = new THREE.Fog('#eef7f9', 95, 180);

    const camera = new THREE.PerspectiveCamera(48, container.clientWidth / container.clientHeight, 0.1, 600);
    camera.position.set(74, 68, 84);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      onWebglUnavailable?.();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 0, 0);
    controls.minDistance = 50;
    controls.maxDistance = 150;
    controls.maxPolarAngle = Math.PI / 2.18;

    // Iluminación solar de escena 3D
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbfd8e3, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.8);
    sun.position.set(42, 72, 24);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -75;
    sun.shadow.camera.right = 75;
    sun.shadow.camera.top = 75;
    sun.shadow.camera.bottom = -75;
    scene.add(sun);

    // Terreno y cuadrícula de referencia
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 140),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.95, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(150, 30, 0xcbd5e1, 0xe2e8f0);
    grid.position.y = 0.012;
    scene.add(grid);

    // Lámina de agua / litoral mediterráneo
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(165, 32),
      new THREE.MeshPhysicalMaterial({ color: 0x9cdcf2, transparent: true, opacity: 0.78, roughness: 0.18, metalness: 0.05 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.02, -52);
    scene.add(water);

    // Ejes de movilidad urbana estilizados
    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.82 });
    for (let i = -3; i <= 3; i += 1) {
      const horizontal = new THREE.Mesh(new THREE.BoxGeometry(112, 0.12, 2.3), roadMaterial);
      horizontal.position.set(0, 0.08, i * 10 + randomDeterminista(i, 8) * 2);
      horizontal.receiveShadow = true;
      scene.add(horizontal);
    }
    for (let i = -4; i <= 4; i += 1) {
      const vertical = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 100), roadMaterial);
      vertical.position.set(i * 10 + randomDeterminista(8, i) * 2, 0.09, 0);
      vertical.receiveShadow = true;
      scene.add(vertical);
    }

    // Edificios extruidos: malla urbana 3D demostrativa con sombras reales
    const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.63, metalness: 0.04 });
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.56, metalness: 0.07 });
    for (let row = -5; row <= 5; row += 1) {
      for (let col = -6; col <= 6; col += 1) {
        const seed = randomDeterminista(row + 7, col + 11);
        if (seed < 0.16) continue;
        const w = 3.8 + randomDeterminista(row, col) * 3.5;
        const d = 3.8 + randomDeterminista(col, row) * 3.5;
        const h = 2.5 + seed * 18;
        const x = col * 8.0 + (randomDeterminista(row, col + 3) - 0.5) * 1.7;
        const z = row * 7.5 + (randomDeterminista(col, row + 5) - 0.5) * 1.7;
        const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMaterial);
        building.position.set(x, h / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.24, d * 0.9), roofMaterial);
        roof.position.set(x, h + 0.15, z);
        roof.castShadow = true;
        scene.add(roof);
      }
    }

    // Volúmenes 3D de las zonas de aforo: la altura expresa presión turística
    zonas.forEach((zona) => {
      const worldPoints = zona.coordenadasPoligono.map(toWorld);
      const xs = worldPoints.map((point) => point[0]);
      const zs = worldPoints.map((point) => point[1]);
      const width = Math.max(Math.max(...xs) - Math.min(...xs), 6);
      const depth = Math.max(Math.max(...zs) - Math.min(...zs), 6);
      const centerX = (Math.max(...xs) + Math.min(...xs)) / 2;
      const centerZ = (Math.max(...zs) + Math.min(...zs)) / 2;
      const capacidad = zona.capacidadCargaSimuladaPct ?? zona.capacidadCargaPct;
      const height = 2.2 + Math.min(capacidad, 125) * 0.16;
      const color = colorCapacidad(capacidad);

      const volumen = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshPhysicalMaterial({
          color,
          transparent: true,
          opacity: 0.28,
          roughness: 0.26,
          metalness: 0.08,
          transmission: 0.02
        })
      );
      volumen.position.set(centerX, height / 2 + 0.15, centerZ);
      volumen.castShadow = true;
      scene.add(volumen);

      const aristas = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth)),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.94 })
      );
      aristas.position.copy(volumen.position);
      scene.add(aristas);
    });

    // Recursos turísticos como hitos verticales
    recursos.forEach((recurso, index) => {
      const [x, z] = toWorld(recurso.ubicacion);
      const group = new THREE.Group();
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(1.05, 1.35, 1.4, 24),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.16 })
      );
      pedestal.position.y = 0.75;
      pedestal.castShadow = true;
      group.add(pedestal);

      const hito = new THREE.Mesh(
        index % 2 === 0 ? new THREE.ConeGeometry(0.78, 3.8, 4) : new THREE.CylinderGeometry(0.65, 0.65, 3.5, 18),
        new THREE.MeshStandardMaterial({ color: 0xd9295d, roughness: 0.32, metalness: 0.2 })
      );
      hito.position.y = 3.0;
      hito.castShadow = true;
      group.add(hito);
      group.position.set(x, 0, z);
      scene.add(group);
    });

    // Sensores IoT como balizas emissivas
    sensores.forEach((sensor) => {
      const [x, z] = toWorld(sensor.ubicacion);
      const estado = sensor.estadoSimulado ?? sensor.estado;
      const baseColor = Number.parseInt(sensorVisual(sensor).color.slice(1), 16);
      const color = estado === 'CRITICO' ? 0xef4444 : estado === 'PRECAUCION' ? 0xf59e0b : baseColor;
      const esfera = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 24, 24),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45, roughness: 0.25 })
      );
      esfera.position.set(x, 3.4, z);
      esfera.castShadow = true;
      scene.add(esfera);

      const light = new THREE.PointLight(color, 1.25, 12);
      light.position.set(x, 4.3, z);
      scene.add(light);
    });

    // Rutas de redistribución como líneas suspendidas en el espacio 3D
    rutasDesvio.forEach((ruta) => {
      if (ruta.coordenadasRuta.length < 2) return;
      const puntosRuta = ruta.coordenadasRuta.map((coordenada) => {
        const [x, z] = toWorld(coordenada);
        return new THREE.Vector3(x, 1.65, z);
      });
      const geometry = new THREE.BufferGeometry().setFromPoints(puntosRuta);
      const line = new THREE.Line(
        geometry,
        new THREE.LineDashedMaterial({ color: 0x0ea5e9, dashSize: 1.6, gapSize: 0.75, linewidth: 2 })
      );
      line.computeLineDistances();
      scene.add(line);
    });

    // Microanimación para dar vida a las balizas sin alterar la cámara del usuario
    const reloj = new THREE.Clock();
    const renderLoop = () => {
      const elapsed = reloj.getElapsedTime();
      scene.traverse((object) => {
        if (object instanceof THREE.PointLight) {
          object.intensity = 1.05 + Math.sin(elapsed * 2.4) * 0.25;
        }
      });
      controls.update();
      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(renderLoop);

    const resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((item) => item.dispose());
          else material.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === container) container.removeChild(renderer.domElement);
    };
  }, [zonas, recursos, sensores, rutasDesvio, onWebglUnavailable]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#eef7f9]">
      <div ref={containerRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      <div className="absolute bottom-6 right-5 z-10 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-xl text-[11px] text-slate-600">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Leyenda 3D</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-slate-300" />Edificios 3D</div>
        <div className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-cyan-400" />Balizas IoT</div>
        <div className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-pink-600" />Recursos turísticos</div>
        <div className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-emerald-500" />Capacidad de carga</div>
      </div>
    </div>
  );
};
