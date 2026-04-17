const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('Sprawdź ile masz zaproszeń')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Użytkownik')
        .setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;

    let inviteCounts = {};
    if (fs.existsSync('./invites.json')) {
      inviteCounts = JSON.parse(fs.readFileSync('./invites.json'));
    }

    const count = inviteCounts[target.id] || 0;

    await interaction.reply({
      content: `👤 ${target.tag} ma **${count}** zaproszeń`,
      ephemeral: false
    });
  }
};
