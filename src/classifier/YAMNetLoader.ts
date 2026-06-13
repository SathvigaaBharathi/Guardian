import * as tf from '@tensorflow/tfjs';

const MODEL_URL = './yamnet/model.json';
let modelCache: tf.GraphModel | null = null;

export async function loadYAMNet(): Promise<tf.GraphModel> {
  if (modelCache) return modelCache;
  await tf.ready();
  console.log('Loading YAMNet model locally from:', MODEL_URL);
  modelCache = await tf.loadGraphModel(MODEL_URL);
  return modelCache;
}
