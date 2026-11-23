import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ViecThatModule } from './viec-that/viec-that.module.js';

@Module({
  imports: [ConfigModule.forRoot(), ViecThatModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
