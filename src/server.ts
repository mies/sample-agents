import { routeAgentRequest, type Schedule, type AgentNamespace } from "agents";
import { unstable_getSchedulePrompt } from "agents/schedule";
import { AIChatAgent } from "agents/ai-chat-agent";
import {
  createDataStreamResponse,
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
  type Message,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { processToolCalls } from "./utils";
import { tools, executions } from "./tools";
import { AsyncLocalStorage } from "node:async_hooks";
import { Observed, fiberplane } from "@fiberplane/agents";
import { MCPClientManager } from "agents/mcp/client";
// import { env } from "cloudflare:workers";

// Environment variables type definition
export type Env = {
  OPENAI_API_KEY: string;
  RESEND_API_KEY: string;
  HOST: string;
  Chat: AgentNamespace<Chat>;
};

// Memory state interface
interface MemoryState {
  memories: Record<
    string,
    {
      value: string;
      timestamp: string;
      context?: string;
    }
  >;
}

const model = openai("gpt-4o-2024-11-20");
// Cloudflare AI Gateway
// const openai = createOpenAI({
//   apiKey: env.OPENAI_API_KEY,
//   baseURL: env.GATEWAY_BASE_URL,
// });

// we use ALS to expose the agent context to the tools
export const agentContext = new AsyncLocalStorage<Chat>();

const agentNamespace = "chat";
/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
@Observed()
export class Chat extends AIChatAgent<Env, MemoryState> {
  initialState = { memories: {} };

  mcp_: MCPClientManager | undefined;

  onStart() {
    this.mcp_ = new MCPClientManager("chat", "1.0.0", {
      baseCallbackUri: `${this.env.HOST}/agents/${agentNamespace}/${this.name}/callback`,
      storage: this.ctx.storage,
    });
  }

  async addMcpServer(url: string, bearerToken?: string) {
    // If a bearer token is provided, use it for bearer token auth
    if (bearerToken) {
      try {
        // For the bearer token approach, we need to create a direct connection
        // to the MCP server without going through the OAuth flow.
        // First, we'll connect to get an ID
        const { id } = await this.mcp.connect(url);
        
        // Store the bearer token in the agent's memory for use with this MCP server
        const memories = this.state.memories || {};
        memories[`mcp_token_${id}`] = {
          value: bearerToken,
          timestamp: new Date().toISOString(),
        };
        
        // Update the state
        await this.setState({ memories });
        
        console.log(`Added MCP server with ID: ${id} and stored bearer token`);
        return "MCP server connected successfully using bearer token";
      } catch (error: any) {
        console.error("Error connecting with bearer token:", error);
        return `Error connecting to MCP server: ${error.message}`;
      }
    }
    
    // Otherwise, fall back to OAuth flow
    const { id, authUrl } = await this.mcp.connect(url);
    console.log(`Added MCP server with ID: ${id}`);
    return authUrl ?? "";
  }

  get mcp() {
    if (!this.mcp_) {
      throw new Error("MCPClientManager not initialized");
    }

    return this.mcp_;
  }

  async onRequest(request: Request) {
    // Check if this is an MCP request that needs a token
    if (request.url.includes('/mcp/')) {
      // Extract the server ID from the URL
      const urlParts = new URL(request.url);
      const pathParts = urlParts.pathname.split('/');
      const mcpServerIdIndex = pathParts.indexOf('mcp') + 1;
      
      if (mcpServerIdIndex > 0 && mcpServerIdIndex < pathParts.length) {
        const serverId = pathParts[mcpServerIdIndex];
        
        // Check if we have a bearer token for this server
        const memories = this.state.memories || {};
        const tokenMemory = memories[`mcp_token_${serverId}`];
        
        if (tokenMemory) {
          // Clone the request and add the bearer token
          const headers = new Headers(request.headers);
          headers.set('Authorization', `Bearer ${tokenMemory.value}`);
          
          const newRequest = new Request(request.url, {
            method: request.method,
            headers,
            body: request.body,
            redirect: request.redirect,
          });
          
          console.log(`Added bearer token to request for MCP server ${serverId}`);
          
          // Continue with the modified request
          request = newRequest;
        }
      }
    }
    
    // Handle MCP callback requests
    if (this.mcp.isCallbackRequest(request)) {
      const { serverId } = await this.mcp.handleCallbackRequest(request);

      return new Response(JSON.stringify({ serverId }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    return super.onRequest(request);
  }

  /**
   * Handles incoming chat messages and manages the response stream
   * @param onFinish - Callback function executed when streaming completes
   */

  // biome-ignore lint/complexity/noBannedTypes: <explanation>
  async onChatMessage(onFinish: StreamTextOnFinishCallback<{}>) {
    // Create a streaming response that handles both text and tool outputs
    return agentContext.run(this, async () => {
      const dataStreamResponse = createDataStreamResponse({
        execute: async (dataStream) => {
          // Process any pending tool calls from previous messages
          // This handles human-in-the-loop confirmations for tools
          const processedMessages = await processToolCalls({
            messages: this.messages,
            dataStream,
            tools,
            executions,
          });

          // Stream the AI response using GPT-4
          const result = streamText({
            model,
            system: `You are a helpful assistant that can do various tasks...

${unstable_getSchedulePrompt({ date: new Date() })}

If the user asks to schedule a task, use the schedule tool to schedule the task.

# Memory Capabilities
You have the ability to remember information across conversations using your memory tools:
- Use 'storeMemory' to remember information (e.g., user preferences, names, facts)
- Use 'retrieveMemory' to recall stored information
- Use 'listMemories' to see all stored information
- Use 'forgetMemory' to remove specific information

When a user tells you information like their name, preferences, or important facts they want you to remember, always use storeMemory to save it. You should also proactively check your memory using retrieveMemory when contextually relevant.

# Email Capabilities
You can send emails on behalf of the user using the 'sendEmail' tool:
- When to use: When a user asks you to send an email or when it's appropriate to follow up via email
- Required information: recipient email address, subject, recipient's first name, and the email message
- Be professional and clear in your email communications
- Always confirm with the user before sending an email

# MCP Server Integration
You can connect to external MCP servers to access additional capabilities:
- When a user asks to register an MCP server, use the mcpServerTool
- You can connect using either OAuth authentication (automatic) or bearer token authentication
- For bearer token authentication, ask the user to provide their bearer token and include it as the bearerToken parameter
- Example: "To add an MCP server with a bearer token, please provide the server URL and your bearer token"

Example: If a user says "Send an email to john@example.com about our meeting tomorrow", ask for any missing details, then use the sendEmail tool.
`,
            messages: processedMessages,
            tools,
            onFinish,
            onError: (error) => {
              console.error("Error while streaming:", error);
            },
            maxSteps: 10,
          });

          // Merge the AI response stream with tool execution outputs
          result.mergeIntoDataStream(dataStream);
        },
      });

      return dataStreamResponse;
    });
  }
  async executeTask(description: string, task: Schedule<string>) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        content: `Running scheduled task: ${description}`,
        createdAt: new Date(),
      },
    ]);
  }
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
const worker = {
  fetch: fiberplane(
    async (request: Request, env: Env, ctx: ExecutionContext) => {
      const url = new URL(request.url);

      if (url.pathname === "/check-open-ai-key") {
        const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
        return Response.json({
          success: hasOpenAIKey,
        });
      }
      if (!process.env.OPENAI_API_KEY) {
        console.error(
          "OPENAI_API_KEY is not set, don't forget to set it locally in .dev.vars, and use `wrangler secret bulk .dev.vars` to upload it to production"
        );
        return new Response("OPENAI_API_KEY is not set", { status: 500 });
      }
      return (
        // Route the request to our agent or return 404 if not found
        (await routeAgentRequest(request, env)) ||
        new Response("Not found", { status: 404 })
      );
    }
  ),
};

export default worker;
