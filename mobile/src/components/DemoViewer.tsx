import {
  OrbitControls,
  PerspectiveCamera,
  useAnimations,
  useGLTF,
} from "@react-three/drei/native";
import { Canvas, type ObjectMap } from "@react-three/fiber/native";
import { Suspense, useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import type { GLTF } from "three-stdlib";
import { installExpoGlConsoleFilter } from "@/lib/expoGlConsole";

function Model({ url }: { url: string | number }) {
  const gltf = useGLTF(url as string, false) as GLTF & ObjectMap;
  const { scene, animations } = gltf;
  const { actions, names } = useAnimations(animations, scene);

  useEffect(() => {
    if (names.length > 0) {
      actions[names[0]]?.play();
    }
  }, [actions, names]);

  return <primitive object={scene} scale={2.5} position={[0, -2, 0]} />;
}

export function DemoViewer() {
  useEffect(() => {
    const handle = installExpoGlConsoleFilter();
    return () => handle.restore();
  }, []);

  return (
    <View className="flex-1 bg-black">
      <Suspense
        fallback={
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        }
      >
        <Canvas
          onCreated={({ gl }) => {
            const ctx = gl.getContext() as WebGLRenderingContext;
            if (typeof ctx?.pixelStorei === "function") {
              const original = ctx.pixelStorei.bind(ctx);
              ctx.pixelStorei = (pname: number, param: number | boolean) => {
                try {
                  original(pname, param);
                } catch {
                  // Unsupported pixelStorei params in expo-gl
                }
              };
            }
          }}
        >
          <PerspectiveCamera makeDefault position={[0, 2, 8]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />
          <Model url={require("../assets/models/squat-demo.glb")} />
          <OrbitControls enablePan={false} minDistance={4} maxDistance={12} />
        </Canvas>
      </Suspense>
    </View>
  );
}
