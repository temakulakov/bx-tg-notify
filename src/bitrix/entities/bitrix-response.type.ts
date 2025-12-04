export interface BitrixTime {
  start: number;
  finish: number;
  duration: number;
  processing: number;
  date_start: string;
  date_finish: string;
  operating_reset_at: number;
  operating: number;
}

export interface BitrixResponseBase {
  next?: number;
  total?: number;
  time: BitrixTime;
}

export interface BitrixResponse<T> extends BitrixResponseBase {
  result: T;
}

export interface BitrixUser {
  ID: string;
  NAME: string;
  LAST_NAME: string;
}

interface BitrixInlineUser {
  id: string;
  name: string;
  link: string;
  icon: string;
  workPosition: string;
}

export enum YesNoEnum {
  Yes = 'Y',
  No = 'N',
}

interface BitrixTag {
  id: string | number;
  name?: string;
  title?: string;
}

export interface BitrixTask {
  id: string;
  title: string;
  description: string;
  deadline: string; // ISO-строка с датой и временем
  replicate: YesNoEnum;
  createdBy: string;
  responsibleId: string;
  descriptionInBbcode: YesNoEnum;
  favorite: YesNoEnum;
  group: any[];
  tags: Record<string, BitrixTag> | BitrixTag[];
  creator: BitrixInlineUser;
  responsible: BitrixInlineUser;
  action: object;
  chatId?: number | string; // ID чата задачи для получения комментариев
}

export interface BitrixDiskFile {
  ID: number;
  NAME: string;
  CODE: string | null;
  STORAGE_ID: number;
  TYPE: 'file' | 'folder' | string; // тип enum, Bitrix обычно возвращает 'file' или 'folder'
  PARENT_ID: number;
  DELETED_TYPE: '0' | '1' | string; // enum, 0 = активный, 1 = удалён
  GLOBAL_CONTENT_VERSION: number;
  FILE_ID: number;
  SIZE: number;
  CREATE_TIME: string; // ISO 8601 datetime, пример: "2025-04-18T16:26:53+03:00"
  UPDATE_TIME: string;
  DELETE_TIME: string | null;
  CREATED_BY: number;
  UPDATED_BY: number;
  DELETED_BY: number;
  DOWNLOAD_URL: string;
  DETAIL_URL: string;
}

// Старый интерфейс для task.commentitem.get (устарел)
export interface BitrixTaskComment {
  ID: string;
  POST_MESSAGE: string;
  AUTHOR_ID: string;
  AUTHOR_NAME?: string;
  AUTHOR_LAST_NAME?: string;
  POST_DATE?: string;
  EDIT_DATE?: string;
  UF_TASK_COMMENT_TYPE?: string;
  UF_FORUM_MESSAGE_DOC?: unknown;
}

// Новый интерфейс для im.dialog.messages.get
export interface BitrixDialogMessage {
  id: number | string;
  chat_id?: number | string;
  text?: string;
  message?: string;
  author_id?: number | string;
  authorId?: number | string;
  userId?: number | string;
  date?: string;
  unread?: boolean;
  uuid?: string | null;
  replaces?: any[];
  params?: any;
  disappearing_date?: string | null;
  [key: string]: any;
}

export interface BitrixDialogMessagesResponse {
  chat_id?: number | string;
  messages: BitrixDialogMessage[];
  users?: any[];
  files?: any[];
  [key: string]: any;
}
