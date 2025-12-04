import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { BitrixResponse } from './entities/bitrix-response.type';

@Injectable()
export class BitrixHttpService {
  private readonly logger = new Logger(BitrixHttpService.name);

  constructor(private readonly httpService: HttpService) {
    const axiosRef = this.httpService.axiosRef;

    axiosRef.interceptors.request.use((config) => {
      this.logger.debug(
        `[${config.method?.toUpperCase()}] ${config.baseURL}${config.url}`,
      );
      if (config.data)
        this.logger.verbose(`Request data: ${JSON.stringify(config.data)}`);
      return config;
    });

    axiosRef.interceptors.response.use(
      (response: AxiosResponse<BitrixResponse<any>>) => {
        const time = response.data?.time;
        if (time) {
          this.logger.debug(
            `✅ Bitrix responded in ${time.duration.toFixed(2)}s (processing: ${time.processing.toFixed(2)}s)`,
          );
        } else {
          this.logger.debug(`✅ Bitrix response ${response.status}`);
        }
        return response;
      },
      (error: AxiosError) => {
        const message = error.response
          ? `❌ Bitrix error [${error.response.status}] ${error.response.statusText}`
          : `❌ Network error: ${error.message}`;
        this.logger.error(message);

        if (error.response?.data) {
          this.logger.error(
            `❌ Bitrix error response: ${JSON.stringify(error.response.data, null, 2)}`,
          );
        }

        return Promise.reject(error);
      },
    );
  }

  async post<T>(
    method: string,
    data?: Record<string, any>,
  ): Promise<BitrixResponse<T>> {
    const response: AxiosResponse<BitrixResponse<T>> = await firstValueFrom(
      this.httpService.post(method, data),
    );
    return response.data;
  }
  /**
   * 🚀 Метод для получения всех данных, если Bitrix возвращает `next`
   */
  async getAll<T>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<BitrixResponse<T[]>> {
    const allResults: T[] = [];
    let start = 0;
    let lastResponse: BitrixResponse<T[]> | null = null;
    const maxIterations = 1000; // защита от бесконечного цикла

    this.logger.debug(
      `📦 Начинаем загрузку всех данных по методу ${method}...`,
    );

    for (let i = 0; i < maxIterations; i++) {
      const response = await this.post<T[]>(method, {
        ...params,
        start,
      });

      if (Array.isArray(response.result)) {
        allResults.push(...response.result);
      } else {
        this.logger.warn(
          `⚠️ Ожидался массив, но получен другой тип данных: ${typeof response.result}`,
        );
        break;
      }

      lastResponse = response;

      if (response.next === undefined) {
        this.logger.debug(
          `✅ Все данные получены (${allResults.length} элементов, ${i + 1} запросов)`,
        );
        break;
      }

      start = response.next;
    }

    if (!lastResponse) {
      throw new Error(`❌ Не удалось получить данные по методу ${method}`);
    }

    return {
      ...lastResponse,
      result: allResults,
    };
  }
}
