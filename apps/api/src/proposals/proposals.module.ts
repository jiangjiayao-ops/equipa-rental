import { Module } from '@nestjs/common';
import { NotifyService } from './notify.service';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { PublicProposalsController } from './public-proposals.controller';

@Module({
  controllers: [ProposalsController, PublicProposalsController],
  providers: [ProposalsService, NotifyService],
  exports: [ProposalsService],
})
export class ProposalsModule {}
