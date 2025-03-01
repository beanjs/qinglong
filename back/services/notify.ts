import crypto from 'crypto';
import got from 'got';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
import nodemailer from 'nodemailer';
import { Inject, Service } from 'typedi';
import winston from 'winston';
import { parseBody, parseHeaders, safeJSONParse } from '../config/util';
import { NotificationInfo } from '../data/notify';
import UserService from './user';
import { readFile } from 'fs/promises';
import config from '../config';

@Service()
export default class NotificationService {
  @Inject((type) => UserService)
  private userService!: UserService;

  private modeMap = new Map([
    ['gotify', this.gotify],
    ['goCqHttpBot', this.goCqHttpBot],
    ['serverChan', this.serverChan],
    ['pushDeer', this.pushDeer],
    ['chat', this.chat],
    ['bark', this.bark],
    ['telegramBot', this.telegramBot],
    ['dingtalkBot', this.dingtalkBot],
    ['weWorkBot', this.weWorkBot],
    ['weWorkApp', this.weWorkApp],
    ['aibotk', this.aibotk],
    ['iGot', this.iGot],
    ['pushPlus', this.pushPlus],
    ['wePlusBot', this.wePlusBot],
    ['email', this.email],
    ['pushMe', this.pushMe],
    ['webhook', this.webhook],
    ['lark', this.lark],
    ['chronocat', this.chronocat],
  ]);

  private title = '';
  private content = '';
  private params!: Omit<NotificationInfo, 'type'>;
  private gotOption = {
    timeout: 10000,
    retry: 1,
  };

  constructor() {}

  public async externalNotify(
    title: string,
    content: string,
  ): Promise<boolean | undefined> {
    const { type, ...rest } = safeJSONParse(
      await readFile(config.systemNotifyFile, 'utf-8'),
    );
    if (type) {
      this.title = title;
      this.content = content;
      this.params = rest;
      const notificationModeAction = this.modeMap.get(type);
      try {
        return await notificationModeAction?.call(this);
      } catch (error: any) {
        throw error;
      }
    }
    return false;
  }

  public async notify(
    title: string,
    content: string,
  ): Promise<boolean | undefined> {
    const { type, ...rest } = await this.userService.getNotificationMode();
    if (type) {
      this.title = title;
      this.content = content;
      this.params = rest;
      const notificationModeAction = this.modeMap.get(type);
      try {
        return await notificationModeAction?.call(this);
      } catch (error: any) {
        throw error;
      }
    }
    return false;
  }

  public async testNotify(
    info: NotificationInfo,
    title: string,
    content: string,
  ) {
    const { type, ...rest } = info;
    if (type) {
      this.title = title;
      this.content = content;
      this.params = rest;
      const notificationModeAction = this.modeMap.get(type);
      return await notificationModeAction?.call(this);
    }
    return true;
  }

  private async gotify() {
    const { gotifyUrl, gotifyToken, gotifyPriority = 1 } = this.params;
    try {
      const res: any = await got
        .post(`${gotifyUrl}/message?token=${gotifyToken}`, {
          ...this.gotOption,
          body: `title=${encodeURIComponent(
            this.title,
          )}&message=${encodeURIComponent(
            this.content,
          )}&priority=${gotifyPriority}`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
        .json();
      if (typeof res.id === 'number') {
        return true;
      } else {
        throw new Error(JSON.stringify(res));
      }
    } catch (error: any) {
      throw new Error(error.response ? error.response.body : error);
    }
  }

  private async goCqHttpBot() {
    const { gobotQq, gobotToken, gobotUrl } = this.params;
    try {
      const res: any = await got
        .post(`${gobotUrl}?${gobotQq}`, {
          ...this.gotOption,
          json: { message: `${this.title}\n${this.content}` },
          headers: { Authorization: 'Bearer ' + gobotToken },
        })
        .json();
      if (res.retcode === 0) {
        return true;
      } else {
        throw new Error(JSON.stringify(res));
      }
    } catch (error: any) {
      throw new Error(error.response ? error.response.body : error);
    }
  }

  private async serverChan() {
    const { pushKey } = this.params;
    const url = pushKey.startsWith('SCT')
      ? `https://sctapi.ftqq.com/${pushKey}.send`
      : `https://sc.ftqq.com/${pushKey}.send`;
    try {
      const res: any = await got
        .post(url, {
          ...this.gotOption,
          body: `title=${this.title}&desp=${this.content}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
        .json();
      if (res.errno === 0 || res.data.errno === 0) {
        return true;
      } else {
        throw new Error(JSON.stringify(res));
      }
    } catch (error: any) {
      throw new Error(error.response ? error.response.body : error);
    }
  }

  private async pushDeer() {
    const { deerKey, deerUrl } = this.params;
    const url = deerUrl || `https://api2.pushdeer.com/message/push`;
    try {
      const res: any = await got
        .post(url, {
          ...this.gotOption,
          body: `pushkey=${deerKey}&text=${encodeURIComponent(
            this.title,
          )}&desp=${encodeURIComponent(this.content)}&type=markdown`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
        .json();
      if (
        res.content.result.length !== undefined &&
        res.content.result.length > 0
      ) {
        return true;
      } else {
        throw new Error(JSON.stringify(res));
      }
    } catch (error: any) {
      throw new Error(error.response ? error.response.body : error);
    }
  }

  private async chat() {
    const { chatUrl, chatToken } = this.params;
    const url = `${chatUrl}${chatToken}`;
    try {
      const res: any = await got
        .post(url, {
          ...this.gotOption,
          body: `payload={"text":"${this.title}\n${this.content}"}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
        .json();
      if (res.success) {
        return true;
      } else {
        throw new Error(JSON.stringify(res));
      }
    } catch (error: any) {
      throw new Error(error.response ? error.response.body : error);
    }
  }

  private async bark() {
    let {
      barkPush,
      barkIcon = '',
      barkSound = '',
      barkGroup = '',
      barkLevel = '',
      barkUrl = '',
      barkArchive = '',
    } = this.params;
    if (!barkPush.startsWith('http')) {
      barkPush = `https://api.day.app/${barkPush}`;
    }
    const url = `${barkPush}`;
    const body = {
      title: this.title,
      body: this.content,
      icon: barkIcon,
      sound: barkSound,
      group: barkGroup,
      isArchive: barkArchive,
      level: barkLevel,
      url: barkUrl,
    };
    try {
      const res: any = await got
        .post(url, {
          ...this.gotOption,
          json: body,
          headers: { 'Content-Type': 'application/json' },
        })
        .json();
      if (res.code === 200) {
        return true;
      } else {
        throw new Error(JSON.stringify(res));
      }
    } catch (error: any) {
      throw new Error(error.response ? error.response.body : error);
    }
  }

  private async telegramBot() {
    const {
      tgApiHost,
      tgProxyAuth,
      tgProxyHost,
      tgProxyPort,
      tgBotToken,
      tgUserId,
    } = this.params;
    const authStr = tgProxyAuth ? `${tgProxyAuth}@` : '';
    const url = `${
      tgApiHost ? tgApiHost : 'https://api.telegram.org'
    }/bot${tgBotToken}/sendMessage`;
    let agent;
    if (tgProxyHost && tgProxyPort) {
      const options: any = {
        keepAlive: true,
        keepAliveMsecs: 1000,
        maxSockets: 256,
        maxFreeSockets: 256,
        proxy: `http://${authStr}${tgProxyHost}:${tgProxyPort}`,
      };
      const httpAgent = new HttpProxyAgent(options);
      const httpsAgent = new HttpsProxyAgent(options);
      agent = {
        http: httpAgent,
        https: httpsAgent,
      };
    }
    try {
      const res: any = await got
        .post(url, {
          ...this.gotOption,
          body: `chat_id=${tgUserId}&text=${this.title}\n\n${this.content}&disable_web_page_preview=true`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          agent,
        })
        .json();
      if (res.ok) {
        return true;
      } else {
        throw new Error(JSON.stringify(res));
      }
    } catch (error: any) {
      throw new Error(error.response ? error.response.body : error);
    }
  }

  private async dingtalkBot() {
    const { ddBotSecret, ddBotToken } = this.params;
    let secretParam = '';
    if (ddBotSecret) {
      const dateNow = Date.now();
      const hmac = crypto.createHmac('sha256', ddBotSecret);
      hmac.update(`${dateNow}\n${ddBotSecret}`);
      const result = encodeURIComponent(hmac.digest('base64'));
      secretParam = `&timestamp=${dateNow}&sign=${result}`;
    }
    const url = `https://oapi.dingtalk.com/robot/send?access_token=${ddBotToken}${secretParam}`;
    try {
      const res: any = await got
        .post(url, {
          ...this.gotOption,
          json: {
            msgtype: 'text',
            text: {
              content: ` ${this.title}\n\n${this.content}`,
            },
          },
        })
        .json();
      if (res.errcode === 0) {
        return true;
      } else {
        throw new Error(JSON.stringify(res));
      }
    } catch (error: any) {
      throw new Error(error.response ? error.response.body : error);
    }
  }

  private async weWorkBot() {
    const { qywxKey, qywxOrigin = 'https://qyapi.weixin.qq.com' } =
      this.params;
    const url = `${qywxOrigin}/cgi-bin/webhook/send?key=${qywxKey}`;
    try {
      const res: any = await got
        .post(url, {
          ...this.gotOption,
          json: {
            msgtype: 'text',
            text: {
              content: ` ${this.title}\n\n${this.content}`,
            },
          },
        })
        .json();
      if (res.errcode === 0) {
        return true;
      } else {
        throw new Error(JSON.stringify(res));
      }
    } catch (error: any) {
      throw new Error(error.response ? error.response.body : error);
    }
  }

  private async weWorkApp() {
    const { qywxKey, qywxOrigin = 'https://qyapi.weixin.qq.com' } =
      this.params;
    const [corpid, corpsecret, touser, agentid, thumb_media_id = '1'] =
    qywxKey.split(',');
    const url = `${qywxOrigin}/cgi-bin/gettoken`;
    const tokenRes: any = await got
      .post(url, {
        ...this.gotOption,
        json: {
          corpid,
          corpsecret,
        },
      })
      .json();

    let options: any = {
      msgtype: 'mpnews',
      mpnews: {
        articles: [
          {
            title: `${this.title}`,
            thumb_media_id,
            author: `智能助手`,
            content_source_url: ``,
            content: `${this.content.replace(/\n/g, '<br/>')}`,
            digest: `${this.content}`,
          },
        ],
      },
    };
    switch (thumb_media_id) {
      case '0':
        options = {
          msgtype: 'textcard',
          textcard: {
            title: `${this.title}`,
            description: `${this.content}`,
            url: 'https://github.com/whyour/qinglong',
            btntxt: '更多',
          },
        };
        break;

      case '1':
        options = {
          msgtype: 'text',
          text: {
            content: `${this.title}\n\n${this.content}`,
          },
        };
        break;
    }

    try {
      const res: any = await got
        .post(
          `${qywxOrigin}/cgi-bin/message/send?access_token=${tokenRes.access_token}`,
          {
            ...this.gotOption,
            json: {
              touser,
              agentid,
              safe: '0',
              ...options,
            },
          },
        )
        .json();

      if (res.errcode === 0) {
        return true;
      } else {
        throw new Error(JSON.stringify(res));
      }
    } catch (error: any) {
      throw new Error(error.response ? error.response.body : error);
    }
  }

  private async aibotk() {
    const { aibotkKey, aibotkType, aibotkName } = this.params;
    let url = '';
    let json = {};
    switch (aibotkType) {
      case 'room':
        url = 'https://api-bot.aibotk.com/openapi/v1/chat/room';
        json = {
          apiKey: `${aibotkKey}`,
          roomName: `${aibotkName}`,
          message: {
            type: 1,
            content: `【青龙快讯】\n\n${this.title}\n${this.content}`,
          },
        };
        break;
      case 'contact':
        url = 'https://api-bot.aibotk.com/openapi/v1/chat/contact';
        json = {
          apiKey: `${aibotkKey}`,
          name: `${aibotkName}`,
          message: {
            type: 1,
            content: `【青龙快讯】\n\n${this.title}\n${this.content}`,
          },
        };
        break;
    }

    try {
      const res: any = await got
        .post(url, {
          ...this.gotOption,
          json: {
            ...json,
          },
        })
        .json();
      if (res.code === 0) {
        return true;
      } else {
        throw new Error(JSON.stringify(res));
      }
    } catch (error: any) {
      throw new Error(error.response ? error.response.body : error);
    }
  }

  private async iGot() {
    const { igotPushKey } = this.params;
    const url = `https://push.hellyw.com/${igotPushKey.toLowerCase()}`;
    try {
      const res: any = await got
        .post(url, {
          ...this.gotOption,
          body: `title=${this.title}&content=${this.content}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
        .json();

      if (res.ret === 0) {
        return true;
      } else {
        throw new Error(JSON.stringify(res));
      }
    } catch (error: any) {
      throw new Error(error.response ? error.response.body : error);
    }
  }

  private async pushPlus() {
    const { pushPlusToken, pushPlusUser } = this.params;
    const url = `https://www.pushplus.plus/send`;
    try {
      const res: any = await got
        .post(url, {
          ...this.gotOption,
          json: {
            token: `${pushPlusToken}`,
            title: `${this.title}`,
            content: `${this.content.replace(/[\n\r]/g, '<br>')}`,
            topic: `${pushPlusUser || ''}`,
          },
        })
        .json();

      if (res.code === 200) {
        return true;
      } else {
        throw new Error(JSON.stringify(res));
      }
    } catch (error: any) {
      throw new Error(error.response ? error.response.body : error);
    }
  }

  private async wePlusBot() {
    const { wePlusBotToken, wePlusBotReceiver, wePlusBotVersion } = this.params;

    let content = this.content;
    let template = 'txt';
    if (this.content.length > 800) {
      template = 'html';
      content = content.replace(/[\n\r]/g, '<br>');
    }

    const url = `https://www.weplusbot.com/send`;
    try {
      const res: any = await got
        .post(url, {
          ...this.gotOption,
          json: {
            token: `${wePlusBotToken}`,
            title: `${this.title}`,
            template: `${template}`,
            content: `${content}`,
            receiver: `${wePlusBotReceiver || ''}`,
            version: `${wePlusBotVersion || 'pro'}`,
          },
        })
        .json();

      if (res.code === 200) {
        return true;
      } else {
        throw new Error(JSON.stringify(res));
      }
    } catch (error: any) {
      throw new Error(error.response ? error.response.body : error);
    }
  }

  private async lark() {
    let { fskey } = this.params;

    if (!fskey.startsWith('http')) {
      fskey = `https://open.feishu.cn/open-apis/bot/v2/hook/${fskey}`;
    }

    try {
      const res: any = await got
        .post(fskey, {
          ...this.gotOption,
          json: {
            msg_type: 'text',
            content: { text: `${this.title}\n\n${this.content}` },
          },
          headers: { 'Content-Type': 'application/json' },
        })
        .json();
      if (res.StatusCode === 0 || res.code === 0) {
        return true;
      } else {
        throw new Error(JSON.stringify(res));
      }
    } catch (error: any) {
      throw new Error(error.response ? error.response.body : error);
    }
  }

  private async email() {
    const { smtpPassword, smtpService, smtpName } = this.params;

    try {
      const transporter = nodemailer.createTransport({
        service: smtpService,
        auth: {
          user: smtpName,
          pass: smtpPassword,
        },
      });

      const info = await transporter.sendMail({
        from: `"青龙快讯" <${smtpName}>`,
        to: `${smtpName}`,
        subject: `${this.title}`,
        html: `${this.content.replace(/\n/g, '<br/>')}`,
      });

      transporter.close();

      if (info.messageId) {
        return true;
      } else {
        throw new Error(JSON.stringify(info));
      }
    } catch (error: any) {
      throw error;
    }
  }

  private async pushMe() {
    const { pushmeKey, pushmeUrl } = this.params;
    try {
      const res: any = await got.post(pushmeUrl || 'https://push.i-i.me/', {
        ...this.gotOption,
        json: {
          push_key: pushmeKey,
          title: this.title,
          content: this.content,
        },
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.body === 'success') {
        return true;
      } else {
        throw new Error(res.body);
      }
    } catch (error: any) {
      throw new Error(error.response ? error.response.body : error);
    }
  }

  private async chronocat() {
    const { chronocatURL, chronocatQQ, chronocatToken } = this.params;
    try {
      const user_ids = chronocatQQ
        .match(/user_id=(\d+)/g)
        ?.map((match: any) => match.split('=')[1]);
      const group_ids = chronocatQQ
        .match(/group_id=(\d+)/g)
        ?.map((match: any) => match.split('=')[1]);

      const url = `${chronocatURL}/api/message/send`;
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${chronocatToken}`,
      };

      for (const [chat_type, ids] of [
        [1, user_ids],
        [2, group_ids],
      ]) {
        if (!ids) {
          continue;
        }
        let _ids: any = ids;
        for (const chat_id of _ids) {
          const data = {
            peer: {
              chatType: chat_type,
              peerUin: chat_id,
            },
            elements: [
              {
                elementType: 1,
                textElement: {
                  content: `${this.title}\n\n${this.content}`,
                },
              },
            ],
          };
          const res: any = await got.post(url, {
            ...this.gotOption,
            json: data,
            headers,
          });
          if (res.statusCode === 200) {
            return true;
          } else {
            throw new Error(res.body);
          }
        }
      }
      return false;
    } catch (error: any) {
      throw new Error(error.response ? error.response.body : error);
    }
  }

  private async webhook() {
    const {
      webhookUrl,
      webhookBody,
      webhookHeaders,
      webhookMethod,
      webhookContentType,
    } = this.params;

    if (!webhookUrl.includes('$title') && !webhookBody.includes('$title')) {
      throw new Error('Url 或者 Body 中必须包含 $title');
    }

    const headers = parseHeaders(webhookHeaders);
    const body = parseBody(webhookBody, webhookContentType, (v) =>
      v?.replaceAll('$title', this.title)?.replaceAll('$content', this.content),
    );
    const bodyParam = this.formatBody(webhookContentType, body);
    const options = {
      method: webhookMethod,
      headers,
      ...this.gotOption,
      allowGetBody: true,
      ...bodyParam,
    };
    try {
      const formatUrl = webhookUrl
        ?.replaceAll('$title', encodeURIComponent(this.title))
        ?.replaceAll('$content', encodeURIComponent(this.content));
      const res = await got(formatUrl, options);
      if (String(res.statusCode).startsWith('20')) {
        return true;
      } else {
        throw new Error(JSON.stringify(res));
      }
    } catch (error: any) {
      throw new Error(error.response ? error.response.body : error);
    }
  }

  private formatBody(contentType: string, body: any): object {
    if (!body) return {};
    switch (contentType) {
      case 'application/json':
        return { json: body };
      case 'multipart/form-data':
        return { form: body };
      case 'application/x-www-form-urlencoded':
      case 'text/plain':
        return { body };
    }
    return {};
  }
}
