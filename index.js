// 🌐 mini serwer dla Render (WAŻNE)
require('http').createServer((req, res) => {
  res.write("Bot działa!");
  res.end();
}).listen(process.env.PORT || 3000);

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
let joinedBy = {};

// 📂 load danych
if (fs.existsSync('./data.json')) {
  const data = JSON.parse(fs.readFileSync('./data.json'));
  inviteCounts = data.inviteCounts || {};
  joinedBy = data.joinedBy || {};
}

// 💾 save danych
function saveData() {
  fs.writeFileSync('./data.json', JSON.stringify({
    inviteCounts,
    joinedBy
  }, null, 2));
}

// 🔥 READY
client.on('clientReady', async () => {
  console.log("CACHE INVITES START");

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const guildInvites = await guild.invites.fetch();
      console.log("Zapisano invite:", guildInvites.size);
      invites[guildId] = guildInvites;
    } catch {}
  }

  console.log(`Zalogowano jako ${client.user.tag}`);

  await client.application.commands.set([
    {
      name: 'invites',
      description: 'Sprawdź ile masz zaproszeń',
      options: [
        {
          name: 'user',
          description: 'Użytkownik',
          type: 6,
          required: false
        }
      ]
    },
    {
      name: 'topinvites',
      description: 'Top zaproszeń'
    }
  ]);

  console.log("Komendy zarejestrowane");
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
  const oldInvites = invites[guild.id];

  // ⏳ czekamy aż Discord zaktualizuje uses
  await new Promise(res => setTimeout(res, 5000));

  const newInvites = await guild.invites.fetch();

  await new Promise(res => setTimeout(res, 2000));
  const newerInvites = await guild.invites.fetch();

  invites[guild.id] = newerInvites;

  if (!oldInvites) {
    console.log("Brak starych invite");
    return;
  }

  const usedInvite = newerInvites.find(inv => {
    const oldUses = oldInvites.get(inv.code)?.uses || 0;
    return inv.uses > oldUses;
  });
  
let inviter = null;

if (usedInvite && usedInvite.inviter) {
  inviter = usedInvite.inviter;
} else {
  console.log("Fallback użyty");

  const fallback = newerInvites.first();

  if (fallback && fallback.inviter) {
    inviter = fallback.inviter;
  }
}

if (!inviter) {
  console.log("Nie udało się znaleźć invitera");
  return;
}

  inviter = usedInvite.inviter;

  joinedBy[member.id] = inviter.id;

  if (!inviteCounts[inviter.id]) inviteCounts[inviter.id] = 0;
  inviteCounts[inviter.id]++;
  try {
  const inviterMember = await guild.members.fetch(inviter.id);

  if (inviteCounts[inviter.id] === 5) {
    const role = guild.roles.cache.find(r => r.name === "Promotor");
    if (role) await inviterMember.roles.add(role);
  }
} catch {}

  console.log(`${inviter.tag} +1 invite (${inviteCounts[inviter.id]})`);

  saveData();

  // 🎯 RANGA
  try {
    const inviterMember = await guild.members.fetch(inviter.id);

    if (inviteCounts[inviter.id] === 5) {
      const role = guild.roles.cache.find(r => r.name === "Promotor");
      if (role) inviterMember.roles.add(role);
    }
  } catch {}
});

// 🔥 LEAVE
client.on('guildMemberRemove', member => {
  const inviterId = joinedBy[member.id];

  if (!inviterId) return;

  if (inviteCounts[inviterId]) {
    inviteCounts[inviterId]--;
  }

  delete joinedBy[member.id];
  saveData();
});

// 🔥 KOMENDY
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'invites') {
    const target = interaction.options.getUser('user') || interaction.user;
    const count = inviteCounts[target.id] || 0;

    return interaction.reply(`👤 ${target.tag} ma **${count}** zaproszeń`);
  }

  if (interaction.commandName === 'topinvites') {
    const sorted = Object.entries(inviteCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    let text = "🏆 **Top Invite:**\n";

    for (let i = 0; i < sorted.length; i++) {
      const [userId, count] = sorted[i];
      text += `${i + 1}. <@${userId}> — ${count}\n`;
    }

    return interaction.reply(text || "Brak danych");
  }
});

client.login(token);
