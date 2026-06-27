export type ClassifyType = 'todo' | 'task' | 'expense' | 'unknown' | 'chat';

export interface ClassifyResult {
  type: ClassifyType;
  data: unknown;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface D1Record {
  id: number;
  update_id: number;
  chat_id: number;
  type: ClassifyType;
  data: string;
  raw_input: string | null;
  created_at: string;
}
