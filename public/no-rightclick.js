// ============================================================
// Right-click (context menu) disable - sirf mouse/desktop devices ke
// liye, jaisa maanga gaya ("mobile ke ilawa jitni bhi devices"). Touch
// devices (phone/tablet) par ye block nahi hota, taake long-press
// wagaira normal kaam karte rahein.
//
// IMPORTANT (honesty note for future maintainers): ye sirf casual
// right-click ko rokta hai. Koi bhi user F12 dabake, browser ke
// top-right menu se "More tools > Developer tools" khol ke, ya
// keyboard shortcut (Ctrl+Shift+I / Cmd+Option+I) se abhi bhi
// DevTools/Inspect Element khol sakta hai - is se poori tarah rokna
// web par mumkin nahi hai. Ye sirf ek halka deterrent hai, asal
// security measure nahi.
// ============================================================
(function () {
    const isTouchDevice = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
        || navigator.maxTouchPoints > 0;
    if (isTouchDevice) return;

    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
})();
