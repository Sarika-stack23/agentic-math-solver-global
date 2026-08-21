from fastmcp import FastMCP
import tempfile
import subprocess
import os

mcp = FastMCP("Python Executor Server")

@mcp.tool()
def execute_python(code: str) -> str:
    """Execute Python code in a sandboxed Docker environment.
    
    Args:
        code: The Python code to execute. Print statements will be captured and returned.
    """
    # Write a wrapper to restrict dangerous imports
    wrapper_code = f"""
import sys
blocked = {{"os", "sys", "subprocess", "socket", "urllib", "requests", "pathlib", "shutil"}}

class SecurityError(Exception):
    pass

# Remove already cached modules so they trigger the import audit hook
for m in list(sys.modules.keys()):
    if m.split('.')[0] in blocked and m != "sys":
        del sys.modules[m]

def audit_hook(event, args):
    if event == "import":
        module = args[0]
        base_module = module.split('.')[0]
        if base_module in blocked:
            raise ImportError(f"Import of '{{module}}' is restricted for security reasons.")
    elif event == "os.system" or event.startswith("subprocess."):
        raise SecurityError(f"Operation '{{event}}' is not allowed.")

sys.addaudithook(audit_hook)

# --- USER CODE START ---
{code}
"""

    with tempfile.TemporaryDirectory() as temp_dir:
        script_path = os.path.join(temp_dir, "script.py")
        with open(script_path, "w") as f:
            f.write(wrapper_code)
            
        try:
            # Run the docker container with resource limits and no network
            result = subprocess.run(
                [
                    "docker", "run", "--rm",
                    "--network", "none",
                    "--memory", "128m",
                    "--cpus", "0.5",
                    "-v", f"{temp_dir}:/app",
                    "-w", "/app",
                    "python:3.9-slim",
                    "python", "script.py"
                ],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            output = result.stdout
            if result.stderr:
                output += "\nErrors:\n" + result.stderr
                
            return output.strip() if output else "Execution completed with no output."
            
        except subprocess.TimeoutExpired:
            return "Execution Error: Code execution timed out after 10 seconds."
        except Exception as e:
            return f"Execution Error: {str(e)}"

if __name__ == "__main__":
    mcp.run(transport='stdio')
