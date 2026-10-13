import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsString } from 'class-validator';
import { ProposalsService } from './proposals.service';

class AcceptDto {
  @IsString()
  optionId!: string;
}

@Controller('public/proposals')
export class PublicProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Get(':token')
  get(@Param('token') token: string) {
    return this.proposals.getByPublicToken(token);
  }

  @Post(':token/accept')
  accept(@Param('token') token: string, @Body() body: AcceptDto) {
    return this.proposals.acceptPublic(token, body.optionId);
  }
}
