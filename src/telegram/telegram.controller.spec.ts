import { Test, TestingModule } from '@nestjs/testing';
import { getBotToken } from 'nestjs-telegraf';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramMessageBuilder } from './telegram.message-builder';
import { TelegramRecipientService } from './telegram.recipient.service';
import { UsersService } from '../users/users.service';
import { ParserService } from '../parser/parser.service';

describe('TelegramController', () => {
  let controller: TelegramController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramController],
      providers: [
        TelegramService,
        {
          provide: getBotToken(),
          useValue: {
            telegram: {
              setMyCommands: jest.fn(),
              sendMessage: jest.fn(),
              getMe: jest.fn(),
            },
          },
        },
        {
          provide: TelegramMessageBuilder,
          useValue: { build: jest.fn() },
        },
        {
          provide: TelegramRecipientService,
          useValue: { resolveRecipients: jest.fn().mockReturnValue([]) },
        },
        {
          provide: UsersService,
          useValue: {
            getTelegramChatIdsForBitrixUsers: jest.fn(),
          },
        },
        {
          provide: ParserService,
          useValue: {
            parseTitle: jest.fn(),
            parseUser: jest.fn(),
            parseDeadline: jest.fn(),
            bbcodeToHtml: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TelegramController>(TelegramController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
