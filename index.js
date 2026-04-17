const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites
  ]
});

const token = process.env.TOKEN;

let invites = {};
let inviteCounts = {};

// 📂 load zapisanych invite
if (fs.existsSync('./invites.json')) {
  inviteCounts = JSON.parse(fs.readFileSync('./invites.json'));
}

// 🔥 READY (WAŻNE)
client.on('ready', async () => {
  console.log(`Zalogowano jako ${client.user.tag}`);

  for (const [guildId, guild] of client.guilds.cache) {
    const guildInvites = await guild.invites.fetch();
    invites[guildId] = guildInvites;
  }
});

// 🔥 NOWE INVITE (ważne!)
client.on('inviteCreate', async invite => {
  const guildInvites = await invite.guild.invites.fetch();
  invites[invite.guild.id] = guildInvites;
});

// 🔥 JOIN
client.on('guildMemberAdd', async member => {
  console.log("JOIN:", member.user.tag);

  const guild = member.guild;

  const newInvites = await guild.invites.fetch();
  const oldInvites = invites[guild.id];

  if (!oldInvites) {
  invites[guild.id] = newInvites;
  return;
}

  invites[guild.id] = newInvites;

  let usedInvite = null;

  newInvites.forEach(inv => {
    const oldUses = oldInvites?.get(inv.code)?.uses || 0;
    if (inv.uses > oldUses) {
      usedInvite = inv;
    }
  });

  if (!usedInvite) {
    console.log("Nie znaleziono invite");
    return;
  }

  const inviter = usedInvite.inviter;

  if (!inviteCounts[inviter.id]) inviteCounts[inviter.id] = 0;
  inviteCounts[inviter.id]++;

  console.log(`${inviter.tag} ma ${inviteCounts[inviter.id]} invite`);

  fs.writeFileSync('./invites.json', JSON.stringify(inviteCounts, null, 2));

  // 🎯 RANGA
  const inviterMember = await guild.members.fetch(inviter.id);

  let inviterMember;
try {
  inviterMember = await guild.members.fetch(inviter.id);
} catch {
  return;
}

  if (inviteCounts[inviter.id] === 5) {
    const role = guild.roles.cache.find(r => r.name === "Promotor");
    if (role) inviterMember.roles.add(role);
  }
});

client.login(token);
