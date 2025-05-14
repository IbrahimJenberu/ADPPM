FROM python:3.11-slim

WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    UPLOAD_DIR=/app/uploads

# Add this line after creating the uploads directory
RUN mkdir -p /app/uploads && chmod 777 /app/uploads \
    && mkdir -p /app/static && chmod -R 777 /app/static

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create uploads directory
RUN mkdir -p /app/uploads && chmod 777 /app/uploads

# Copy app code
COPY . .

# Expose port
EXPOSE 8025

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8025"]