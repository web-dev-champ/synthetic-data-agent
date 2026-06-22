from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests
import jwt
import os
import datetime

from database import get_db
from models import User
from utils.logger import get_custom_logger

logger = get_custom_logger("auth")

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])

# You will get this from the Google Cloud Console later
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "your_google_client_id")
# A secret key to sign your own backend JWTs
JWT_SECRET = os.getenv("JWT_SECRET", "super_secret_key_change_this_in_production") 

class GoogleAuthRequest(BaseModel):
    credential: str  # The token sent from the frontend Google button

@auth_router.post("/google")
def authenticate_google_user(request: GoogleAuthRequest, db: Session = Depends(get_db)):
    try:
        # 1. Verify the token with Google's servers
        idinfo = id_token.verify_oauth2_token(
            request.credential, 
            requests.Request(), 
            GOOGLE_CLIENT_ID
        )

        email = idinfo['email']
        name = idinfo.get('name', 'Unknown User')

        # 2. Find or create the user in your database
        user = db.query(User).filter(User.email == email).first()
        if not user:
            logger.info(f"Creating new user for {email}")
            user = User(email=email, name=name, auth_provider="google")
            db.add(user)
            db.commit()
            db.refresh(user)

        # 3. Create YOUR custom backend JWT
        # This expires in 24 hours
        expiration = datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        payload = {
            "sub": user.id,
            "email": user.email,
            "exp": expiration
        }
        access_token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")

        return {
            "status": "success",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {"id": user.id, "name": user.name, "email": user.email}
        }

    except ValueError:
        logger.warning("Invalid Google token provided.")
        raise HTTPException(status_code=401, detail="Invalid Google authentication token.")
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during authentication.")