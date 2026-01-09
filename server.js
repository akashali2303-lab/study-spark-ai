const express = require('express');
const cors = require('cors');
require('dotenv').config();
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Tesseract = require('tesseract.js');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/', (req, res) => res.send("Selim's Engine is Active"));

app.post('/ask', upload.single('file'), async (req, res) => {
    try {
        const { prompt, history } = req.body;
        let ocrText = "";

        if (req.file) {
            const result = await Tesseract.recognize(req.file.buffer, 'ben+eng');
            ocrText = result.data.text;
        }

        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            systemInstruction: "You are StudySpark AI, created by Selim Reza. RULES: 1. Mirror the user's language (Bangla for Bangla). 2. Use LaTeX for Math/Chem. 3. Use Mermaid for structures. 4. If OCR text exists, analyze it with the user question."
        });

        const chat = model.startChat({ history: JSON.parse(history || "[]") });
        const finalPrompt = `[Handwritten OCR Context]: ${ocrText}\n[User Message]: ${prompt || "Analyze the image."}`;
        const result = await chat.sendMessage(finalPrompt);
        const response = await result.response;
        
        res.json({ text: response.text() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend running on ${PORT}`));