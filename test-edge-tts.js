const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

async function test() {
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      'zh-CN-XiaoxiaoNeural',
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
    );
    const { audioStream } = tts.toStream('老朋友，您今天过得怎么样呀？');
    let chunks = [];
    let total = 0;
    await new Promise((resolve, reject) => {
      audioStream.on('data', c => { chunks.push(c); total += c.length; });
      audioStream.on('end', resolve);
      audioStream.on('error', reject);
    });
    console.log('OK - received', total, 'bytes');
    process.exit(0);
  } catch (e) {
    console.error('ERR:', e.message);
    process.exit(1);
  }
}
test();
