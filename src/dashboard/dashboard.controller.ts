import { Controller, Get, Render } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  @Get()
  @Render('dashboard')
  async getDashboard() {
    const status = await this.dashboardService.getSystemStatus();
    const statusWithFlags = this.addStatusFlags(status);
    return { status: statusWithFlags };
  }

  private addStatusFlags(status: any) {
    return {
      database: {
        ...status.database,
        isOk: status.database.status === 'ok',
        isError: status.database.status === 'error',
        isWarning: status.database.status === 'warning',
      },
      telegram: {
        ...status.telegram,
        isOk: status.telegram.status === 'ok',
        isError: status.telegram.status === 'error',
        isWarning: status.telegram.status === 'warning',
      },
      bitrix: {
        ...status.bitrix,
        isOk: status.bitrix.status === 'ok',
        isError: status.bitrix.status === 'error',
        isWarning: status.bitrix.status === 'warning',
      },
      server: {
        ...status.server,
        isOk: status.server.status === 'ok',
        isError: status.server.status === 'error',
        isWarning: status.server.status === 'warning',
      },
    };
  }
}

