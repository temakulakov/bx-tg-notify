import { Test, TestingModule } from '@nestjs/testing';
import { ParserService } from './parser.service';
import { BitrixService } from '../bitrix/bitrix.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { TasksService } from '../tasks/tasks.service';

describe('ParserService', () => {
  let service: ParserService;
  let bitrixService: jest.Mocked<BitrixService>;
  let usersService: jest.Mocked<UsersService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParserService,
        {
          provide: BitrixService,
          useValue: {
            getTask: jest.fn(),
            getFile: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn(),
            findByBitrixId: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: TasksService,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ParserService>(ParserService);
    bitrixService = module.get(BitrixService);
    usersService = module.get(UsersService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('bbcodeToHtml', () => {
    it('должен преобразовывать [B]...[/B] в <b>...</b>', async () => {
      const input = '[B]ЦКП задачи: [/B]';
      const expected = '<b>ЦКП задачи: </b>';
      expect(await service.bbcodeToHtml(input)).toBe(expected);
    });

    it('должен преобразовывать [B]...[/B] в нижнем регистре', async () => {
      const input = '[b]жирный текст[/b]';
      const expected = '<b>жирный текст</b>';
      expect(await service.bbcodeToHtml(input)).toBe(expected);
    });

    it('должен преобразовывать [I]...[/I] в <i>...</i>', async () => {
      const input = '[I]курсив[/I]';
      const expected = '<i>курсив</i>';
      expect(await service.bbcodeToHtml(input)).toBe(expected);
    });

    it('должен преобразовывать [U]...[/U] в <u>...</u>', async () => {
      const input = '[U]подчеркнутый[/U]';
      const expected = '<u>подчеркнутый</u>';
      expect(await service.bbcodeToHtml(input)).toBe(expected);
    });

    it('должен преобразовывать [S]...[/S] в <s>...</s>', async () => {
      const input = '[S]зачеркнутый[/S]';
      const expected = '<s>зачеркнутый</s>';
      expect(await service.bbcodeToHtml(input)).toBe(expected);
    });

    it('должен преобразовывать вложенные теги', async () => {
      const input = '[B][I]жирный и курсив[/I][/B]';
      const expected = '<b><i>жирный и курсив</i></b>';
      expect(await service.bbcodeToHtml(input)).toBe(expected);
    });

    it('должен преобразовывать [URL=...]...[/URL] в <a href="...">...</a>', async () => {
      const input = '[URL=https://example.com]ссылка[/URL]';
      const expected = '<a href="https://example.com">ссылка</a>';
      expect(await service.bbcodeToHtml(input)).toBe(expected);
    });

    it('должен преобразовывать [URL]...[/URL] в <a href="...">...</a>', async () => {
      const input = '[URL]https://example.com[/URL]';
      const expected = '<a href="https://example.com">https://example.com</a>';
      expect(await service.bbcodeToHtml(input)).toBe(expected);
    });

    it('должен удалять [IMG] теги (Telegram не поддерживает изображения)', async () => {
      const input = '[IMG]https://example.com/image.jpg[/IMG]';
      const expected = 'https://example.com/image.jpg';
      expect(await service.bbcodeToHtml(input)).toBe(expected);
    });

    it('должен преобразовывать [CODE]...[/CODE] в <code>...</code>', async () => {
      const input = '[CODE]const x = 1;[/CODE]';
      const expected = '<code>const x = 1;</code>';
      expect(await service.bbcodeToHtml(input)).toBe(expected);
    });

    it('должен преобразовывать [QUOTE]...[/QUOTE] в <blockquote>...</blockquote>', async () => {
      const input = '[QUOTE]цитата[/QUOTE]';
      const expected = '<blockquote>цитата</blockquote>';
      expect(await service.bbcodeToHtml(input)).toBe(expected);
    });

    it('должен удалять [COLOR=...] теги (Telegram не поддерживает цвет)', async () => {
      const input = '[COLOR=red]красный текст[/COLOR]';
      const expected = 'красный текст';
      expect(await service.bbcodeToHtml(input)).toBe(expected);
    });

    it('должен удалять [SIZE=...] теги (Telegram не поддерживает размер)', async () => {
      const input = '[SIZE=20px]большой текст[/SIZE]';
      const expected = 'большой текст';
      expect(await service.bbcodeToHtml(input)).toBe(expected);
    });

    it('должен преобразовывать [LIST]...[/LIST] в маркированный список', async () => {
      const input = '[LIST][*]пункт 1[*]пункт 2[/LIST]';
      const expected = '• пункт 1\n• пункт 2';
      expect(await service.bbcodeToHtml(input)).toBe(expected);
    });

    it('должен преобразовывать [LIST=1]...[/LIST] в нумерованный список', async () => {
      const input = '[LIST=1][*]пункт 1[*]пункт 2[/LIST]';
      const expected = '1. пункт 1\n2. пункт 2';
      expect(await service.bbcodeToHtml(input)).toBe(expected);
    });

    it('должен удалять теги [P]...[/P]', async () => {
      const input = '[P]Параграф[/P]';
      const expected = 'Параграф';
      expect(await service.bbcodeToHtml(input)).toBe(expected);
    });

    it('должен сохранять переносы строк (Telegram их поддерживает)', async () => {
      const input = 'строка 1\nстрока 2';
      const expected = 'строка 1\nстрока 2';
      expect(await service.bbcodeToHtml(input)).toBe(expected);
    });

    it('должен обрабатывать пустую строку', async () => {
      expect(await service.bbcodeToHtml('')).toBe('');
    });

    it('должен обрабатывать null/undefined', async () => {
      expect(await service.bbcodeToHtml(null as any)).toBe('');
      expect(await service.bbcodeToHtml(undefined as any)).toBe('');
    });

    it('должен экранировать HTML-символы в тексте', async () => {
      const input = '[B]текст <script>alert("xss")</script>[/B]';
      const expected = '<b>текст &lt;script&gt;alert("xss")&lt;/script&gt;</b>';
      expect(await service.bbcodeToHtml(input)).toBe(expected);
    });

    it('должен обрабатывать сложный пример с несколькими тегами', async () => {
      const input = '[B]ЦКП задачи: [/B][I]важно[/I] [URL=https://example.com]ссылка[/URL]';
      const expected = '<b>ЦКП задачи: </b><i>важно</i> <a href="https://example.com">ссылка</a>';
      expect(await service.bbcodeToHtml(input)).toBe(expected);
    });

    it('должен обрабатывать реальный пример из Bitrix с нумерованным списком и тегами [P]', async () => {
      const input = '[B]ЦКП задачи: [/B]Таблица ОН. Амбассадо[B]ара. Кfвалификатор лист "Анализ ры[/B]нка вакансии" содержит 10 компаний с наивысшим количеством откликов по вакансии.\r\n\r\n[URL=https://docs.google.com/spreadsheets/d/1p_Obs17fTP_WpjXiTf8TePuohGlg6X2EGwtub1BlOGg/edit?gid=324340550#gid=324340550]2. СТ. ОН. Амбассадор. - Google Таблицы[/URL]\r\n\r\nЛогика выполнения задачи:\r\n[LIST=1]\r\n[*]Отобрать вакансии на HH.ru, Зайти на НН  на телефоне как пользователь.\r\n[*][P]В поисковой строке ввести наименований вакансии по которой нужно сделать анализ.[/P]\r\n[*][P]Просматриваем вакансии, нам нужно отобрать 10 вакансий которые набрали наибольшее количество откликов и просмотров. Важно вакансии с наибольшим количеством откликов не располагаться друг за другом. [/P]\r\n[*][P]Отбираем вакансии на должность менеджер Sale/менеджер по продажам.[/P]\r\n[*][P]Заполняем лист "Анализ вакансии."[/P]\r\n[*][P]Таблицу заполнить по убыванию количества откликов.[/P]\r\n[/LIST]';
      const result = await service.bbcodeToHtml(input);
      console.log(result);
      // Проверяем основные элементы
      expect(result).toContain('<b>ЦКП задачи: </b>');
      expect(result).toContain('<b>ара. Кfвалификатор лист "Анализ ры</b>');
      expect(result).toContain('<a href="https://docs.google.com/spreadsheets/d/1p_Obs17fTP_WpjXiTf8TePuohGlg6X2EGwtub1BlOGg/edit?gid=324340550#gid=324340550">2. СТ. ОН. Амбассадор. - Google Таблицы</a>');
      expect(result).toContain('Логика выполнения задачи:');
      expect(result).toContain('1. Отобрать вакансии на HH.ru');
      expect(result).toContain('2. В поисковой строке ввести');
      expect(result).toContain('3. Просматриваем вакансии');
      expect(result).not.toContain('[P]');
      expect(result).not.toContain('[/P]');
      expect(result).not.toContain('[LIST=1]');
      expect(result).not.toContain('[/LIST]');
      expect(result).not.toContain('[*]');
    });

    it('должен преобразовывать [DISK FILE ID=...] в ссылку на файл', async () => {
      const mockFile = {
        ID: 4636,
        NAME: 'test-file.pdf',
        DOWNLOAD_URL: 'https://example.com/download/4636',
        CODE: null,
        STORAGE_ID: 1,
        TYPE: 'file',
        PARENT_ID: 0,
        DELETED_TYPE: '0',
        GLOBAL_CONTENT_VERSION: 1,
        FILE_ID: 123,
        SIZE: 1024,
        CREATE_TIME: '2025-01-01T00:00:00+03:00',
        UPDATE_TIME: '2025-01-01T00:00:00+03:00',
        DELETE_TIME: null,
        CREATED_BY: 1,
        UPDATED_BY: 1,
        DELETED_BY: 0,
        DETAIL_URL: 'https://example.com/detail/4636',
      };

      bitrixService.getFile.mockResolvedValue({
        result: mockFile,
        time: {
          start: 0,
          finish: 0,
          duration: 0,
          processing: 0,
          date_start: '',
          date_finish: '',
          operating_reset_at: 0,
          operating: 0,
        },
      });

      const input = 'Скачать файл: [DISK FILE ID=4636]';
      const result = await service.bbcodeToHtml(input);
      expect(result).toContain('<a href="https://example.com/download/4636">test-file.pdf</a>');
      expect(result).not.toContain('[DISK FILE ID=4636]');
      expect(bitrixService.getFile).toHaveBeenCalledWith(4636);
    });

    it('должен обрабатывать ошибку при получении файла', async () => {
      bitrixService.getFile.mockRejectedValue(new Error('File not found'));

      const input = 'Файл: [DISK FILE ID=9999]';
      const result = await service.bbcodeToHtml(input);
      expect(result).toContain('[Ошибка загрузки файла 9999]');
      expect(result).not.toContain('[DISK FILE ID=9999]');
    });

    it('должен обрабатывать случай, когда файл не найден', async () => {
      bitrixService.getFile.mockResolvedValue({
        result: null as any,
        time: {
          start: 0,
          finish: 0,
          duration: 0,
          processing: 0,
          date_start: '',
          date_finish: '',
          operating_reset_at: 0,
          operating: 0,
        },
      });

      const input = 'Файл: [DISK FILE ID=9999]';
      const result = await service.bbcodeToHtml(input);
      expect(result).toContain('[Файл 9999 не найден]');
      expect(result).not.toContain('[DISK FILE ID=9999]');
    });

    it('должен обрабатывать реальный пример с [DISK FILE ID=4636] внутри [B] тега', async () => {
      const mockFile = {
        ID: 4636,
        NAME: 'test-document.pdf',
        DOWNLOAD_URL: 'https://bitrix24.example.com/disk/downloadFile/4636',
        CODE: null,
        STORAGE_ID: 1,
        TYPE: 'file',
        PARENT_ID: 0,
        DELETED_TYPE: '0',
        GLOBAL_CONTENT_VERSION: 1,
        FILE_ID: 123,
        SIZE: 2048,
        CREATE_TIME: '2025-01-01T00:00:00+03:00',
        UPDATE_TIME: '2025-01-01T00:00:00+03:00',
        DELETE_TIME: null,
        CREATED_BY: 1,
        UPDATED_BY: 1,
        DELETED_BY: 0,
        DETAIL_URL: 'https://bitrix24.example.com/disk/viewFile/4636',
      };

      bitrixService.getFile.mockResolvedValue({
        result: mockFile,
        time: {
          start: 0,
          finish: 0,
          duration: 0,
          processing: 0,
          date_start: '',
          date_finish: '',
          operating_reset_at: 0,
          operating: 0,
        },
      });

      const input = '[B]ЦКП задачи:  [DISK FILE ID=4636]  [/B]Таблица ОН.  Амбассадо[B]ара. Квалификатор лист "Анализ ры[/B]нка вакансии" содержит 10 компаний с наивысшим количеством откликов по вакансии\r\n\r\n[URL=https://docs.google.com/spreadsheets/d/1p_Obs17fTP_WpjXiTf8TePuohGlg6X2EGwtub1BlOGg/edit?gid=324340550#gid=324340550]2. СТ. ОН. Амбассадор. - Google Таблицы[/URL]\r\n\r\nЛогика выполнения задачи:\r\n[LIST=1]\r\n[*]Отобрать вакансии на HH.ru, Зайти на НН  на телефоне как пользователь.\r\n[*][P]В поисковой строке ввести наименований вакансии по которой нужно сделать анализ.[/P]\r\n[*][P]Просматриваем вакансии, нам нужно отобрать 10 вакансий которые набрали наибольшее количество откликов и просмотров. Важно вакансии с наибольшим количеством откликов не располагаться друг за другом. [/P]\r\n[*][P]Отбираем вакансии на должность менеджер Sale/менеджер по продажам.[/P]\r\n[*][P]Заполняем лист "Анализ вакансии."[/P]\r\n[*][P]Таблицу заполнить по убыванию количества откликов.[/P]\r\n[/LIST]';

      const result = await service.bbcodeToHtml(input);
      console.log('Результат преобразования:');
      console.log(result);
      console.log('\n---\n');

      // Проверяем основные элементы
      expect(result).toContain('<b>ЦКП задачи:');
      expect(result).toContain('</b>');
      expect(result).toContain('<b>ара. Квалификатор лист "Анализ ры</b>');

      // Проверяем, что [DISK FILE ID=4636] заменен на ссылку
      expect(result).toContain('<a href="https://bitrix24.example.com/disk/downloadFile/4636">test-document.pdf</a>');
      expect(result).not.toContain('[DISK FILE ID=4636]');

      // Проверяем ссылку на Google Таблицы
      expect(result).toContain('<a href="https://docs.google.com/spreadsheets/d/1p_Obs17fTP_WpjXiTf8TePuohGlg6X2EGwtub1BlOGg/edit?gid=324340550#gid=324340550">2. СТ. ОН. Амбассадор. - Google Таблицы</a>');

      // Проверяем нумерованный список
      expect(result).toContain('Логика выполнения задачи:');
      expect(result).toContain('1. Отобрать вакансии на HH.ru');
      expect(result).toContain('2. В поисковой строке ввести');
      expect(result).toContain('3. Просматриваем вакансии');
      expect(result).toContain('4. Отбираем вакансии на должность менеджер Sale/менеджер по продажам.');
      expect(result).toContain('5. Заполняем лист "Анализ вакансии."');
      expect(result).toContain('6. Таблицу заполнить по убыванию количества откликов.');

      // Проверяем, что теги удалены
      expect(result).not.toContain('[P]');
      expect(result).not.toContain('[/P]');
      expect(result).not.toContain('[LIST=1]');
      expect(result).not.toContain('[/LIST]');
      expect(result).not.toContain('[*]');

      // Проверяем, что метод getFile был вызван с правильным ID
      expect(bitrixService.getFile).toHaveBeenCalledWith(4636);
    });

    it('должен преобразовывать [USER=ID] в ссылку на пользователя', async () => {
      configService.get.mockImplementation(
        (key: string) =>
          key === 'BX24_DOMAIN' ? 'https://example.bitrix24.ru' : undefined,
      );

      usersService.findByBitrixId.mockResolvedValue({
        bitrix_id: 114,
        name: 'Артем',
        telegram_ids: [],
      } as any);

      const input = 'Ответственный: [USER=114]Артем[/USER]';
      const result = await service.bbcodeToHtml(input);

      expect(usersService.findByBitrixId).toHaveBeenCalledWith(114);
      expect(result).toContain(
        '<a href="https://example.bitrix24.ru/company/personal/user/114">Артем</a>',
      );
    });
  });

  describe('truncateHtml', () => {
    it('не должен менять строку если длина меньше ограничения', () => {
      const input = '<b>Привет</b>, мир!';
      expect(service.truncateHtml(input, 50)).toBe(input);
    });

    it('должен обрезать текст и закрывать теги', () => {
      const input = '<b>Привет, мир!</b>';
      expect(service.truncateHtml(input, 5)).toBe('<b>Приве…</b>');
    });

    it('должен обрезать ссылку без поломки тега', () => {
      const input = '<a href="https://example.com">Длинная ссылка</a>';
      expect(service.truncateHtml(input, 7)).toBe(
        '<a href="https://example.com">Длинная…</a>',
      );
    });

    it('должен корректно считать HTML сущности', () => {
      const input = 'Привет&nbsp;мир!';
      expect(service.truncateHtml(input, 7)).toBe('Привет&nbsp;…');
    });
  });
});
