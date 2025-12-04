import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum BitrixWebhookType {
  OnTaskCommentAdd = 'ONTASKCOMMENTADD',
  OnTaskAdd = 'ONTASKADD',
  OnTaskUpdate = 'ONTASKUPDATE',
}

export enum BitrixWebhookTypeNumber {
  OnTaskCommentAdd = 112,
  OnTaskAdd = 106,
  OnTaskUpdate = 108,
}

const sanitizeUndefined = ({ value }: { value: unknown }) =>
  value === 'undefined' || value === 'null' ? undefined : value;

const toOptionalInt = ({ value }: { value: unknown }) => {
  if (value === 'undefined' || value === 'null' || value === '') {
    return undefined;
  }

  const numeric =
    typeof value === 'string' ? Number(value) : (value as number | undefined);

  return Number.isFinite(numeric as number) ? Number(numeric) : value;
};

/**
 * Вложенный объект auth[...] — служебная информация о портале Bitrix24
 */
export class BitrixWebhookAuth {
  @IsString()
  @IsNotEmpty()
  domain: string;

  @IsUrl()
  client_endpoint: string;

  @IsUrl()
  server_endpoint: string;

  @IsString()
  @IsNotEmpty()
  member_id: string;

  @IsString()
  @IsNotEmpty()
  application_token: string;
}

/**
 * data[FIELDS_BEFORE] / data[FIELDS_AFTER]
 */
export class BitrixTaskFields {
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  ID?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  TASK_ID?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  MESSAGE_ID?: number;
}

/**
 * data[...] структура
 */
export class BitrixWebhookData {
  @IsOptional()
  @Transform(sanitizeUndefined)
  @ValidateNested()
  @Type(() => BitrixTaskFields)
  FIELDS_BEFORE?: BitrixTaskFields;

  @IsOptional()
  @Transform(sanitizeUndefined)
  @ValidateNested()
  @Type(() => BitrixTaskFields)
  FIELDS_AFTER?: BitrixTaskFields;

  @IsOptional()
  @Transform(sanitizeUndefined)
  @IsString()
  IS_ACCESSIBLE_BEFORE?: string;

  @IsOptional()
  @Transform(sanitizeUndefined)
  @IsString()
  IS_ACCESSIBLE_AFTER?: string;
}

/**
 * Основной DTO для любого вебхука Bitrix24
 */
export class BitrixWebhookDto {
  @IsString()
  @IsNotEmpty()
  event: string;

  @IsInt()
  event_handler_id: number;

  @ValidateNested()
  @Type(() => BitrixWebhookData)
  data: BitrixWebhookData;

  @IsInt()
  ts: number;

  @ValidateNested()
  @Type(() => BitrixWebhookAuth)
  auth: BitrixWebhookAuth;
}
