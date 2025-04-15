interface EmailTemplateProps {
  firstName: string;
  message?: string;
  subject?: string;
}

export const EmailTemplate = ({
  firstName,
  message = "Thank you for using our AI agent!",
  subject = "Hello from your AI Agent",
}: EmailTemplateProps) => (
  <div>
    <h1>{subject}</h1>
    <p>Hello {firstName},</p>
    <p>{message}</p>
    <p>Best regards,</p>
    <p>Your AI Assistant</p>
  </div>
);