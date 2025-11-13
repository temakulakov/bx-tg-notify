import { Module } from '@nestjs/common';
import { WebappController } from './webapp.controller';
import { WebappService } from './webapp.service';
import { UsersModule } from '../users/users.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { PhrasesModule } from '../phrases/phrases.module';

@Module({
  imports: [UsersModule, DashboardModule, PhrasesModule],
  controllers: [WebappController],
  providers: [WebappService],
})
export class WebappModule {}

