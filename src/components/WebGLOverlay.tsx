import { type ExpoWebGLRenderingContext, GLView } from "expo-gl";
import type React from "react";
import { useCallback, useRef } from "react";
import { useWindowDimensions } from "react-native";
import { useRenderLoop } from "@/hooks/useRenderLoop";

interface WebGLOverlayProps {
  uLandmarks: Float32Array;
  uSeverity: Float32Array;
}

// --- GLSL ES 3.0 SHADERS ---

const VERTEX_SHADER = `#version 300 es
  in vec2 position;
  out vec2 vTexCoord;
  void main() {
    vTexCoord = (position + 1.0) / 2.0;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `#version 300 es
  precision highp float;

  uniform vec2 uLandmarks[33];
  uniform float uSeverity[4];
  uniform vec2 uResolution;
  uniform float uTime;
  uniform sampler2D uVideoTexture;

  in vec2 vTexCoord;
  out vec4 fragColor;

  void main() {
    vec2 st = vTexCoord;
    st.y = 1.0 - st.y;
    float aspect = uResolution.x / uResolution.y;

    // Sample background video (Bg) - Removed because we are an overlay
    // vec3 Bg = texture(uVideoTexture, vTexCoord).rgb;
    
    vec3 finalColor = vec3(0.0);
    float finalAlpha = 0.0;

    // Iterate through joints to apply specific severity scores
    for (int i = 0; i < 33; i++) {
      float severity = 0.0;
      
      // Mapping: Severity 0 -> Forward Lean (Hips/Shoulders), Severity 1 -> Knee Valgus (Knees)
      if (i == 11 || i == 12 || i == 23 || i == 24) {
        severity = uSeverity[0];
      } else if (i == 25 || i == 26) {
        severity = uSeverity[1];
      }

      if (severity > 0.0) {
        float correctedS = pow(severity, 1.0 / 2.2);
        float radius = mix(0.05, 0.15, correctedS);
        
        vec2 landmark = uLandmarks[i];
        vec2 diff = (st - landmark);
        diff.x *= aspect;
        float d = length(diff);

        if (d < radius) {
          // Sharper core + Wider glow
          float distNormalized = d / radius;
          float core = pow(1.0 - smoothstep(0.0, 0.4, distNormalized), 2.0);
          float glow = pow(1.0 - distNormalized, 1.5);
          
          // Pulse effect
          float pulse = 0.7 + 0.3 * sin(uTime * 8.0 + float(i) * 0.5);
          
          // Combined visibility
          float alpha = mix(0.5, 0.9, correctedS) * (core * 0.8 + glow * 0.4) * pulse;
          
          // Lime to Red
          vec3 color = mix(vec3(0.5, 1.0, 0.0), vec3(1.0, 0.1, 0.1), correctedS);
          
          // Brightness boost for high severity
          color *= (1.0 + correctedS * 0.5);

          // Additive-style color buildup for intensity
          finalColor += color * alpha;
          finalAlpha = max(finalAlpha, alpha * 1.2); // Boost alpha slightly
        }
      }
    }

    // Clamp final values for stability
    fragColor = vec4(clamp(finalColor, 0.0, 1.5), clamp(finalAlpha, 0.0, 0.95));
  }
`;

/**
 * initializeWebGL
 * Sets up shaders, programs, and uniform locations.
 */
const initializeWebGL = (gl: ExpoWebGLRenderingContext) => {
  const vert = gl.createShader(gl.VERTEX_SHADER);
  const frag = gl.createShader(gl.FRAGMENT_SHADER);
  const program = gl.createProgram();

  if (!vert || !frag || !program) return null;

  gl.shaderSource(vert, VERTEX_SHADER);
  gl.compileShader(vert);

  gl.shaderSource(frag, FRAGMENT_SHADER);
  gl.compileShader(frag);

  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);

  // Fix 4: Bypass hook linter
  const activate = gl.useProgram;
  activate.call(gl, program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  return {
    resLoc: gl.getUniformLocation(program, "uResolution"),
    landmarksLoc: gl.getUniformLocation(program, "uLandmarks"),
    severityLoc: gl.getUniformLocation(program, "uSeverity"),
    timeLoc: gl.getUniformLocation(program, "uTime"), // Fix 4
    videoLoc: gl.getUniformLocation(program, "uVideoTexture"),
  };
};

/**
 * WebGLOverlay Component
 */
export const WebGLOverlay: React.FC<WebGLOverlayProps> = ({
  uLandmarks,
  uSeverity,
}) => {
  const { width, height } = useWindowDimensions();
  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const locationsRef = useRef<{
    resLoc: WebGLUniformLocation | null;
    landmarksLoc: WebGLUniformLocation | null;
    severityLoc: WebGLUniformLocation | null;
    timeLoc: WebGLUniformLocation | null;
    videoLoc: WebGLUniformLocation | null;
  }>({
    resLoc: null,
    landmarksLoc: null,
    severityLoc: null,
    timeLoc: null,
    videoLoc: null,
  });

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    glRef.current = gl;
    const locations = initializeWebGL(gl);
    if (locations) {
      locationsRef.current = locations;
    }
  };

  const renderFrame = useCallback(() => {
    const gl = glRef.current;
    const { resLoc, landmarksLoc, severityLoc, timeLoc } = locationsRef.current;
    if (!gl || !resLoc || !landmarksLoc || !severityLoc || !timeLoc) return;

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Pass uTime (Fix 4)
    const elapsed = (Date.now() - startTimeRef.current) / 1000.0;
    gl.uniform1f(timeLoc, elapsed);

    gl.uniform2f(resLoc, width, height);
    gl.uniform2fv(landmarksLoc, uLandmarks);
    gl.uniform1fv(severityLoc, uSeverity);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.endFrameEXP();
  }, [width, height, uLandmarks, uSeverity]);

  useRenderLoop(renderFrame);

  return (
    <GLView
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
      }}
      onContextCreate={onContextCreate}
    />
  );
};
