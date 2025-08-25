export interface EmailAddress {
  name: string;
  email: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  dataBase64?: string;
  contentId?: string;
  isInline?: boolean;
}

export interface Message {
  id: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  date: string;
  subject?: string;
  html?: string;
  text?: string;
  attachments: Attachment[];
}

export interface Thread {
  id: string;
  subject: string;
  recipients: EmailAddress[];
  messages: Message[];
  leadIds: string[];
  updatedAt: string;
}

export interface ThreadSummary {
  id: string;
  subject: string;
  recipients: EmailAddress[];
  snippet: string;
  updatedAt: string;
  leadIds: string[];
  attachments?: Attachment[];
  messageCount?: number;
  hasIncomingReplies?: boolean;
}

export interface SendEmailRequest {
  threadId?: string;
  to: EmailAddress[];
  cc?: EmailAddress[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: {
    name: string;
    mimeType: string;
    dataBase64: string;
  }[];
}

export interface DraftReplyRequest {
  threadId: string;
  style?: "short" | "followup" | "thankyou";
  maxMessages?: number;
}

export interface DraftReplyResponse {
  draft: string;
}
