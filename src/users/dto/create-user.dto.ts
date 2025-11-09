import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateUserDto {
  @IsInt()
  @IsNotEmpty()
  bitrixId: number;

  @IsString()
  @IsNotEmpty()
  name: string;
}
