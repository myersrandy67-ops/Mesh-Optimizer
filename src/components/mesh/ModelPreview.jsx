import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RotateCw } from 'lucide-react';

export default function ModelPreview({ vertices, faces, isProcessing }) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const meshRef = useRef(null);
  const frameRef = useRef(null);
  const mouseRef = useRef({ isDown: false, x: 0, y: 0 });
  const rotRef = useRef({ x: -0.4, y: 0.6 });

  const geometry = useMemo(() => {
    if (!vertices || !faces || faces.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(faces.length * 9);
    let idx = 0;
    for (const face of faces) {
      for (const vi of face) {
        const v = vertices[vi];
        if (v) {
          positions[idx++] = v[0];
          positions[idx++] = v[1];
          positions[idx++] = v[2];
        } else {
          idx += 3;
        }
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, idx), 3));
    geo.computeVertexNormals();
    return geo;
  }, [vertices, faces]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);
    const dirLight2 = new THREE.DirectionalLight(0x88ccff, 0.5);
    dirLight2.position.set(-3, -2, -4);
    scene.add(dirLight2);

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      if (meshRef.current && !mouseRef.current.isDown) {
        rotRef.current.y += 0.003;
        meshRef.current.rotation.x = rotRef.current.x;
        meshRef.current.rotation.y = rotRef.current.y;
      }
      renderer.render(scene, camera);
    };
    animate();

    const onMouseDown = (e) => {
      mouseRef.current = { isDown: true, x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e) => {
      if (!mouseRef.current.isDown || !meshRef.current) return;
      const dx = e.clientX - mouseRef.current.x;
      const dy = e.clientY - mouseRef.current.y;
      rotRef.current.y += dx * 0.01;
      rotRef.current.x += dy * 0.01;
      meshRef.current.rotation.x = rotRef.current.x;
      meshRef.current.rotation.y = rotRef.current.y;
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };
    const onMouseUp = () => {
      mouseRef.current.isDown = false;
    };

    mount.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      mount.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;

    if (meshRef.current) {
      scene.remove(meshRef.current);
      meshRef.current.geometry.dispose();
      meshRef.current.material.dispose();
      meshRef.current = null;
    }

    if (!geometry) return;

    const material = new THREE.MeshPhongMaterial({
      color: 0x22d3ee,
      specular: 0x444444,
      shininess: 40,
      flatShading: true,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const center = new THREE.Vector3();
    box.getCenter(center);
    mesh.position.sub(center);

    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 3 / maxDim;
    mesh.scale.set(scale, scale, scale);

    mesh.rotation.x = rotRef.current.x;
    mesh.rotation.y = rotRef.current.y;

    scene.add(mesh);
    meshRef.current = mesh;

    camera.position.set(0, 0, 6);
    camera.lookAt(0, 0, 0);
  }, [geometry]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900/50 to-black/50">
      <div ref={mountRef} className="w-full h-full" />
      {isProcessing && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
            <RotateCw className="h-8 w-8 text-cyan-400 animate-spin" />
            <span className="text-sm text-white/60">Decimating mesh…</span>
          </div>
        </div>
      )}
      {!vertices && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-white/20 uppercase tracking-widest">No model loaded</p>
        </div>
      )}
    </div>
  );
}