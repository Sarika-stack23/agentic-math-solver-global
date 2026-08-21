import requests
import time
import sys
import json

def benchmark():
    url = "http://localhost:8080/api/v1/chat"
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer test-token"
    }
    
    questions = [
        # Algebra
        "Solve 2x + 5 = 15",
        "Solve for x: x^2 - 5x + 6 = 0",
        "Find the value of y if 3y - 7 = 14",
        "Expand (x + 3)(x - 4)",
        "Factorize x^2 - 16",
        # Calculus
        "Find the derivative of x^2 + 3x",
        "What is the integral of 2x dx?",
        "Differentiate sin(x)*cos(x)",
        "Find the limit of (sin x)/x as x approaches 0",
        "Find the second derivative of x^3 - 4x^2 + x",
        # Word Problems
        "If a train travels 60 mph for 2 hours, how far does it go?",
        "A rectangle has a length of 10 and a width of 5. What is the area?",
        "If I buy 3 apples for $2 each, how much do I pay?",
        "What is 15% of 200?",
        "A car accelerates at 5 m/s^2 for 4 seconds. What is its final velocity if it started from rest?",
        # Trigonometry / Geometry
        "What is the area of a circle with radius 3?",
        "Find the hypotenuse of a right triangle with legs 3 and 4.",
        "What is the value of sin(pi/2)?",
        "Simplify sin^2(x) + cos^2(x)",
        # Arithmetic / Logic
        "Simplify the fraction 14/28",
    ]
    
    results = []
    
    print(f"Starting benchmark of {len(questions)} questions with actual API key...")
    for i, q in enumerate(questions):
        print(f"[{i+1}/{len(questions)}] Querying: '{q}'")
        payload = {"query": q, "session_id": f"benchmark_long_{i}"}
        
        start_time = time.time()
        
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=45)
            latency = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                print(f"  -> SUCCESS! Latency: {latency:.2f}s")
                results.append(latency)
            else:
                print(f"  -> FAILED with status {response.status_code}: {response.text}")
        except Exception as e:
            print(f"  -> ERROR: {e}")
            
    if results:
        avg_latency = sum(results) / len(results)
        accuracy = (len(results) / len(questions)) * 100
        print("\n=== BENCHMARK RESULTS ===")
        print(f"Total Successful Queries: {len(results)}/{len(questions)}")
        print(f"Average Inference Latency: {avg_latency:.2f} seconds")
        print(f"Accuracy Rate: {accuracy:.1f}%")
    else:
        print("\nBenchmark failed. No successful queries.")

if __name__ == "__main__":
    benchmark()
