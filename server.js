const express = require('express');
const cors = require('cors');
require('dotenv').config();
const multer = require('multer');
const { OpenAI } = require('openai');
const Tesseract = require('tesseract.js');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Enable CORS for Netlify frontend
app.use(cors({ origin: '*' }));
app.use(express.json());

// Initialize Cerebras (OpenAI Compatible)
const client = new OpenAI({
    apiKey: process.env.CEREBRAS_API_KEY,
    baseURL: "https://api.cerebras.ai/v1",
});

const MODEL_ID = "llama-3.3-70b";

// 1. Health Check Route (Used to prevent sleeping or check status)
app.get('/', (req, res) => res.send("🚀 Selim's StudySpark AI Engine is Online!"));

// 2. Main AI Logic
app.post('/ask', upload.single('file'), async (req, res) => {
    try {
        const { prompt, history } = req.body;
        let ocrText = "";

        // OCR PROCESSING
        if (req.file) {
            console.log("📸 Image Detected. Extracting text...");
            const result = await Tesseract.recognize(req.file.buffer, 'ben+eng');
            ocrText = result.data.text;
        }

        // CONTEXTUAL MERGING
        const finalContent = `
            [IMAGE/DOCUMENT DATA]: ${ocrText || "No image uploaded."}
            [USER QUESTION]: ${prompt || "Explain the uploaded content."}
        `;

        const messages = [
            { 
                role: "system", 
                content: `You are StudySpark AI, an elite academic assistant created by Selim Reza. 
                CORE RULES:
                1. DUAL ANALYSIS: Analyze the User Question IN CONTEXT of the Image Data provided.
                2. ADAPTIVE LENGTH: Observe the user's requested length. If they ask for "details" or specific word counts, be thorough. If they ask "briefly", be concise.
                3. LANGUAGE MIRRORING: Strictly respond in the language the user used for their question (Bengali or English).
                4. SCIENCE & MATH: Use LaTeX for all formulas (e.g., \\( H_2O \\)). Use Mermaid for structural diagrams.
                5. ACCURACY: Correct any OCR transcription errors based on scientific context.` 
            },
            ...JSON.parse(history || "[]"),
            { role: "user", content: finalContent }
        ];

        const completion = await client.chat.completions.create({
            model: MODEL_ID,
            messages: messages,
            temperature: 0.2,
        });

        res.json({ text: completion.choices[0].message.content });
    } catch (error) {
        console.error("Server Error:", error.message);
        res.status(500).json({ error: "API Error", details: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 StudySpark Engine Live on ${PORT}`));