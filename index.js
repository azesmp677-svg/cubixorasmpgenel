const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');

// 30 Farklı Şarkı Listesi
const sarkilar = [
    "https://www.youtube.com/watch?v=5qap5aO4i9A",
    "https://www.youtube.com/watch?v=jfKfPfyJRdk",
    // Buraya istediğin diğer YouTube linklerini ekleyebilirsin (toplam 30 adet)
];

// messageCreate içine veya ayrı bir komut olarak ekleyebilirsin:
if (command === "basla" || message.content === "!basla") {
    const channel = message.member?.voice.channel;
    if (!channel) {
        return message.reply("Önce bir ses kanalına girmelisin!");
    }

    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    let sarkiIndex = 0;

    function sonrakiSarkiyiCal() {
        if (sarkiIndex >= sarkilar.length) {
            sarkiIndex = 0; // Liste bittiğinde baştan başlar (7/24 döngü)
        }

        const stream = ytdl(sarkilar[sarkiIndex], { filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1 << 25 });
        const resource = createAudioResource(stream);

        player.play(resource);
        message.channel.send(`🎵 Şu an çalınıyor (${sarkiIndex + 1}/30): ${sarkilar[sarkiIndex]}`);
        
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

    message.reply("🎶 Müzik sistemi başlatıldı, bot ses kanalında şarkı söylüyor!");
}
