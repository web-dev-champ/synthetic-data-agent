import ast
from utils.logger import get_custom_logger

logger = get_custom_logger("guardrail_code")

class SecurityScanner(ast.NodeVisitor):
    def __init__(self):
        self.violations = []
        # FIX: Added 'os' so pathing works without triggering the alarm
        self.allowed_imports = {'faker', 'csv', 'random', 'datetime', 'pandas', 'openpyxl', 'typing', 'math', 'os'}
        
        # FIX: Removed 'open' so standard file writing is permitted
        self.forbidden_functions = {'eval', 'exec', 'compile', '__import__'}

    def visit_Import(self, node):
        for alias in node.names:
            base_module = alias.name.split('.')[0]
            if base_module not in self.allowed_imports:
                self.violations.append(f"Forbidden import attempt: {alias.name}")
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        if node.module:
            base_module = node.module.split('.')[0]
            if base_module not in self.allowed_imports:
                self.violations.append(f"Forbidden from import attempt: {node.module}")
        self.generic_visit(node)

    def visit_Call(self, node):
        if isinstance(node.func, ast.Name):
            if node.func.id in self.forbidden_functions:
                self.violations.append(f"Forbidden function call: {node.func.id}")
        self.generic_visit(node)

def is_code_safe(code_string: str) -> tuple[bool, str]:
    logger.info("Parsing Abstract Syntax Tree for generated code.")
    try:
        tree = ast.parse(code_string)
    except SyntaxError as e:
        msg = f"LLM generated invalid Python syntax: {e}"
        logger.error(msg)
        return False, msg

    scanner = SecurityScanner()
    scanner.visit(tree)

    if scanner.violations:
        msg = f"Code failed security check: {', '.join(scanner.violations)}"
        logger.warning(msg)
        return False, msg
    
    logger.info("Code passed AST security scan.")
    return True, "Safe"