import { IsInt } from 'class-validator';
import { TaskWebhookDto } from './task-webhook.dto';

export class CommentTaskWebhookDto extends TaskWebhookDto {
  @IsInt()
  commentId: number;
}
