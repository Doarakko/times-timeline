import dotenv from 'dotenv';
import { App, LogLevel } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const token = process.env.SLACK_BOT_TOKEN;
const channel_id = process.env.SLACK_CHANNEL_ID || '';

const web = new WebClient(token);
const app = new App({
  appToken: process.env.SLACK_APP_TOKEN,
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  logLevel: LogLevel.WARN,
  convoStore: false,
  ignoreSelf: true
});

const prisma = new PrismaClient();

app.event('app_mention', async ({ say }) => {
  say(`Go to <#${channel_id}>!`);
});

app.event('message', async ({ message }) => {
  if (
    // eslint-disable-next-line
    // @ts-ignore message.subtype and message.channel does not exist on type
    message.subtype === 'slackbot_response' ||
    message.subtype === 'bot_message' ||
    message.channel === channel_id
  ) {
    return;
  }

  // eslint-disable-next-line
  // @ts-ignore message.text does not exist on type
  let text: string = message.text;
  text = text.replace(/<@.+>/g, '');
  text = text.replace(/<https?:\/\/[-_.!~*'()a-zA-Z0-9;/?:@&=+$,%#]+>/g, '');
  text = text.replace(/\n/g, ' ');
  if (text.length == 0) {
    return;
  }

  // eslint-disable-next-line
  // @ts-ignore message.user does not exist on type
  const userId = message.user;

  try {
    const user = await prisma.user.findFirst({
      where: {
        slackUserId: { equals: userId }
      }
    });
    let iconImageUrl = user?.iconImageUrl;
    let displayName = user?.displayName;

    if (!user) {
      const usersRes = await web.users.profile.get({ user: userId });
      iconImageUrl = usersRes.profile?.image_original || '';
      displayName = usersRes.profile?.display_name || '';

      await prisma.user.create({
        data: {
          slackUserId: userId,
          iconImageUrl: iconImageUrl,
          displayName: displayName
        }
      });
    }

    const eventTs = message.event_ts;
    const permalinkRes = await web.chat.getPermalink({
      channel: message.channel,
      message_ts: eventTs
    });
    const permalink = permalinkRes.permalink;

    web.chat.postMessage({
      channel: channel_id,
      username: displayName,
      icon_url: iconImageUrl,
      unfurl_links: false,
      unfurl_media: false,
      text: `<${permalink}|${text}>`
    });
  } catch (error) {
    console.dir(error, { depth: null });
  }
});

(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running!');
})();
