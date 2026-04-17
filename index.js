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

// 📂 load zapisanych invite
if (fs.existsSync('./invites.json')) {
  inviteCounts = JSON.parse(fs.readFileSync('./invites.json'));
}

// 🔥 READY + rejestracja komendy
client.on('clientReady', async () => {
  console.log(`Zalogowano jako ${client.user.tag}`);

  // 📌 rejestracja komendy globalnej
  await client.application.commands.create({
    name: 'invites',
    description: 'Sprawdź ile masz zaproszeń',
    options: [
      {
        name: 'user',
        description: 'Użytkownik',
        type: 6, // USER
        required: false
      }
    ]
  });

  console.log("Komenda /invites zarejestrowana");

  // cache invite
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const guildInvites = await guild.invites.fetch();
      invites[guildId] = guildInvites;
    } catch {}
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

  await new Promise(res => setTimeout(res, 1000));

  const newInvites = await guild.invites.fetch();
  const oldInvites = invites[guild.id];

  if (!oldInvites) {
    invites[guild.id] = newInvites;
    return;
  }

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

  invites[guild.id] = newInvites;

  if (!usedInvite || !usedInvite.inviter) {
    console.log("Nie znaleziono invite");
    return;
  }

  const inviter = usedInvite.inviter;

  if (!inviteCounts[inviter.id]) inviteCounts[inviter.id] = 0;
  inviteCounts[inviter.id]++;

  console.log(`${inviter.tag} ma ${inviteCounts[inviter.id]} invite`);

  fs.writeFileSync('./invites.json', JSON.stringify(inviteCounts, null, 2));

  // 🎯 RANGA
  try {
    const inviterMember = await guild.members.fetch(inviter.id);

    if (inviteCounts[inviter.id] === 5) {
      const role = guild.roles.cache.find(r => r.name === "Promotor");
      if (role) inviterMember.roles.add(role);
    }
  } catch {}
});

// 🔥 KOMENDY
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // /invites
  if (interaction.commandName === 'invites') {
    const target = interaction.options.getUser('user') || interaction.user;
    const count = inviteCounts[target.id] || 0;

    return interaction.reply({
      content: `👤 ${target.tag} ma **${count}** zaproszeń`
    });
  }

  // /topinvites
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
