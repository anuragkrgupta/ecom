// 🔹 1. System prompt: customize your bot's behavior here
// Example: only talk about recipes and ingredients
const SYSTEM_PROMPT = `
You are a chatbot for a grocery website.
Your ONLY job is:
- Help users choose recipes.
- Suggest ingredients and quantities.
- Suggest alternative ingredients from the store.

You MUST refuse to answer anything not related to food, cooking, or groceries.
When refusing, say: "I can only help with recipes and groceries on this website."
Keep answers short and friendly.
`;

// 🔹 2. Conversation history for backend (completed turns only)
let history = [];

// ------------- Chat input + sending logic -------------
document.addEventListener('DOMContentLoaded', function () {
    const ta = document.querySelector('.bot-input');

    function autoResize(el) {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }

    if (ta) {
        autoResize(ta);

        ta.addEventListener('input', function (e) {
            autoResize(e.target);
        });

        // Enter to send, Shift+Enter for new line
        ta.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const form = ta.closest('form');
                if (form) {
                    form.dispatchEvent(new Event('submit', { cancelable: true }));
                }
            }
        });

        const form = ta.closest('form');
        if (form) {
            form.addEventListener('submit', async function (e) {
                e.preventDefault();
                const val = ta.value.trim();
                if (!val) return;

                // Show user message in chat
                appendMessage('user', val);
                ta.value = '';
                autoResize(ta);

                // Send to Python backend (Flask)
                try {
                    const resp = await fetch('http://127.0.0.1:5000/message', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            message: val,
                            system: SYSTEM_PROMPT,
                            history: history   // previous turns only
                        })
                    });

                    if (resp.ok) {
                        const data = await resp.json();
                        const replyText = data.reply || '(no reply)';
                        appendMessage('bot', replyText);

                        // 🔹 Update history AFTER successful response
                        history.push({ role: 'user', content: val });
                        history.push({ role: 'assistant', content: replyText });
                    } else {
                        appendMessage('bot', '(server error) ' + resp.status);
                    }
                } catch (err) {
                    // Fallback when backend is not running / network error
                    appendMessage('bot', '(network error) ' + err.message + ' — falling back to local reply');
                    setTimeout(function () {
                        appendMessage('bot', 'You said: ' + val);
                    }, 500);
                }
            });
        }
    }
});

// ------------- Chat toggle (open / close) -------------
document.addEventListener('DOMContentLoaded', function () {
    const toggle = document.getElementById('chat-toggle');
    const bot = document.querySelector('.bot-box');
    if (!toggle || !bot) return;

    // Persisted state from localStorage
    const saved = window.localStorage.getItem('chat-open');
    let isOpen = null;
    if (saved !== null) {
        isOpen = saved === 'true';
    }

    const closed = bot.classList.contains('closed');

    // If we have a saved state, apply it; otherwise use class in DOM
    if (isOpen !== null) {
        if (isOpen) {
            bot.classList.remove('closed');
        } else {
            bot.classList.add('closed');
        }
    }

    toggle.setAttribute('aria-expanded', String(!bot.classList.contains('closed')));

    toggle.addEventListener('click', function () {
        const isNowClosed = bot.classList.toggle('closed');
        const expanded = String(!isNowClosed);
        toggle.setAttribute('aria-expanded', expanded);

        // Persist
        window.localStorage.setItem('chat-open', String(!isNowClosed));

        // Rotate/animate toggle
        if (!isNowClosed) {
            toggle.classList.add('open');
        } else {
            toggle.classList.remove('open');
        }

        // Focus textarea when opening
        if (!isNowClosed) {
            const ta = bot.querySelector('.bot-input');
            if (ta) ta.focus();
        }
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
        const target = e.target;
        if (bot.classList.contains('closed')) return;
        if (target === toggle || toggle.contains(target)) return;
        if (bot.contains(target)) return;

        // Clicked outside
        bot.classList.add('closed');
        toggle.setAttribute('aria-expanded', 'false');
        window.localStorage.setItem('chat-open', 'false');
        toggle.classList.remove('open');
    });
});

// ------------- Helper: append messages to chat -------------
function appendMessage(who, text) {
    const container = document.querySelector('.bot-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'msg ' + (who === 'user' ? 'user' : 'bot');
    div.textContent = text;
    container.appendChild(div);

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
}

// For testing (Node / bundlers)
if (typeof module !== 'undefined') {
    module.exports = {};
}

