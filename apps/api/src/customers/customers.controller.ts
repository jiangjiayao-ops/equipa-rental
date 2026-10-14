import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MasterAdminGuard } from '../auth/master-admin.guard';
import { CustomersService } from './customers.service';

class UpsertCustomerDto {
  @IsString()
  @MinLength(1)
  legalName!: string;

  @IsOptional()
  @IsString()
  tradeName?: string | null;

  @IsString()
  @MinLength(1)
  document!: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  city?: string | null;

  @IsOptional()
  @IsString()
  state?: string | null;

  @IsOptional()
  @IsString()
  street?: string | null;

  @IsOptional()
  @IsString()
  cep?: string | null;

  @IsOptional()
  @IsString()
  contactName?: string | null;
}

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list() {
    return this.customers.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.customers.getOrThrow(id);
  }

  @Post()
  create(@Body() body: UpsertCustomerDto) {
    return this.customers.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpsertCustomerDto) {
    return this.customers.update(id, body);
  }

  @Delete(':id')
  @UseGuards(MasterAdminGuard)
  remove(
    @Param('id') id: string,
    @Query('hard') hard: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customers.remove(
      id,
      { userId: user.userId, email: user.email },
      hard === '1' || hard === 'true',
    );
  }
}
