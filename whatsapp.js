import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const INSTANCE_ID = process.env.ULTRAMSG_INSTANCE_ID;
const TOKEN = process.env.ULTRAMSG_TOKEN;
const ULTRA_URL = `https://api.ultramsg.com/${INSTANCE_ID}`;

export async function sendWhatsAppMessage(to, message) {
  try {
    if (!INSTANCE_ID || !TOKEN) {
      throw new Error("ULTRAMSG_INSTANCE_ID or ULTRAMSG_TOKEN is missing from .env!");
    }

    const response = await axios.post(`${ULTRA_URL}/messages/chat`, {
      token: TOKEN, 
      to: to, 
      body: message,
    });
    console.log("✅ Message sent successfully to UltraMsg queue.", response.data);
    
    if (response.data.error) {
        console.error("❌ UltraMsg API Reported Error:", response.data.error);
    }
    
  } catch (error) {
    console.error("❌ UltraMsg Outbound Error:", error.response?.data?.error || error.message);
  }
}