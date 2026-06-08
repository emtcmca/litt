from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.routes import brief, actions, demo, clients, internal

app = FastAPI(title="Litt API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "firm_id": config.DEMO_FIRM_ID}


app.include_router(brief.router, prefix="/api")
app.include_router(actions.router, prefix="/api")
app.include_router(demo.router, prefix="/api")
app.include_router(clients.router, prefix="/api")
app.include_router(internal.router, prefix="/api")

from app.mcp_server.server import mcp
app.mount("/mcp", mcp.http_app())
