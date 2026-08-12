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
let currentSong = 1;

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

        // Mobile browsers (khaas kar iOS Safari) audio.play() ko sirf tab
        // allow karte hain jab wo click ke andar turant/synchronously call
        // ho - koi "await" beech mein aa jaye to "user gesture" ka permission
        // toot jata hai aur play() silently block ho jata hai. Isliye yahan
        // pehle turant normal (network) src se play karo.
        audio.src = `Audio/${index}.mp3`;
        audio.currentTime = 0;
        audio.play().catch(err => console.warn('Play blocked:', err));
        updateNowBar();
        if (typeof window.melodiaxUpdatePlayerDownloadBtn === 'function') window.melodiaxUpdatePlayerDownloadBtn(index, false);

        // Offline (IndexedDB) copy check baad mein (async) karo - agar mil
        // jaye to usi gaane par silently switch kar do. Ye ab user-gesture
        // ki zaroorat ke bagair chalta hai kyunki audio pehle se play ho
        // chuka hota hai.
        if (window.melodiaxOffline && typeof window.melodiaxOffline.getPlayUrl === 'function') {
            const clickedIndex = index;
            window.melodiaxOffline.getPlayUrl(clickedIndex).then((offlineUrl) => {
                if (offlineUrl && currentSong === clickedIndex) {
                    const resumeAt = audio.currentTime;
                    audio.src = offlineUrl;
                    audio.currentTime = resumeAt;
                    audio.play().catch(() => {});
                }
            }).catch(() => { /* offline lookup fail - network path already chal raha hai */ });
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


playNextSong = () => {
    if (!songOnRepeat) {

        let nextSong = (currentSong + 1) % playMusic.length;
        currentSong = nextSong == 0 ? 104 : nextSong;
        audio.src = order[currentSong - 1].songPath;
        audio.currentTime = 0;
        audio.play();
        updateNowBar();
    } else {
        audio.src = order[currentSong - 1].songPath;
        audio.currentTime = 0;
        audio.play();
        updateNowBar();
    }
}


playPrevSong = () => {
    let prevSong = (currentSong - 1);
    currentSong = prevSong == 0 ? 104 : prevSong;
    audio.src = `Audio/${currentSong}.mp3`
    audio.currentTime = 0;
    audio.play();
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
//
// iOS (Safari aur Chrome, dono WebKit use karte hain) me ek known bug hai -
// naya gaana bajne par metadata turant set karne se Control Center/lock-screen
// widget purani metadata (pichla gaana) dikhata reh jata hai. Fix: pehle
// purani metadata ko null karo taake iOS "clean slate" se refresh kare, phir
// asal audio actually chalna start hone ("playing" event) ke baad naya
// metadata set karo - turant play() call ke baad set karne se race lagti hai.
let pendingSessionData = null;

function setMediaSessionMetadata(data) {
    if (!('mediaSession' in navigator) || !data) return;
    pendingSessionData = data;
    navigator.mediaSession.metadata = null; // purani (stuck) metadata clear
    applySessionMetadata();
}

function applySessionMetadata() {
    if (!('mediaSession' in navigator) || !pendingSessionData) return;
    const data = pendingSessionData;
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
    // Hardware/lock-screen/notification controls ko humare asal buttons pe
    // forward kar dete hain, taake behavior (projector sync, icon, wagera)
    // hamesha same rahe - duplicate logic nahi likhni parti.
    navigator.mediaSession.setActionHandler('play', () => play.click());
    navigator.mediaSession.setActionHandler('pause', () => play.click());
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrevSong());
    navigator.mediaSession.setActionHandler('nexttrack', () => playNextSong());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null && audio.duration) {
            audio.currentTime = details.seekTime;
        }
    });

    // Play/pause state ko lock-screen ke sath hamesha sync rakho, chahe
    // audio kahin se bhi (button, hardware control, ended/repeat) chale/ruke.
    audio.addEventListener('play', () => { navigator.mediaSession.playbackState = 'playing'; });
    audio.addEventListener('pause', () => { navigator.mediaSession.playbackState = 'paused'; });

    // Asal fix: audio actually chalna shuru hone par (naye src ke liye) ek
    // baar phir metadata apply karo. Isi waqt iOS Control Center widget ko
    // reliably refresh karta hai - turant play() call ke waqt nahi.
    audio.addEventListener('playing', () => {
        applySessionMetadata();
    });
}

forward = document.getElementById('forward');
backward = document.getElementById('backward');

// NOTE: Gaana khatam hone (ended) ka asal agle-gaane-par-jaana wala logic
// neeche (dusre 'ended' listener) mein hai jo forward.click() simulate karta
// hai. Yahan dobara playNextSong() call karne se ek hi 'ended' event par
// agla gaana DO baar advance ho raha tha (audio.src turant do baar badalta
// tha, jisse pehla play() request interrupt ho jata tha - mobile par yahi
// wajah thi ke agla gaana bhi nahi chalta tha). Isliye ye duplicate call
// hata di gayi hai.

forward.addEventListener('click', () => {
    playNextSong();
})

backward.addEventListener('click', () => {
    playPrevSong();
})

forward.addEventListener('click', () => {
    // Index update hone ke baad
    handleProjector(currentSong); 
});

backward.addEventListener('click', () => {
    // Index update hone ke baad
    handleProjector(currentSong);
});

let volumeBar = document.getElementById('volumeBar');
let volIcon = document.getElementById('vol-icon');

volumeBar.addEventListener('input', (e) => {
    let value = e.target.value;


    audio.volume = value / 100;


    volumeBar.style.background = `linear-gradient(to right, #bdda2c ${value}%, #333 ${value}%)`;


    if (value == 0) {
        volIcon.className = "fa-solid fa-volume-xmark";
    } else if (value < 50) {
        volIcon.className = "fa-solid fa-volume-low";
    } else {
        volIcon.className = "fa-solid fa-volume-high";
    }
});


volIcon.addEventListener('click', () => {
    if (audio.volume > 0) {
        audio.dataset.prevVol = audio.volume;
        audio.volume = 0;
        volumeBar.value = 0;
        volIcon.className = "fa-solid fa-volume-xmark";
    } else {
        let prev = audio.dataset.prevVol || 1;
        audio.volume = prev;
        volumeBar.value = prev * 100;
        volIcon.className = "fa-solid fa-volume-high";
    }

    volumeBar.style.background = `linear-gradient(to right, #610f38 ${volumeBar.value}%, #333 ${volumeBar.value}%)`;
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
        audio.play();
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

// Gaana khatam hone par
audio.addEventListener('ended', () => {
    const mainRightPart = document.querySelector('.main-right-part');

    if (repeat.classList.contains('fa-repeat-1')) {
        // Repeat mode: wahi gaana + wahi video loop ho
        audio.currentTime = 0;
        audio.play();
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
