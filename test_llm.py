import asyncio
from backend.src.services.llm_service import LLMService
from backend.src.config import settings

async def main():
    try:
        service = LLMService()
        async for chunk in service.stream_response("Solve 2x + 5 = 15"):
            print(chunk, end="", flush=True)
    except Exception as e:
        print(f"\nERROR: {e}")

if __name__ == "__main__":
    asyncio.run(main())
