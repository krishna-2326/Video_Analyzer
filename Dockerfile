# Use Python 3.10 slim base image
FROM python:3.10-slim

# Install FFmpeg and system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY Requirements.txt .
RUN pip install --no-cache-dir -r Requirements.txt

# Copy application files
COPY . .

# Environment variables (EXPOSE 7860 for Hugging Face Spaces / $PORT for cloud)
ENV PORT=7860
ENV WHISPER_MODEL=base
ENV PIP_ROOT_USER_ACTION=ignore

# Expose default port
EXPOSE 7860

# Start FastAPI server on $PORT or 7860
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-7860}"]
