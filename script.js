const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const voiceBtn = document.getElementById('voice-mode-btn');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');

let chatHistory = [];
let selectedFile = null;

// --- 🎙️ VOICE MODE (Speech Recognition) ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'bn-BD'; 
    
    voiceBtn.addEventListener('click', () => {
        if (voiceBtn.classList.contains('active')) {
            recognition.stop();
        } else {
            recognition.start();
            voiceBtn.classList.add('active');
            userInput.placeholder = "Listening...";
        }
    });

    recognition.onresult = (e) => {
        userInput.value = e.results[0][0].transcript;
        voiceBtn.classList.remove('active');
        userInput.placeholder = "Type a message...";
    };

    recognition.onend = () => voiceBtn.classList.remove('active');
}

fileInput.addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
    if (selectedFile) fileInfo.innerText = "📄 Attached: " + selectedFile.name;
});

// --- 🧠 CORE HYBRID LOGIC ---
async function askAI() {
    const prompt = userInput.value.trim();
    if (!prompt && !selectedFile) return;

    appendMessage(prompt || "Analyzing visual input...", 'user-card');
    userInput.value = '';
    fileInfo.innerText = '';
    sendBtn.disabled = true;

    // Loading Animation HTML
    const loaderHTML = `
        <div class="loader-wave" style="display:flex; gap:5px; padding:5px;">
            <div style="width:8px; height:8px; background:var(--primary); border-radius:50%; animation: pulse 1.5s infinite;"></div>
            <div style="width:8px; height:8px; background:var(--primary); border-radius:50%; animation: pulse 1.5s infinite; animation-delay:0.2s;"></div>
            <div style="width:8px; height:8px; background:var(--primary); border-radius:50%; animation: pulse 1.5s infinite; animation-delay:0.4s;"></div>
        </div>`;
    
    const loadingDiv = appendMessage(loaderHTML, 'ai-card', true);

    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('history', JSON.stringify(chatHistory));
    if (selectedFile) formData.append('file', selectedFile);

    try {
        /**
         * 🚀 DEPLOYMENT FIX:
         * Replace the URL below with your actual Render URL!
         * Example: 'https://studyspark-backend.onrender.com/ask'
         */
        const BACKEND_URL = 'https://your-backend-name.onrender.com/ask'; 
        
        const response = await fetch(BACKEND_URL, { 
            method: 'POST', 
            body: formData 
        });

        const data = await response.json();
        
        // Clean LaTeX formatting
        let cleanText = data.text.replace(/\\,\s?/g, '').replace(/\$,\s?/g, '$');
        
        // Render Markdown
        loadingDiv.innerHTML = marked.parse(cleanText);

        // Add Action Bar (Copy & Listen)
        const actionBar = document.createElement('div');
        actionBar.className = 'action-bar';
        actionBar.innerHTML = `
            <button class="action-btn" onclick="copyTxt(this)">📋 Copy</button>
            <button class="action-btn" onclick="speakTxt(this)">🔊 Listen</button>
        `;
        loadingDiv.appendChild(actionBar);

        // Render Scientific Content
        if (window.MathJax) MathJax.typesetPromise([loadingDiv]);
        
        // Render Mermaid Diagrams
        if (window.mermaid && cleanText.includes('```mermaid')) {
            const mNodes = loadingDiv.querySelectorAll('.language-mermaid');
            mNodes.forEach(async (node) => {
                await mermaid.run({ nodes: [node] });
            });
        }

        // Update Memory
        chatHistory.push({ role: "user", content: prompt || "Attached Photo" });
        chatHistory.push({ role: "assistant", content: data.text });
        if (chatHistory.length > 10) chatHistory.shift();

    } catch (err) {
        console.error("Error:", err);
        loadingDiv.innerHTML = "⚠️ Connection Error. The server might be sleeping (Cold Start). Please wait 30s and try again.";
    } finally {
        sendBtn.disabled = false;
        selectedFile = null;
    }
}

// Function to handle message appending
function appendMessage(text, className, isHTML = false) {
    const div = document.createElement('div');
    div.className = className;
    if (isHTML) {
        div.innerHTML = text;
    } else {
        // User messages are plain text, AI messages use Markdown
        div.innerHTML = className === 'user-card' ? text : marked.parse(text);
    }
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return div;
}

// Copy Text to Clipboard
function copyTxt(btn) {
    const txt = btn.parentElement.parentElement.innerText.replace(/📋 Copy|🔊 Listen/g, '');
    navigator.clipboard.writeText(txt);
    btn.innerText = "✅ Done";
    setTimeout(() => btn.innerText = "📋 Copy", 2000);
}

// Text to Speech (Voice Assistant)
function speakTxt(btn) {
    const txt = btn.parentElement.parentElement.innerText.replace(/📋 Copy|🔊 Listen/g, '');
    if (window.speechSynthesis.speaking) return window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(txt);
    // Auto-detect Bengali or English
    utt.lang = txt.match(/[অ-য়]/) ? 'bn-BD' : 'en-US';
    window.speechSynthesis.speak(utt);
}

// Event Listeners
sendBtn.addEventListener('click', askAI);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') askAI();
});