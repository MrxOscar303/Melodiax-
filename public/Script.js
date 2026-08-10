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
    element.addEventListener('click', async (e) => {
        makeAllPlay();
        e.target.classList.remove('fa-circle-play');
        e.target.classList.add('fa-circle-pause');
        play.classList.remove('fa-circle-play');
        play.classList.add('fa-circle-pause');

        index = parseInt(e.target.id);
        currentSong = index;

        // Pehle offline (IndexedDB) copy check karo - agar gaana download
        // kiya hua hai to wahi (bina internet) chalao, warna normal network path.
        let src = `Audio/${index}.mp3`;
        if (window.melodiaxOffline && typeof window.melodiaxOffline.getPlayUrl === 'function') {
            try {
                const offlineUrl = await window.melodiaxOffline.getPlayUrl(index);
                if (offlineUrl) src = offlineUrl;
            } catch (err) { /* offline lookup fail - normal network path use karlo */ }
        }
        audio.src = src;
        audio.currentTime = 0;
        audio.play();
        updateNowBar();
        if (typeof window.melodiaxUpdatePlayerDownloadBtn === 'function') window.melodiaxUpdatePlayerDownloadBtn(index, false);
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

const songs = [
    { songName: 'Die For You', songDes: 'VALORANT, Grabbitz', songImage: 'Images/1.jpg', songPath: 'Audio/1.mp3', projector: true, videoPath: 'Videos/11.mp4' },
    { songName: 'La leçon particulière', songDes: 'Francis Lai', songImage: 'Images/2.jpg', songPath: 'Audio/2.mp3' },
    { songName: 'Maand', songDes: 'Bayaan,Hassan Raheem,Rovalio', songImage: 'Images/3.jpg', songPath: 'Audio/3.mp3', projector: true, videoPath: 'Videos/projector2.mp4' },
    { songName: 'Roi - Instrumental Slowed', songDes: 'Mckyyy', songImage: 'Images/4.jpg', songPath: 'Audio/4.mp3' },
    { songName: 'Solitude - Slowed', songDes: 'juno,blindheart', songImage: 'Images/5.jpg', songPath: 'Audio/5.mp3' },
    { songName: 'Ticking Away', songDes: 'VALORANT, Grabbitz', songImage: 'Images/6.jpg', songPath: 'Audio/6.mp3' },
    { songName: 'Chess - Super Slowed', songDes: 'joyful', songImage: 'Images/7.jpg', songPath: 'Audio/7.mp3' },
    { songName: 'Softcore', songDes: 'The Neighbourhood', songImage: 'Images/8.jpg', songPath: 'Audio/8.mp3' },
    { songName: 'Afsanay', songDes: 'Talhan Anjum, Yunus', songImage: 'Images/9.jpg', songPath: 'Audio/9.mp3'},
    { songName: 'Talaash', songDes: 'Danish Roomi', songImage: 'Images/10.jpg', songPath: 'Audio/10.mp3' },
    { songName: 'After Dark Slowed', songDes: 'Mr Kitty x Rain', songImage: 'Images/11.jpg', songPath: 'Audio/11.mp3' },
    { songName: 'Gojo x Starboy', songDes: 'Xenoz', songImage: 'Images/12.jpg', songPath: 'Audio/12.mp3', projector: true, videoPath: 'Videos/4.mp4' },
    { songName: 'Gangman Style Instrumental', songDes: 'PSY', songImage: 'Images/13.jpg', songPath: 'Audio/13.mp3' },
    { songName: 'Gabriela (Male Version)', songDes: 'KATSEYE', songImage: 'Images/14.jpg', songPath: 'Audio/14.mp3' },
    { songName: 'We do not talk anymore', songDes: 'Charlie Puth', songImage: 'Images/15.jpg', songPath: 'Audio/15.mp3' },
    { songName: 'The Lost Soul x Lost Down', songDes: 'NBSPLV', songImage: 'Images/16.jpg', songPath: 'Audio/16.mp3' },
    { songName: 'For A Reason', songDes: 'Karan Aujla', songImage: 'Images/17.jpg', songPath: 'Audio/17.mp3' },
    { songName: 'G.O.A.T', songDes: 'Diljit Dosanjh', songImage: 'Images/18.jpg', songPath: 'Audio/18.mp3' },
    { songName: 'AFSOS', songDes: 'Anuv Jain, AP Dhillon', songImage: 'Images/19.jpg', songPath: 'Audio/19.mp3' },
    { songName: 'Elevated', songDes: 'SHUBH', songImage: 'Images/20.jpg', songPath: 'Audio/20.mp3' },
    { songName: 'Dhundhala', songDes: 'Yashraj, Talwiinder', songImage: 'Images/21.jpg', songPath: 'Audio/21.mp3' },
    { songName: 'Faltu Pyar', songDes: 'Hassan Raheem, Natasaha Noorani', songImage: 'Images/22.jpg', songPath: 'Audio/22.mp3' },
    { songName: 'Wishes', songDes: 'Hassan Raheem, Talwiinder, Umair', songImage: 'Images/23.jpg', songPath: 'Audio/23.mp3' },
    { songName: 'Iraaday', songDes: 'Abdul Hanan, Rovalio', songImage: 'Images/24.jpg', songPath: 'Audio/24.mp3' },
    { songName: 'Sadqay', songDes: 'Ashir Wajaht, Nayel, Nehal Naseem', songImage: 'Images/25.jpg', songPath: 'Audio/25.mp3' },
    { songName: 'Akhiyaan Gulaab', songDes: 'Shahid Kapoor, Kriti Sanon ', songImage: 'Images/26.jpg', songPath: 'Audio/26.mp3' },
    { songName: 'Bikhra', songDes: 'Abdul Hanan', songImage: 'Images/27.jpg', songPath: 'Audio/27.mp3' },
    { songName: 'Smile', songDes: 'Talha Anjum, Umair', songImage: 'Images/28.jpg', songPath: 'Audio/28.mp3' },
    { songName: 'Living Life, In The Night', songDes: 'Cheriimoya', songImage: 'Images/29.jpg', songPath: 'Audio/29.mp3' },
    { songName: 'Fairytale', songDes: 'AlexandeRybakVideo', songImage: 'Images/30.jpg', songPath: 'Audio/30.mp3' },
    { songName: 'Gata Only', songDes: 'FloyyMenor', songImage: 'Images/31.jpg', songPath: 'Audio/31.mp3' },
    { songName: 'Dil Luteya x Mil Gente', songDes: 'CAR REMIX', songImage: 'Images/32.jpg', songPath: 'Audio/32.mp3', projector: true, videoPath: 'Videos/10.mp4' },
    { songName: 'Statement', songDes: 'NEFFEX', songImage: 'Images/33.jpg', songPath: 'Audio/33.mp3' },
    { songName: 'Magenta Riddim x Badnam ', songDes: 'CAR REMIX', songImage: 'Images/34.jpg', songPath: 'Audio/34.mp3'  },
    { songName: 'Kangna Tera Ni', songDes: 'CAR REMIX', songImage: 'Images/35.jpg', songPath: 'Audio/35.mp3' },
    { songName: 'HASEEN', songDes: 'TALWIINDER', songImage: 'Images/36.jpg', songPath: 'Audio/36.mp3' },
    { songName: 'Hymn For The Weekend', songDes: 'Coldplay', songImage: 'Images/37.jpg', songPath: 'Audio/37.mp3' , projector: true, videoPath: 'Videos/2.mp4'},
    { songName: 'Hue Bechain', songDes: 'Yaseer Desai ', songImage: 'Images/38.jpg', songPath: 'Audio/38.mp3' },
    { songName: 'Tu Itni Khoobsurat Hai', songDes: 'Rahat Fateh Ali Khan', songImage: 'Images/39.jpg', songPath: 'Audio/39.mp3' },
    { songName: 'Mere Rashke Qamar x Attention', songDes: 'Jeffery Iqbal', songImage: 'Images/40.jpg', songPath: 'Audio/40.mp3' , projector: true, videoPath: 'Videos/8.mp4' },
    { songName: 'I Will Survive x JJK', songDes: 'Thrax', songImage: 'Images/41.jpg', songPath: 'Audio/41.mp3', projector: true, videoPath: 'Videos/5.mp4' },
    { songName: 'Hotline Bling Instrumental', songDes: 'Billie Eilish', songImage: 'Images/42.jpg', songPath: 'Audio/42.mp3' },
    { songName: 'Golden Brown Best Part Slowed', songDes: 'The Stranglers', songImage: 'Images/43.jpg', songPath: 'Audio/43.mp3', projector: true, videoPath: 'Videos/1.mp4' },
    { songName: 'Taratella Napoletana', songDes: 'Andrea Colombari', songImage: 'Images/44.jpg', songPath: 'Audio/44.mp3' },
    { songName: 'M.', songDes: 'Anil Emre Daldal', songImage: 'Images/45.jpg', songPath: 'Audio/45.mp3' },
    { songName: 'Bloody Mary Instrumental', songDes: 'Lady Gaga', songImage: 'Images/46.jpg', songPath: 'Audio/46.mp3' },
    { songName: 'Metamorphosis - Ultra Slowed', songDes: 'INTERWORLD', songImage: 'Images/47.jpg', songPath: 'Audio/47.mp3'},
    { songName: 'Call Me - Slowed', songDes: 'plenka', songImage: 'Images/48.jpg', songPath: 'Audio/48.mp3' },
    { songName: 'Hikari - Super Slowed', songDes: 'Clovis Reyes', songImage: 'Images/49.jpg', songPath: 'Audio/49.mp3' },
    { songName: 'Babel', songDes: 'Otnicka ', songImage: 'Images/50.jpg', songPath: 'Audio/50.mp3' },
    { songName: 'Where Are You', songDes: 'Otnicka', songImage: 'Images/51.jpg', songPath: 'Audio/51.mp3' },
    { songName: 'STRUCT - Super Slowed', songDes: 'UdieNnx', songImage: 'Images/52.jpg', songPath: 'Audio/52.mp3' },
    { songName: 'U Hurt Me', songDes: 'yourtears', songImage: 'Images/53.jpg', songPath: 'Audio/53.mp3' },
    { songName: 'RAVE', songDes: 'Dxrk', songImage: 'Images/54.jpg', songPath: 'Audio/54.mp3' },
    { songName: 'Sahara', songDes: 'Hensonn', songImage: 'Images/55.jpg', songPath: 'Audio/55.mp3'},
    { songName: 'C418 - Aria Math', songDes: 'NycrypticProject', songImage: 'Images/56.jpg', songPath: 'Audio/56.mp3' },
    { songName: 'Shootout - Slowed Reverb', songDes: 'Izzamuzzic', songImage: 'Images/57.jpg', songPath: 'Audio/57.mp3' },
    { songName: 'love lost ', songDes: 'Talha Anjum, Umair', songImage: 'Images/58.jpg', songPath: 'Audio/58.mp3' , projector: true, videoPath: 'Videos/9.mp4' },
    { songName: 'Bandish', songDes: 'SHAREH, JOKHAY, TALHA ANJUM, YUNUS', songImage: 'Images/59.jpg', songPath: 'Audio/59.mp3' },
    { songName: 'COME THROUGH', songDes: 'Umair, Talha Anjum, Abdullah Maharvi', songImage: 'Images/60.jpg', songPath: 'Audio/60.mp3' },
    { songName: 'FUNK SIGILO - Slowed', songDes: 'h6itam', songImage: 'Images/61.jpg', songPath: 'Audio/61.mp3' },
    { songName: 'The Red Baron', songDes: 'SABATON ', songImage: 'Images/62.jpg', songPath: 'Audio/62.mp3' , projector: true, videoPath: 'Videos/7.mp4' },
    { songName: 'After Dark x Sweater Weather', songDes: 'tashfii', songImage: 'Images/63.jpg', songPath: 'Audio/63.mp3' },
    { songName: 'Enemy x Warriors ', songDes: 'Imagine Dragons', songImage: 'Images/64.jpg', songPath: 'Audio/64.mp3' },
    { songName: 'That Girl', songDes: 'Amrinder Gill', songImage: 'Images/65.jpg', songPath: 'Audio/65.mp3' },
    { songName: 'Pendu', songDes: 'Amrinder Gill, Fateh', songImage: 'Images/66.jpg', songPath: 'Audio/66.mp3' },
    { songName: 'Judge', songDes: 'Amrinder Gill', songImage: 'Images/67.jpg', songPath: 'Audio/67.mp3' },
    { songName: '12 SAAL', songDes: 'BILAL SAEED', songImage: 'Images/68.jpg', songPath: 'Audio/68.mp3'},
    { songName: 'MAJHAIL', songDes: 'AP DHILLON', songImage: 'Images/69.jpg', songPath: 'Audio/69.mp3' },
    { songName: 'TRUMP', songDes: 'Cheema Y, Gur Sidhu', songImage: 'Images/70.jpg', songPath: 'Audio/70.mp3' },
    { songName: 'Amplifier', songDes: 'Imran Khan ', songImage: 'Images/71.jpg', songPath: 'Audio/71.mp3' },
    { songName: 'KAMLEE', songDes: 'SARRB Starboy X', songImage: 'Images/72.jpg', songPath: 'Audio/72.mp3' },
    { songName: 'TUTOR x KUFAR x KNIFE BROWS', songDes: 'Cheema Y', songImage: 'Images/73.jpg', songPath: 'Audio/73.mp3' },
    { songName: 'HIGH ON YOU', songDes: 'Jind Universe', songImage: 'Images/74.jpg', songPath: 'Audio/74.mp3' },
    { songName: 'STFU', songDes: 'AP DHILLON, Shinda Kahlon', songImage: 'Images/75.jpg', songPath: 'Audio/75.mp3' },
    { songName: 'ADHI ADHI RAAT', songDes: 'BILAL SAEED', songImage: 'Images/76.jpg', songPath: 'Audio/76.mp3'},
    { songName: 'GOAT', songDes: 'AP DHILLON, GURINDER GILL', songImage: 'Images/77.jpg', songPath: 'Audio/77.mp3' },
    { songName: 'Supreme', songDes: 'Shubh', songImage: 'Images/78.jpg', songPath: 'Audio/78.mp3' },
    { songName: 'FARAAR ', songDes: 'GURINDER GILL, Shinda Kahlon', songImage: 'Images/79.jpg', songPath: 'Audio/79.mp3' },
    { songName: 'SOFTLY', songDes: 'KARAN AUJLA', songImage: 'Images/80.jpg', songPath: 'Audio/80.mp3' },
    { songName: 'Deewane', songDes: 'Navaan Sandhu', songImage: 'Images/81.jpg', songPath: 'Audio/81.mp3' },
    { songName: 'Pta Chalega', songDes: 'Imran Khan', songImage: 'Images/82.jpg', songPath: 'Audio/82.mp3' },
    { songName: 'Na Ja', songDes: 'Pav Dharia', songImage: 'Images/83.jpg', songPath: 'Audio/83.mp3' },
    { songName: 'Gehra Hua', songDes: 'Ranveer Singh, Sara Arjun', songImage: 'Images/84.jpg', songPath: 'Audio/84.mp3' },
    { songName: 'Untitled #13 x All Quiet On The Western Front', songDes: 'SoliderSmartEditz', songImage: 'Images/85.jpg', songPath: 'Audio/85.mp3', projector: true, videoPath: 'Videos/6.mp4' },
    { songName: 'SILHOUETTE', songDes: 'PASTEL GHOST', songImage: 'Images/86.jpg', songPath: 'Audio/86.mp3'  },
    { songName: 'kletka - slowed', songDes: 'molchat doma', songImage: 'Images/87.jpg', songPath: 'Audio/87.mp3'  },
    { songName: 'la petite fille de la mer', songDes: 'Tiredminds', songImage: 'Images/88.jpg', songPath: 'Audio/88.mp3'},
    { songName: 'Let It Happen - Slowed Reverb', songDes: 'Tame Impala', songImage: 'Images/89.jpg', songPath: 'Audio/89.mp3' },
    { songName: 'The Perfect Girl Retrowave Remix', songDes: 'Mareux', songImage: 'Images/90.jpg', songPath: 'Audio/90.mp3' , projector: true, videoPath: 'Videos/3.mp4' },
    { songName: 'Succesion Theme', songDes: 'Nicholas Britell', songImage: 'Images/91.jpg', songPath: 'Audio/91.mp3', projector: true, videoPath: 'Videos/14.mp4' },
    { songName: 'Happy Nation - Slowed', songDes: 'ace of base', songImage: 'Images/92.jpg', songPath: 'Audio/92.mp3' },
    { songName: 'Nothing At All', songDes: 'Nxdia', songImage: 'Images/93.jpg', songPath: 'Audio/93.mp3' },
    { songName: 'Did I tell u that I miss u', songDes: 'Adore', songImage: 'Images/94.jpg', songPath: 'Audio/94.mp3' },
    { songName: 'Vanished - Slowed', songDes: 'mkl', songImage: 'Images/95.jpg', songPath: 'Audio/95.mp3' },
    { songName: 'Chamber of Reflection', songDes: 'Mac DeMarco', songImage: 'Images/96.jpg', songPath: 'Audio/96.mp3' },
    { songName: 'Humsafar', songDes: 'Qurat-ul-Ain Balouch', songImage: 'Images/97.jpg', songPath: 'Audio/97.mp3' },
    { songName: 'Mann Mayal', songDes: 'Qurat-ul-Ain Balouch', songImage: 'Images/98.jpg', songPath: 'Audio/98.mp3' },
    { songName: 'Pehli Si Muhabbat', songDes: 'Ali Zafar', songImage: 'Images/99.jpg', songPath: 'Audio/99.mp3' },
    { songName: 'Uchiyaan Dewaraan', songDes: 'Bilal Saeed & Momina Mustehsan', songImage: 'Images/100.jpg', songPath: 'Audio/100.mp3' },
    { songName: 'Tum', songDes: 'Murtaza Qizilbash', songImage: 'Images/101.jpg', songPath: 'Audio/101.mp3' },
    { songName: 'Ghalat Fehmi', songDes: 'Asim Azhar', songImage: 'Images/102.jpg', songPath: 'Audio/102.mp3' },
    { songName: 'Gulabi Aankhen', songDes: 'SANAM', songImage: 'Images/103.jpg', songPath: 'Audio/103.mp3' },
    { songName: 'Kya Mujy Pyaar Hai', songDes: 'Vicky Singh', songImage: 'Images/104.jpg', songPath: 'Audio/104.mp3', projector: true, videoPath: 'Videos/12.mp4' },
];

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
}

forward = document.getElementById('forward');
backward = document.getElementById('backward');

forward.addEventListener('click', () => {
    playNextSong();
})

audio.addEventListener('ended', () => {
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
