import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OperationsService } from './operations.service';

@Controller('operations')
@UseGuards(JwtAuthGuard)
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('mobilizations')
  mobilizations() {
    return this.operations.mobilizations();
  }

  @Get('transfers')
  transfers() {
    return this.operations.transfers();
  }
}
