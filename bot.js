document.addEventListener('DOMContentLoaded', function () {
    const ta = document.querySelector('.bot-input');
    function autoResize(el){
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }
    if(ta){
        autoResize(ta);
        ta.addEventListener('input', function(e){
            autoResize(e.target);
        });

        ta.addEventListener('keydown', function(e){
            if(e.key === 'Enter' && !e.shiftKey){
                e.preventDefault();
                const form = ta.closest('form');
                if(form){
                    form.dispatchEvent(new Event('submit', {cancelable: true}));
                }
            }
        });

        const form = ta.closest('form');
        if(form){
                form.addEventListener('submit', async function(e){
                    e.preventDefault();
                    const val = ta.value.trim();
                    if(!val) return;
                    // append user's message to the messages area
                    appendMessage('user', val);
                    ta.value = '';
                    autoResize(ta);

                    // send to Python backend
                    try{
                        const resp = await fetch('http://127.0.0.1:5000/message', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: val })
                        });
                        if(resp.ok){
                            const data = await resp.json();
                            appendMessage('bot', data.reply || '(no reply)');
                        } else {
                            appendMessage('bot', '(server error) ' + resp.status);
                        }
                    } catch(err){
                        // fallback when backend is not running
                        appendMessage('bot', '(network error) ' + err.message + ' — falling back to local reply');
                        setTimeout(function(){
                            appendMessage('bot', 'You said: ' + val);
                        }, 500);
                    }
                });
        }
    }
});

// Chat toggle button: show / hide the .bot-box
document.addEventListener('DOMContentLoaded', function (){
    const toggle = document.getElementById('chat-toggle');
    const bot = document.querySelector('.bot-box');
    if(!toggle || !bot) return;
    // Persisted state from localStorage
    const saved = window.localStorage.getItem('chat-open');
    let isOpen = null;
    if(saved !== null){
        isOpen = saved === 'true';
    }
    const closed = bot.classList.contains('closed');
    // if we have a saved state, apply it; otherwise use class in DOM
    if(isOpen !== null){
        if(isOpen){
            bot.classList.remove('closed');
        } else {
            bot.classList.add('closed');
        }
    }
    toggle.setAttribute('aria-expanded', String(!bot.classList.contains('closed')));

    toggle.addEventListener('click', function(){
        const isNowClosed = bot.classList.toggle('closed');
        // aria-expanded should be true when chat is visible
        const expanded = String(!isNowClosed);
        toggle.setAttribute('aria-expanded', expanded);
        // persist
        window.localStorage.setItem('chat-open', String(!isNowClosed));
        // rotate/animate toggle
        if(!isNowClosed){
            toggle.classList.add('open');
        } else {
            toggle.classList.remove('open');
        }
        // focus textarea when opening
        if(!isNowClosed){
            const ta = bot.querySelector('.bot-input');
            if(ta) ta.focus();
        }
    });

    // Close on outside click
    document.addEventListener('click', function(e){
        const target = e.target;
        if(bot.classList.contains('closed')) return;
        if(target === toggle || toggle.contains(target)) return;
        if(bot.contains(target)) return;
        // clicked outside
        bot.classList.add('closed');
        toggle.setAttribute('aria-expanded', 'false');
        window.localStorage.setItem('chat-open', 'false');
        toggle.classList.remove('open');
    });
});

// Helper: append messages to .bot-messages and auto-scroll
function appendMessage(who, text){
    const container = document.querySelector('.bot-messages');
    if(!container) return;
    const div = document.createElement('div');
    div.className = 'msg ' + (who === 'user' ? 'user' : 'bot');
    div.textContent = text;
    container.appendChild(div);
    // scroll to bottom
    container.scrollTop = container.scrollHeight;
}

// Export for testing or external use if available
if(typeof module !== 'undefined'){
    module.exports = {};
}
