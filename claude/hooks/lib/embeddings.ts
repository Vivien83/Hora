/**
 * HORA — Local vector embeddings via @huggingface/transformers
 *
 * Uses all-MiniLM-L6-v2 (22MB ONNX model, local, zero API)
 * - First call downloads model to cache (~22MB)
 * - Subsequent calls load from cache (~200ms)
 * - Per-embedding: ~10-50ms
 * - 384-dimension vectors, normalized (dot product = cosine similarity)
 */

// Module-level singleton for the pipeline
let pipelineInstance: any = null;
let loadFailed = false;

export async function getEmbedder(): Promise<any> {
  if (loadFailed) return null;
  if (pipelineInstance) return pipelineInstance;

  try {
    const { pipeline } = await import("@huggingface/transformers");
    pipelineInstance = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      quantized: true,  // quantized ONNX for speed
    });
    return pipelineInstance;
  } catch {
    loadFailed = true;
    return null;
  }
}

export async function embed(text: string): Promise<number[] | null> {
  const embedder = await getEmbedder();
  if (!embedder) return null;

  try {
    const result = await embedder(text, { pooling: "mean", normalize: true });
    return Array.from(result.data);
  } catch {
    return null;
  }
}

export async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];
  const embedder = await getEmbedder();
  if (!embedder) return texts.map(() => null);

  const results: (number[] | null)[] = [];
  for (const text of texts) {
    try {
      const result = await embedder(text, { pooling: "mean", normalize: true });
      results.push(Array.from(result.data));
    } catch {
      results.push(null);
    }
  }
  return results;
}

/**
 * Cosine similarity between two normalized vectors.
 * Since vectors are normalized, dot product = cosine similarity.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}
