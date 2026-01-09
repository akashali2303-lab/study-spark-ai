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

    // FIX: Passing 'true' as the third argument to treat this as Raw HTML, NOT Markdown
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
        const response = await fetch('http://127.0.0.1:8080/ask', { method: 'POST', body: formData });
        const data = await response.json();
        
        let cleanText = data.text.replace(/\\,\s?/g, '').replace(/\$,\s?/g, '$');
        loadingDiv.innerHTML = marked.parse(cleanText);

        const actionBar = document.createElement('div');
        actionBar.className = 'action-bar';
        actionBar.innerHTML = `
            <button class="action-btn" onclick="copyTxt(this)">📋 Copy</button>
            <button class="action-btn" onclick="speakTxt(this)">🔊 Listen</button>
        `;
        loadingDiv.appendChild(actionBar);

        if (window.MathJax) MathJax.typesetPromise([loadingDiv]);
        if (window.mermaid && cleanText.includes('```mermaid')) {
            await mermaid.run({ nodes: [loadingDiv.querySelector('.language-mermaid')] });
        }

        chatHistory.push({ role: "user", content: prompt || "Attached Photo" });
        chatHistory.push({ role: "assistant", content: data.text });
        if (chatHistory.length > 10) chatHistory.shift();

    } catch (err) {
        loadingDiv.innerHTML = "⚠️ Network Error. Restart node server.js";
    } finally {
        sendBtn.disabled = false;
        selectedFile = null;
    }
}

// FIX: Added 'isHTML' parameter to prevent Markdown escaping for loaders
function appendMessage(text, className, isHTML = false) {
    const div = document.createElement('div');
    div.className = className;
    if (isHTML) {
        div.innerHTML = text;
    } else {
        div.innerHTML = className === 'user-card' ? text : marked.parse(text);
    }
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return div;
}

function copyTxt(btn) {
    const txt = btn.parentElement.parentElement.innerText.replace(/📋 Copy|🔊 Listen/g, '');
    navigator.clipboard.writeText(txt);
    btn.innerText = "✅ Done";
    setTimeout(() => btn.innerText = "📋 Copy", 2000);
}

function speakTxt(btn) {
    const txt = btn.parentElement.parentElement.innerText.replace(/📋 Copy|🔊 Listen/g, '');
    if (window.speechSynthesis.speaking) return window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(txt);
    utt.lang = txt.match(/[অ-য়]/) ? 'bn-BD' : 'en-US';
    window.speechSynthesis.speak(utt);
}

sendBtn.addEventListener('click', askAI);
userInput.addEventListener('keypress', (e) => e.key === 'Enter' && askAI());