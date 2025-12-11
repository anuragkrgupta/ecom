# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai
import os
import requests
from urllib.parse import urlencode, quote_plus

# Load .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# Read API keys and model from environment variables
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_MODEL = os.getenv("GOOGLE_MODEL", "gemini-2.5-flash")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")  # optional, used for YouTube Data API v3

if not GOOGLE_API_KEY:
    print("⚠️  WARNING: GOOGLE_API_KEY is not set!")
    print("   Please set it via:")
    print("   1. Environment variable: $env:GOOGLE_API_KEY = 'your-key'")
    print("   2. Or create a .env file with GOOGLE_API_KEY=your-key")
    print("   3. See .env.example for reference")
    # we deliberately don't crash — endpoint returns error instead

# Configure Google Generative AI only if key is available
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)

# Global chat session for conversation context
chat_session = None

# ---------------- YouTube helper ----------------
def youtube_top_video(query: str, api_key: str, max_results: int = 1):
    """
    Search YouTube for the top video matching `query` and return a dictionary:
      { "url": "...", "videoId": "...", "title": "...", "thumbnail": "..." }
    Returns None on failure or when no video found.
    """
    if not api_key or not query:
        return None

    params = {
        "part": "snippet",
        "q": query,
        "key": api_key,
        "type": "video",
        "maxResults": max_results,
    }
    url = "https://www.googleapis.com/youtube/v3/search?" + urlencode(params, quote_via=quote_plus)
    try:
        resp = requests.get(url, timeout=6)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("items", [])
        if not items:
            return None

        item = items[0]
        video_id = item.get("id", {}).get("videoId")
        snippet = item.get("snippet", {}) or {}
        title = snippet.get("title", "") or ""
        thumbs = snippet.get("thumbnails", {}) or {}
        thumbnail = (
            thumbs.get("high", {}).get("url")
            or thumbs.get("medium", {}).get("url")
            or thumbs.get("default", {}).get("url")
            or None
        )
        if not video_id:
            return None

        return {
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "videoId": video_id,
            "title": title,
            "thumbnail": thumbnail
        }
    except Exception as e:
        # Let callers handle logging; return None to keep chat reply unaffected
        print("YouTube API error:", e)
        return None

# ---------------- Routes ----------------
@app.route("/message", methods=["POST"])
def message():
    """
    Expected JSON body:
    {
      "message": "user text",
      "system": "optional system prompt",
      "history": [optional history array]
    }

    Response JSON:
    {
      "reply": "text from model",
      "youtube": { url, videoId, title, thumbnail }  // or null
    }
    """
    global chat_session
    data = request.get_json(silent=True) or {}
    user_text = (data.get("message") or "").strip()
    system_prompt = data.get("system", "You are a helpful assistant.")
    request_history = data.get("history", None)

    if not user_text:
        return jsonify({"error": "No message provided."}), 400

    try:
        # Initialize model and chat session on first use
        if chat_session is None:
            model_kwargs = {"model_name": GOOGLE_MODEL, "system_instruction": system_prompt}
            model = genai.GenerativeModel(**model_kwargs)
            try:
                initial_history = request_history if isinstance(request_history, list) else []
                chat_session = model.start_chat(history=initial_history)
            except Exception:
                chat_session = model.start_chat(history=[])

        # Send message and get response from Gemini
        response = chat_session.send_message(user_text)
        reply = (response.text or "").strip()

        # ---------- Helper: detect whether the reply contains Ingredients + Steps ----------
        def reply_has_recipe_sections(text: str) -> bool:
            if not text:
                return False
            t = text.lower()

            # Heuristics (any one from each group must be present)
            ingredient_indicators = [
                r'\bingredient(s)?\b',    # "Ingredients" header
                r'^\s*[-*•]\s+',          # bullet list items at line start
                r'^\s*\d+\s*(grams|g|kg|ml|l|cup|cups|tbsp|tsp)\b',  # quantity-like lines
            ]
            steps_indicators = [
                r'\bstep[s]?\b',          # "Steps" or "Step 1"
                r'^\s*\d+\.\s+',          # numbered steps "1. "
                r'^\s*step\s+\d+\b',      # "Step 1"
                r'\bpreheat\b',           # cooking action words
                r'\bsaute\b|\bfry\b|\bboil\b|\bbake\b|\bgrill\b'
            ]

            import re

            has_ingredient = False
            has_steps = False

            # Check for explicit header words first (best signal)
            if re.search(r'\bingredient(s)?\b', t):
                has_ingredient = True
            if re.search(r'\bstep(s)?\b|\bmethod\b|\binstructions\b', t):
                has_steps = True

            # More heuristics if headers not found
            if not has_ingredient:
                for patt in ingredient_indicators:
                    if re.search(patt, t, re.MULTILINE):
                        has_ingredient = True
                        break

            if not has_steps:
                for patt in steps_indicators:
                    if re.search(patt, t, re.MULTILINE):
                        has_steps = True
                        break

            # final decision: both must be True
            return bool(has_ingredient and has_steps)

        # Determine whether to fetch YouTube: only if reply contains ingredients and steps
        youtube_result = None
        try:
            if reply_has_recipe_sections(reply):
                # Use user's message as query (+ "recipe") to improve relevance
                query = user_text + " recipe"
                youtube_result = youtube_top_video(query, YOUTUBE_API_KEY)
            else:
                # don't call YouTube API if recipe sections are not present
                youtube_result = None
        except Exception as yterr:
            print("YouTube lookup failed:", yterr)
            youtube_result = None

        return jsonify({
            "reply": reply,
            "youtube": youtube_result
        })

    except Exception as e:
        print("Error from Google AI:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/reset", methods=["POST"])
def reset_chat():
    """Reset the chat session (clear conversation history)"""
    global chat_session
    chat_session = None
    return jsonify({"status": "Chat reset."})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
