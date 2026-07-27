const { GoogleGenerativeAI } = require("@google/generative-ai");

const g = new GoogleGenerativeAI("AIzaSyDzgMm3B-PNa6e96UZiIOBG2q2NL0G7SQY");

async function check() {
  const ts = new Date().toLocaleTimeString();
  try {
    const r = await g.getGenerativeModel({ model: "gemini-2.0-flash-lite" }).generateContent("Say: OK");
    console.log(`[${ts}] ✅ GEMINI AVAILABLE — AI Fundamental Analysis is READY`);
    process.exit(0); // signal available
  } catch (e) {
    const msg = e.message || "";
    const isRL = msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE") || msg.includes("demand") || msg.includes("503");
    if (isRL) {
      console.log(`[${ts}] ⏳ Still rate limited. Next check in 5 min...`);
      process.exit(1); // signal still limited
    } else {
      console.log(`[${ts}] ❌ Error: ${msg.slice(0, 80)}`);
      process.exit(2);
    }
  }
}

check();
