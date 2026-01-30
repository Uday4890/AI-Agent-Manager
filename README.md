🌟 Qdrant-Powered WhatsApp AI Agent
Persona-Aware Long-Term Memory for Conversational Systems

This project implements a production-oriented conversational AI agent that combines deterministic persona control with semantic long-term memory using Qdrant as the primary vector search engine.

The system is designed for real-world messaging platforms (WhatsApp) where conversations are fragmented, long-running, and require persistent context.

🧠 Core Idea

Traditional chatbots rely on short prompt windows and forget past interactions.
This system introduces a multi-layer memory architecture:

Firestore (Deterministic memory)
Enforces strict persona, tone, and behavioral rules.

Qdrant (Semantic memory)
Stores and retrieves long-term contextual information using vector similarity search.

This separation ensures consistency, scalability, and controllable behavior.

🧩 System Architecture (MAS Design)
User (WhatsApp)
      |
Webhook (ngrok → Express)
      |
Main Agent (server.js)
      |
      |-- Persona & Rules (Firestore)
      |-- Short-Term Context (Firestore)
      |-- Long-Term Semantic Memory (Qdrant)
      |
OpenAI LLM
      |
Context-Aware Response

Multi-Agent Separation

Main Agent (Brain)
Handles reasoning, memory retrieval, persona enforcement, and LLM orchestration.

Worker Agent (whatsapp.js)
Handles platform-specific message delivery (UltraMsg).

This modular design improves fault isolation and extensibility.

🔍 Why Qdrant Is Central

Qdrant is used as the primary vector database to:

Store embeddings of user preferences and contextual statements

Perform similarity search across past interactions

Retrieve relevant memories even when phrasing differs

Key Properties:

Per-user memory isolation (phone-number scoped)

Vector similarity search (Cosine distance)

Runtime retrieval influencing agent responses

Without Qdrant, long-term memory would degrade to summaries or heuristics.

🧠 Memory Design
1️⃣ Persona & Rules (Firestore)

Deterministic

Never overridden

Example:

phone_number → instruction_text

2️⃣ Short-Term Context (Firestore)

Last N messages

Maintains conversational continuity

3️⃣ Long-Term Semantic Memory (Qdrant)

Embedded using OpenAI embeddings

Retrieved via similarity search

Injected into the system prompt

This ensures:

Memory supports behavior, but never controls it.

📁 Project Structure
File	Role
server.js	Main Agent (logic, memory, LLM)
whatsapp.js	Messaging Worker (UltraMsg)
firebase.js	Firestore initialization
memory/qdrant.js	Qdrant client & collection setup
🚀 Getting Started (Local Setup)
Prerequisites

Node.js ≥ 18

Docker Desktop

OpenAI API Key

1️⃣ Start Qdrant
docker run -p 6333:6333 qdrant/qdrant


Verify:

http://localhost:6333

2️⃣ Clone & Install
git clone https://github.com/Uday4890/AI-Agent-Manager.git
cd AI-Agent-Manager
npm install

3️⃣ Environment Variables

Create .env (do NOT commit):

OPENAI_API_KEY=your_openai_key


Firebase credentials are also loaded from environment variables.

4️⃣ Run the Server
node server.js


Server runs on:

http://localhost:3000

5️⃣ Expose Webhook (WhatsApp)
ngrok http 3000


Set webhook URL in WhatsApp API provider as:

https://<ngrok-url>/whatsapp/incoming

🧪 Local Testing (No WhatsApp Required)

A test endpoint is provided for demos and debugging:

POST /test


Example:

curl -X POST http://localhost:3000/test \
  -H "Content-Type: application/json" \
  -d '{"message":"I prefer short answers"}'


Returns:

persona applied

Qdrant retrieval results

This ensures full reproducibility without external services.

⚠️ Limitations

Semantic memory insertion uses a simple heuristic

Qdrant data is ephemeral unless volumes are used

Full WhatsApp demo requires a second device

These do not affect system correctness or evaluation.
📌 Summary

This project demonstrates a principled, production-aligned use of Qdrant for long-term semantic memory in a conversational AI agent.
By separating rules, context, and semantic recall, the system remains predictable while adapting over time.

📜 License

MIT

🚧 Future Work

Tool / function calling agents

Proactive scheduling agents

Memory decay & reinforcement scoring
