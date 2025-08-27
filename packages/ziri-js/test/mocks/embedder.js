export const makeEmbedder = () => ({
  embedBatch: async (texts) => texts.map(() => Array(1536).fill(0).map(() => Math.random()))
});