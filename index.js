require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  EmbedBuilder,
  ActivityType,
  SlashCommandBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus
} = require("@discordjs/voice");

const dgram = require("dgram");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

const PREFIX = "e!";
const BOT_NAME = "Cubixorasmp Guard";

const MC_IP = "cubixorasmp.play.hosting";
const MC_BEDROCK_PORT = 19132;

const guildSettings = new Map();

function getSettings(guildId) {
  if (!guildSettings.has(guildId)) {
    guildSettings.set(guildId, {
      dcLogChannel: null,
      mcLogChannel: null,
      mcChatChannel: null,
      musicQueue: [
        { title: "Örnek Şarkı 1", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
        { title: "Örnek Şarkı 2", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
        { title: "Örnek Şarkı 3", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" }
      ],
      currentIndex: 0,
      player: null,
      connection: null,
      isPlaying: false
    });
  }
  return guildSettings.get(guildId);
}

function hasStaffPermission(member) {
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.permissions.has(PermissionsBitField.Flags.ModerateMembers) ||
    member.permissions.has(PermissionsBitField.Flags.ManageMessages)
  );
}

function parseDuration(text) {
  if (!text) return null;
  const match = text.toLowerCase().match(/^(\d+)(s|sn|m|dk|h|sa|d|g)$/);
  if (!match) return null;

  const number = Number(match[1]);
  const unit = match[2];
  const map = {
    s: 1000, sn: 1000,
    m: 60 * 1000, dk: 60 * 1000,
    h: 60 * 60 * 1000, sa: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000, g: 24 * 60 * 60 * 1000
  };
  return number * (map[unit] || 1000);
}

async function fetchBedrockPlayers() {
  return new Promise(resolve => {
    const socket = dgram.createSocket("udp4");
    const buffer = Buffer.from([
      0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00
    ]);

    socket.send(buffer, 0, buffer.length, MC_BEDROCK_PORT, MC_IP, err => {
      if (err) {
        socket.close();
        return resolve(null);
      }
    });

    socket.on("message", msg => {
      socket.close();
      try {
        const decoded = msg.toString("utf-8");
        const parts = decoded.split(";");
        if (parts.length >= 5) {
          return resolve(parts[4]);
        }
      } catch {
        return resolve(null);
      }
    });

    setTimeout(() => {
      try { socket.close(); } catch {}
      resolve(null);
    }, 2000);
  });
}

const slashCommands = [
  new SlashCommandBuilder().setName("başlat").setDescription("Botu ses kanalına sokar ve müziği başlatır"),
  new SlashCommandBuilder().setName("panel").setDescription("Gelişmiş müzik kontrol panelini açar"),
  new SlashCommandBuilder().setName("ticket-kur").setDescription("Destek talebi (ticket) sistemini kurar").addChannelOption(opt => opt.setName("kanal").setDescription("Ticket kanalı").addChannelTypes(ChannelType.GuildText).setRequired(true)),
  new SlashCommandBuilder().setName("dc-ceza").setDescription("Discord ceza log kanalını ayarlar").addChannelOption(opt => opt.setName("kanal").setDescription("Log kanalı").addChannelTypes(ChannelType.GuildText).setRequired(true)),
  new SlashCommandBuilder().setName("mc-ceza").setDescription("Minecraft ceza log kanalını ayarlar").addChannelOption(opt => opt.setName("kanal").setDescription("Log kanalı").addChannelTypes(ChannelType.GuildText).setRequired(true)),
  new SlashCommandBuilder().setName("mcsohbet").setDescription("Minecraft oyuncu giriş-çıkış ve sohbet kanalını ayarlar").addChannelOption(opt => opt.setName("kanal").setDescription("Sohbet/Log kanalı").addChannelTypes(ChannelType.GuildText).setRequired(true))
];

client.once("ready", async () => {
  console.log(`${BOT_NAME} aktif!`);
  for (const guild of client.guilds.cache.values()) {
    try {
      await guild.commands.set(slashCommands.map(cmd => cmd.toJSON()));
    } catch (e) {}
  }

  setInterval(async () => {
    const online = await fetchBedrockPlayers();
    const statusText = online !== null ? `MC: ${online} Oyuncu 🟢` : `CubixoraSMP 🌍`;
    client.user.setPresence({
      activities: [{ name: statusText, type: ActivityType.Watching }],
      status: "online"
    });
  }, 30000);
});

// Ortak Müzik Başlatma Fonksiyonu
function startMusicPlayer(guild, member, replyMethod) {
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    return replyMethod("Önce bir ses kanalına girmelisin!", true);
  }

  const settings = getSettings(guild.id);

  try {
    settings.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
    });

    settings.player = createAudioPlayer();
    settings.connection.subscribe(settings.player);

    function playSong() {
      const currentSong = settings.musicQueue[settings.currentIndex];
      const resource = createAudioResource(currentSong.url);
      settings.player.play(resource);
      settings.isPlaying = true;
    }

    playSong();
    replyMethod("🎶 Müzik sistemi başlatıldı ve çalmaya başladı!");

    settings.player.on(AudioPlayerStatus.Idle, () => {
      settings.currentIndex = (settings.currentIndex + 1) % settings.musicQueue.length;
      playSong();
    });
  } catch (e) {
    replyMethod("Müzik başlatılırken hata oluştu.", true);
  }
}

// Mesaj Komutları (Prefix: e!)
client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;
  const content = message.content.trim();
  const settings = getSettings(message.guild.id);

  if (!content.startsWith(PREFIX)) return;
  const args = content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  // e!başlat veya e!basla
  if (command === "başlat" || command === "basla") {
    return startMusicPlayer(message.guild, message.member, (text) => message.reply(text));
  }

  if (command === "mute") {
    if (!hasStaffPermission(message.member)) return message.reply("Bu komut için yetkin yok.");
    const target = message.mentions.members.first();
    const durationText = args[1] || "30m";
    const duration = parseDuration(durationText);
    const reason = args.slice(2).join(" ") || "Sebep belirtilmedi";

    if (!target || !duration) return message.reply("Kullanım: `e!mute @kullanıcı 30m [sebep]`");

    try {
      await target.timeout(duration, reason);
      message.reply(`🔇 ${target} başarıyla susturuldu.`);

      if (settings.dcLogChannel) {
        const logChan = message.guild.channels.cache.get(settings.dcLogChannel);
        if (logChan) {
          const embed = new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle("🔇 Discord Ceza — MUTE")
            .addFields(
              { name: "👤 Cezalandırılan Üye", value: `${target} (${target.user.tag})` },
              { name: "🛡️ Yetkili", value: `${message.author} (${message.author.tag})` },
              { name: "⏰ Mute Süresi", value: durationText },
              { name: "⏳ Kalan Süre (Geri Sayım)", value: durationText },
              { name: "📄 Ceza Sebebi", value: reason }
            )
            .setFooter({ text: `${BOT_NAME} Ceza Takip Sistemi` })
            .setTimestamp();
          logChan.send({ embeds: [embed] });
        }
      }
    } catch {
      message.reply("Bu üyeyi susturamadım.");
    }
  }
});

// Slash Komutları & Buton Etkileşimleri
client.on("interactionCreate", async interaction => {
  if (interaction.isChatInputCommand()) {
    const guild = interaction.guild;
    const member = interaction.member;
    const settings = getSettings(guild.id);

    if (interaction.commandName === "başlat") {
      return startMusicPlayer(guild, member, (text, ephemeral = false) => interaction.reply({ content: text, ephemeral }));
    }

    if (interaction.commandName === "panel") {
      const embed = new EmbedBuilder()
        .setColor(0x1db954)
        .setTitle("🎵 Cubixorasmp Müzik Kontrol Paneli")
        .setDescription("Aşağıdaki düğmeleri kullanarak müziği başlatabilir, durdurabilir, sonraki veya önceki şarkıya geçebilirsin.")
        .addFields({ name: "Şu anki Durum", value: settings.isPlaying ? "Çalıyor 🟢" : "Durduruldu 🔴" })
        .setFooter({ text: `${BOT_NAME} Müzik Sistemi` });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("music_play").setLabel("Başlat").setStyle(ButtonStyle.Success).setEmoji("▶️"),
        new ButtonBuilder().setCustomId("music_stop").setLabel("Durdur").setStyle(ButtonStyle.Danger).setEmoji("⏹️"),
        new ButtonBuilder().setCustomId("music_back").setLabel("Geri").setStyle(ButtonStyle.Secondary).setEmoji("⏮️"),
        new ButtonBuilder().setCustomId("music_next").setLabel("İleri").setStyle(ButtonStyle.Secondary).setEmoji("⏭️")
      );

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    if (!hasStaffPermission(member)) {
      return interaction.reply({ content: "Bu komutu kullanmak için yetkin yok.", ephemeral: true });
    }

    if (interaction.commandName === "ticket-kur") {
      const channel = interaction.options.getChannel("kanal");
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle("🎫 Destek Talebi (Ticket)").setDescription("Destek açmak için aşağıdaki butona tıkla.");
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("create_ticket").setLabel("Destek Talebi Aç").setStyle(ButtonStyle.Primary).setEmoji("🎫"));
      await channel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: `✅ Ticket sistemi ${channel} kanalına kuruldu!`, ephemeral: true });
    }

    if (interaction.commandName === "dc-ceza") {
      settings.dcLogChannel = interaction.options.getChannel("kanal").id;
      return interaction.reply({ content: `✅ Discord log kanalı ayarlandı.`, ephemeral: true });
    }

    if (interaction.commandName === "mc-ceza") {
      settings.mcLogChannel = interaction.options.getChannel("kanal").id;
      return interaction.reply({ content: `✅ Minecraft ceza log kanalı ayarlandı.`, ephemeral: true });
    }

    if (interaction.commandName === "mcsohbet") {
      settings.mcChatChannel = interaction.options.getChannel("kanal").id;
      return interaction.reply({ content: `✅ /mcsohbet kanalı ayarlandı.`, ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    const guild = interaction.guild;
    const settings = getSettings(guild.id);

    if (interaction.customId === "music_play") {
      if (settings.player) {
        settings.player.unpause();
        settings.isPlaying = true;
        return interaction.reply({ content: "▶️ Müzik devam ettiriliyor.", ephemeral: true });
      }
      return interaction.reply({ content: "Önce sese girip müzik başlatmalısın!", ephemeral: true });
    }

    if (interaction.customId === "music_stop") {
      if (settings.player) {
        settings.player.pause();
        settings.isPlaying = false;
        return interaction.reply({ content: "⏹️ Müzik durduruldu.", ephemeral: true });
      }
    }

    if (interaction.customId === "music_next") {
      settings.currentIndex = (settings.currentIndex + 1) % settings.musicQueue.length;
      return interaction.reply({ content: "⏭️ Sonraki şarkıya geçildi.", ephemeral: true });
    }

    if (interaction.customId === "music_back") {
      settings.currentIndex = (settings.currentIndex - 1 + settings.musicQueue.length) % settings.musicQueue.length;
      return interaction.reply({ content: "⏮️ Önceki şarkıya dönüldü.", ephemeral: true });
    }

    if (interaction.customId === "create_ticket") {
      await interaction.deferReply({ ephemeral: true });
      const ticketChannel = await guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("close_ticket").setLabel("Talebi Kapat").setStyle(ButtonStyle.Danger).setEmoji("🔒")
      );
      await ticketChannel.send({ content: `${interaction.user}`, components: [row] });
      return interaction.editReply({ content: `✅ Destek odan açıldı: ${ticketChannel}` });
    }

    if (interaction.customId === "close_ticket") {
      await interaction.reply({ content: "🔒 Talep kapatılıyor..." });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }
  }
});

const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Cubixorasmp Guard Mega Bot Aktif!"));
app.listen(PORT, () => console.log(`Web sunucusu ${PORT} portunda çalışıyor.`));

client.login(process.env.TOKEN);
