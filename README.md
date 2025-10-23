🌟 Modular AI Agent Manager: WhatsApp Core Engine

This project provides the foundational, production-ready architecture for a personalized and perpetually context-aware AI Digital Assistant. It is designed for resilience and scalability across multiple communication platforms using Node.js, OpenAI, and Google Firestore.

Key Architectural Features

Multi-Agent Design (Brain and Worker): Implements a highly decoupled "Brain and Worker" architecture. The central server.js (the Brain) handles all LLM calls, memory logic, and tone management, while isolated workers (like whatsapp.js) manage platform-specific credentials and message delivery. This isolation enhances security and ensures fault tolerance.

Infinite Conversation Memory: Solves the token limit problem via Conversation Summarization. Once a thread exceeds the defined limit (currently 15 messages), the Main Agent uses GPT-4o-mini to compress the history into a concise summary, which is archived in Firestore.

Multimodal Ready: The system is configured to process and analyze both text captions and image URLs simultaneously in a single API call, leveraging the vision capabilities of modern LLMs.

🛠️ Project Structure & Setup

Core Components

File

Role

Status

server.js

Main Agent / Brain: Handles webhooks, memory retrieval, summarization logic, and the final LLM call.

Secured

whatsapp.js

Sub-Agent Worker: Manages outbound messaging via the external API (e.g., UltraMsg).

Secured

firebase.js

Data Layer: Initializes the Firestore database connection by reading configuration securely from process.env.

Secured

Getting Started (Local Setup)

To get a local copy up and running, follow these simple steps.

1. Clone the Repository & Install Dependencies

# Clone the repository
git clone git clone https://github.com/Uday4890/AI-Agent-Manager.git
cd AI-Agent-Manager

# Install Node.js dependencies
npm install


2. Configure Environment Variables (Secrets)

Create a file named .env in the root of your project directory. Do NOT commit this file. Use the provided .env.example file as a template to fill in your real credentials.

3. Run the Server & Expose the Webhook

Your Node.js server listens on port 3000 for incoming WhatsApp messages. Since it must be reachable from the internet, you must use ngrok to create a secure tunnel.

Start your Node.js server:

node server.js


In a second terminal window, run ngrok:

# This exposes your local port 3000 publicly
ngrok http 3000


Configure WhatsApp Webhook: Copy the Forwarding URL (the https://... link) provided by ngrok and paste it into your WhatsApp API provider's webhook settings, appending the endpoint path:

[YOUR NGROK URL]/whatsapp/incoming


🚀 Future Roadmap (Version 2.0 - Proactive Agents)

The next phase will introduce Function Calling (Tool Use) to transform the agent into an active execution engine:

Calendar Agent: For scheduling and real-time availability checks.

Clock Agent: For setting time-based reminders.

Notepad Agent: A proactive scheduler to aggregate and report on all activity every few hours.
