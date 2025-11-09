import { IsInt } from 'class-validator';

export class TaskWebhookDto {
  @IsInt()
  id: number;
}
