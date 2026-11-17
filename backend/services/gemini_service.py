import os
import json
import asyncio
from google import genai

SYSTEM_PROMPT = """You are an IT incident classification expert. Analyze the given IT incident and return ONLY valid JSON with this exact structure:
{
  "category": "APPLICATION|NETWORK|HARDWARE|ACCESS|OTHER",
  "suggested_priority": "P1|P2|P3|P4",
  "priority_reasoning": "brief explanation why this priority",
  "ai_summary": "1-2 sentence plain English summary of the problem",
  "suggested_resolution_steps": ["step 1", "step 2", "step 3"]
}
P1=Critical business impact, P2=High impact, P3=Medium, P4=Low."""


def _get_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    return genai.Client()  # reads GEMINI_API_KEY automatically


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        # parts[1] is the content between first pair of ```
        text = parts[1]
        if text.startswith("json"):
            text = text[4:]
    return text.strip()


async def analyze_incident(title: str, description: str) -> dict:
    client = _get_client()
    if not client:
        return {
            "category": "OTHER",
            "suggested_priority": "P3",
            "priority_reasoning": "AI unavailable — no GEMINI_API_KEY set",
            "ai_summary": description[:200],
            "suggested_resolution_steps": ["Investigate the issue", "Contact support team"],
        }

    try:
        def _call():
            return client.interactions.create(
                model="gemini-4-hydrogen",
                system_instruction=SYSTEM_PROMPT,
                input=f"Title: {title}\nDescription: {description}",
                store=False,
            )

        interaction = await asyncio.to_thread(_call)
        text = _strip_fences(interaction.output_text or "")
        return json.loads(text)
    except Exception as e:
        return {
            "category": "OTHER",
            "suggested_priority": "P3",
            "priority_reasoning": f"AI error: {str(e)}",
            "ai_summary": description[:200],
            "suggested_resolution_steps": [
                "Investigate the issue",
                "Contact support team",
                "Escalate if needed",
            ],
        }


async def get_resolution_suggestions(title: str, description: str, category: str) -> list:
    client = _get_client()
    if not client:
        return [
            "Check system logs",
            "Restart affected services",
            "Contact vendor support",
            "Escalate to senior technician",
        ]
    try:
        def _call():
            return client.interactions.create(
                model="gemini-4-hydrogen",
                system_instruction=(
                    "You are an expert IT support technician. Return ONLY a JSON array of "
                    "4-5 specific, actionable resolution steps as strings. No markdown."
                ),
                input=(
                    f"IT Incident - Category: {category}\n"
                    f"Title: {title}\n"
                    f"Description: {description}\n\n"
                    "Provide step-by-step resolution instructions."
                ),
                store=False,
            )

        interaction = await asyncio.to_thread(_call)
        text = _strip_fences(interaction.output_text or "[]")
        return json.loads(text)
    except Exception:
        return [
            "Check system logs",
            "Restart affected services",
            "Contact vendor support",
            "Escalate to senior technician",
        ]
