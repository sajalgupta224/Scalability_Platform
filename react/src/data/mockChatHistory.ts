export const mockChatHistory: { user: string; bot: { [key: string]: string } }[] =
    [
        {
            "user": "Summarize the benefits of TypeScript over JavaScript in one sentence.",
            "bot": {
                "mistral-large2": "TypeScript adds static typing, better tooling, and safer refactoring, improving maintainability and developer productivity.",
                "llama3.1-70b": "By adding static types and IDE tooling, TypeScript reduces runtime bugs and makes large codebases easier to scale and refactor.",
                "llama3.1-8b": "It provides types and tooling that catch errors early and make refactoring easier compared to plain JavaScript."
            }
        },
        {
            "user": "Give me a regex to match a simple email (not perfect, just common cases).",
            "bot": {
                "mistral-large2": "^\\S+@\\S+\\.[A-Za-z]{2,}$",
                "llama3.1-70b": "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$",
                "llama3.1-8b": "^.+@.+\\..+$"
            }
        },
        {
            "user": "Explain the difference between synchronous and asynchronous code like I'm five.",
            "bot": {
                "mistral-large2": "Synchronous is like waiting in a line: you finish one thing before the next; asynchronous is like taking a number and playing while you wait to be called.",
                "llama3.1-70b": "Sync is doing tasks one by one in order; async lets you start a task, then do other things while it finishes in the background.",
                "llama3.1-8b": "Sync waits; async doesn’t wait and lets you do other things meanwhile."
            }
        },
        {
            "user": "What’s the Big-O time complexity of binary search and why?",
            "bot": {
                "mistral-large2": "O(log n), because each comparison halves the search space until the target is found or the range is empty.",
                "llama3.1-70b": "Binary search is O(log n) since it repeatedly divides the array in half, reducing the problem size exponentially.",
                "llama3.1-8b": "O(log n), it halves the range each step."
            }
        },
        {
            "user": "Provide a concise commit message for fixing a null pointer crash on login.",
            "bot": {
                "mistral-large2": "fix(auth): prevent null deref on login by guarding missing user profile",
                "llama3.1-70b": "fix(login): add null checks for user profile to avoid NPE on startup",
                "llama3.1-8b": "fix: add null checks to stop login crash"
            }
        },
        {
            "user": "Write a one-liner Node.js script to print the current working directory.",
            "bot": {
                "mistral-large2": "node -e \"console.log(process.cwd())\"",
                "llama3.1-70b": "node -e \"console.log(process.cwd());\"",
                "llama3.1-8b": "node -e \"console.log(process.cwd())\""
            }
        },
        {
            "user": "Suggest a better variable name for `x` representing milliseconds to wait before retry.",
            "bot": {
                "mistral-large2": "retryDelayMs",
                "llama3.1-70b": "retryBackoffMs",
                "llama3.1-8b": "retryDelayMs"
            }
        },
        {
            "user": "How do I convert a JavaScript Date to ISO string without timezone offset?",
            "bot": {
                "mistral-large2": "Use `new Date().toISOString()`; it returns UTC ISO-8601 without local offset.",
                "llama3.1-70b": "`new Date().toISOString()` produces a UTC timestamp like `2025-12-05T10:12:34.567Z`.",
                "llama3.1-8b": "Call `toISOString()` on the Date."
            }
        },
        {
            "user": "Give me a short, friendly 2-sentence welcome message for a new Slack channel #dev-help.",
            "bot": {
                "mistral-large2": "Welcome to #dev-help! Post your questions, and we’ll tackle them together—no question is too small.",
                "llama3.1-70b": "Hey there—welcome to #dev-help! Ask anything, share context, and someone will jump in to unblock you.",
                "llama3.1-8b": "Welcome to #dev-help! Drop your questions and we’ll help out."
            }
        },
        {
            "user": "What’s a safe default HTTP cache header for static assets with content hashes?",
            "bot": {
                "mistral-large2": "Use `Cache-Control: public, max-age=31536000, immutable` for hashed assets.",
                "llama3.1-70b": "`Cache-Control: public, max-age=31536000, immutable` is a common choice for fingerprinted files.",
                "llama3.1-8b": "Set `Cache-Control: public, max-age=31536000, immutable`."
            }
        }
    ]
