import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import morgan from 'morgan';
import config from 'config';
import { webhook_type } from './api/';
import { logger } from './logger';
import { chatgptReply } from './bots/chatgpt';

const port: number = (process.env.PORT ?
  parseInt(process.env.PORT) :
  config.get('port'));

const secret: string = config.get('secret');

const app = express();
app.use(morgan('combined'));
app.use(bodyParser.text({ type: ['json', 'text'] }));

// 中間件：檢查 HMAC
function verifyHMAC(req: Request, res: Response, next: NextFunction) {
  const hmac = req.headers['hmac']; // 從 header 取得 HMAC
  logger.debug(`hmac = ${hmac}`);
  if (!hmac) {
    logger.warn('標頭無 HMAC');
    return res.status(401).send('標頭無 HMAC');
  }

  const payload = req.body;
  logger.debug(`payload = ${payload}`);
  const computed_hmac = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  if (hmac !== computed_hmac) {
    logger.warn('HMAC 驗證失敗');
    return res.status(401).send('HMAC 驗證失敗');
  }

  next();
}

// 路由：需要 HMAC 校驗
app.post('/', verifyHMAC, (req, res) => {
  logger.info('HMAC 驗證成功');
  res.send('HMAC 驗證成功');
  const request: webhook_type.API = JSON.parse(req.body);
  if ('MentionedInComment' in request) {
    const {
      article_id,
      comment_content
    } = request['MentionedInComment'];

    chatgptReply(article_id, comment_content.trim());

  } else {
    throw new Error(`未知的 webhook: ${req.body}`);
  }
});

// 啟動伺服器
app.listen(port, () => {
  logger.info(`靜候於埠口 ${port}`);
});
