from ollama import Client

client = Client()

response = client.chat(
    model="llama3.1:8b",
    messages=[
        {"role": "system", "content": "You are a helpful tax consultant."},
        {"role": "user", "content": "Summarize Section 80C deductions."}
    ]
)

print(response["message"]["content"])
