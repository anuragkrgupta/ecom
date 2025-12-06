from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai
import os

# Load .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# Read Google AI API key and model from environment variables
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_MODEL = os.getenv("GOOGLE_MODEL", "gemini-2.5-flash")

if not GOOGLE_API_KEY:
    print("⚠️  WARNING: GOOGLE_API_KEY is not set!")
    print("   Please set it via:")
    print("   1. Environment variable: $env:GOOGLE_API_KEY = 'your-key'")
    print("   2. Or create a .env file with GOOGLE_API_KEY=your-key")
    print("   3. See .env.example for reference")

# Configure Google Generative AI only if key is available
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)

# Global chat session for conversation context
chat_session = None


@app.route("/message", methods=["POST"])
def message():
    global chat_session
    data = request.get_json(silent=True) or {}
    user_text = data.get("message", "").strip()
    system_prompt = data.get("system", "You are a helpful assistant.")

    if not user_text:
        return jsonify({"error": "No message provided."}), 400

    try:
        # Initialize model and chat session on first use
        if chat_session is None:
            model = genai.GenerativeModel(
                model_name=GOOGLE_MODEL,
                system_instruction=system_prompt
            )
            chat_session = model.start_chat(history=[])

        # Send message and get response
        response = chat_session.send_message(user_text)
        reply = response.text.strip()
        return jsonify({"reply": reply})

    except Exception as e:
        # Good for debugging in development
        print("Error from Google AI:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/reset", methods=["POST"])
def reset_chat():
    """Reset the chat session (clear conversation history)"""
    global chat_session
    chat_session = None
    return jsonify({"status": "Chat reset."})


if __name__ == "__main__":
    # Default to localhost:5000
    app.run(host="127.0.0.1", port=5000, debug=True)
