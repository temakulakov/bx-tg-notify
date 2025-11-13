import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  IsDateString,
  IsBoolean,
} from 'class-validator';

export class CreateTaskDto {
  @IsInt()
  bitrixId: number;

  @IsString()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsArray()
  @IsNotEmpty()
  responsible_ids: number[];

  @IsInt()
  created_by: number;

  @IsOptional()
  @IsBoolean()
  replicate?: boolean;
}
