import app from './app';
import { config } from './config';
import { logger } from './lib/logger';

app.listen(config.port, () => {
  logger.info(`Server listening on port ${config.port} [${config.nodeEnv}]`);
});

export default app;
