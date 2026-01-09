const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const voiceBtn = document.getElementById('voice-mode-btn');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const scrollArea = document.querySelector('.content-scroll-area');

let chatHistory = [];
let selectedFile = null;

// --- 🧭 TAB NAVIGATION ---
document.getElementById('show-chat').onclick = (e) => {
    e.preventDefault();
    document.getElementById('chat-section').classList.remove('hidden');
    document.getElementById('about-section').classList.add('hidden');
    document.getElementById('show-chat').classList.add('active');
    document.getElementById('show-about').classList.remove('active');
};
document.getElementById('show-about').onclick = (e) => {
    e.preventDefault();
    document.getElementById('about-section').classList.remove('hidden');
    document.getElementById('chat-section').classList.add('hidden');
    document.getElementById('show-about').classList.add('active');
    document.getElementById('show-chat').classList.remove('active');
};

// --- 🎙️ VOICE INPUT (User to Assistant) ---
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

// --- 📁 FILE HANDLER ---
fileInput.addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
    if (selectedFile) {
        fileInfo.innerText = "📄 Attached: " + selectedFile.name;
        fileInfo.style.color = "#6366f1";
    }
});

// --- 🧠 CORE AI LOGIC WITH COLD-START RETRY ---
async function askAI() {
    const prompt = userInput.value.trim();
    if (!prompt && !selectedFile) return;

    appendMessage(prompt || "Analyzing visual input...", 'user-card');
    userInput.value = '';
    fileInfo.innerText = '';
    sendBtn.disabled = true;

    const loaderHTML = `
        <div style="display:flex; flex-direction:column; gap:8px;">
            <div class="loader-wave" style="display:flex; gap:5px; padding:5px;">
                <div style="width:8px; height:8px; background:var(--primary); border-radius:50%; animation: pulse 1.5s infinite;"></div>
                <div style="width:8px; height:8px; background:var(--primary); border-radius:50%; animation: pulse 1.5s infinite; animation-delay:0.2s;"></div>
                <div style="width:8px; height:8px; background:var(--primary); border-radius:50%; animation: pulse 1.5s infinite; animation-delay:0.4s;"></div>
            </div>
            <small id="status-msg" style="color:var(--muted); font-size:0.7rem;">Waking up engine...</small>
        </div>`;
    
    const loadingDiv = appendMessage(loaderHTML, 'ai-card', true);

    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('history', JSON.stringify(chatHistory));
    if (selectedFile) formData.append('file', selectedFile);

    // --- SMART RETRY FETCH ---
    const fetchWithRetry = async (attempt = 1) => {
        try {
            // REPLACE with your real Render URL
            const BACKEND_URL = 'https://study-spark-ai-vcby.onrender.com/ask';
            
            const response = await fetch(BACKEND_URL, { method: 'POST', body: formData });
            
            if (!response.ok) throw new Error("Server waking up");

            const data = await response.json();
            
            let cleanText = data.text.replace(/\\,\s?/g, '').replace(/\$,\s?/g, '$');
            loadingDiv.innerHTML = marked.parse(cleanText);

            // Add Action Buttons
            const actionBar = document.createElement('div');
            actionBar.className = 'action-bar';
            actionBar.innerHTML = `<button class="act-btn" onclick="copyTxt(this)">📋 Copy</button><button class="act-btn" onclick="speakTxt(this)">🔊 Listen</button>`;
            loadingDiv.appendChild(actionBar);

            // Render Math & Diagrams
            if (window.MathJax) MathJax.typesetPromise([loadingDiv]);
            if (window.mermaid && cleanText.includes('```mermaid')) {
                const nodes = loadingDiv.querySelectorAll('.language-mermaid');
                nodes.forEach(async (node) => await mermaid.run({ nodes: [node] }));
            }

            // Update History
            chatHistory.push({ role: "user", content: prompt || "Attached Photo" });
            chatHistory.push({ role: "assistant", content: data.text });
            if (chatHistory.length > 10) chatHistory.shift();

        } catch (err) {
            if (attempt < 3) {
                const status = document.getElementById('status-msg');
                if (status) status.innerText = `Server is waking up... Please wait (Attempt ${attempt}/3)`;
                setTimeout(() => fetchWithRetry(attempt + 1), 12000); // Retry every 12 seconds
            } else {
                loadingDiv.innerHTML = "<span style='color:red'>⚠️ Server connection timed out. Render's free tier takes 50s to wake up. Please refresh and try once more.</span>";
            }
        } finally {
            if (attempt >= 1) sendBtn.disabled = false;
            scrollArea.scrollTop = scrollArea.scrollHeight;
        }
    };

    fetchWithRetry();
}

// --- HELPERS ---
function appendMessage(text, className, isHTML = false) {
    const div = document.createElement('div');
    div.className = className;
    div.innerHTML = isHTML ? text : (className === 'user-card' ? text : marked.parse(text));
    chatContainer.appendChild(div);
    scrollArea.scrollTop = scrollArea.scrollHeight;
    return div;
}

window.copyTxt = (btn) => {
    const txt = btn.parentElement.parentElement.innerText.replace(/📋 Copy|🔊 Listen/g, '');
    navigator.clipboard.writeText(txt);
    btn.innerText = "✅ Done";
    setTimeout(() => btn.innerText = "📋 Copy", 2000);
};

window.speakTxt = (btn) => {
    const txt = btn.parentElement.parentElement.innerText.replace(/📋 Copy|🔊 Listen/g, '');
    if (window.speechSynthesis.speaking) return window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(txt);
    utt.lang = txt.match(/[অ-য়]/) ? 'bn-BD' : 'en-US';
    window.speechSynthesis.speak(utt);
};

sendBtn.onclick = askAI;
userInput.onkeypress = (e) => e.key === 'Enter' && askAI();