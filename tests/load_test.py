import asyncio
import aiohttp
import time
import json
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("load_tester")

URL = "http://localhost:8080/api/v1/chat/stream"
PAYLOAD = {"query": "2 + 2", "session_id": "test_session"}
HEADERS = {
    "Content-Type": "application/json",
    "X-Mock-AI": "true",
    "Authorization": "Bearer test-token" # bypassing firebase via fallback
}

async def make_request(session, req_id):
    start = time.time()
    try:
        async with session.post(URL, json=PAYLOAD, headers=HEADERS, timeout=10) as response:
            status = response.status
            # read the stream
            text = await response.text()
            duration = time.time() - start
            if status == 200 and "mocked response" in text:
                return {"success": True, "duration": duration, "status": status}
            elif status == 429: # Rate limit hit
                return {"success": False, "duration": duration, "status": status, "error": "Rate limit 429"}
            else:
                return {"success": False, "duration": duration, "status": status, "error": f"Invalid response: {text[:50]}"}
    except Exception as e:
        duration = time.time() - start
        return {"success": False, "duration": duration, "status": 0, "error": str(e)}

async def run_batch(concurrency):
    logger.info(f"--- Starting test with {concurrency} concurrent users ---")
    
    connector = aiohttp.TCPConnector(limit=concurrency + 50)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [make_request(session, i) for i in range(concurrency)]
        start_time = time.time()
        results = await asyncio.gather(*tasks)
        total_time = time.time() - start_time
        
        successes = [r for r in results if r["success"]]
        failures = [r for r in results if not r["success"]]
        
        avg_time = sum(r["duration"] for r in results) / len(results) if results else 0
        
        logger.info(f"Results for {concurrency} users:")
        logger.info(f"  Success: {len(successes)}")
        logger.info(f"  Failed:  {len(failures)}")
        logger.info(f"  Total time: {total_time:.2f}s")
        logger.info(f"  Avg req time: {avg_time:.2f}s")
        logger.info(f"  Throughput: {len(results) / total_time:.2f} req/s")
        
        if failures:
            logger.error(f"  Sample errors: {[f['error'] for f in failures[:3]]}")
        
        return {
            "concurrency": concurrency,
            "success": len(successes),
            "failed": len(failures),
            "throughput": len(results) / total_time,
            "avg_time": avg_time
        }

async def main():
    levels = [10, 50, 100, 250, 500, 1000]
    all_results = []
    
    await asyncio.sleep(2)
    
    for level in levels:
        res = await run_batch(level)
        all_results.append(res)
        await asyncio.sleep(2) # cool down
        
    print("\n\n--- FINAL REPORT ---")
    for r in all_results:
        print(f"Users: {r['concurrency']:<5} | Success: {r['success']:<5} | Fail: {r['failed']:<4} | AvgTime: {r['avg_time']:.2f}s | Throughput: {r['throughput']:.2f} req/s")

if __name__ == "__main__":
    asyncio.run(main())
