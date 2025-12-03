from google import genai

client = genai.Client(api_key="AIzaSyChs9e6cTn-w_-1mKOnVf_1eRnRga9eTRc")

response = client.models.generate_content(
    model="gemini-2.5-flash", contents="Explain how AI works in a few words"
)
print(response.text)