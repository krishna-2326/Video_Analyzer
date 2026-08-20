# Actionable items, decisions, questions

from langchain_mistralai import ChatMistralAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
import os
from dotenv import load_dotenv

load_dotenv()

# extract_* functions send the whole transcript in one call (no chunking,
# unlike summarizer.py's map-reduce) so the model keeps full context. For
# very long transcripts this risks hitting the context window, so we cap
# input length -- keeping the END of the transcript, since action items /
# decisions/questions tend to cluster near meeting wrap-up.
# Increase max transcript limit to 60,000 chars (Mistral supports 32k tokens)
MAX_TRANSCRIPT_CHARS = 60000


def get_llm():
    # api_key is read from MISTRAL_API_KEY automatically if not passed explicitly
    return ChatMistralAI(model="mistral-small-latest", temperature=0.2)


def build_chain(system_prompt: str):
    llm = get_llm()
    return (
        RunnablePassthrough() | RunnableLambda(lambda x: {"text": x}) | ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "{text}"),
        ]) | llm | StrOutputParser()
    )


def _prepare_transcript(transcript: str) -> str:
    transcript = transcript.strip()
    if len(transcript) > MAX_TRANSCRIPT_CHARS:
        # Smart sampling: keep start, middle, and end so no key context is lost
        half = MAX_TRANSCRIPT_CHARS // 2
        return transcript[:half] + "\n\n... [middle content skipped for analysis] ...\n\n" + transcript[-half:]
    return transcript


def extract_action_items(transcript: str) -> str:
    if not transcript or not transcript.strip():
        return "No action items or recommendations found."

    chain = build_chain(
        "You are an expert AI content analyst. From the transcript, extract all action items, "
        "practical recommendations, key steps, or actionable lessons taught.\n"
        "If the content is an explainer/tutorial/speech, summarize the key practical takeaways or steps.\n"
        "Format as a numbered list with:\n"
        "- Description / Step\n"
        "- Context or Recommendation\n\n"
        "Always provide meaningful insights from the content."
    )

    return chain.invoke(_prepare_transcript(transcript))


def extract_key_decisions(transcript: str) -> str:
    if not transcript or not transcript.strip():
        return "No key decisions or conclusions found."

    chain = build_chain(
        "You are an expert AI content analyst. From the transcript, extract all key conclusions, "
        "major decisions, core findings, or primary arguments established. "
        "Format as a numbered list with clear bullet points. "
        "Always provide meaningful conclusions from the content."
    )
    return chain.invoke(_prepare_transcript(transcript))


def extract_questions(transcript: str) -> str:
    if not transcript or not transcript.strip():
        return "No open questions found."

    chain = build_chain(
        "From the transcript, extract any open questions, unresolved topics, or key areas "
        "suggested for further discussion, thought, or exploration. "
        "Format as a numbered list. "
        "If no explicit questions were asked, summarize the main themes or topics raised for the audience."
    )
    return chain.invoke(_prepare_transcript(transcript))


def extract_key_moments(transcript: str) -> str:
    if not transcript or not transcript.strip():
        return "No key moments found."

    chain = build_chain(
        "From the transcript, extract 4-6 key chapters or major milestone moments with estimated timestamps.\n"
        "Format as bullet points with estimated timestamps like:\n"
        "- [00:00] Introduction & Overview\n"
        "- [02:30] Primary Concept Discussion\n"
        "- [05:45] Key Takeaways & Conclusion\n"
        "Always output clean, structured timeline items."
    )
    return chain.invoke(_prepare_transcript(transcript))