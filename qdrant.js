import { QdrantClient } from "@qdrant/js-client-rest";

export const qdrant = new QdrantClient({
  url: "http://localhost:6333"
});

export async function initQdrant() {
  const collections = await qdrant.getCollections();
  const exists = collections.collections.find(
    c => c.name === "agent_memory"
  );

  if (!exists) {
    await qdrant.createCollection("agent_memory", {
      vectors: {
        size: 1536,
        distance: "Cosine"
      }
    });
    console.log("✅ Qdrant collection created");
  } else {
    console.log("ℹ️ Qdrant collection already exists");
  }
}
