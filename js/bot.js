//  1. System prompt: customize your bot's behavior here
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

let history = [];

// ---------- helpers ----------

// Auto-resize a textarea
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

// Escape HTML (used if we ever need to create safe text)
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Create a DocumentFragment that preserves newlines and converts URLs into anchors
function createMessageContentFragment(text) {
  const frag = document.createDocumentFragment();

  if (typeof text !== "string") text = String(text || "");

  // Replace markdown bullets "* " at start of lines with "• "
  const pretty = text.replace(/^\* /gm, "• ");

  // Split by newline but preserve empty lines
  const lines = pretty.split(/\r?\n/);

  lines.forEach((line, idx) => {
    // For each line, we will detect URLs and create text/anchor nodes
    // URL regex (simple): matches http(s) urls
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(line)) !== null) {
      const url = match[0];
      const start = match.index;
      const before = line.slice(lastIndex, start);
      if (before) frag.appendChild(document.createTextNode(before));
      // create anchor
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = url;
      frag.appendChild(a);
      lastIndex = start + url.length;
    }

    // trailing text after last match
    const trailing = line.slice(lastIndex);
    if (trailing) frag.appendChild(document.createTextNode(trailing));

    // Add a line break for every line except the last (we want same visual separation)
    if (idx < lines.length - 1) {
      frag.appendChild(document.createElement("br"));
    }
  });

  return frag;
}

// ---------- append message + youtube card rendering ----------
function appendMessage(who, text, youtubeObj) {
  const container = document.querySelector(".bot-messages");
  if (!container) return;

  // message wrapper
  const wrapper = document.createElement("div");
  wrapper.className = "msg " + (who === "user" ? "user" : "bot");
  // preserve newlines visually
  wrapper.style.whiteSpace = "pre-wrap";

  // Build safe content
  const contentFrag = createMessageContentFragment(text);
  wrapper.appendChild(contentFrag);
  container.appendChild(wrapper);

  // If youtube object exists, render a safe card (DOM API only)
  if (youtubeObj && youtubeObj.url) {
    try {
      const card = document.createElement("div");
      card.className = "yt-card";

      // Thumbnail
      if (youtubeObj.thumbnail) {
        const thumbLink = document.createElement("a");
        thumbLink.href = youtubeObj.url;
        thumbLink.target = "_blank";
        thumbLink.rel = "noopener noreferrer";

       // Wrapper for thumbnail + play button
const wrap = document.createElement("div");
wrap.className = "yt-thumb-wrapper";

// Thumbnail
const img = document.createElement("img");
img.src = youtubeObj.thumbnail;
img.alt = youtubeObj.title || "YouTube video";
img.className = "yt-thumb";
wrap.appendChild(img);

// Play button overlay
const play = document.createElement("div");
play.className = "yt-play";
wrap.appendChild(play);

// Make entire thumbnail clickable
thumbLink.appendChild(wrap);
card.appendChild(thumbLink);

      }

      // Meta (title + label)
      const meta = document.createElement("div");
      meta.className = "yt-meta";

      const titleLink = document.createElement("a");
      titleLink.href = youtubeObj.url;
      titleLink.target = "_blank";
      titleLink.rel = "noopener noreferrer";
      titleLink.className = "yt-title";
      titleLink.textContent = youtubeObj.title || "Watch on YouTube";
      meta.appendChild(titleLink);

      const label = document.createElement("div");
      label.className = "yt-label";
      label.textContent = "YouTube";
      meta.appendChild(label);

      card.appendChild(meta);

      container.appendChild(card);
    } catch (err) {
      // don't break chat rendering on card errors
      console.warn("Failed to render YouTube card:", err);
    }
  }

  // Auto-scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// ---------- initial DOM setup (autoResize, send on Enter, form handling) ----------
document.addEventListener("DOMContentLoaded", function () {
  const ta = document.querySelector(".bot-input");

  if (ta) {
    autoResize(ta);

    ta.addEventListener("input", function (e) {
      autoResize(e.target);
    });

    // Enter to send, Shift+Enter for newline
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const form = ta.closest("form");
        if (form) form.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    });

    const form = ta.closest("form");
    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        const val = ta.value.trim();
        if (!val) return;

        // Show user message
        appendMessage("user", val);
        ta.value = "";
        autoResize(ta);

        // Send to backend
        try {
          const resp = await fetch("http://127.0.0.1:5000/message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: val,
              system: SYSTEM_PROMPT,
              history: history
            })
          });

          if (resp.ok) {
            const data = await resp.json();
            const replyText = data.reply || "(no reply)";
            const yt = data.youtube || null;

            // Render reply + youtube card (if any)
            appendMessage("bot", replyText, yt);

            // Update history AFTER successful response
            history.push({ role: "user", content: val });
            history.push({ role: "assistant", content: replyText });
          } else {
            appendMessage("bot", "(server error) " + resp.status);
          }
        } catch (err) {
          // Fallback when backend is not running / network error
          appendMessage(
            "bot",
            "(network error) " + err.message + " — falling back to local reply because your server is not responding"
          );
          setTimeout(function () {
            appendMessage("bot", "You said: " + val);
          }, 500);
        }
      });
    }
  }

  // Chat toggle behavior (same as your previous code)
  const toggle = document.getElementById("chat-toggle");
  const bot = document.querySelector(".bot-box");
  if (toggle && bot) {
    // Persisted state from localStorage
    const saved = window.localStorage.getItem("chat-open");
    let isOpen = null;
    if (saved !== null) {
      isOpen = saved === "true";
    }

    // Apply saved state or keep existing DOM class
    if (isOpen !== null) {
      if (isOpen) bot.classList.remove("closed");
      else bot.classList.add("closed");
    }
    toggle.setAttribute("aria-expanded", String(!bot.classList.contains("closed")));

    toggle.addEventListener("click", function () {
      const isNowClosed = bot.classList.toggle("closed");
      toggle.setAttribute("aria-expanded", String(!isNowClosed));
      window.localStorage.setItem("chat-open", String(!isNowClosed));
      if (!isNowClosed) toggle.classList.add("open");
      else toggle.classList.remove("open");
      if (!isNowClosed) {
        const ta2 = bot.querySelector(".bot-input");
        if (ta2) ta2.focus();
      }
    });

    // Close on outside click
    document.addEventListener("click", function (e) {
      const target = e.target;
      if (bot.classList.contains("closed")) return;
      if (target === toggle || toggle.contains(target)) return;
      if (bot.contains(target)) return;
      bot.classList.add("closed");
      toggle.setAttribute("aria-expanded", "false");
      window.localStorage.setItem("chat-open", "false");
      toggle.classList.remove("open");
    });
  }
});

// For testing environments (node)
if (typeof module !== "undefined") {
  module.exports = {};
}
