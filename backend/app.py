from fastapi import FastAPI
from dotenv import load_dotenv
import os
import uvicorn
from database import engine
from models import Base
from fastapi.middleware.cors import CORSMiddleware 
# This will create the tables in Neon if they don't exist yet
Base.metadata.create_all(bind=engine)

# Import the list of routers from the routes folder
from routes import api_routers 

# Load environment variables
load_dotenv()

# Initialize FastAPI
app = FastAPI(title="Synthetic Data Agent API")
# Dynamically include all routers from the list
for router in api_routers:
    app.include_router(router)

# the CORS Middleware block
app.add_middleware(
    CORSMiddleware,
    # Allow the exact URLs your frontend runs on
    allow_origins=[
        "http://localhost:5173", # Standard Vite port
        "http://127.0.0.1:5173",
        "https://synthetic-data-agent.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"], # This explicitly allows the OPTIONS, POST, GET methods
    allow_headers=["*"], # This allows your Authorization/Bearer tokens to pass through
)

@app.get("/")
def read_root():
    return {"message": "Synthetic Data Agent is live!"}

if __name__ == "__main__":
    uvicorn.run(
        "app:app", 
        host="127.0.0.1", 
        port=8000, 
        reload=True,
        # Ignore dynamically generated files so the server doesn't restart mid-run!
        reload_excludes=["generated_scripts/*", "generated_data/*", "logs/*"]
    )