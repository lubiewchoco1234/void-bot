const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const token = process.env.TOKEN;

let invites = {};
let inviteCounts = {};

client.on('ready', async () => {
  console.log(`Zalogowano jako ${client.user.tag}`);

  client.guilds.cache.forEach(async (guild) => {
    const guildInvites = await guild.invites.fetch();
    invites[guild.id] = guildInvites;
  });
});

client.on('guildMemberAdd', async member => {
  const guild = member.guild;
  const newInvites = await guild.invites.fetch();
  const oldInvites = invites[guild.id];

  invites[guild.id] = newInvites;

  let invite = null;

  newInvites.forEach(i => {
    const oldUses = oldInvites.get(i.code)?.uses || 0;
    if (i.uses > oldUses) invite = i;
  });

  if (!invite) return;

  const inviter = invite.inviter;

  if (!inviteCounts[inviter.id]) inviteCounts[inviter.id] = 0;
  inviteCounts[inviter.id]++;

  console.log(`${inviter.tag} ma ${inviteCounts[inviter.id]} invite`);
});

client.login(token);
