import scrubadub
from utils.logger import get_custom_logger

logger = get_custom_logger("guardrail_input")

FORBIDDEN_KEYWORDS = {
    "ignore previous", "system prompt", "bypass", "jailbreak",
    "drop table", "delete from", "os.system", "subprocess", "eval("
}

def sanitize_input(user_text: str) -> tuple[bool, str]:
    logger.info("Scanning input for malicious keywords and PII.")
    if not user_text:
        return True, ""

    lower_text = user_text.lower()
    
    for keyword in FORBIDDEN_KEYWORDS:
        if keyword in lower_text:
            msg = f"Security exception: Input contains forbidden syntax ('{keyword}')."
            logger.warning(msg)
            return False, msg
    # 2. PII Scrubbing 
    # If a user pastes a real name, email, or phone number, scrubadub replaces it 
    # (e.g., "John Doe" becomes "{{NAME}}") so the LLM doesn't learn or use real data.
    scrubbed_text = scrubadub.clean(user_text)
    logger.info("Input scanning passed.")
    return True, scrubbed_text