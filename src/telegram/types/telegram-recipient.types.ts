export interface ChatRegistration {
  chatId: number;
  userId?: number;
  username?: string;
  groupKeys?: string[];
}

export type RecipientSelector =
  | number
  | string
  | Array<number | string>
  | Set<number | string>;
