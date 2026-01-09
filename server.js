const express = require('express');
const cors = require('cors');
require('dotenv').config();
const multer = require('multer');
const { OpenAI } = require('openai');
const Tesseract = require('tesseract.js');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors({ origin: '*' }));
app.use(express.json());

const client = new OpenAI({
    apiKey: process.env.CEREBRAS_API_KEY,
    baseURL: "https://api.cerebras.ai/v1",
});

const MODEL_ID = "llama-3.3-70b";

app.post('/ask', upload.single('file'), async (req, res) => {
    try {
        const { prompt, history } = req.body;
        let ocrText = "";

        // 1. OCR PROCESSING (If Image exists)
        if (req.file) {
            console.log("📸 Image Detected. Extracting text...");
            const result = await Tesseract.recognize(req.file.buffer, 'ben+eng');
            ocrText = result.data.text;
        }

        // 2. CONTEXTUAL MERGING (The Key Fix)
        // Combining OCR findings with the User's specific chat instructions
        const finalContent = `
            [IMAGE/DOCUMENT DATA]: ${ocrText || "No image uploaded."}
            [USER QUESTION]: ${prompt || "Explain the uploaded content."}
        `;

        const messages = [
            { 
                role: "system", 
                content: `You are StudySpark AI, an elite academic assistant. 
                CORE RULES:
                1. DUAL ANALYSIS: You must analyze the User Question IN CONTEXT of the Image Data provided.
                2. ADAPTIVE LENGTH: Observe the user's requested length. If they ask for "details", be thorough. If they ask "briefly", be concise.
                3. LANGUAGE MIRRORING: Strictly respond in the language the user used for their question (Bengali or English).
                4. SCIENCE & MATH: Use LaTeX for all formulas. Use Mermaid for structural diagrams.
                5. ACCURACY: If OCR text looks like a chemical equation or math, fix any transcription errors based on your scientific knowledge.` 
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

const PORT = 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 StudySpark Hybrid Engine Live on 8080`));