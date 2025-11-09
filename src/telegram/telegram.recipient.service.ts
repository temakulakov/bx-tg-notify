import { Injectable, Logger } from '@nestjs/common';
import {
  ChatRegistration,
  RecipientSelector,
} from './types/telegram-recipient.types';

@Injectable()
export class TelegramRecipientService {
  private readonly logger = new Logger(TelegramRecipientService.name);
  private readonly groups = new Map<string, Set<number>>();
  private readonly chatRegistry = new Map<number, ChatRegistration>();

  constructor() {
    this.groups.set('all', new Set());
    this.groups.set('default', new Set());
  }

  registerChat(registration: ChatRegistration) {
    const existing = this.chatRegistry.get(registration.chatId);

    if (existing) {
      this.chatRegistry.set(registration.chatId, {
        ...existing,
        ...registration,
        groupKeys: Array.from(
          new Set([...(existing.groupKeys ?? []), ...(registration.groupKeys ?? [])]),
        ),
      });
    } else {
      this.chatRegistry.set(registration.chatId, registration);
    }

    this.addToGroup('all', registration.chatId);
    if (!registration.groupKeys || registration.groupKeys.length === 0) {
      this.addToGroup('default', registration.chatId);
    } else {
      registration.groupKeys.forEach((group) => this.addToGroup(group, registration.chatId));
    }

    this.logger.debug(`Registered chat ${registration.chatId}`);
  }

  addToGroup(group: string, chatId: number) {
    if (!this.groups.has(group)) {
      this.groups.set(group, new Set());
    }
    this.groups.get(group)?.add(chatId);
  }

  removeFromGroup(group: string, chatId: number) {
    this.groups.get(group)?.delete(chatId);
  }

  canReceive(chatId: number, group?: string): boolean {
    if (group) {
      return this.groups.get(group)?.has(chatId) ?? false;
    }
    return this.chatRegistry.has(chatId);
  }

  resolveRecipients(selector: RecipientSelector): number[] {
    const resolved = new Set<number>();

    const normalize = (value: number | string) => {
      if (typeof value === 'number') {
        resolved.add(value);
        return;
      }

      if (this.groups.has(value)) {
        this.groups.get(value)?.forEach((chatId) => resolved.add(chatId));
        return;
      }

      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        resolved.add(parsed);
      }
    };

    if (Array.isArray(selector)) {
      selector.forEach(normalize);
    } else if (selector instanceof Set) {
      selector.forEach(normalize);
    } else {
      normalize(selector);
    }

    return Array.from(resolved.values());
  }

  listGroups(): Record<string, number[]> {
    const result: Record<string, number[]> = {};
    this.groups.forEach((value, key) => {
      result[key] = Array.from(value.values());
    });
    return result;
  }

  listRegisteredChats(): ChatRegistration[] {
    return Array.from(this.chatRegistry.values());
  }
}
