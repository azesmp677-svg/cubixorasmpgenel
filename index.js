require("dotenv").config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Çalınacak Şarkı Listesi (30 adet YouTube linki ekleyebilirsin)
const sarkilar = [
    "https://www.youtube.com/watch?v=5qap5aO4i9A",
    "https://www.youtube.com/watch?v=jfKfPfyJRdk",
    // Diğer şarkı linklerini buraya ekle
];

client.once('ready', () => {
    console.log(`${client.user.tag} aktif ve müzik çalmaya hazır!`);
});

client.on('messageCreate', async message => {
    if (!message.guild || message.author.bot) return;

    if (message.content.trim() === '!basla') {
        const channel = message.member?.voice.channel;
        if (!channel) {
            return message.reply("Önce bir ses kanalına girmelisin!");
        }

        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        connection.subscribe(player);

        let sarkiIndex = 0;

        function sonrakiSarkiyiCal() {
            if (sarkiIndex >= sarkilar.length) {
                sarkiIndex = 0; // Liste bitince baştan başlar (7/24 döngü)
            }

            try {
                const stream = ytdl(sarkilar[sarkiIndex], { filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1 << 25 });
                const resource = createAudioResource(stream);

                player.play(resource);
                message.channel.send(`🎵 Şu an çalınıyor (${sarkiIndex + 1}/${sarkilar.length}): ${sarkilar[sarkiIndex]}`);
            } catch (error) {
                console.error('Şarkı yüklenme hatası:', error);
                sonrakiSarkiyiCal();
            }
            
            sarkiIndex++;
        }

        sonrakiSarkiyiCal();

        player.on(AudioPlayerStatus.Idle, () => {
            sonrakiSarkiyiCal();
        });

        player.on('error', error => {
            console.error('Oynatma hatası:', error);
            sonrakiSarkiyiCal();
        });

        return message.reply("🎶 Müzik sistemi başlatıldı, bot ses kanalında şarkı söylüyor!");
    }
});

// Tokeni .env dosyasından güvenli bir şekilde alır
client.login(process.env.TOKEN);
