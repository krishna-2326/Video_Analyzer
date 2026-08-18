import os
import io
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors


def generate_txt_report(data: dict) -> str:
    """Generate a clean formatted plain-text report from pipeline results."""
    title = data.get("title", "Meeting Summary")
    summary = data.get("summary", "")
    action_items = data.get("action_items", "")
    key_decisions = data.get("key_decisions", "")
    open_questions = data.get("open_questions", "")
    transcript = data.get("transcript", "")

    lines = [
        "=" * 70,
        f"AI VIDEO & MEETING REPORT: {title.upper()}",
        "=" * 70,
        "",
        "📋 EXECUTIVE SUMMARY",
        "-" * 35,
        summary,
        "",
        "✅ ACTION ITEMS",
        "-" * 35,
        action_items,
        "",
        "🔑 KEY DECISIONS",
        "-" * 35,
        key_decisions,
        "",
        "❓ OPEN QUESTIONS / FOLLOW-UPS",
        "-" * 35,
        open_questions,
        "",
        "=" * 70,
        "📜 FULL TRANSCRIPT",
        "=" * 70,
        transcript,
        ""
    ]
    return "\n".join(lines)


def generate_pdf_report(data: dict) -> bytes:
    """Generate a beautifully styled PDF report using ReportLab."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#1E293B'),
        spaceAfter=15,
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=12,
        spaceAfter=6,
    )

    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#334155'),
        spaceAfter=8,
    )

    story = []

    # Title Banner
    title_text = data.get("title", "AI Video & Meeting Summary")
    story.append(Paragraph(f"📌 {title_text}", title_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#2563EB'), spaceAfter=15))

    sections = [
        ("📋 Executive Summary", data.get("summary", "")),
        ("✅ Action Items", data.get("action_items", "")),
        ("🔑 Key Decisions", data.get("key_decisions", "")),
        ("❓ Open Questions", data.get("open_questions", "")),
    ]

    for sec_title, sec_content in sections:
        story.append(Paragraph(sec_title, section_heading))
        # Format lines into paragraphs
        formatted_content = sec_content.replace("\n", "<br/>")
        story.append(Paragraph(formatted_content, body_style))
        story.append(Spacer(1, 8))

    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#E2E8F0'), spaceBefore=10, spaceAfter=15))
    story.append(Paragraph("📜 Full Transcript", section_heading))

    transcript_text = data.get("transcript", "")
    # Trim transcript if extremely long for PDF performance
    if len(transcript_text) > 10000:
        transcript_text = transcript_text[:10000] + "... [Transcript truncated for PDF export]"

    formatted_transcript = transcript_text.replace("\n", "<br/>")
    story.append(Paragraph(formatted_transcript, body_style))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
