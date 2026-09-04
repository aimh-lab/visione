FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY media_resolver.py .

CMD ["uvicorn", "media_resolver:create_default_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
