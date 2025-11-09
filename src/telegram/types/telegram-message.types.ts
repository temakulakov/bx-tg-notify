export interface TelegramMessageSection {
  title?: string;
  lines?: string[];
  raw?: string;
}

export interface TelegramMessageTemplate {
  header?: string;
  title?: string;
  sections?: TelegramMessageSection[];
  footer?: string;
  metadata?: Record<string, string | number | boolean>;
  emphasis?: string;
  raw?: string;
}
