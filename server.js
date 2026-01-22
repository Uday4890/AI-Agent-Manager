import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

import { initQdrant, qdrant } from "./memory/qdrant.js";
import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  limit,
  orderBy
} from "firebase/firestore/lite";
import { sendWhatsAppMessage } from "./whatsapp.js";

// ---------------- CONFIG ----------------
const HISTORY_LIMIT = 15;
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ---------------- OPENAI ----------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ---------------- EMBEDDINGS ----------------
async function embedText(text) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text
  });
  return res.data[0].embedding;
}

// ---------------- QDRANT MEMORY ----------------

// Store semantic memory
async function storeSemanticMemory(text, phone) {
  const vector = await embedText(text);

  await qdrant.upsert("agent_memory", {
    points: [
      {
        id: Date.now() + Math.random(),
        vector,
        payload: {
          content: text,
          phone_number: phone,
          timestamp: new Date().toISOString()
        }
      }
    ]
  });

  console.log("🧠 Stored semantic memory:", text);
}

// Retrieve semantic memory
async function retrieveSemanticMemory(queryText, phone) {
  const vector = await embedText(queryText);

  const results = await qdrant.search("agent_memory", {
    vector,
    limit: 3,
    filter: {
      must: [
        {
          key: "phone_number",
          match: { value: phone }
        }
      ]
    }
  });

  console.log(
    `🔍 Qdrant retrieved ${results.length} memories`
  );

  return results.map(r => r.payload.content);
}

// ---------------- FIRESTORE MEMORY ----------------

// Conversation history
async function retrieveConversationHistory(senderNumber) {
  const q = query(
    collection(db, "messages"),
    where("from", "==", senderNumber),
    orderBy("timestamp", "desc"),
    limit(HISTORY_LIMIT)
  );

  const snapshot = await getDocs(q);
  const history = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    const role =
      data.direction === "outbound_sent"
        ? "assistant"
        : "user";

    history.push({ role, content: data.text });
  });

  return history.reverse();
}

// Persona / tone rules
async function getToneProfile(phoneNumber) {
  console.log("🎭 Looking up persona for:", phoneNumber);

  try {
    const specific = query(
      collection(db, "tone_rules"),
      where("phone_number", "==", phoneNumber),
      limit(1)
    );

    const snap = await getDocs(specific);

    if (!snap.empty) {
      console.log("🎭 Using phone-specific persona");
      return snap.docs[0].data().instruction_text;
    }

    const fallback = query(
      collection(db, "tone_rules"),
      where("id", "==", "DEFAULT_UNKNOWN"),
      limit(1)
    );

    const fallbackSnap = await getDocs(fallback);

    if (!fallbackSnap.empty) {
      console.log("🎭 Using DEFAULT_UNKNOWN persona");
      return fallbackSnap.docs[0].data().instruction_text;
    }

    console.warn("⚠️ DEFAULT_UNKNOWN missing");
    return "You are a helpful AI assistant.";

  } catch (err) {
    console.error("🔥 Persona lookup failed:", err.message);
    return "You are a helpful AI assistant.";
  }
}

// ---------------- ROUTES ----------------

// Health check
app.get("/", (_, res) => {
  res.send("AI Agent running with Qdrant + Firestore");
});

// 🔬 LOCAL TEST ROUTE (NO WHATSAPP NEEDED)
app.post("/test", async (req, res) => {
  const phone = "+919999999999";
  const message = req.body.message || "test message";

  console.log("🧪 Local test triggered");

  const toneInstruction = await getToneProfile(phone);
  const semanticMemories =
    await retrieveSemanticMemory(message, phone);

  res.json({
    phone,
    toneInstruction,
    semanticMemories
  });
});

// WhatsApp webhook
app.post("/whatsapp/incoming", async (req, res) => {
  const incoming = req.body.data;
  if (!incoming || incoming.fromMe) return res.sendStatus(200);

  // ✅ CORRECT: UltraMsg already gives valid format
  const replyToNumber = incoming.from;

  if (!replyToNumber.endsWith("@c.us")) {
    console.warn("⚠️ Skipping non-user WhatsApp ID:", replyToNumber);
    return res.sendStatus(200);
  }

  const messageBody =
    incoming.body || "User sent media";

  console.log(`📨 ${replyToNumber}: ${messageBody}`);

  try {
    const toneInstruction =
      await getToneProfile(replyToNumber);

    const history =
      await retrieveConversationHistory(replyToNumber);

    const semanticMemories =
      await retrieveSemanticMemory(
        messageBody,
        replyToNumber
      );

    const semanticContext =
      semanticMemories.length > 0
        ? `\n\nRelevant long-term context:\n- ${semanticMemories.join(
            "\n- "
          )}`
        : "";

    const messages = [
      {
        role: "system",
        content:
          toneInstruction +
          semanticContext +
          "\n\nFollow persona rules strictly."
      },
      ...history,
      { role: "user", content: messageBody }
    ];

    const aiResponse =
      await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages
      });

    const replyText =
      aiResponse.choices[0].message.content;

    await sendWhatsAppMessage(replyToNumber, replyText);

    await addDoc(collection(db, "messages"), {
      from: replyToNumber,
      text: messageBody,
      timestamp: new Date(),
      direction: "inbound"
    });

    await addDoc(collection(db, "messages"), {
      from: "AI_Agent",
      text: replyText,
      timestamp: new Date(),
      direction: "outbound_sent"
    });

    if (/prefer|always|remember/i.test(messageBody)) {
      await storeSemanticMemory(messageBody, replyToNumber);
    }

    res.json({ status: "sent" });
  } catch (e) {
    console.error("🔥 Processing failed:", e.message);
    res.status(500).json({ error: "failed" });
  }
});

// ---------------- STARTUP ----------------
async function startServer() {
  await initQdrant();
  app.listen(3000, () =>
    console.log("🚀 Server running on port 3000")
  );
}

startServer();

