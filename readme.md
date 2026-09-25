# Nebula Sanity Agent

A command-line agent that uses Gemini to answer questions from article content stored in Sanity.

## How It Works

The agent checks its Sanity connection, sends a built-in question about Nebula's win condition to Gemini, and answers using Sanity query results. It can query documents with GROQ or list the dataset's document types and fields. Its instructions require source URLs for claims and ask it to show contradictory sources side by side.

The command prints the question, connection status, tool name, a result preview, and the final answer. Query arguments are not printed. Errors are written to stderr.

## Stack

- Node.js with ES modules
- Gemini model `gemini-3.5-flash-lite`
- Sanity project `uyvc8si1`, dataset `production`
- GROQ for Sanity queries

## Setup

Run these commands from the `agent` directory:

```powershell
npm install
```

Create an `.env` file in the `agent` directory with both keys:

```dotenv
GEMINI_API_KEY=your-gemini-api-key
SANITY_API_TOKEN=your-sanity-api-token
```

The Sanity token must have permission to read the `production` dataset in project `uyvc8si1`. Keep `.env` private and do not commit it.

Start the agent from the `agent` directory:

```powershell
node agent.js
```

The current question is set in `agent.js`; edit `userQuestion` to ask something else.