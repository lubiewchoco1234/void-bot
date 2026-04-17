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

// 🔥 READY
client.on('clientReady', async () => {
  console.log(`Zalogowano jako ${client.user.tag}`);

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const guildInvites = await guild.invites.fetch();
      invites[guildId] = guildInvites;
    } catch (err) {
      console.log("Błąd pobierania invite:", err);
    }
  }
});

// 🔥 NOWE INVITE
client.on('inviteCreate', async invite => {
  const guildInvites = await invite.guild.invites.fetch();
  invites[invite.guild.id] = guildInvites;
});

// 🔥 JOIN
client.on('guildMemberAdd', async member => {
  console.log("JOIN:", member.user.tag);

  const guild = member.guild;

  // ⏳ delay żeby Discord zdążył zaktualizować uses
  await new Promise(res => setTimeout(res, 1000));

  let newInvites;
  try {
    newInvites = await guild.invites.fetch();
  } catch (err) {
    console.log("Błąd fetch invite:", err);
    return;
  }

  const oldInvites = invites[guild.id];

  if (!oldInvites) {
    invites[guild.id] = newInvites;
    console.log("Brak starych invite (restart bota?)");
    return;
  }

  // 🔍 DEBUG
  console.log("---- INVITES ----");
  newInvites.forEach(inv => {
    const oldUses = oldInvites.get(inv.code)?.uses || 0;
    console.log(inv.code, "OLD:", oldUses, "NEW:", inv.uses);
  });

  // 🔍 SZUKANIE INVITE (lepsza metoda)
  let usedInvite = null;
  let maxDiff = 0;

  newInvites.forEach(inv => {
    const oldUses = oldInvites.get(inv.code)?.uses || 0;
    const diff = inv.uses - oldUses;

    if (diff > maxDiff) {
      maxDiff = diff;
      usedInvite = inv;
    }
  });

  // update cache
  invites[guild.id] = newInvites;

  if (!usedInvite) {
    console.log("Nie znaleziono invite");
    return;
  }

  if (!usedInvite.inviter) {
    console.log("Invite bez invitera (vanity?)");
    return;
  }

  const inviter = usedInvite.inviter;

  if (!inviteCounts[inviter.id]) inviteCounts[inviter.id] = 0;
  inviteCounts[inviter.id]++;

  console.log(`${inviter.tag} ma ${inviteCounts[inviter.id]} invite`);

  fs.writeFileSync('./invites.json', JSON.stringify(inviteCounts, null, 2));

  // 🎯 RANGA
  let inviterMember;
  try {
    inviterMember = await guild.members.fetch(inviter.id);
  } catch {
    console.log("Nie można pobrać membera");
    return;
  }

  if (inviteCounts[inviter.id] === 5) {
    const role = guild.roles.cache.find(r => r.name === "Promotor");
    if (role) {
      inviterMember.roles.add(role);
      console.log("Nadano rangę Promotor");
    }
  }
});

client.login(token);
