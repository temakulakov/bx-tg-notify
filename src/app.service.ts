import { Injectable } from '@nestjs/common';
import { BitrixService } from './bitrix/bitrix.service';
import {
  BitrixResponse,
  BitrixUser,
} from './bitrix/entities/bitrix-response.type';
import { UsersService } from './users/users.service';

@Injectable()
export class AppService {
  constructor(
    private readonly bitrixService: BitrixService,
    private userService: UsersService,
  ) {}

  async getHello() {
    const a: BitrixResponse<BitrixUser[]> = await this.bitrixService.getUsers();
    a.result.map((user: BitrixUser) => {
      this.userService.create({
        bitrixId: parseInt(user.ID),
        name: `${user.LAST_NAME} ${user.LAST_NAME}`,
      });
    });

    return this.userService.findAll();
  }
}
