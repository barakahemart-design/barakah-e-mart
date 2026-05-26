import { CodingSnippet } from "./types";

export const DEFAULT_SNIPPETS: CodingSnippet[] = [
  {
    id: "fizzbuzz",
    title: "FizzBuzz Puzzle",
    description: "The classic programming interview warm-up using modules and loops.",
    language: "javascript",
    code: `// Classic FizzBuzz Implementation
function fizzBuzz(limit) {
  const result = [];
  for (let i = 1; i <= limit; i++) {
    if (i % 3 === 0 && i % 5 === 0) {
      result.push("FizzBuzz");
    } else if (i % 3 === 0) {
      result.push("Fizz");
    } else if (i % 5 === 0) {
      result.push("Buzz");
    } else {
      result.push(i.toString());
    }
  }
  return result;
}

// Run explanation
console.log(fizzBuzz(15).join(", "));
`
  },
  {
    id: "fibonacci-bug",
    title: "Fibonacci (With Speed Bug)",
    description: "An unoptimized recursive Fibonacci calculator suitable for AI analysis and optimization.",
    language: "typescript",
    code: `// Slow Recursive Fibonacci
// Note: This has O(2^n) time complexity and will slow down for larger N!
function getFibonacci(n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  
  // Call recursively without memoization or caching
  return getFibonacci(n - 1) + getFibonacci(n - 2);
}

// Run calculation
const resultValue = getFibonacci(8);
console.log("Fibonacci of 8 is: " + resultValue);
`
  },
  {
    id: "binary-search",
    title: "Binary Search (Python)",
    description: "High performance searching algorithm on structured ordered lists.",
    language: "python",
    code: `def binary_search(arr, target):
    """
    Search for target in sorted array arr.
    Returns the index if found, else -1.
    """
    left, right = 0, len(arr) - 1
    
    while left <= right:
        mid = (left + right) // 2
        
        # Check if target is present at mid
        if arr[mid] == target:
            return mid
        # If target is greater, ignore left half
        elif arr[mid] < target:
            left = mid + 1
        # If target is smaller, ignore right half
        else:
            right = mid - 1
            
    return -1

# Sample Execution
numbers = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
target_num = 23
index = binary_search(numbers, target_num)
print(f"Number {target_num} is found at index {index}")
`
  },
  {
    id: "is-prime",
    title: "Optimized Prime Check (C++)",
    description: "C++ mathematical logic to check if a number is prime using square roots.",
    language: "cpp",
    code: `#include <iostream>
#include <cmath>

bool isPrime(int n) {
    if (n <= 1) return false;
    if (n <= 3) return true;
    
    // Check if divisible by 2 or 3
    if (n % 2 == 0 || n % 3 == 0) return false;
    
    // Check using standard sqrt range logic
    int limit = std::sqrt(n);
    for (int i = 5; i <= limit; i += 6) {
        if (n % i == 0 || n % (i + 2) == 0)
            return false;
    }
    
    return true;
}

int main() {
    int testNum = 29;
    std::cout << testNum << " is prime: " << (isPrime(testNum) ? "Yes" : "No") << std::endl;
    return 0;
}
`
  },
  {
    id: "sql-injection-bug",
    title: "User Fetch (Security Risk)",
    description: "A database querying script containing a severe SQL Injection vulnerability.",
    language: "javascript",
    code: `// Warning: Highly insecure SQL database query implementation
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

function getUserProfile(userIdInput, callback) {
  // Direct string concatenation exposes database to SQL injection attacks!
  const query = "SELECT id, username, email, role FROM users WHERE id = '" + userIdInput + "'";
  
  db.get(query, (err, row) => {
    if (err) {
      console.error(err.message);
      callback(err, null);
    } else {
      callback(null, row);
    }
  });
}
`
  }
];
