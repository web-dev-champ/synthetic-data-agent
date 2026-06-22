from .generate_data import generate_data_router
from .auth import auth_router

# Add all future routers to this list
api_routers = [
    generate_data_router,
    auth_router
]