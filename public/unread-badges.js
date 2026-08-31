// ============================================================
// Messages ka unread badge ("Online" nav tab ke upar chhota red
// number) + browser tab title me combined "(N)" prefix - jahan N
// = unread messages + unread notifications ka total.
//
// notifications.js apna count window.melodiaxNotifUnreadCount me
// rakhta hai aur har update par window.melodiaxUpdateTabTitle()
// call karta hai - ye file wahi function deti hai, aur khud apna
// unread-messages count bhi usi tarha poll + report karti hai.
// Socket.io abhi is app me nahi hai, is liye "real-time" yahan
// halke polling (25s) se milta hai - jaisa notifications.js
// pehle se karta hai.
// ============================================================
(function () {
    const POLL_INTERVAL_MS = 25000;
    const BASE_TITLE = document.title;

    const onlineBtn = document.getElementById('nav-online-btn');
    const onlineBadge = document.getElementById('nav-online-badge');

    window.melodiaxMsgUnreadCount = 0;

    function setOnlineBadge(count) {
        if (!onlineBadge) return;
        if (count > 0) {
            onlineBadge.textContent = count > 99 ? '99+' : String(count);
            onlineBadge.style.display = 'inline-flex';
        } else {
            onlineBadge.style.display = 'none';
        }
    }

    window.melodiaxUpdateTabTitle = function updateTabTitle() {
        const msgCount = window.melodiaxMsgUnreadCount || 0;
        const notifCount = window.melodiaxNotifUnreadCount || 0;
        const total = msgCount + notifCount;
        document.title = total > 0 ? `(${total > 99 ? '99+' : total}) ${BASE_TITLE}` : BASE_TITLE;
    };

    async function pollUnreadMessages() {
        // "Online" tab sirf logged-in users ko dikhta hai - agar wo abhi
        // hidden hai to user login nahi hai, poll karne ki zaroorat nahi.
        if (!onlineBtn || onlineBtn.style.display === 'none') return;
        try {
            const res = await fetch('/api/messages/unread-count', { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            window.melodiaxMsgUnreadCount = data.total || 0;
            window.melodiaxUnreadPerFriend = data.perFriend || {};
            setOnlineBadge(window.melodiaxMsgUnreadCount);
            window.melodiaxUpdateTabTitle();
            // Home sidebar ka "Messages" summary pill (badge + avatar stack)
            // bhi isi poll se refresh hota hai - friends.js ye function deta hai.
            if (typeof window.melodiaxUpdateMessagesSummary === 'function') {
                window.melodiaxUpdateMessagesSummary(window.melodiaxMsgUnreadCount, window.melodiaxUnreadPerFriend);
            }
        } catch (err) {
            // Chup chap ignore - agla poll try kar lega.
        }
    }

    // Chat khulte hi (chat.js message read mark karta hai) badge foran
    // refresh ho jaye, poore 25 second ka wait na karna pade.
    window.melodiaxRefreshUnreadMessages = pollUnreadMessages;

    pollUnreadMessages();
    setInterval(pollUnreadMessages, POLL_INTERVAL_MS);
})();
