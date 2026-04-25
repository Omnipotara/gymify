import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.isProd ? 'info' : 'debug',
  ...(config.isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, ignore: 'pid,hostname' },
        },
      }),
});
