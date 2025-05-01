/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool } from "ai";
import { z } from "zod";
import { Resend } from "resend";

import { agentContext } from "./server";
import { MemoryStore } from "./memory";
import { EmailTemplate } from "./emails/email-template";
import {
  unstable_getSchedulePrompt,
  unstable_scheduleSchema,
} from "agents/schedule";

/**
 * Weather information tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 * The actual implementation is in the executions object below
 */
const getWeatherInformation = tool({
  description: "show the weather in a given city to the user",
  parameters: z.object({ city: z.string() }),
  // Omitting execute function makes this tool require human confirmation
});

/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
const getLocalTime = tool({
  description: "get the local time for a specified location",
  parameters: z.object({ location: z.string() }),
  execute: async ({ location }) => {
    console.log(`Getting local time for ${location}`);
    return "10am";
  },
});



const scheduleTask = tool({
  description: "A tool to schedule a task to be executed at a later time",
  parameters: unstable_scheduleSchema,
  execute: async ({ when, description }) => {
    // we can now read the agent context from the ALS store
    const agent = agentContext.getStore();
    if (!agent) {
      throw new Error("No agent found");
    }
    function throwError(msg: string): string {
      throw new Error(msg);
    }
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    const input =
      when.type === "scheduled"
        ? when.date // scheduled
        : when.type === "delayed"
          ? when.delayInSeconds // delayed
          : when.type === "cron"
            ? when.cron // cron
            : throwError("not a valid schedule input");
    try {
      agent.schedule(input!, "executeTask", description);
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
    return `Task scheduled for type "${when.type}" : ${input}`;
  },
});

/**
 * Tool to list all scheduled tasks
 * This executes automatically without requiring human confirmation
 */
const getScheduledTasks = tool({
  description: "List all tasks that have been scheduled",
  parameters: z.object({}),
  execute: async () => {
    const agent = agentContext.getStore();
    if (!agent) {
      throw new Error("No agent found");
    }
    try {
      const tasks = agent.getSchedules();
      if (!tasks || tasks.length === 0) {
        return "No scheduled tasks found.";
      }
      return tasks;
    } catch (error) {
      console.error("Error listing scheduled tasks", error);
      return `Error listing scheduled tasks: ${error}`;
    }
  },
});

/**
 * Tool to cancel a scheduled task by its ID
 * This executes automatically without requiring human confirmation
 */
const cancelScheduledTask = tool({
  description: "Cancel a scheduled task using its ID",
  parameters: z.object({
    taskId: z.string().describe("The ID of the task to cancel"),
  }),
  execute: async ({ taskId }) => {
    const agent = agentContext.getStore();
    if (!agent) {
      throw new Error("No agent found");
    }
    try {
      await agent.cancelSchedule(taskId);
      return `Task ${taskId} has been successfully canceled.`;
    } catch (error) {
      console.error("Error canceling scheduled task", error);
      return `Error canceling task ${taskId}: ${error}`;
    }
  },
});

/**
 * Memory tools for storing and retrieving information
 */
const storeMemory = tool({
  description: "Store information in the agent's memory for future reference",
  parameters: z.object({
    key: z.string().describe("The unique identifier for this memory"),
    value: z.string().describe("The information to remember"),
  }),
  execute: async ({ key, value }) => {
    const agent = agentContext.getStore();
    if (!agent) {
      throw new Error("No agent found");
    }

    // Access and update the agent's memory state
    const memories = agent.state.memories || {};
    memories[key] = {
      value,
      timestamp: new Date().toISOString(),
    };

    // Update the state
    await agent.setState({ memories });
    return `Remembered: ${key} = ${value}`;
  },
});

const retrieveMemory = tool({
  description: "Retrieve information from the agent's memory",
  parameters: z.object({
    key: z
      .string()
      .describe("The unique identifier for the memory to retrieve"),
  }),
  execute: async ({ key }) => {
    const agent = agentContext.getStore();
    if (!agent) {
      throw new Error("No agent found");
    }

    const memories = agent.state.memories || {};
    const memory = memories[key];

    if (!memory) {
      return `I don't have any memory stored for '${key}'`;
    }
    return `I remember: ${key} = ${memory.value}`;
  },
});

const listMemories = tool({
  description: "List all memories the agent has stored",
  parameters: z.object({}),
  execute: async () => {
    const agent = agentContext.getStore();
    if (!agent) {
      throw new Error("No agent found");
    }

    const memories = agent.state.memories || {};
    const memoryKeys = Object.keys(memories);

    if (memoryKeys.length === 0) {
      return "I don't have any memories stored yet.";
    }

    const formattedMemories = memoryKeys
      .map((key) => `${key}: ${memories[key].value}`)
      .join("\n");

    return `Here are my memories:\n${formattedMemories}`;
  },
});

const forgetMemory = tool({
  description: "Remove a specific memory from the agent's storage",
  parameters: z.object({
    key: z.string().describe("The unique identifier for the memory to forget"),
  }),
  execute: async ({ key }) => {
    const agent = agentContext.getStore();
    if (!agent) {
      throw new Error("No agent found");
    }

    const memories = agent.state.memories || {};
    const exists = memories[key] !== undefined;

    if (exists) {
      // Create a new memories object without the specified key
      const updatedMemories = { ...memories };
      delete updatedMemories[key];

      // Update the state
      await agent.setState({ memories: updatedMemories });
      return `I've forgotten the information about '${key}'`;
    }

    return `I didn't have any memory stored for '${key}'`;
  },
});

/**
 * Email tool for sending emails using Resend
 */
const sendEmail = tool({
  description: "Send an email to a recipient using Resend service",
  parameters: z.object({
    to: z.string().describe("Email address of the recipient"),
    subject: z.string().describe("Subject line of the email"),
    firstName: z.string().describe("First name of the recipient"),
    message: z.string().describe("Main content of the email"),
  }),
  execute: async ({ to, subject, firstName, message }) => {
    try {
      // For now, we'll use a demo key or get from process.env
      // In production, you would get this from your environment configuration
      const resendApiKey = process.env.RESEND_API_KEY || "re_123456789"; // Use a placeholder key for now

      // Initialize Resend client
      const resend = new Resend(resendApiKey);

      // Send the email with plain text instead of React component
      const data = await resend.emails.send({
        from: "AI Agent <hi@updates.fp.dev>",
        to: [to],
        subject: subject,
        html: `
          <div>
            <h1>${subject}</h1>
            <p>Hello ${firstName},</p>
            <p>${message}</p>
            <p>Best regards,</p>
            <p>Your AI Assistant</p>
          </div>
        `,
      });

      // Handle potential errors from the API response
      if (data.error) {
        return `Failed to send email: ${data.error.message}`;
      }

      return `Email successfully sent to ${to} with subject "${subject}"`;
    } catch (error: any) {
      // Type the error as any to access message property
      const errorMessage = error.message || "Unknown error occurred";
      return `Error sending email: ${errorMessage}`;
    }
  },
});

export const mcpServerTool = tool({
  description: "Register remote MCP servers in chat",
  parameters: z.object({
    url: z
      .string()
      .min(1)
      .url()
      .describe("The full URL of the remote MCP server"),
    bearerToken: z
      .string()
      .optional()
      .describe("Optional bearer token for authentication"),
  }),
  execute: async ({ url, bearerToken }) => {
    const agent = agentContext.getStore();
    if (!agent) {
      throw new Error("Agent not found");
    }
    return agent.addMcpServer(url, bearerToken);
  },
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
/**
 * Tool to get interesting facts about numbers using the Numbers API
 * This executes automatically without requiring human confirmation
 */
const getNumberFact = tool({
  description: "Get an interesting fact about a specific number",
  parameters: z.object({
    number: z.number().describe("The number to get a fact about")
  }),
  execute: async ({ number }) => {
    try {
      const response = await fetch(`https://numbersapi.com/${number}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const fact = await response.text();
      return fact;
    } catch (error: any) {
      const errorMessage = error.message || "Unknown error occurred";
      return `Error getting number fact: ${errorMessage}`;
    }
  },
});

export const tools = {
  getWeatherInformation,
  getLocalTime,
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask,
  storeMemory,
  retrieveMemory,
  listMemories,
  forgetMemory,
  sendEmail,
  mcpServerTool,
  getNumberFact,
};

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 */
export const executions = {
  getWeatherInformation: async ({ city }: { city: string }) => {
    console.log(`Getting weather information for ${city}`);
    return `The weather in ${city} is sunny`;
  },
};
