let play = document.getElementById('play');
let progressBar = document.getElementById('progressBar');
const projectorVid = document.getElementById('projector-video');
const exitProjectorBtn = document.getElementById('exit-projector-btn');
let projectorExited = false; // Current song ke liye user ne projector video manually OFF ki hui ha ya nahi (toggle)

// Button ke icon ko hamesha projectorExited ke mutabiq minus/plus dikhao
function syncProjectorBtnIcon() {
    if (exitProjectorBtn) exitProjectorBtn.classList.toggle('off', projectorExited);
}
function showProjectorBtn() {
    if (exitProjectorBtn) {
        syncProjectorBtnIcon();
        exitProjectorBtn.classList.add('visible');
    }
}
function hideProjectorBtn() {
    if (exitProjectorBtn) exitProjectorBtn.classList.remove('visible');
}

// Projector video gaane se chhoti ho sakti hai - is liye seedha audio ka
// currentTime na daal kar, video ki apni duration se modulo le lete hain,
// taake gaana khatam hone tak video baar baar loop hoti rahe (sirf sahi
// jagah se dobara shuru hoti hai, freeze/atak nahi jati).
function syncProjectorToTime(refTime) {
    if (!projectorVid || projectorVid.src === "") return;
    const dur = projectorVid.duration;
    if (dur && isFinite(dur) && dur > 0) {
        projectorVid.currentTime = refTime % dur;
    } else {
        projectorVid.currentTime = refTime;
    }
}
let audio = new Audio('Audio/1.mp3');
// iOS (khaas kar purane devices jaise iPhone 7) par background/lock-screen
// playback ko zyada reliable banane ke liye: "auto" preload rakhte hain
// (taake buffered/ready audio element hamesha maujood rahe) aur
// "playsinline" set karte hain - technically video ke liye zaroori hai,
// lekin kuch WebKit versions audio element par bhi isi flag ko background
// session ke liye check karte hain, is liye safe side par daal dete hain.
audio.preload = 'auto';
audio.setAttribute('playsinline', '');
audio.setAttribute('webkit-playsinline', '');
let currentSong = 1;

// Songs aur Podcasts dono SAME <audio> element aur SAME YouTube player use
// karte hain (taake ek waqt me sirf ek hi cheez baje) - is liye jab bhi
// audio khatam ho, error de, ya forward/backward/shuffle/repeat dabaya jaye,
// code ko pata hona chahiye "abhi kaun sa system chal raha hai" - warna gaana
// khatam hone par galti se DUSRE (song) system ka "agla" chal jata hai jab
// asal me ek podcast chal raha tha (ya iske ulta). Ye flag hamesha "song" ya
// "podcast" hota hai; jo bhi actually play karna start kare wahi ise apne
// hisab se set kar deta hai.
window.melodiaxAudioOwner = 'song';

// NOTE: Master play/pause click logic (icon + music + projector video + button)
// ab neechay ek hi jagah "Play/Pause button" section mein consolidate kar diya gaya hai,
// taake video aur "Exit Projector" button hamesha sahi sync mein rahein.

// ---------------- Progress bar fill: SINGLE source of truth ----------------
// Ye ek hi function ab pura progress bar (value + yellow/white fill dono
// themes ke liye) control karta hai - local audio, YouTube songs (admin.js),
// aur manual seek sab isi se guzarte hain. Style.css ka #progressBar sirf
// --p custom property se apna background gradient banata hai, is liye
// kahin bhi inline "style.background" set karne ki zaroorat nahi - isse
// wo purani race condition khatam ho gayi jisme alag-alag jagah se set hone
// wale inline styles ek dusre ko overwrite karke fill "gayab" kar dete the
// (khaas kar theme change ke baad, jab tak page reload na ho).
function setProgressFill(pct) {
    if (isNaN(pct)) pct = 0;
    progressBar.value = pct;
    progressBar.style.setProperty('--p', pct + '%');
}

audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    setProgressFill((audio.currentTime / audio.duration) * 100);

    if (displayCurrent) displayCurrent.innerText = formatTime(audio.currentTime);

    // Projector video ko audio ke sath sync rakho (agar 0.5s se zyada drift ho jaye).
    // Video gaane se chhoti ho sakti hai aur khud loop ho rahi hoti hai, is liye
    // drift bhi uski apni duration se modulo lekar nikalte hain.
    if (projectorVid && projectorVid.src !== "" && !audio.paused) {
        const vidDur = projectorVid.duration;
        const expected = (vidDur && isFinite(vidDur) && vidDur > 0) ? audio.currentTime % vidDur : audio.currentTime;
        if (Math.abs(projectorVid.currentTime - expected) > 0.5) {
            syncProjectorToTime(audio.currentTime);
        }
    }
});

// Music ki progress bar jab move karein
progressBar.addEventListener('input', function () {
    let value = this.value;
    setProgressFill(value);

    // 1. Music ko aage/piche karo (Ye pehle se tha)
    audio.currentTime = (progressBar.value * audio.duration) / 100;

    // 2. FIXED: Video ko bhi music ke sath sync karo
    if (projectorVid && projectorVid.src !== "") {
        syncProjectorToTime(audio.currentTime); // Video wahi pahunch jayegi jahan music hai (loop hote hue)
    }
});


let playMusic = Array.from(document.getElementsByClassName('playMusic'));

makeAllPlay = () => {
    playMusic.forEach((element) => {
        element.classList.remove('fa-circle-pause');
        element.classList.add('fa-circle-play');
    })
}
playMusic.forEach((element) => {
    element.addEventListener('click', (e) => {
        makeAllPlay();
        e.target.classList.remove('fa-circle-play');
        e.target.classList.add('fa-circle-pause');
        play.classList.remove('fa-circle-play');
        play.classList.add('fa-circle-pause');

        index = parseInt(e.target.id);
        currentSong = index;
        window.melodiaxAudioOwner = 'song';

        // Turant (koi `await` se pehle nahi) real source se play karo - iOS
        // Safari/Chrome (WebKit) ek `await` ke baad aane wale audio.play()
        // ko chup-chaap reject kar dete hain (button "pause" dikhata hai
        // lekin kuch bajta nahi), kyunki user-gesture ka context toot jata hai.
        const trackData = order[index - 1] || songs[index - 1];
        const src = trackData ? trackData.songPath : '';
        audio.src = src;
        audio.currentTime = 0;
        audio.play().catch((err) => console.warn('Playback failed:', err));
        updateNowBar();
        if (typeof window.melodiaxUpdatePlayerDownloadBtn === 'function') window.melodiaxUpdatePlayerDownloadBtn(index, false);

        // Offline (IndexedDB) copy mile to baad mein usi audio element par
        // switch kar do (already "unlocked" hai is gesture ki wajah se).
        if (window.melodiaxOffline && typeof window.melodiaxOffline.getPlayUrl === 'function') {
            window.melodiaxOffline.getPlayUrl(index).then((offlineUrl) => {
                if (offlineUrl && currentSong === index) {
                    const resumeTime = audio.currentTime;
                    audio.src = offlineUrl;
                    audio.currentTime = resumeTime;
                    audio.play().catch((err) => console.warn('Playback failed:', err));
                }
            }).catch(() => { /* offline lookup fail - network path already playing */ });
        }
    })
})

playMusic.forEach((element) => {
    element.addEventListener('click', (e) => {
        let id = parseInt(e.target.id);
        handleProjector(id); // Ye pichli video ko khud hi hata dega
        // audio.play() logic...
    });
});



let allMusic = Array.from(document.getElementsByClassName('music-card'))

const songs = [];

order = [...songs];

allMusic.forEach((element, i) => {
    element.getElementsByTagName('img')[0].src = songs[i].songImage;
    element.getElementsByClassName('img-title')[0].innerText = songs[i].songName;
    element.getElementsByClassName('img-description')[0].innerText = songs[i].songDes;
})

let shuffle = document.getElementById('shuffle');
let repeat = document.getElementById('repeat');
let nowBar = document.querySelector('.now-bar');

let songOnShuffle = false;
let songOnRepeat = false;


function shufflesongs(originalOrder) {
    order = [...originalOrder];
    for (i = order.length - 1; i > 0; i--) {
        let j = Math.floor((Math.random) * (i + 1));
        [order[i], order[j]] = [order[j], order[i]]
    }
    return order;
}


shuffle.addEventListener('click', () => {
    if (!songOnShuffle) {
        songOnShuffle = true;
        songOnRepeat = false;
        shuffle.classList.add('active');
        repeat.classList.remove('active');

        order = shufflesongs(songs);

    } else {
        songOnShuffle = false;
        shuffle.classList.remove('active');

        order = songs;
    }
})
repeat.addEventListener('click', () => {
    if (!songOnRepeat) {
        songOnRepeat = true;
        songOnShuffle = false;
        repeat.classList.add('active');
        shuffle.classList.remove('active');
    } else {
        songOnRepeat = false;
        repeat.classList.remove('active');
    }
})

// ---------------- Playback speed (songs + podcasts, dono) ----------------
// Shared <audio> element + shared YouTube player use hote hain, is liye
// yahan set ki hui speed khud-ba-khud dono system (song ho ya podcast) par
// lagu ho jati hai - alag se kahin aur handle karne ki zaroorat nahi.
let currentPlaybackSpeed = 1;
const playbackSpeedBtn = document.getElementById('playback-speed-btn');
const playbackSpeedPanel = document.getElementById('playback-speed-panel');
const playbackSpeedSlider = document.getElementById('playback-speed-slider');
const playbackSpeedValueText = document.getElementById('playback-speed-value-text');
const playbackSpeedPresets = document.querySelectorAll('.playback-speed-preset');

function formatSpeedLabel(speed) {
    // Trailing zeros hata dete hain: 1 -> "1x", 1.5 -> "1.5x", 1.25 -> "1.25x"
    return (Math.round(speed * 100) / 100) + 'x';
}

function applyPlaybackSpeed(speed) {
    speed = Math.min(3, Math.max(0.25, speed));
    currentPlaybackSpeed = speed;
    audio.playbackRate = speed;
    if (typeof projectorVid !== 'undefined' && projectorVid) projectorVid.playbackRate = speed;
    // ytPlayer admin.js me define hota hai (Script.js ke baad load hoti hai) -
    // lekin ye function hamesha click/interaction ke waqt hi chalta hai (parse
    // waqt nahi), is liye tab tak ytPlayer maujood ho chuki hoti hai.
    if (typeof ytPlayer !== 'undefined' && ytPlayer && ytPlayer.setPlaybackRate) {
        try { ytPlayer.setPlaybackRate(speed); } catch (err) { /* player abhi ready na ho to ignore */ }
    }
    if (playbackSpeedValueText) playbackSpeedValueText.textContent = formatSpeedLabel(speed);
    if (playbackSpeedSlider) {
        playbackSpeedSlider.value = speed;
        // Bar ki fill (--p) ko slider ki min/max ke hisaab se update karte
        // hain, taake sirf accent-color wali default bar ki jagah ek
        // proper filled/custom-styled bar dikhe.
        const min = parseFloat(playbackSpeedSlider.min) || 0.25;
        const max = parseFloat(playbackSpeedSlider.max) || 3;
        const pct = ((speed - min) / (max - min)) * 100;
        playbackSpeedSlider.style.setProperty('--p', pct + '%');
    }
    if (playbackSpeedBtn) playbackSpeedBtn.classList.toggle('active', speed !== 1);
    playbackSpeedPresets.forEach((btn) => {
        btn.classList.toggle('active', Math.abs(parseFloat(btn.dataset.speed) - speed) < 0.001);
    });
}
window.melodiaxApplyPlaybackSpeed = applyPlaybackSpeed;
window.melodiaxGetPlaybackSpeed = () => currentPlaybackSpeed;

if (playbackSpeedBtn && playbackSpeedPanel) {
    playbackSpeedBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = playbackSpeedPanel.classList.toggle('open');
        if (isOpen) {
            // Pehla click: panel "on" - khul jata hai taake user speed chun sake.
        } else {
            // Dusra click (isi button pe): panel "off" ho jata hai AND
            // speed wapas default 1x par reset ho jati hai.
            applyPlaybackSpeed(1);
        }
    });
    playbackSpeedPanel.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => playbackSpeedPanel.classList.remove('open'));
}
if (playbackSpeedSlider) {
    playbackSpeedSlider.addEventListener('input', (e) => applyPlaybackSpeed(parseFloat(e.target.value)));
}
playbackSpeedPresets.forEach((btn) => {
    btn.addEventListener('click', () => applyPlaybackSpeed(parseFloat(btn.dataset.speed)));
});


playNextSong = () => {
    if (!songOnRepeat) {

        let nextSong = (currentSong + 1) % playMusic.length;
        currentSong = nextSong == 0 ? 104 : nextSong;
        audio.src = order[currentSong - 1].songPath;
        audio.currentTime = 0;
        audio.play().catch((err) => console.warn('Playback failed:', err));
        updateNowBar();
    } else {
        audio.src = order[currentSong - 1].songPath;
        audio.currentTime = 0;
        audio.play().catch((err) => console.warn('Playback failed:', err));
        updateNowBar();
    }
}


playPrevSong = () => {
    let prevSong = (currentSong - 1);
    currentSong = prevSong == 0 ? 104 : prevSong;
    audio.src = `Audio/${currentSong}.mp3`
    audio.currentTime = 0;
    audio.play().catch((err) => console.warn('Playback failed:', err));
    updateNowBar();
}

// `songData` optional hai - agar diya gaya ho (jaise offline.js kisi
// downloaded gaane ke liye) to usi ka image/title/desc dikhao, warna purana
// waisa hi `order[currentSong - 1]` se le lo. Ye zaroori hai un cases ke liye
// jahan gaana `order`/`songs` array me maujood hi nahi hota (offline mode me
// downloaded admin/YouTube track) - pehle wahan crash ho kar poora function
// ruk jata tha aur player-bar purane gaane par hi atka reh jata tha.
function updateNowBar(songData) {
    const data = songData || order[currentSong - 1];
    if (!data) return;
    nowBar.getElementsByTagName('img')[0].src = data.songImage;
    nowBar.getElementsByClassName('img-title-info')[0].innerText = data.songName;
    nowBar.getElementsByClassName('img-des-info')[0].innerText = data.songDes;
    setMediaSessionMetadata(data);
}

// ---------------- Media Session (background/lock-screen playback) ----------------
// Mobile browsers audio ko background me / screen sleep hone par bhi bajate
// rehte hain jab tak <audio> tag khud pause na ho - lekin lock-screen/
// notification par gaana ka naam, cover aur play/pause/next/prev controls
// dikhane ke liye Media Session API set karna zaroori hai, warna kai
// devices/browsers thori dair baad audio ko background me rok bhi dete hain.
function setMediaSessionMetadata(data) {
    if (!('mediaSession' in navigator) || !data) return;
    navigator.mediaSession.metadata = new MediaMetadata({
        title: data.songName || 'Melodiax',
        artist: data.songDes || '',
        album: 'Melodiax',
        artwork: data.songImage ? [
            { src: data.songImage, sizes: '96x96', type: 'image/png' },
            { src: data.songImage, sizes: '256x256', type: 'image/png' },
            { src: data.songImage, sizes: '512x512', type: 'image/png' }
        ] : []
    });
}

if ('mediaSession' in navigator) {
    // IMPORTANT: har action ko apne alag try/catch mein register karte hain.
    // Wajah - agar ek hi purani (jaise iPhone 7 ke) Safari version par koi
    // EK action (jaise 'seekto' ya 'stop') support hi na ho, to us par
    // "setActionHandler" khud ek error throw kar deta hai - aur agar sab
    // calls ek hi block mein sequentially likhi hon (jaisa pehle tha), to
    // wo ek error poore block ko wahin rok deta hai, is wajah se uske BAAD
    // wali lines (next/prev/play-state sync waghera) kabhi register hi
    // nahi hoti thin. Yahi wajah thi ke lock-screen/control-center widget
    // dikhta to tha lekin uske buttons kaam nahi karte the. Ab har handler
    // apne aap mein independent hai - ek fail ho to baaki sab phir bhi
    // register ho jate hain.
    const setSafeAction = (action, handler) => {
        try {
            navigator.mediaSession.setActionHandler(action, handler);
        } catch (err) {
            // Ye action is browser/OS version par supported nahi - koi
            // masla nahi, baaki actions par asar nahi padega.
        }
    };

    // Hardware/lock-screen/notification controls ko humare asal buttons pe
    // forward kar dete hain, taake behavior (projector sync, icon, wagera)
    // hamesha same rahe - duplicate logic nahi likhni parti.
    setSafeAction('play', () => {
        if (audio.paused) play.click();
    });
    setSafeAction('pause', () => {
        if (!audio.paused) play.click();
    });
    setSafeAction('stop', () => {
        if (!audio.paused) play.click();
    });
    setSafeAction('previoustrack', () => playPrevSong());
    setSafeAction('nexttrack', () => playNextSong());
    setSafeAction('seekto', (details) => {
        if (details.seekTime != null && audio.duration) {
            if (typeof details.fastSeek === 'boolean' && details.fastSeek && 'fastSeek' in audio) {
                audio.fastSeek(details.seekTime);
            } else {
                audio.currentTime = details.seekTime;
            }
            setProgressFill((details.seekTime / audio.duration) * 100);
        }
    });

    // Play/pause state ko lock-screen ke sath hamesha sync rakho, chahe
    // audio kahin se bhi (button, hardware control, ended/repeat) chale/ruke.
    // Warna OS ka widget kabhi "playing" par atka reh jata ya reverse.
    audio.addEventListener('play', () => { navigator.mediaSession.playbackState = 'playing'; });
    audio.addEventListener('pause', () => { navigator.mediaSession.playbackState = 'paused'; });

    // setPositionState: lock-screen/control-center scrubber ko batata hai
    // gaana kitna lamba hai aur abhi kahan par hai - iske bina wo widget ka
    // progress bar hamesha stuck/0 dikhta hai aur scrub karna bhi kaam nahi
    // karta (yahi "widget dikhta hai lekin work nahi karta" ka doosra bada
    // sabab hai). Purane duration/negative/NaN values par error na aaye is
    // liye har baar guard lagate hain.
    if ('setPositionState' in navigator.mediaSession) {
        audio.addEventListener('timeupdate', () => {
            if (!isFinite(audio.duration) || audio.duration <= 0) return;
            try {
                navigator.mediaSession.setPositionState({
                    duration: audio.duration,
                    playbackRate: audio.playbackRate || 1,
                    position: Math.min(audio.currentTime, audio.duration)
                });
            } catch (err) { /* duration/position abhi valid nahi - ignore */ }
        });
        audio.addEventListener('loadedmetadata', () => {
            if (!isFinite(audio.duration) || audio.duration <= 0) return;
            try {
                navigator.mediaSession.setPositionState({
                    duration: audio.duration,
                    playbackRate: audio.playbackRate || 1,
                    position: 0
                });
            } catch (err) { /* ignore */ }
        });
    }
}

forward = document.getElementById('forward');
backward = document.getElementById('backward');

forward.addEventListener('click', () => {
    if (window.melodiaxAudioOwner === 'podcast') {
        if (typeof window.melodiaxPlayNextPodcast === 'function') window.melodiaxPlayNextPodcast();
        return;
    }
    playNextSong();
})

backward.addEventListener('click', () => {
    if (window.melodiaxAudioOwner === 'podcast') {
        if (typeof window.melodiaxPlayPrevPodcast === 'function') window.melodiaxPlayPrevPodcast();
        return;
    }
    playPrevSong();
})

forward.addEventListener('click', () => {
    // Index update hone ke baad - sirf song mode me relevant hai (podcasts
    // ka apna projector wo khud playPodcast ke andar handle karte hain).
    if (window.melodiaxAudioOwner === 'podcast') return;
    handleProjector(currentSong);
});

backward.addEventListener('click', () => {
    if (window.melodiaxAudioOwner === 'podcast') return;
    handleProjector(currentSong);
});

let volumeBar = document.getElementById('volumeBar');
let volIcon = document.getElementById('vol-icon');

// Original bar color hamesha yahi rahega - chahe user isse drag kare ya
// sirf icon par click karke mute/unmute kare, dono jagah SAME color use
// hota hai (pehle mute-click wale case mein ek alag maroon color
// (#610f38) hardcoded tha, is wajah se mute karne ke baad bar ka color
// badal jata tha - ab dono jagah se ye ek hi constant use hoti hai).
const VOLUME_FILL_COLOR = '#bdda2c';

function paintVolumeBar(value) {
    volumeBar.style.background = `linear-gradient(to right, ${VOLUME_FILL_COLOR} ${value}%, #333 ${value}%)`;
}

// iOS (Safari/Chrome, sab WebKit hain) par "audio.volume" JS se set hi nahi
// ho sakta - ye Apple ki permanent, official restriction hai (volume hamesha
// device ke hardware buttons ke control mein rehta hai). Pehle is wajah se
// pura slider hi disable/dim kar diya jata tha - ab aisa nahi karte: slider
// desktop jaisa hi active/draggable rehta hai (mobile/iOS dono par), bas
// iOS par "volume level" ki jagah ye slider "mute <-> unmute" ka kaam karta
// hai (0 tak le jao to mute, wapas upar le jao to unmute) - jo ".muted" ke
// zariye iOS par bhi guaranteed kaam karta hai.
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS Safari

volumeBar.addEventListener('input', (e) => {
    let value = e.target.value;

    if (isIOS) {
        // Real volume level set nahi ho sakta - is liye slider ko sirf
        // mute-threshold ki tarah use karte hain, taake drag karna "kuch
        // na kuch" zaroor kare (sirf cosmetic na rahe).
        audio.muted = (value == 0);
    } else {
        audio.volume = value / 100;
    }

    paintVolumeBar(value);

    if (value == 0) {
        volIcon.className = "fa-solid fa-volume-xmark";
    } else if (value < 50) {
        volIcon.className = "fa-solid fa-volume-low";
    } else {
        volIcon.className = "fa-solid fa-volume-high";
    }
});


volIcon.addEventListener('click', () => {
    if (isIOS) {
        // ".volume" ki tarah 0/prev set karne ki bajaye ".muted" toggle karte
        // hain - ye iOS par bhi guaranteed kaam karta hai. Slider ko bhi
        // (visually) usi ke mutabiq sync kar dete hain.
        audio.muted = !audio.muted;
        volIcon.className = audio.muted ? "fa-solid fa-volume-xmark" : "fa-solid fa-volume-high";
        volumeBar.value = audio.muted ? 0 : (volumeBar.dataset.prevVal || 100);
        paintVolumeBar(volumeBar.value);
        return;
    }
    if (audio.volume > 0) {
        audio.dataset.prevVol = audio.volume;
        audio.volume = 0;
        volumeBar.dataset.prevVal = volumeBar.value;
        volumeBar.value = 0;
        volIcon.className = "fa-solid fa-volume-xmark";
    } else {
        let prev = audio.dataset.prevVol || 1;
        audio.volume = prev;
        volumeBar.value = prev * 100;
        volIcon.className = "fa-solid fa-volume-high";
    }

    paintVolumeBar(volumeBar.value);
});

const displayCurrent = document.getElementById('track-current');
const displayTotal = document.getElementById('track-total');


function formatTime(time) {
    if (isNaN(time)) return "0:00";
    let min = Math.floor(time / 60);
    let sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

audio.addEventListener('loadedmetadata', () => {
    displayTotal.innerText = formatTime(audio.duration);
});


const themeBtn = document.getElementById('theme-toggle');

// Theme-aware favicon: swaps every favicon <link> between the green (default)
// set and the red-theme set so the browser tab icon always matches the M logo.
const FAVICON_MAP = {
    'favicon-ico': { default: 'favicon.ico?v=2', red: 'favicon-red.ico?v=2' },
    'favicon-shortcut': { default: 'favicon.ico?v=2', red: 'favicon-red.ico?v=2' },
    'favicon-16': { default: 'favicon-16x16.png?v=2', red: 'favicon-16x16-red.png?v=2' },
    'favicon-32': { default: 'favicon-32x32.png?v=2', red: 'favicon-32x32-red.png?v=2' },
    'favicon-48': { default: 'favicon-48x48.png?v=2', red: 'favicon-48x48-red.png?v=2' },
    'favicon-apple': { default: 'apple-touch-icon.png?v=2', red: 'apple-touch-icon-red.png?v=2' },
    'favicon-192': { default: 'android-chrome-192x192.png?v=2', red: 'android-chrome-192x192-red.png?v=2' },
    'favicon-512': { default: 'android-chrome-512x512.png?v=2', red: 'android-chrome-512x512-red.png?v=2' },
};

function applyThemeFavicon(isRed) {
    Object.keys(FAVICON_MAP).forEach((id) => {
        const oldLink = document.getElementById(id);
        if (!oldLink) return;
        const href = isRed ? FAVICON_MAP[id].red : FAVICON_MAP[id].default;
        // Just updating .href leaves Chrome/Edge showing the old cached icon
        // for a while. Removing the <link> and inserting a fresh one forces
        // the browser to reload it immediately.
        const newLink = oldLink.cloneNode(true);
        newLink.href = href;
        oldLink.parentNode.replaceChild(newLink, oldLink);
    });

    // manifest.json (jo Android/desktop "Install App" ke waqt icon uthata
    // hai) ko bhi theme ke mutabiq switch kar dete hain - taake jo bhi
    // theme is waqt active ho, install/"Add to Home Screen" usi rang wala
    // logo use kare. (Pehle se installed app ka home-screen icon OS/browser
    // khud cache kar leta hai - wo retroactively nahi badal sakta, ye sirf
    // agli install ke liye hai.)
    const manifestLink = document.getElementById('app-manifest-link');
    if (manifestLink) {
        manifestLink.href = isRed ? 'manifest-red.json' : 'manifest.json';
    }
}

if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      
        document.body.classList.toggle('red-theme');

      
        themeBtn.classList.toggle('active');

  
        if (document.body.classList.contains('red-theme')) {
            themeBtn.classList.replace('fa-moon', 'fa-sun');
        } else {
            themeBtn.classList.replace('fa-sun', 'fa-moon');
        }

        applyThemeFavicon(document.body.classList.contains('red-theme'));
    });
}


const sInput = document.getElementById('search-input');
const sResults = document.getElementById('search-results');

if (sInput && sResults) {
    sInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (query === "") {
            sResults.classList.remove('active');
            return;
        }

        // 'songs' array se match dhoondhna
        const matches = songs.filter(song => 
            song.songName.toLowerCase().includes(query) || 
            song.songDes.toLowerCase().includes(query)
        );

        if (matches.length > 0) {
            sResults.classList.add('active');
            sResults.innerHTML = matches.map(song => {
                // Gaane ka asli index (ID) dhoondhna play karne ke liye
                const songId = songs.findIndex(s => s.songName === song.songName) + 1;
                return `
                    <div class="search-item" onclick="playSongFromSearch('${songId}')">
                        <img src="${song.songImage}" alt="">
                        <div class="search-item-info">
                            <strong>${song.songName}</strong>
                            <span>${song.songDes}</span>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            sResults.classList.remove('active');
        }
    });
}

// Search result se gaana play karne ka function
window.playSongFromSearch = (id) => {
    const playBtn = document.getElementById(id);
    if (playBtn) {
        playBtn.click(); // Aapka purana play function trigger hoga
    }
    sResults.classList.remove('active');
    sInput.value = ""; // Search bar clear
};

// Bahar click karne par slide band ho jaye
document.addEventListener('click', (e) => {
    if (sResults && !sInput.contains(e.target) && !sResults.contains(e.target)) {
        sResults.classList.remove('active');
    }
});


// =========================================================
// PROJECTOR MODE (video background jab specific songs bajen)
// =========================================================

// Naya gaana select hote hi purani projector video hata kar,
// zaroorat parne par nayi video set karo
function handleProjector(id) {
    const projectorContainer = document.getElementById('projector-overlay');
    const projectorVid = document.getElementById('projector-video');
    const mainRightPart = document.querySelector('.main-right-part');

    // Naya gaana chuna gaya ha, is liye pichla manual "exit" reset kardo
    projectorExited = false;

    // Step 1: Pehle purani video ko rok kar gayab karo, songs list wapas dikhao
    projectorVid.pause();
    projectorVid.src = ""; // Source clear karne se pichli video gayab ho jayegi
    projectorContainer.style.display = "none";
    if (mainRightPart) mainRightPart.classList.remove('songs-fade-out');
    hideProjectorBtn();

    // Step 2: Check karo naye gaane ke liye projector chahiye ya nahi
    const songData = songs[id - 1];
    if (songData && songData.projector === true) {
        projectorVid.src = songData.videoPath;
        projectorContainer.style.display = "block";
        projectorVid.load();
        projectorVid.play();

        // Cool animation: songs list gayab, "Exit Projector" button nazar aaye
        if (mainRightPart) {
            mainRightPart.classList.add('songs-fade-out');
        }
        showProjectorBtn();
    }
}

// Play/Pause button: icon, music, projector video, songs list aur exit button - sab sync
play.addEventListener('click', () => {
    const projectorContainer = document.getElementById('projector-overlay');
    const mainRightPart = document.querySelector('.main-right-part');
    const songData = songs[currentSong - 1];

    if (audio.paused || audio.currentTime <= 0) {
        // --- PLAY ---
        audio.play().catch((err) => console.warn('Playback failed:', err));
        play.classList.remove('fa-circle-play');
        play.classList.add('fa-circle-pause');

        if (projectorVid && projectorVid.src !== "" && songData && songData.projector) {
            // Button hamesha dikhao (chahe user ne pehle "off" toggle kiya ho)
            showProjectorBtn();
            if (!projectorExited) {
                projectorVid.play();
                if (mainRightPart) {
                    projectorContainer.style.display = "block";
                    mainRightPart.classList.add('songs-fade-out');
                }
            }
        }
    } else {
        // --- PAUSE ---
        audio.pause();
        play.classList.add('fa-circle-play');
        play.classList.remove('fa-circle-pause');

        // Pause hote hi video freeze aur songs list wapas dikhado
        if (projectorVid) {
            projectorVid.pause();
            if (mainRightPart) {
                mainRightPart.classList.remove('songs-fade-out');
            }
            hideProjectorBtn();
        }
    }
});

// Gaana/Podcast (local mp3/mp4) khatam hone par
audio.addEventListener('ended', () => {
    if (window.melodiaxAudioOwner === 'podcast') {
        // Podcast ka apna repeat/next/stop-if-none logic (podcast.js) -
        // song wale playNextSong/forward ko yahan bilkul touch nahi karte.
        if (typeof window.melodiaxPodcastEnded === 'function') window.melodiaxPodcastEnded();
        return;
    }

    const mainRightPart = document.querySelector('.main-right-part');

    if (repeat.classList.contains('active')) {
        // Repeat mode: wahi gaana + wahi video loop ho
        audio.currentTime = 0;
        audio.play().catch((err) => console.warn('Playback failed:', err));
        if (projectorVid && projectorVid.src !== "" && !projectorExited) {
            projectorVid.currentTime = 0;
            projectorVid.play();
        }
    } else {
        // Agla gaana chalne se pehle list wapas dikhado, button hata do
        if (mainRightPart) {
            mainRightPart.classList.remove('songs-fade-out');
        }
        hideProjectorBtn();
        forward.click(); // handleProjector(currentSong) khud call ho jayega (forward listener mein)
    }
});

// Projector Toggle button: minus (projector ON) <-> plus (projector OFF)
// Button hamesha visible rehta ha - sirf projector video ON/OFF hoti ha
if (exitProjectorBtn) {
    exitProjectorBtn.addEventListener('click', () => {
        const projectorContainer = document.getElementById('projector-overlay');
        const mainRightPart = document.querySelector('.main-right-part');
        const songData = songs[currentSong - 1];
        if (!songData || !songData.projector) return; // Safety: is song ke liye projector hai hi nahi

        // State toggle karo
        projectorExited = !projectorExited;
        syncProjectorBtnIcon(); // icon ko naye state (minus/plus) mein morph karao

        // Har click par cool "flash" animation (dono directions ke liye)
        exitProjectorBtn.classList.remove('burst');
        void exitProjectorBtn.offsetWidth; // reflow - taake animation dubara se (restart) chal sake
        exitProjectorBtn.classList.add('burst');
        exitProjectorBtn.addEventListener('animationend', () => {
            exitProjectorBtn.classList.remove('burst');
        }, { once: true });

        if (projectorExited) {
            // --- Projector OFF: video hide, songs list wapas ---
            projectorVid.pause();
            projectorContainer.style.display = "none";
            if (mainRightPart) mainRightPart.classList.remove('songs-fade-out');
        } else {
            // --- Projector ON: video wapas dikhado, songs list phir fade out ---
            projectorContainer.style.display = "block";
            syncProjectorToTime(audio.currentTime); // Music ke sath sync karo (loop hote hue)
            if (!audio.paused) projectorVid.play();
            if (mainRightPart) mainRightPart.classList.add('songs-fade-out');
        }
    });
}

// ============================================================
// "M" logo par click (ya keyboard se Enter/Space) karne se bhi Home par
// chala jaye - bilkul home-icon jaisa hi behavior (asal home-navigation
// logic playlist.js mein home-icon par wire hai, is liye yahan sirf uska
// click simulate kar dete hain, taake dono jagah ka logic ek hi rahe).
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const logoEl = document.querySelector('.logo');
    if (!logoEl) return;

    function goHome() {
        const homeIcon = document.querySelector('.home-icon');
        if (homeIcon) homeIcon.click();
    }

    logoEl.addEventListener('click', goHome);
    logoEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            goHome();
        }
    });
});
