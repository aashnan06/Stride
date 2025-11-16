import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

// Add this right after dotenv.config()
console.log("🔑 Checking API keys...");
console.log("ElevenLabs API key exists:", !!process.env.ELEVENLABS_API_KEY);
console.log("ElevenLabs API key length:", process.env.ELEVENLABS_API_KEY?.length);
console.log("Gemini API key exists:", !!process.env.GEMINI_API_KEY);

if (!process.env.ELEVENLABS_API_KEY) {
  console.log("❌ CRITICAL: ElevenLabs API key is missing!");
} else {
  console.log("✅ ElevenLabs API key is present");
}

const app = express();
app.use(cors());
app.use(express.json());

console.log("Backend index.js has started running!");

// Map character → ElevenLabs voiceId
const voices = {
  mom: "Itr6exdQTrvjpW1lNztS",
  dad: "cjVigY5qzO86Huf0OWal",
  friend: "OmCmWje54WoEq3eEzDu6"
};

// Test route
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

// Generate conversation (text only)
// Generate conversation (text only) - with model fallback
app.post("/generate-conversation", async (req, res) => {
  const { convoType } = req.body;
  console.log("🎯 Generating conversation for:", convoType);
  
  const prompt = `
Generate a safe, realistic phone conversation where the user only hears one side of the conversation. Make sure that the things the caller is saying doesn't require specific answers for the conversation to make sense, it should stay generic in the sense that multiple answers could make sense. 
Include short pauses [Pause 2s], [Pause 3s], etc., at natural breaks.
The conversation topic is: ${convoType}.
Return only the lines of the person the user is hearing.
`;

  // Try these common models in order
  const modelsToTry = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-pro",
    "gemini-1.0-pro"
  ];

  let lastError;

  for (const model of modelsToTry) {
    try {
      console.log(`   Trying model: ${model}`);
      
      const result = await axios.post(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
        { contents: [{ parts: [{ text: prompt }] }] },
        { 
          params: { key: process.env.GEMINI_API_KEY },
          timeout: 10000
        }
      );

      console.log(`✅ Success with model: ${model}`);
      
      if (result.data.candidates && result.data.candidates[0]) {
        const convoText = result.data.candidates[0].content.parts[0].text;
        console.log("   Conversation text:", convoText);
        return res.json({ conversation: convoText, modelUsed: model });
      } else {
        console.log("❌ Unexpected Gemini response structure:", result.data);
        lastError = "Unexpected response structure";
        continue; // Try next model
      }
    } catch (err) {
      lastError = err;
      console.log(`❌ Model ${model} failed:`, err.response?.data?.error?.message || err.message);
      
      // If it's a 404 (model not found), try next model
      if (err.response?.status === 404) {
        continue;
      }
      
      // For other errors, break and use fallback
      break;
    }
  }

  // If all models failed, use fallback conversation
  console.log("🔄 All models failed, using fallback conversation");
  const fallbackConvo = getFallbackConversation(convoType);
  return res.json({ 
    conversation: fallbackConvo, 
    note: "Used fallback conversation",
    error: lastError?.response?.data?.error?.message || lastError?.message 
  });
});

// Add this fallback function
function getFallbackConversation(convoType) {
  const fallbacks = {
    mom: `
Hi honey, I just wanted to call and see how your week is going so far. [Pause 2s]

Oh, good, I'm glad to hear that. You sound well rested. [Pause 3s]

Really? That's exciting! Tell me a little bit about what you're working on. [Pause 4s]

Wow, that sounds like a lot of hard work. Just remember not to overdo it, okay? [Pause 2s]

Yes, you know me. I worry! Are you making sure to eat a proper lunch every day? [Pause 3s]

That's fine, just make sure you're not skipping meals. You need your energy. [Pause 3s]

Anyway, I just wanted to hear your voice for a few minutes. I miss you! [Pause 2s]

Okay, I'll let you go back to what you were doing. Call me later in the week when you have a bit more time.[Pause 3s]

Love you! Take care of yourself. Bye for now.
`,
    dad: `
Hey, honey. Just checking in. Everything okay on your end?

[Pause 3s]

That’s good. No, nothing’s wrong. I was just having a quick break and thought I'd call.

[Pause 4s]

Oh, the weather here is pretty typical. A little breezy, but the sun is out.

[Pause 1s]

So, did you figure out what time you were thinking of coming home next week?

[Pause 5s]

Okay, just let me know when you book it, so I can plan to pick you up.

[Pause 2s]

We’re good on groceries, thanks for asking. Your mother made that chili you like last night. There might be some leftovers.

[Pause 3s]

Oh, hey, did you remember to check on that car insurance thing we talked about? The payment is due soon, I think.

[Pause 4s]

Great. That’s all I needed to know. Just wanted to make sure it was on your radar.

[Pause 2s]

No, no rush on the details. Just whenever you get a minute.

[Pause 5s]

Alright. Well, I’ve gotta get back to this email. You take care, okay? And don't forget to eat something decent.

[Pause 1s]

Love you. Talk soon. Bye.
`,
    friend: `
Hey! Yeah, it's me. What are you doing?

[Pause 2s]

Oh, nice. I was just about to head out, but I wanted to see if you were busy later.

[Pause 3s]

That's too bad. Well, I had a pretty weird thing happen this morning, actually.

[Pause 1s]

Seriously. So, I went to that coffee shop near the park, right? The one with the blue awning?

[Pause 4s]

Exactly! Anyway, I'm waiting for my order, and this guy comes in and he's wearing... you are not going to believe this... a full-on knight costume.

[Pause 2s]

No, not like a Halloween thing! It was shiny! It looked real!

[Pause 5s]

I know! And he didn't order anything. He just stood there for a minute, adjusted his helmet, and walked out.

[Pause 1s]

Yeah, exactly. Just another Tuesday, I guess.

[Pause 3s]

Right? Anyway, I was thinking we could try that new place downtown tomorrow night, if you're free then?

[Pause 6s]

Perfect. I'll text you the time. Okay, gotta run. Talk to you later!

[Pause 2s]

You too! Bye!
`
  };

  const key = convoType.toLowerCase().includes('mom') ? 'mom' : 
              convoType.toLowerCase().includes('dad') ? 'dad' : 'friend';
  
  return fallbacks[key];
}

// Generate audio from conversation text
app.post("/generate-conversation-audio", async (req, res) => {
  const { text, character } = req.body;
  
  console.log("🎯 Received audio request for character:", character);
  const key = character ? character.toLowerCase() : 'unknown';
  const voiceId = voices[key] || voices.mom;
  console.log("   Using voiceId:", voiceId);

  try {
    console.log("   Making request to ElevenLabs...");
    const audioRes = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      { 
        text,
        model_id: "eleven_turbo_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      },
      {
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        },
        responseType: "arraybuffer"
      }
    );
    
    console.log("✅ Audio generated successfully, size:", audioRes.data.byteLength);
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audioRes.data);
    
  } catch (err) {
    console.log("❌ ELEVENLABS API ERROR DETAILS:");
    console.log("   HTTP Status:", err.response?.status);
    console.log("   HTTP Status Text:", err.response?.statusText);
    console.log("   Error Message:", err.message);
    
    if (err.response?.data) {
      try {
        const errorJson = JSON.parse(Buffer.from(err.response.data).toString());
        console.log("   Error JSON:", errorJson);
      } catch (e) {
        console.log("   Error Data:", Buffer.from(err.response.data).toString());
      }
    }
    
    res.status(500).json({ 
      error: "ElevenLabs API failed",
      status: err.response?.status,
      message: err.response?.statusText || err.message
    });
  }
});

// Test ElevenLabs API key endpoint
app.get("/test-api-key", async (req, res) => {
  try {
    console.log("🔑 Testing ElevenLabs API key...");
    
    const testResponse = await axios.get('https://api.elevenlabs.io/v1/user', {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY
      }
    });
    
    console.log("✅ ElevenLabs API key is VALID!");
    console.log("   Account info:", testResponse.data);
    
    res.json({ 
      status: 'valid', 
      account: testResponse.data 
    });
    
  } catch (err) {
    console.log("❌ ElevenLabs API key is INVALID:");
    console.log("   Error:", err.response?.data || err.message);
    
    res.status(500).json({ 
      status: 'invalid', 
      error: err.response?.data || err.message 
    });
  }
});

// Add this endpoint to see available models
app.get("/list-gemini-models", async (req, res) => {
  try {
    console.log("🔍 Listing available Gemini models...");
    
    const response = await axios.get(
      "https://generativelanguage.googleapis.com/v1/models",
      { params: { key: process.env.GEMINI_API_KEY } }
    );
    
    console.log("✅ Available models:");
    const models = response.data.models;
    
    models.forEach(model => {
      console.log(`   - ${model.name}: ${model.displayName}`);
      console.log(`     Supported methods: ${model.supportedGenerationMethods?.join(', ') || 'None'}`);
    });
    
    // Filter for models that support generateContent
    const generateContentModels = models.filter(model => 
      model.supportedGenerationMethods?.includes('generateContent')
    );
    
    res.json({
      allModels: models,
      generateContentModels: generateContentModels,
      suggestedModels: generateContentModels.map(m => m.name)
    });
    
  } catch (err) {
    console.log("❌ Error listing models:", err.response?.data || err.message);
    res.status(500).json({ 
      error: "Failed to list models", 
      details: err.response?.data || err.message 
    });
  }
});

// 🚀 SINGLE server listener - ONLY ONE!
app.listen(3000, "0.0.0.0", () => console.log("Server running on port 3000"));