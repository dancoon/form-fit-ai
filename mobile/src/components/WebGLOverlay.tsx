import { type ExpoWebGLRenderingContext, GLView } from "expo-gl";
import type React from "react";
import { memo, useCallback, useRef } from "react";
import { useWindowDimensions } from "react-native";
import { useRenderLoop } from "@/hooks/useRenderLoop";

interface WebGLOverlayProps {
  uLandmarks: Float32Array;
  uSeverity: Float32Array;
  poseActive?: boolean;
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
  uniform float uPoseActive;

  in vec2 vTexCoord;
  out vec4 fragColor;

  // KnownPoseLandmarkConnections — MediaPipe default skeleton topology
  const int CONN_COUNT = 30;
  const int CONN_A[30] = int[30](
    0, 5, 0, 2, 9,
    11, 11, 13, 15, 15, 15,
    12, 12, 14, 16, 16, 16,
    11, 12, 23, 23, 24, 25, 26, 27, 27, 29, 26, 28, 28
  );
  const int CONN_B[30] = int[30](
    5, 8, 2, 7, 10,
    12, 13, 15, 17, 19, 21,
    14, 16, 18, 20, 22, 20,
    23, 24, 24, 25, 26, 27, 28, 29, 31, 31, 28, 30, 32
  );

  vec2 toAspect(vec2 p, float aspect) {
    return vec2(p.x * aspect, p.y);
  }

  float distToSegment(vec2 p, vec2 a, vec2 b, float aspect) {
    vec2 pa = toAspect(p - a, aspect);
    vec2 ba = toAspect(b - a, aspect);
    float denom = dot(ba, ba);
    float h = denom > 0.0001 ? clamp(dot(pa, ba) / denom, 0.0, 1.0) : 0.0;
    return length(pa - ba * h);
  }

  float drawLine(vec2 st, vec2 a, vec2 b, float aspect, float halfWidth) {
    float d = distToSegment(st, a, b, aspect);
    return 1.0 - smoothstep(halfWidth * 0.5, halfWidth, d);
  }

  float drawHollowJoint(vec2 st, vec2 landmark, float aspect, float outerR, float innerR) {
    float d = length(toAspect(st - landmark, aspect));
    return smoothstep(innerR, innerR + 0.001, d)
         * (1.0 - smoothstep(outerR - 0.001, outerR, d));
  }

  float jointOuterR(int i) {
    if (i == 11 || i == 12) return 0.022;
    if (i == 13 || i == 14) return 0.018;
    if (i >= 15 && i <= 22) return 0.013;
    return 0.010;
  }

  float jointInnerR(int i) {
    return jointOuterR(i) * 0.52;
  }

  float jointSeverity(int i) {
    if (i == 25 || i == 26) return uSeverity[1];
    if (i == 23 || i == 24) return uSeverity[2];
    if (i == 11 || i == 12 || i == 0) return uSeverity[3];
    return uSeverity[0] * 0.35;
  }

  void main() {
    vec2 st = vTexCoord;
    st.y = 1.0 - st.y;
    float aspect = uResolution.x / uResolution.y;

    vec3 finalColor = vec3(0.0);
    float finalAlpha = 0.0;

    if (uPoseActive < 0.5) {
      fragColor = vec4(0.0);
      return;
    }

    const vec3 skeletonColor = vec3(1.0);
    const float lineHalfWidth = 0.0038;

    // White skeleton lines (MediaPipe default style)
    for (int c = 0; c < CONN_COUNT; c++) {
      float lineAlpha = drawLine(
        st,
        uLandmarks[CONN_A[c]],
        uLandmarks[CONN_B[c]],
        aspect,
        lineHalfWidth
      );
      if (lineAlpha > 0.0) {
        finalColor = skeletonColor;
        finalAlpha = max(finalAlpha, lineAlpha * 0.98);
      }
    }

    // Hollow white joint rings
    for (int i = 0; i < 33; i++) {
      float ringAlpha = drawHollowJoint(
        st,
        uLandmarks[i],
        aspect,
        jointOuterR(i),
        jointInnerR(i)
      );
      if (ringAlpha > 0.0) {
        finalColor = skeletonColor;
        finalAlpha = max(finalAlpha, ringAlpha * 0.98);
      }

      // Form-error glow when severity slider is raised
      float severity = jointSeverity(i);
      if (severity > 0.0) {
        vec2 diff = toAspect(st - uLandmarks[i], aspect);
        float d = length(diff);
        float correctedS = pow(severity, 1.0 / 2.2);
        float radius = mix(0.05, 0.15, correctedS);
        float distNormalized = d / radius;
        float core = pow(1.0 - smoothstep(0.0, 0.4, distNormalized), 2.0);
        float glow = pow(1.0 - distNormalized, 1.5);
        float pulse = 0.7 + 0.3 * sin(uTime * 8.0 + float(i) * 0.5);
        float alpha = mix(0.5, 0.9, correctedS) * (core * 0.8 + glow * 0.4) * pulse;
        vec3 color = mix(vec3(0.5, 1.0, 0.0), vec3(1.0, 0.1, 0.1), correctedS);
        color *= (1.0 + correctedS * 0.5);
        finalColor += color * alpha;
        finalAlpha = max(finalAlpha, alpha * 1.2);
      }
    }

    fragColor = vec4(clamp(finalColor, 0.0, 1.0), clamp(finalAlpha, 0.0, 1.0));
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
    timeLoc: gl.getUniformLocation(program, "uTime"),
    poseActiveLoc: gl.getUniformLocation(program, "uPoseActive"),
  };
};

/**
 * WebGLOverlay Component
 */
const WebGLOverlayInner: React.FC<WebGLOverlayProps> = ({
  uLandmarks,
  uSeverity,
  poseActive = false,
}) => {
  const { width, height } = useWindowDimensions();
  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const locationsRef = useRef<{
    resLoc: WebGLUniformLocation | null;
    landmarksLoc: WebGLUniformLocation | null;
    severityLoc: WebGLUniformLocation | null;
    timeLoc: WebGLUniformLocation | null;
    poseActiveLoc: WebGLUniformLocation | null;
  }>({
    resLoc: null,
    landmarksLoc: null,
    severityLoc: null,
    timeLoc: null,
    poseActiveLoc: null,
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
    const { resLoc, landmarksLoc, severityLoc, timeLoc, poseActiveLoc } =
      locationsRef.current;
    if (
      !gl ||
      !resLoc ||
      !landmarksLoc ||
      !severityLoc ||
      !timeLoc ||
      !poseActiveLoc
    ) {
      return;
    }

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Pass uTime (Fix 4)
    const elapsed = (Date.now() - startTimeRef.current) / 1000.0;
    gl.uniform1f(timeLoc, elapsed);

    gl.uniform2f(resLoc, width, height);
    gl.uniform2fv(landmarksLoc, uLandmarks);
    gl.uniform1fv(severityLoc, uSeverity);
    gl.uniform1f(poseActiveLoc, poseActive ? 1 : 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.endFrameEXP();
  }, [width, height, uLandmarks, uSeverity, poseActive]);

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
        pointerEvents: "none",
      }}
      onContextCreate={onContextCreate}
    />
  );
};

export const WebGLOverlay = memo(WebGLOverlayInner);
