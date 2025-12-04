from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI
import os

# Load .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# Read OpenAI API key and model from environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not set in the environment or .env file")

# Create OpenAI client
client = OpenAI(api_key=OPENAI_API_KEY)


@app.route("/message", methods=["POST"])
def message():
    data = request.get_json(silent=True) or {}
    user_text = data.get("message", "").strip()
    system_prompt = data.get("system", "You are a helpful assistant.")
    history = data.get("history")  # optional list of {role, content}

    if not user_text:
        return jsonify({"error": "No message provided."}), 400

    # Build messages for Chat API
    messages = [{"role": "system", "content": system_prompt}]

    if isinstance(history, list):
        for item in history:
            if "role" in item and "content" in item:
                messages.append({"role": item["role"], "content": item["content"]})

    messages.append({"role": "user", "content": user_text})

    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=messages,
            max_tokens=600,
            temperature=0.7,
        )

        reply = resp.choices[0].message.content.strip()
        return jsonify({"reply": reply})

    except Exception as e:
        # Good for debugging in development
        print("Error from OpenAI:", e)
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # Default to localhost:5000
    app.run(host="127.0.0.1", port=5000, debug=True)
