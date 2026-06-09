import { type ExpoWebGLRenderingContext, GLView } from "expo-gl";
import type React from "react";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { useWindowDimensions } from "react-native";
import { useRenderLoop } from "@/hooks/useRenderLoop";

/** Skeleton pass resolution — upscaled with linear filtering on blit. */
const OVERLAY_RENDER_SCALE = 0.5;

const GLOW_SEVERITY_EPS = 0.001;

export interface WebGLOverlayHandle {
  requestRender: () => void;
}

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
  precision mediump float;

  uniform vec2 uLandmarks[33];
  uniform float uSeverity[4];
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uPoseActive;
  uniform float uGlowEnabled;

  in vec2 vTexCoord;
  out vec4 fragColor;

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

      if (uGlowEnabled > 0.5) {
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
    }

    fragColor = vec4(clamp(finalColor, 0.0, 1.0), clamp(finalAlpha, 0.0, 1.0));
  }
`;

const BLIT_FRAGMENT_SHADER = `#version 300 es
  precision mediump float;
  uniform sampler2D uTexture;
  in vec2 vTexCoord;
  out vec4 fragColor;
  void main() {
    fragColor = texture(uTexture, vTexCoord);
  }
`;

type GlLocations = {
  skeletonProgram: WebGLProgram;
  blitProgram: WebGLProgram;
  posLoc: number;
  blitPosLoc: number;
  blitTexLoc: WebGLUniformLocation | null;
  resLoc: WebGLUniformLocation | null;
  landmarksLoc: WebGLUniformLocation | null;
  severityLoc: WebGLUniformLocation | null;
  timeLoc: WebGLUniformLocation | null;
  poseActiveLoc: WebGLUniformLocation | null;
  glowLoc: WebGLUniformLocation | null;
  fbo: WebGLFramebuffer | null;
  fboTexture: WebGLTexture | null;
  fboWidth: number;
  fboHeight: number;
};

function compileShader(
  gl: ExpoWebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

function linkProgram(
  gl: ExpoWebGLRenderingContext,
  vert: WebGLShader,
  frag: WebGLShader,
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  return program;
}

function setupFullscreenQuad(gl: ExpoWebGLRenderingContext, program: WebGLProgram) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
  return posLoc;
}

function ensureHalfResFbo(
  gl: ExpoWebGLRenderingContext,
  state: GlLocations,
  screenWidth: number,
  screenHeight: number,
): void {
  const fboWidth = Math.max(1, Math.floor(screenWidth * OVERLAY_RENDER_SCALE));
  const fboHeight = Math.max(1, Math.floor(screenHeight * OVERLAY_RENDER_SCALE));

  if (state.fboWidth === fboWidth && state.fboHeight === fboHeight) {
    return;
  }

  if (state.fboTexture) gl.deleteTexture(state.fboTexture);
  if (state.fbo) gl.deleteFramebuffer(state.fbo);

  const texture = gl.createTexture();
  if (!texture) return;

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    fboWidth,
    fboHeight,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const fbo = gl.createFramebuffer();
  if (!fbo) return;

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);

  state.fbo = fbo;
  state.fboTexture = texture;
  state.fboWidth = fboWidth;
  state.fboHeight = fboHeight;
}

const initializeWebGL = (gl: ExpoWebGLRenderingContext): GlLocations | null => {
  const vert = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const skeletonFrag = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const blitFrag = compileShader(gl, gl.FRAGMENT_SHADER, BLIT_FRAGMENT_SHADER);
  if (!vert || !skeletonFrag || !blitFrag) return null;

  const skeletonProgram = linkProgram(gl, vert, skeletonFrag);
  const blitProgram = linkProgram(gl, vert, blitFrag);
  if (!skeletonProgram || !blitProgram) return null;

  const activate = gl.useProgram;
  activate.call(gl, skeletonProgram);
  const posLoc = setupFullscreenQuad(gl, skeletonProgram);

  activate.call(gl, blitProgram);
  const blitPosLoc = setupFullscreenQuad(gl, blitProgram);

  return {
    skeletonProgram,
    blitProgram,
    posLoc,
    blitPosLoc,
    blitTexLoc: gl.getUniformLocation(blitProgram, "uTexture"),
    resLoc: gl.getUniformLocation(skeletonProgram, "uResolution"),
    landmarksLoc: gl.getUniformLocation(skeletonProgram, "uLandmarks"),
    severityLoc: gl.getUniformLocation(skeletonProgram, "uSeverity"),
    timeLoc: gl.getUniformLocation(skeletonProgram, "uTime"),
    poseActiveLoc: gl.getUniformLocation(skeletonProgram, "uPoseActive"),
    glowLoc: gl.getUniformLocation(skeletonProgram, "uGlowEnabled"),
    fbo: null,
    fboTexture: null,
    fboWidth: 0,
    fboHeight: 0,
  };
};

function hasActiveGlow(severity: Float32Array): boolean {
  for (let i = 0; i < severity.length; i++) {
    if (severity[i] > GLOW_SEVERITY_EPS) return true;
  }
  return false;
}

const WebGLOverlayInner = forwardRef<WebGLOverlayHandle, WebGLOverlayProps>(
  function WebGLOverlayInner(
    { uLandmarks, uSeverity, poseActive = false },
    ref,
  ) {
    const { width, height } = useWindowDimensions();
    const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
    const glStateRef = useRef<GlLocations | null>(null);
    const startTimeRef = useRef<number>(Date.now());

    const landmarksRef = useRef(uLandmarks);
    landmarksRef.current = uLandmarks;
    const severityRef = useRef(uSeverity);
    severityRef.current = uSeverity;
    const poseActiveRef = useRef(poseActive);
    poseActiveRef.current = poseActive;

    const glowActive = useMemo(() => hasActiveGlow(uSeverity), [uSeverity]);

    const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
      glRef.current = gl;
      glStateRef.current = initializeWebGL(gl);
    };

    const renderFrame = useCallback(() => {
      const gl = glRef.current;
      const state = glStateRef.current;
      if (
        !gl ||
        !state ||
        !state.resLoc ||
        !state.landmarksLoc ||
        !state.severityLoc ||
        !state.timeLoc ||
        !state.poseActiveLoc ||
        !state.glowLoc ||
        !state.blitTexLoc
      ) {
        return;
      }

      const screenW = gl.drawingBufferWidth;
      const screenH = gl.drawingBufferHeight;
      ensureHalfResFbo(gl, state, screenW, screenH);

      if (!state.fbo || !state.fboTexture) return;

      const elapsed = (Date.now() - startTimeRef.current) / 1000.0;
      const glowEnabled = hasActiveGlow(severityRef.current);

      const activate = gl.useProgram;
      activate.call(gl, state.skeletonProgram);

      gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbo);
      gl.viewport(0, 0, state.fboWidth, state.fboHeight);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform1f(state.timeLoc, elapsed);
      gl.uniform2f(state.resLoc, width, height);
      gl.uniform2fv(state.landmarksLoc, landmarksRef.current);
      gl.uniform1fv(state.severityLoc, severityRef.current);
      gl.uniform1f(state.poseActiveLoc, poseActiveRef.current ? 1 : 0);
      gl.uniform1f(state.glowLoc, glowEnabled ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      activate.call(gl, state.blitProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, screenW, screenH);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, state.fboTexture);
      gl.uniform1i(state.blitTexLoc, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.endFrameEXP();
    }, [width, height]);

    useImperativeHandle(ref, () => ({ requestRender: renderFrame }), [
      renderFrame,
    ]);

    useEffect(() => {
      renderFrame();
    }, [uSeverity, poseActive, renderFrame]);

    // Pulse animation only when form-error glow is visible.
    useRenderLoop(renderFrame, glowActive);

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
  },
);

export const WebGLOverlay = memo(WebGLOverlayInner);
