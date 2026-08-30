#!/usr/bin/env python3
"""
FastAPI Main Application
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .routes import router

# Initialize app
app = FastAPI(
    title="Unified Cyber Defense Platform API",
    description="AI-powered security intelligence system",
    version="1.0.0"
)

# CORS middleware (allow frontend to talk to backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router, prefix="/api/v1")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Unified Cyber Defense Platform API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/api/v1/health",
            "predict": "/api/v1/predict (POST)",
            "analyze": "/api/v1/analyze (POST)"
        }
    }

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
