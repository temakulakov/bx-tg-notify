import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { BitrixService } from './bitrix/bitrix.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly bitrixService: BitrixService,
  ) {}

  @Get()
  getHello() {
    return this.bitrixService.getTask(20124);
  }
}
