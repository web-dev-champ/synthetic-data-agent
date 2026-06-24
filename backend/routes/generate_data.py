from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
from google import genai
import subprocess
import os
import sys
import time
import traceback
import uuid
import pandas as pd
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime

# Security Guardrails
from utils.guardrails.input_scanner import sanitize_input
from utils.guardrails.code_scanner import is_code_safe

# Database & Logging
from database import get_db
from models import ExecutionLog, ExceptionLog, GeneratedFile
from utils.logger import get_custom_logger

def cleanup_old_files():
    """Deletes files older than 24 hours to save server space."""
    now = time.time()
    # 24 hours in seconds
    max_age_sec = 24 * 60 * 60 
    
    folders_to_clean = [SCRIPTS_DIR, OUTPUT_DIR]
    
    for folder in folders_to_clean:
        for filename in os.listdir(folder):
            file_path = os.path.join(folder, filename)
            # Check file age
            if os.path.isfile(file_path):
                file_age = os.path.getmtime(file_path)
                if now - file_age > max_age_sec:
                    try:
                        os.remove(file_path)
                        logger.info(f"Automatically deleted old file: {filename}")
                    except Exception as e:
                        logger.error(f"Failed to delete {filename}: {e}")
# ---------------------------------------------------------
# AUTHENTICATION 
# This tells FastAPI to look for a "Bearer <token>" header.
# ---------------------------------------------------------
import jwt
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/google") # Pointing to your auth endpoint

def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Interceptors every secured request, extracts the Bearer token, 
    decodes it, and returns the verified user_id.
    """
    JWT_SECRET = os.getenv("JWT_SECRET", "super_secret_key_change_this_in_production")
    
    try:
        # Decode the token using the same secret key you specified in .env
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token: Missing user identity.")
            
        return user_id
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials.")


# ---------------------------------------------------------
# IN-MEMORY RATE LIMITER
# ---------------------------------------------------------
user_requests = {}
RATE_LIMIT_PER_MIN = 5
RATE_LIMIT_PER_DAY = 50
ONE_MINUTE_SEC = 60
ONE_DAY_SEC = 86400

def check_rate_limit(current_user_id: str = Depends(get_current_user)):
    """Limits users to X requests per minute and Y requests per day."""
    current_time = time.time()
    
    if current_user_id not in user_requests:
        user_requests[current_user_id] = []
        
    # 1. Clean up timestamps older than 24 hours
    user_requests[current_user_id] = [
        ts for ts in user_requests[current_user_id] 
        if current_time - ts < ONE_DAY_SEC
    ]
    
    # 2. Check Daily Limit
    if len(user_requests[current_user_id]) >= RATE_LIMIT_PER_DAY:
        raise HTTPException(
            status_code=429, 
            detail=f"Daily rate limit exceeded. Maximum {RATE_LIMIT_PER_DAY} requests per day allowed."
        )

    # 3. Check Minute Limit
    requests_last_minute = sum(1 for ts in user_requests[current_user_id] if current_time - ts < ONE_MINUTE_SEC)
    if requests_last_minute >= RATE_LIMIT_PER_MIN:
        raise HTTPException(
            status_code=429, 
            detail=f"Rate limit exceeded. Maximum {RATE_LIMIT_PER_MIN} requests per minute allowed."
        )
        
    # 4. Record the current request timestamp
    user_requests[current_user_id].append(current_time)
    
    return current_user_id


# ---------------------------------------------------------
# INITIALIZATION
# ---------------------------------------------------------
logger = get_custom_logger("data_generator")
logger2 = get_custom_logger("download_file")

generate_data_router = APIRouter(
    prefix="/data",
    tags=["Synthetic Data Generation"]
)

SCRIPTS_DIR = "generated_scripts"
OUTPUT_DIR = "generated_data"
os.makedirs(SCRIPTS_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

class ColumnDefinition(BaseModel):
    col_name: str
    datatype: str
    desc: str

class DataRequest(BaseModel):
    columns: List[ColumnDefinition]=Field(..., max_length=20)
    overall_context: Optional[str] = "Standard data generation."
    num_rows: int = Field(default=1000, ge=1, le=2000)

# ---------------------------------------------------------
# 1. GENERATE API
# ---------------------------------------------------------
@generate_data_router.post("/generate")
def generate_synthetic_data(
    request: DataRequest, 
    db: Session = Depends(get_db),
    current_user_id: str = Depends(check_rate_limit) # <-- Update this line
):
    cleanup_old_files()
    start_time = time.time()
    logger.info(f"Starting generation request for {request.num_rows} rows by user: {current_user_id}")
    
    # --- GUARDRAIL 1: Input Scanning ---
    if request.overall_context:
        is_safe, processed_context = sanitize_input(request.overall_context)
        if not is_safe:
            db.add(ExceptionLog(component="guardrail_input", error_message="Prompt injection", stack_trace=processed_context))
            db.commit()
            raise HTTPException(status_code=400, detail=processed_context)
        request.overall_context = processed_context

    for col in request.columns:
        is_safe, processed_desc = sanitize_input(col.desc)
        if not is_safe:
            db.add(ExceptionLog(component="guardrail_input", error_message="Column injection", stack_trace=processed_desc))
            db.commit()
            raise HTTPException(status_code=400, detail=f"Invalid column description: {processed_desc}")
        col.desc = processed_desc
    
    # --- MULTI-USER ISOLATION (UUIDs) ---
    job_id = str(uuid.uuid4())
    unique_csv_name = f"data_{job_id}.csv"
    unique_script_name = f"script_{job_id}.py"

    script_filename = os.path.join(SCRIPTS_DIR, unique_script_name)
    output_csv_path = os.path.join(OUTPUT_DIR, unique_csv_name).replace("\\", "/")
    
    # --- PROMPT PREPARATION ---
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
    
    formatted_columns = "\n".join(
        [f"- Column: '{col.col_name}' | Type: {col.datatype} | Logic: {col.desc}" for col in request.columns]
    )
    
    system_prompt = f"""
    You are an expert Python data engineer. 
    Write a Python script using the 'faker', 'random', and 'csv' libraries to generate {request.num_rows} rows of realistic synthetic data.
    
    OVERALL CONTEXT & BUSINESS LOGIC:
    {request.overall_context}
    
    SCHEMA DEFINITION:
    The dataset must contain exactly these columns with the following specifications:
    {formatted_columns}
    
    The script MUST save the output exactly to this path: '{output_csv_path}'.
    Output ONLY the raw Python code. Do not include markdown formatting, explanations, or ```python tags.
    """
    
    try:
        # Phase 1: LLM Generation

        try:
            # Phase 1: LLM Generation (NEW SDK SYNTAX)
            logger.info("LLM generation started")     
            # Initialize the new client (it automatically looks for GEMINI_API_KEY in your .env)
            client = genai.Client() 
            # Call generate_content on the models service
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=system_prompt,
            )
            script_code = response.text.strip()
            logger.info("LLM generation completed")
        except Exception as e:
            logger.exception(f"LLM Generation Failed due to: {e}")
            raise    

        if script_code.startswith("```python"):
            script_code = script_code[9:-3].strip()
        elif script_code.startswith("```"):
            script_code = script_code[3:-3].strip()

        # --- GUARDRAIL 2: Code Scanning ---
        is_safe_code, security_msg = is_code_safe(script_code)
        if not is_safe_code:
            db.add(ExceptionLog(component="guardrail_code", error_message="Unsafe code block", stack_trace=security_msg))
            db.commit()
            raise HTTPException(status_code=403, detail="The AI generated unsafe code and execution was blocked.")

        with open(script_filename, "w", encoding="utf-8") as f:
            f.write(script_code)
            
        # Phase 2: Execution
        logger.info(f"Executing dynamic script: {unique_script_name}")
        try:
            subprocess.run([sys.executable, script_filename], capture_output=True, text=True, check=True)
            logger.info("Python script executed successfully.")
        except Exception as e:
            logger.exception(f"Script execution failed due to: {e}")
            raise
        finally:
            # Clean up the python script after execution to save server space
            if os.path.exists(script_filename):
                os.remove(script_filename)
            
        # --- SAVE SUCCESS HISTORY TO DATABASE ---
        db.add(GeneratedFile(
            id=job_id,
            user_id=current_user_id,
            filename=unique_csv_name,
            num_rows=request.num_rows,
            status="SUCCESS"
        ))
        db.commit()
        
        return {
            "status": "success", 
            "message": f"Successfully generated {request.num_rows} rows!",
            "filename": unique_csv_name
        }
    except Exception as e:
        # Save Failed History to Database
        db.add(GeneratedFile(
            id=job_id,
            user_id=current_user_id,
            filename=unique_csv_name,
            num_rows=request.num_rows,
            status="FAILED"
        ))
        
        error_msg = str(e)
        if isinstance(e, subprocess.CalledProcessError):
            error_msg = f"Script Execution Failed: {e.stderr}"

        db.add(ExceptionLog(component="data_generator", error_message=error_msg, stack_trace=traceback.format_exc()))
        db.commit()
        
        # If it's already an HTTP Exception (like your 400 guardrail checks), let it pass through
        if isinstance(e, HTTPException): raise e
        
        # THE FIX: Raise an HTTP 500 Server Error instead of returning a 200 OK
        raise HTTPException(status_code=500, detail=f"Generation failed: {error_msg}")
    
# ---------------------------------------------------------
# 2. DOWNLOAD API
# ---------------------------------------------------------
@generate_data_router.get("/download/{filename}")
def download_file(
    filename: str, 
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user)
):
    try:
        logger2.info(f"Download started for: {filename}")
        requested_file_path = os.path.join(OUTPUT_DIR, filename)
        
        # --- THE MAGIC INTERCEPTOR: CSV to XLSX Conversion ---
        if filename.endswith(".xlsx"):
            base_name = filename[:-5] 
            source_csv_path = os.path.join(OUTPUT_DIR, f"{base_name}.csv")
            
            if not os.path.exists(source_csv_path):
                raise HTTPException(status_code=404, detail="Source data not found. Please generate it first.")
            
            if not os.path.exists(requested_file_path):
                logger2.info(f"Converting {source_csv_path} to beautifully formatted Excel...")
                df = pd.read_csv(source_csv_path)
                writer = pd.ExcelWriter(requested_file_path, engine='openpyxl')
                df.to_excel(writer, index=False, sheet_name='Synthetic Data')
                
                worksheet = writer.sheets['Synthetic Data']
                for col in worksheet.columns:
                    max_length = max((len(str(cell.value)) for cell in col), default=0)
                    worksheet.column_dimensions[col[0].column_letter].width = (max_length + 2)
                    
                writer.close()
                
        elif not os.path.exists(requested_file_path):
            raise HTTPException(status_code=404, detail="File not found.")

        # --- DYNAMIC HEADERS ---
        if filename.endswith(".xlsx"):
            content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif filename.endswith(".csv"):
            content_type = "text/csv"
        else:
            content_type = "application/octet-stream"

        return FileResponse(path=requested_file_path, media_type=content_type, filename=filename)
        
    except Exception as e:
        if not isinstance(e, HTTPException):
            db.add(ExceptionLog(component="download_file", error_message=str(e), stack_trace=traceback.format_exc()))
            db.commit()
        raise


# ---------------------------------------------------------
# 3. HISTORY API (NEW!)
# ---------------------------------------------------------
@generate_data_router.get("/history")
def get_user_history(
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user)
):
    """Fetches all successful generations for the logged-in user."""
    try:
        records = (
            db.query(GeneratedFile)
            .filter(GeneratedFile.user_id == current_user_id, GeneratedFile.status == "SUCCESS")
            .order_by(GeneratedFile.created_at.desc())
            .all()
        )
        
        history = [
            {
                "job_id": record.id,
                "filename": record.filename,
                "rows": record.num_rows,
                "generated_at": record.created_at.strftime("%Y-%m-%d %H:%M:%S")
            }
            for record in records
        ]
            
        return {"status": "success", "history": history}
        
    except Exception as e:
        logger.error(f"Failed to fetch history: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve file history.")