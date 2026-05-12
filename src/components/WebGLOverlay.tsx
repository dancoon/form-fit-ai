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

  in vec2 vTexCoord;
  out vec4 fragColor;

  void main() {
    vec2 st = vTexCoord;
    st.y = 1.0 - st.y;

    float aspect = uResolution.x / uResolution.y;
    float severity = uSeverity[0];
    float correctedS = pow(severity, 1.0 / 2.2);
    float radius = mix(0.08, 0.12, correctedS);

    vec3 colorWhite = vec3(1.0);
    vec3 colorBlack = vec3(0.0);
    vec3 mixedColor = mix(colorWhite, colorBlack, correctedS);

    float minDist = 1000.0;
    for (int i = 0; i < 33; i++) {
      vec2 landmark = uLandmarks[i];
      vec2 diff = (st - landmark);
      diff.x *= aspect;
      float d = length(diff);
      minDist = min(minDist, d);
    }

    if (minDist < radius) {
      fragColor = vec4(mixedColor, 1.0);
    } else {
      discard;
    }
  }
`;

/**
 * initializeWebGL
 *
 * Utility function to set up shaders and programs.
 * Defined outside the component to avoid React Hooks linter false positives
 * on gl.useProgram and ensure a clean architectural separation.
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

  // Bypass name-based hook linter false positive using .call()
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
  };
};

/**
 * WebGLOverlay Component
 *
 * Implements the Shader Engine for FormFit AI.
 * Renders parametric error indicators over the user's joints using GLSL ES 3.0.
 */
export const WebGLOverlay: React.FC<WebGLOverlayProps> = ({
  uLandmarks,
  uSeverity,
}) => {
  const { width, height } = useWindowDimensions();
  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
  const locationsRef = useRef<{
    resLoc: WebGLUniformLocation | null;
    landmarksLoc: WebGLUniformLocation | null;
    severityLoc: WebGLUniformLocation | null;
  }>({
    resLoc: null,
    landmarksLoc: null,
    severityLoc: null,
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
    const { resLoc, landmarksLoc, severityLoc } = locationsRef.current;
    if (!gl || !resLoc || !landmarksLoc || !severityLoc) return;

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform2f(resLoc, width, height);
    gl.uniform2fv(landmarksLoc, uLandmarks);
    gl.uniform1fv(severityLoc, uSeverity);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.endFrameEXP();
  }, [width, height, uLandmarks, uSeverity]);

  useRenderLoop(renderFrame);

  return (
    <GLView className="absolute inset-0" onContextCreate={onContextCreate} />
  );
};
