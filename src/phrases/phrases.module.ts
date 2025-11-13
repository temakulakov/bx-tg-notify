import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhrasesService } from './phrases.service';
import { PhrasesController } from './phrases.controller';
import { Phrase } from './entities/phrase.entity';
import { UsersModule } from '../users/users.module';
import { TelegramAuthGuard } from '../auth/guards/telegram-auth.guard';

@Module({
    imports: [
        TypeOrmModule.forFeature([Phrase]),
        UsersModule,
    ],
    controllers: [PhrasesController],
    providers: [PhrasesService, TelegramAuthGuard],
    exports: [PhrasesService],
})
export class PhrasesModule implements OnModuleInit {
    constructor(private readonly phrasesService: PhrasesService) { }

    async onModuleInit() {
        await this.phrasesService.initializeFromFile();
    }
}

