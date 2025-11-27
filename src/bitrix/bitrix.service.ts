import { Injectable } from '@nestjs/common';
import { BitrixHttpService } from './bitrix-http.service';
import {
  BitrixDiskFile,
  BitrixResponse,
  BitrixTask,
  BitrixUser,
  BitrixTaskComment,
} from './entities/bitrix-response.type';
import { BitrixMethod } from './constants/bitrix-methods.enum';

@Injectable()
export class BitrixService {
  constructor(private readonly bitrixHttp: BitrixHttpService) {}

  async getUsers(): Promise<BitrixResponse<BitrixUser[]>> {
    return this.bitrixHttp.getAll<BitrixUser>(BitrixMethod.USER_GET, {
      select: ['ID', 'NAME', 'LAST_NAME'],
      filter: { ACTIVE: 'Y' },
    });
  }

  async getFile(id: number): Promise<BitrixResponse<BitrixDiskFile>> {
    return this.bitrixHttp.post(BitrixMethod.GET_FILE, {
      id,
    });
  }

  async getTask(id: number): Promise<BitrixResponse<{ task: BitrixTask }>> {
    return this.bitrixHttp.post(BitrixMethod.TASK, {
      id,
      select: [
        'ID',
        'TITLE',
        'DESCRIPTION',
        'DEADLINE',
        'REPLICATE',
        'CREATED_BY',
        'RESPONSIBLE_ID',
        'TAGS',
      ],
    });
  }

  async getTaskComment(
    taskId: number,
    commentId: number,
  ): Promise<BitrixResponse<BitrixTaskComment>> {
    return this.bitrixHttp.post(BitrixMethod.TASK_COMMENT, {
      TASKID: taskId,
      ITEMID: commentId,
    });
  }
}
