import logging
import os
from datetime import datetime

def get_custom_logger(component_name: str):
    # Create the component-specific log directory
    log_dir = os.path.join("logs", component_name)
    os.makedirs(log_dir, exist_ok=True)
    
    # Name the log file by today's date
    log_file = os.path.join(log_dir, f"{datetime.now().strftime('%Y-%m-%d')}.log")
    
    logger = logging.getLogger(component_name)
    
    # Prevent adding multiple handlers if logger is called multiple times
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        
        # Standard logging format
        formatter = logging.Formatter('%(asctime)s - [%(levelname)s] - %(name)s - %(message)s')
        
        # File handler
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        
        # Console handler (so you still see it in your terminal)
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
        
    return logger