import {
  Body,
  Controller,
  Post,
  Logger,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { BitrixWebhookDto } from './dto/bitrix-webhook.dto';
import { WebhookGuard } from './webhook.guard';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) { }

  @Post('bitrix24')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WebhookGuard)
  async handleWebhook(@Body() dto: BitrixWebhookDto): Promise<{ success: boolean }> {
    this.logger.log(`Получен вебхук: ${dto.event}`);

    await this.webhookService.handleWebhook(dto);

    return { success: true };
  }

  @Post('document-approval')
  @HttpCode(HttpStatus.OK)
  async handleDocumentApproval(
    @Query() query: Record<string, any>,
  ): Promise<{ success: boolean }> {
    this.logger.log(
      `Получен запрос document-approval: ${JSON.stringify(query)}`,
    );

    await this.webhookService.handleDocumentApproval(query);

    return { success: true };
  }


}
