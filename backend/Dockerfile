FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY shared/ shared/
COPY auth/ auth/
COPY registry/ registry/
COPY watchlist/ watchlist/
COPY alert/ alert/
COPY search/ search/
COPY integrations/ integrations/
COPY app.py .
COPY alert_worker.py .

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
