import { Test, TestingModule } from '@nestjs/testing';
import { getBotToken } from 'nestjs-telegraf';
import { TelegramService } from './telegram.service';
import { TelegramMessageBuilder } from './telegram.message-builder';
import { TelegramRecipientService } from './telegram.recipient.service';
import { UsersService } from '../users/users.service';
import { ParserService } from '../parser/parser.service';
import { ConfigService } from '@nestjs/config';

describe('TelegramService', () => {
  let service: TelegramService;
  const botMock = {
    telegram: {
      setMyCommands: jest.fn(),
      sendMessage: jest.fn(),
      getMe: jest.fn(),
    },
  };
  const messageBuilderMock = {
    build: jest.fn().mockReturnValue('formatted message'),
  };
  const recipientServiceMock = {
    resolveRecipients: jest.fn().mockReturnValue([123]),
  };
  const usersServiceMock = {
    getTelegramChatIdsForBitrixUsers: jest
      .fn()
      .mockResolvedValue([123, 456]),
  };
  const parserServiceMock = {
    parseTitle: jest.fn().mockResolvedValue('Заголовок'),
    parseUser: jest.fn().mockResolvedValue('Пользователь'),
    parseDeadline: jest.fn().mockResolvedValue('1 января 2025 года в 12:00'),
    bbcodeToHtml: jest.fn().mockResolvedValue('Описание'),
    truncateHtml: jest.fn().mockImplementation((value: string) => value),
    escapeHtml: jest.fn().mockImplementation((value: string) => value),
  };
  const configServiceMock = {
    get: jest.fn().mockReturnValue('https://example.bitrix24.ru'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        { provide: getBotToken(), useValue: botMock },
        {
          provide: TelegramMessageBuilder,
          useValue: messageBuilderMock,
        },
        {
          provide: TelegramRecipientService,
          useValue: recipientServiceMock,
        },
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
        {
          provide: ParserService,
          useValue: parserServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send template messages to resolved recipients', async () => {
    botMock.telegram.sendMessage.mockResolvedValueOnce({ message_id: 1 });

    const results = await service.sendTemplateMessage('default', {
      title: 'Test',
      sections: [{ lines: ['Line 1'] }],
    });

    expect(messageBuilderMock.build).toHaveBeenCalled();
    expect(recipientServiceMock.resolveRecipients).toHaveBeenCalledWith(
      'default',
    );
    expect(botMock.telegram.sendMessage).toHaveBeenCalledWith(
      123,
      'formatted message',
      expect.objectContaining({ parse_mode: 'HTML' }),
    );
    expect(results).toHaveLength(1);
  });
});
