// L'oreille de Pandi : pendant le jeu « Chut, Pandi s'endort » (Chambre.js), le micro du téléphone
// mesure seulement si la pièce est calme. Le son n'est ni enregistré ni envoyé : on ne garde qu'un
// nombre, le niveau sonore (en décibels, non calibré), dix fois par seconde, et le micro se ferme à la
// fin du jeu.
// Sur iPhone, ouvrir le micro fait passer le son de l'app en mode « appel » (plus bas) : le jeu ne joue
// aucun son pendant qu'il écoute, et la sortie audio est remise comme avant à la fermeture.
import { audioContext, appSoundUntil } from './sounds.js';

const QUIET_AFTER = 1000; // ms : on n'écoute pas pendant un son de l'app, ni juste après

export const earSupported = () =>
  typeof window !== 'undefined' && (typeof window.__pandiMicro === 'function' || (window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia)));

function session(type) {
  try {
    if (navigator.audioSession) navigator.audioSession.type = type;
  } catch {}
}

// Ouvre le micro. onLevel(dB) dix fois par seconde, ou onLevel(null) quand on n'écoute pas (un son de
// l'app joue, ou le contexte audio est en pause). Renvoie { close } ; échoue si le micro est refusé.
export async function openEar(onLevel, { every = 100 } = {}) {
  // Essais en local : window.__pandiMicro() donne le niveau (dB) à la place du micro
  if (typeof window.__pandiMicro === 'function') {
    const timer = setInterval(() => onLevel(window.__pandiMicro()), every);
    return { close: () => clearInterval(timer) };
  }
  const ac = audioContext();
  if (!ac?.createMediaStreamSource) throw new Error('Pas de WebAudio');
  session('play-and-record');
  let stream;
  try {
    // le son brut : sans réglage automatique du volume, le niveau ne voudrait plus rien dire
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
  } catch (e) {
    session('auto');
    throw e;
  }
  const src = ac.createMediaStreamSource(stream);
  const analyser = ac.createAnalyser();
  analyser.fftSize = 2048;
  // relié à la sortie par un volume nul : certains navigateurs ne calculent que ce qui mène à la sortie
  const mute = ac.createGain();
  mute.gain.value = 0;
  src.connect(analyser);
  analyser.connect(mute);
  mute.connect(ac.destination);
  const buf = new Float32Array(analyser.fftSize);
  const timer = setInterval(() => {
    if (ac.state !== 'running') {
      ac.resume?.().catch(() => {});
      return onLevel(null);
    }
    if (performance.now() < appSoundUntil() + QUIET_AFTER) return onLevel(null);
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    // un micro coupé (téléphone en veille) ne renvoie que des zéros : ce n'est pas du calme mesuré
    onLevel(rms > 1e-6 ? 20 * Math.log10(rms) : null);
  }, every);
  let closed = false;
  return {
    close() {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      try {
        src.disconnect();
        analyser.disconnect();
        mute.disconnect();
      } catch {}
      // la sortie audio revient au haut-parleur, au volume normal
      session('playback');
      setTimeout(() => session('auto'), 300);
    },
  };
}
