import type { TfliteModel } from "react-native-fast-tflite";

export function decodeOutputBuffer(
  buffer: ArrayBuffer,
  dataType?: string,
): Float32Array {
  if (dataType === "uint8") {
    const u8 = new Uint8Array(buffer);
    const out = new Float32Array(u8.length);
    for (let i = 0; i < u8.length; i++) {
      out[i] = u8[i] / 255;
    }
    return out;
  }
  return new Float32Array(buffer);
}

export function parseModelOutputs(
  outputs: ArrayBuffer[],
  outputMetas?: ReadonlyArray<{ shape: number[]; dataType?: string }>,
): {
  classification: number;
  errors: [number, number, number];
} {
  let classification = 0;
  let errors: [number, number, number] = [0, 0, 0];
  let foundCls = false;
  let foundErr = false;

  for (let i = 0; i < outputs.length; i++) {
    const meta = outputMetas?.[i];
    const values = decodeOutputBuffer(outputs[i], meta?.dataType);
    const elementCount = values.length;

    if (elementCount === 1) {
      classification = values[0];
      foundCls = true;
    } else if (elementCount === 3) {
      errors = [values[0], values[1], values[2]];
      foundErr = true;
    } else if (elementCount >= 4 && !foundCls && !foundErr) {
      classification = values[0];
      errors = [values[1], values[2], values[3]];
      foundCls = true;
      foundErr = true;
    }
  }

  return { classification, errors };
}

export function encodeModelInput(
  model: TfliteModel,
  normalizedSequence: Float32Array,
): ArrayBuffer {
  const inputMeta = model.inputs[0];
  const elementCount = inputMeta.shape.reduce((a, b) => a * b, 1);

  if (inputMeta.dataType === "uint8") {
    const buffer = new ArrayBuffer(elementCount);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < elementCount && i < normalizedSequence.length; i++) {
      view[i] = Math.max(
        0,
        Math.min(255, Math.round(normalizedSequence[i] * 128 + 128)),
      );
    }
    return buffer;
  }

  const buffer = new ArrayBuffer(elementCount * 4);
  const view = new Float32Array(buffer);
  const copyLen = Math.min(view.length, normalizedSequence.length);
  view.set(normalizedSequence.subarray(0, copyLen));
  return buffer;
}
