import { Module } from '@nestjs/common';
import { NotifyService } from './notify.service';
import { ProposalPdfService } from './proposal-pdf.service';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { PublicProposalsController } from './public-proposals.controller';

@Module({
  controllers: [ProposalsController, PublicProposalsController],
  providers: [ProposalsService, NotifyService, ProposalPdfService],
  exports: [ProposalsService],
})
export class ProposalsModule {}
