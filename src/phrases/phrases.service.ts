import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Phrase } from './entities/phrase.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class PhrasesService {
    private readonly logger = new Logger(PhrasesService.name);
    private readonly phrasesFilePath = path.join(
        process.cwd(),
        'comment-stop-phrases.txt',
    );

    constructor(
        @InjectRepository(Phrase)
        private readonly phraseRepository: Repository<Phrase>,
    ) { }

    /**
     * Инициализация: загружает фразы из файла в БД при первом запуске
     */
    async initializeFromFile(): Promise<void> {
        try {
            const count = await this.phraseRepository.count();
            if (count > 0) {
                this.logger.debug('Фразы уже загружены в БД, пропускаем инициализацию');
                return;
            }

            const fileContent = await fs.readFile(this.phrasesFilePath, 'utf-8');
            const phrases = fileContent
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0);

            if (phrases.length === 0) {
                this.logger.warn('Файл с фразами пуст или не найден');
                return;
            }

            const phraseEntities = phrases.map((text) =>
                this.phraseRepository.create({ text }),
            );

            await this.phraseRepository.save(phraseEntities);
            this.logger.log(
                `Загружено ${phraseEntities.length} фраз из файла в БД`,
            );
        } catch (error) {
            this.logger.error('Ошибка при инициализации фраз из файла', error);
        }
    }

    async findAll(): Promise<Phrase[]> {
        return this.phraseRepository.find({
            order: { createdAt: 'DESC' },
        });
    }

    async create(text: string): Promise<Phrase> {
        this.logger.log(`[PhrasesService.create] Создание фразы: "${text}"`);
        try {
            const phrase = this.phraseRepository.create({ text });
            const saved = await this.phraseRepository.save(phrase);
            this.logger.log(`[PhrasesService.create] ✅ Фраза сохранена в БД: id=${saved.id}, text="${saved.text}"`);
            return saved;
        } catch (error) {
            this.logger.error(`[PhrasesService.create] ❌ Ошибка при сохранении в БД: ${error.message}`, error.stack);
            throw error;
        }
    }

    async remove(id: number): Promise<void> {
        await this.phraseRepository.delete(id);
    }

    async findOne(id: number): Promise<Phrase | null> {
        return this.phraseRepository.findOneBy({ id });
    }
}


