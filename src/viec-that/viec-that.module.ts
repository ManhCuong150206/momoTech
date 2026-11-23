import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { GeocodingModule } from '../geocoding/geocoding.module.js';
import { ApiErrorFilter } from './api-errors.js';
import { HistoryService } from './history.service.js';
import { InvitationRateGuard } from './invitation-rate.guard.js';
import { ViecThatController } from './viec-that.controller.js';

@Module({
  imports: [ConfigModule, GeocodingModule],
  controllers: [ViecThatController],
  providers: [
    HistoryService,
    InvitationRateGuard,
    { provide: APP_FILTER, useClass: ApiErrorFilter },
  ],
})
export class ViecThatModule {}
