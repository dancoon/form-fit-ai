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

/**
 * Model Component
 * Loads the GLTF model and plays the first animation clip.
 */
function Model({ url }: { url: string | number }) {
  // In React Native, 'require' returns a number. The useGLTF hook's TS definition
  // expects 'string | string[]', so we cast it to string to satisfy the type checker.
  // We then cast the result to 'GLTF & ObjectMap' to ensure access to 'scene' and 'animations'.
  const gltf = useGLTF(url as string) as GLTF & ObjectMap;
  const { scene, animations } = gltf;
  const { actions, names } = useAnimations(animations, scene);

  useEffect(() => {
    if (names.length > 0) {
      // Play the first animation clip found
      actions[names[0]]?.play();
    }
  }, [actions, names]);

  return <primitive object={scene} scale={2.5} position={[0, -2, 0]} />;
}

/**
 * DemoViewer Component
 * Renders a 3D corrective demonstration using @react-three/fiber.
 */
export function DemoViewer() {
  return (
    <View className="flex-1 bg-black">
      <Suspense
        fallback={
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        }
      >
        <Canvas>
          <PerspectiveCamera makeDefault position={[0, 2, 8]} />

          {/* Lighting */}
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />

          {/* 3D Model with Animations */}
          <Model url={require("../../assets/models/squat-demo.glb")} />

          {/* Interaction */}
          <OrbitControls enablePan={false} minDistance={4} maxDistance={12} />
        </Canvas>
      </Suspense>
    </View>
  );
}
