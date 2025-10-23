import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai"; 
import axios from "axios"; 
import { db } from "./firebase.js"; 
import { collection, addDoc, getDocs, query, where, limit, orderBy } from "firebase/firestore/lite";
import { sendWhatsAppMessage } from "./whatsapp.js";

// --- CONFIGURATION ---
const HISTORY_LIMIT = 15; // Max messages to retrieve for short-term context
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// --- OPENAI CONFIGURATION (The Brain) ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// ------------------------------------------

// ------------------------------------------
// --- CONTEXT RETRIEVAL FUNCTIONS ---
// ------------------------------------------

// Function 1: Retrieves the last messages for short-term memory (Used for infinite storage)
async function retrieveConversationHistory(senderNumber) {
    try {
        const q = query(
            collection(db, "messages"),
            where("from", "==", senderNumber), 
            orderBy("timestamp", "desc"), 
            limit(HISTORY_LIMIT)
        );

        const snapshot = await getDocs(q);
        let history = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const role = data.direction.includes('outbound') || data.direction === 'summary' ? 'assistant' : 'user';
            
            if (data.direction === 'summary') {
                history.push({ role: 'system', content: `PREVIOUS CONTEXT SUMMARY: ${data.text}` });
            } else {
                 history.push({ role: role, content: data.text });
            }
        });
        
        return history.reverse(); 

    } catch (error) {
        console.error("Error retrieving conversation history (Firebase Indexing likely required):", error);
        throw new Error("Memory Retrieval Failed. Indexing required in Firestore."); 
    }
}

// Function 2: Gets the correct personality prompt (Tone Switching)
async function getToneProfile(phoneNumber) {
    let instruction = null;
    
    try {
        const specificQuery = query(collection(db, "tone_rules"), where("phone_number", "==", phoneNumber), limit(1));
        const specificSnapshot = await getDocs(specificQuery);

        if (!specificSnapshot.empty) {
            instruction = specificSnapshot.docs[0].data().instruction_text; 
            return instruction; 
        }

        const defaultQuery = query(collection(db, "tone_rules"), where("id", "==", 'DEFAULT_UNKNOWN'), limit(1));
        const defaultSnapshot = await getDocs(defaultQuery);
        
        if (!defaultSnapshot.empty) {
            instruction = defaultSnapshot.docs[0].data().instruction_text;
        } else {
            instruction = "You are a neutral, helpful AI assistant. Be brief and professional."; 
        }
    
    } catch (error) {
        return null; // Return null on database error to trigger 'Automation Paused'
    }
    
    return instruction;
}


// Function 3: CONVERSATION SUMMARIZATION (Infinite Memory Logic)
async function summarizeConversation(conversationHistory) {
    console.log("🟡 Triggering summarization for long conversation history...");
    try {
        const summaryPrompt = "Please summarize the entire following conversation history into a single, cohesive paragraph that captures the main topic and any critical ongoing action items. Use neutral language.";
        
        const messages = [
            { role: "system", content: summaryPrompt },
            ...conversationHistory
        ];

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", 
            messages: messages,
            max_tokens: 150, 
        });

        const summaryText = response.choices[0].message.content;
        console.log(`✅ Summary Generated: ${summaryText.substring(0, 50)}...`);
        return summaryText;

    } catch (error) {
        console.error("Error during summarization:", error.message);
        return "The primary topic of this thread is unknown due to memory limits. Continue the conversation contextually.";
    }
}
// -------------------------------------------------------------------------


// --- PRIMARY WEBHOOK: The Master Loop ---
app.get("/", (req, res) => {
  res.send("AI Agent Server is running! OpenAI and Firestore are connected. (STATUS: AUTOMATED)");
});


app.post("/whatsapp/incoming", async (req, res) => { 
    const incomingData = req.body.data;

    if (!incomingData || !incomingData.from || !incomingData.body) {
        // Check for media-only messages that might lack 'body' and handle them
        if (incomingData.media || incomingData.fileUrl) { /* proceed with media logic */ } else {
            return res.sendStatus(200); 
        }
    }
    
    // Loop Prevention
    if (incomingData.fromMe) { return res.sendStatus(200); }

    // Data Extraction & Cleanup
    let replyToNumber = '+' + incomingData.from.split('@')[0].replace('+', '');
    const messageBody = incomingData.body || "User sent media without caption."; // Handle empty text with media
    
    // --- 🖼️ NEW: MEDIA EXTRACTION LOGIC ---
    let mediaUrl = null;
    if (incomingData.media) {
        mediaUrl = incomingData.media;
    } else if (incomingData.fileUrl) { 
        mediaUrl = incomingData.fileUrl;
    }
    if (mediaUrl) {
        console.log(`🖼️ Detected Media URL: ${mediaUrl}`);
    }
    // ----------------------------------------

    console.log(`Incoming message from ${replyToNumber}: ${messageBody}`);

    try {
        // 1. RETRIEVE CONTEXT (Tone and History)
        const toneInstruction = await getToneProfile(replyToNumber);
        
        // RESTRICTED AUTOMATION CHECK
        if (toneInstruction === null) { 
            await addDoc(collection(db, "messages"), { from: replyToNumber, text: messageBody, timestamp: new Date(), direction: 'inbound_ignored' });
            return res.sendStatus(200);
        }

        let conversationHistory = await retrieveConversationHistory(replyToNumber);
        
        // LONG-TERM MEMORY CHECK (Summarization Trigger)
        if (conversationHistory.length >= HISTORY_LIMIT) {
            const newSummary = await summarizeConversation(conversationHistory);
            
            await addDoc(collection(db, "messages"), { 
                from: 'SYSTEM_MEMORY', 
                text: newSummary, 
                timestamp: new Date(), 
                direction: 'summary' 
            });

            // Replace the conversationHistory array with only the new summary for the current API call
            conversationHistory = [
                { role: "system", content: `PREVIOUS CONTEXT SUMMARY: ${newSummary}` }
            ];
            console.log(`Successfully compressed conversation to permanent memory.`);
        }
        
        // Log Inbound
        await addDoc(collection(db, "messages"), { from: replyToNumber, text: messageBody, timestamp: new Date(), direction: 'inbound' });

        
        // 2. ASSEMBLE MESSAGES ARRAY (Sending Memory + Persona to the Brain)
        
        // 🚨 CRITICAL CHANGE: Build the content array for Multimodal Input
        const userContentArray = [];
        
        // Add the image URL object if media was detected
        if (mediaUrl) {
            userContentArray.push({ 
                type: "image_url", 
                image_url: { 
                    url: mediaUrl 
                } 
            });
        }
        
        // Add the user's text (caption or question)
        userContentArray.push({ type: "text", text: messageBody });

        // Final message structure for the LLM
        const messages = [
            // 1. System Prompt (The Persona/Tone and final instruction)
            { 
                role: "system", 
                content: toneInstruction + " Based on the conversation history, generate a reply. Assume you are speaking in the first person. ABSOLUTE RULE: If the message includes an image, prioritize analyzing the image and keep the text response concise."
            },
            
            // 2. Short-Term Memory / Summary 
            ...conversationHistory, 
            
            // 3. Current User Message (The multimodal prompt)
            { 
                role: "user", 
                content: userContentArray // <--- FINAL MULTIMODAL INPUT
            }
        ];


        // 3. Call the Main Agent (AI)
        const aiResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini", 
            messages: messages,
        });

        const replyText = aiResponse.choices[0].message.content;
        console.log(`Generated reply: ${replyText}`);

        // 4. EXECUTE THE SEND
        await sendWhatsAppMessage(replyToNumber, replyText); 
        
        // 5. LOG THE SENT MESSAGE
        await addDoc(collection(db, "messages"), {
            from: 'AI_Agent', 
            text: replyText, 
            timestamp: new Date(),
            direction: 'outbound_sent' 
        });
        console.log("💾 Outbound message logged to Firestore.");

        res.json({ status: "Reply sent autonomously", original_msg: messageBody, ai_reply: replyText });

    } catch (error) {
        console.error("Autonomous Reply Failure (Internal):", error.message);
        res.status(500).json({ error: `Failed to process and send autonomous reply. Error: ${error.message}` });
    }
});

// Start the server
app.listen(3000, () => console.log("Server running on port 3000"));