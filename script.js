// 1. Favicon Rounded Masking Engine - i broke something idk what
window.addEventListener('DOMContentLoaded', () => {
    const img = new Image();
    img.src = 'image0.jpg';
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 64; canvas.height = 64;
        ctx.beginPath(); ctx.arc(32, 32, 32, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(img, 0, 0, 64, 64);
        document.getElementById('favicon').setAttribute('href', canvas.toDataURL('image/png'));
    };
});

// 2. Synthesized Web Audio API UI Click Engine
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playHoverTick() {
    try {
        initAudio();
        if (!audioCtx || audioCtx.state === 'suspended') return;
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(650, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime); 
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.05); 
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.06);
    } catch (e) {}
}

// OSRS Username Effect Logic
const username = document.getElementById('username');
username.addEventListener('mouseenter', () => {
    username.classList.add('flash2-active', 'wave-active');
});
username.addEventListener('mouseleave', () => {
    username.classList.remove('flash2-active', 'wave-active');
});

// Standard user interaction listeners
window.addEventListener('click', initAudio, { once: true });
window.addEventListener('keydown', initAudio, { once: true });

// Attach listeners across all your links
document.querySelectorAll('.btn').forEach(button => {
    button.addEventListener('mouseenter', playHoverTick);
});
