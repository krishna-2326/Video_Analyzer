import os
from langchain_mistralai import ChatMistralAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from core.vector_store import build_vector_store, load_vector_store, get_retriever

def get_llm():
    return ChatMistralAI(
        model="mistral-small-latest",
        temperature=0.3,
    )

def format_docs(docs):
    return "\n\n".join([doc.page_content for doc in docs])

def build_rag_chain(transcript: str):
    vector_store = build_vector_store(transcript)
    retriever = get_retriever(vector_store, k=8)
    llm = get_llm()

    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """You are an intelligent AI assistant. Answer the user's question clearly, 
accurately, and concisely based on the transcript context provided below.

Guidelines:
- Rely on the provided transcript context (from a video, podcast, tutorial, lecture, interview, or meeting) to answer the question.
- Provide a helpful, thorough response explaining the concepts, topics, steps, or details mentioned in the transcript.
- If the question asks for a general overview, main ideas, key takeaways, or recommendations, explain them clearly using the context.
- Be direct and friendly. Only state that information is missing if the transcript context genuinely does not contain relevant details.

Transcript Context:
{context}""",
        ),
        ("human", "{question}"),
    ])

    # Full LCEL RAG pipeline
    rag_chain = (
        {
            "context": retriever | RunnableLambda(format_docs),
            "question": RunnablePassthrough(),
        }
        | prompt
        | llm
        | StrOutputParser()
    )

    return rag_chain


def load_rag_chain():
    vector_store = load_vector_store()
    retriever = get_retriever(vector_store, k=8)

    llm = get_llm()
    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """You are an intelligent AI assistant. Answer the user's question clearly, 
accurately, and concisely based on the transcript context provided below.

Guidelines:
- Rely on the provided transcript context (from a video, podcast, tutorial, lecture, interview, or meeting) to answer the question.
- Provide a helpful, thorough response explaining the concepts, topics, steps, or details mentioned in the transcript.
- If the question asks for a general overview, main ideas, key takeaways, or recommendations, explain them clearly using the context.
- Be direct and friendly. Only state that information is missing if the transcript context genuinely does not contain relevant details.

Transcript Context:
{context}""",
        ),
        ("human", "{question}"),
    ])

    rag_chain = (
        {
            "context":  retriever | RunnableLambda(format_docs),
            "question": RunnablePassthrough(),
        }
        | prompt
        | llm
        | StrOutputParser()
    )

    return rag_chain


def ask_question(rag_chain, question:str) -> str:
    print(f"Question : {question}")
    answer = rag_chain.invoke(question)
    print(f"answer :{answer}")
    return answer