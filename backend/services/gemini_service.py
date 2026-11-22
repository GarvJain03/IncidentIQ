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
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or api_key == "your_gemini_api_key_here":
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
            "category": "APPLICATION" if any(w in description.lower() for w in ["payroll", "app", "software", "crash", "system"]) else "OTHER",
            "suggested_priority": "P1" if any(w in description.lower() for w in ["payroll", "outage", "crash", "database", "down"]) else "P3",
            "priority_reasoning": "Standard heuristic fallback — configure GEMINI_API_KEY for dynamic AI reasoning",
            "ai_summary": f"Incident regarding '{title}': issue affecting operational workflow reported by employee.",
            "suggested_resolution_steps": [
                "Inspect related system logs for errors",
                "Verify service uptime and database connectivity",
                "Escalate to technical lead if critical service is impacted",
            ],
        }

    try:
        def _call():
            return client.interactions.create(
                model="gemini-4-hydrogen",
                system_instruction=SYSTEM_PROMPT,
                input=f"Title: {title}\nDescription: {description}",
                store=False,
            )

        interaction = await asyncio.wait_for(asyncio.to_thread(_call), timeout=9.0)
        text = _strip_fences(interaction.output_text or "")
        return json.loads(text)
    except asyncio.TimeoutError:
        return {
            "category": "APPLICATION" if any(w in description.lower() for w in ["payroll", "app", "software", "crash", "system"]) else "OTHER",
            "suggested_priority": "P1" if any(w in description.lower() for w in ["payroll", "outage", "crash", "database", "down"]) else "P3",
            "priority_reasoning": "AI call timed out — applied automated fast heuristic classification",
            "ai_summary": f"Incident '{title}': issue affecting operational workflow reported.",
            "suggested_resolution_steps": [
                "Inspect related system logs for errors",
                "Verify service uptime and connectivity",
                "Escalate to technical lead if critical service is impacted",
            ],
        }
    except Exception as e:
        return {
            "category": "OTHER",
            "suggested_priority": "P3",
            "priority_reasoning": f"AI error: {str(e)}",
            "ai_summary": f"Reported issue: '{title}'. Operational impact under investigation.",
            "suggested_resolution_steps": [
                "Investigate affected host and service logs",
                "Contact technical support team",
                "Apply corrective maintenance patch",
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

        interaction = await asyncio.wait_for(asyncio.to_thread(_call), timeout=9.0)
        text = _strip_fences(interaction.output_text or "[]")
        return json.loads(text)
    except Exception:
        return [
            "Check system logs",
            "Restart affected services",
            "Contact vendor support",
            "Escalate to senior technician",
        ]
