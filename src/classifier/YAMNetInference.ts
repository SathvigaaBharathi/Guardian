import * as tf from '@tensorflow/tfjs';

export interface ClassifyResult {
  classIndex: number;
  confidence: number;
}

export async function classifyFrame(
  model: tf.GraphModel,
  frame: Float32Array
): Promise<ClassifyResult> {
  return tf.tidy(() => {
    const input = tf.tensor1d(frame); // shape [15600] matches the expected [-1] 1D tensor shape
    const output = model.predict(input) as tf.Tensor[];
    // YAMNet output[0] = scores [N, 521], output[1] = embeddings, output[2] = spectrogram
    const scores = output[0]; // [N, 521]
    const meanScores = scores.mean(0); // [521]
    const classIndex = meanScores.argMax().dataSync()[0] as number;
    const confidence = meanScores.max().dataSync()[0] as number;
    return { classIndex, confidence };
  });
}
