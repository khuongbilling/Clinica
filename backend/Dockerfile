FROM python:3.11.14-slim

WORKDIR /opt/clinica

COPY backend/requirements.txt backend/constraints-python311-2026-08-29.txt /tmp/
RUN python -m pip install --no-cache-dir --upgrade "pip==25.0.1" \
    && python -m pip install --no-cache-dir \
      -r /tmp/requirements.txt \
      -c /tmp/constraints-python311-2026-08-29.txt \
    && python -m pip check \
    && groupadd --system --gid 10001 clinica \
    && useradd --system --uid 10001 --gid clinica \
      --home-dir /nonexistent --shell /usr/sbin/nologin clinica

COPY --chown=10001:10001 backend/*.py /opt/clinica/backend/
COPY --chown=10001:10001 frontend/src/game/activityRegistry.manifest.json \
     /opt/clinica/frontend/src/game/activityRegistry.manifest.json

ENV CLINICA_ENV=production \
    PORT=8000 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 8000

USER 10001:10001

CMD ["sh", "-c", "exec python -m uvicorn server:app --app-dir backend --host 0.0.0.0 --port \"${PORT:-8000}\""]