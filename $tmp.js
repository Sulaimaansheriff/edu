
/* =========================================================
   1. REVEAL
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const els = document.querySelectorAll(".reveal");

    if (!("IntersectionObserver" in window)) {
        els.forEach(e => e.classList.add("visible"));
        return;
    }

    const io = new IntersectionObserver((entries, obs) => {

        entries.forEach(en => {

            if (!en.isIntersecting) return;

            en.target.classList.add("visible");
            obs.unobserve(en.target);

        });

    }, {
        threshold: 0.12,
        rootMargin: "0px 0px -40px 0px"
    });

    els.forEach(e => io.observe(e));

});


/* =========================================================
   2. CERTIFICATION SCROLLER

   Rules:
   - Works on desktop, tablet and mobile.
   - Every selected year goes to the TOP.
   - Last year ALSO goes to the TOP.
   - Enough bottom room is added so the last heading can actually reach top.
   - The viewport is at least as tall as the last year itself, so all last-year
     cards can be shown.
========================================================= */

(function initCert() {

    const eduCol =
        document.getElementById("eduColumn");

    const certHdr =
        document.getElementById("certHeader");

    const yearNav =
        document.getElementById("yearNav");

    const scrollBox =
        document.getElementById("certScrollBox");

    const scrollUp =
        document.getElementById("certScrollUp");

    const scrollDown =
        document.getElementById("certScrollDown");

    const track =
        document.getElementById("certTrack");

    const yearPrev =
        document.getElementById("yearPrev");

    const yearNext =
        document.getElementById("yearNext");

    const yearNavBox =
        document.getElementById("yearNavYears");

    if (
        !eduCol ||
        !certHdr ||
        !yearNav ||
        !scrollBox ||
        !scrollUp ||
        !scrollDown ||
        !track ||
        !yearPrev ||
        !yearNext ||
        !yearNavBox
    ) {
        return;
    }

    let blocks = [];
    let activeIdx = 0;

    let syncing = false;
    let resizeFrame = 0;
    let certDrag = null;

    function gather() {

        blocks = [];

        track
            .querySelectorAll(".year-block")
            .forEach((b, idx) => {

                const heading =
                    b.querySelector(".year-heading");

                const yearText =
                    heading
                        ? heading.textContent.trim()
                        : `Year ${idx + 1}`;

                blocks.push({
                    el: b,
                    heading,
                    yearText,
                    idx
                });

            });
    }

    function outerHeight(el) {

        if (!el) return 0;

        const rect =
            el.getBoundingClientRect();

        const cs =
            getComputedStyle(el);

        return (
            rect.height +
            (parseFloat(cs.marginTop) || 0) +
            (parseFloat(cs.marginBottom) || 0)
        );
    }

    function offsetInScrollBox(el) {

        const boxRect =
            scrollBox.getBoundingClientRect();

        const elRect =
            el.getBoundingClientRect();

        return (
            elRect.top -
            boxRect.top +
            scrollBox.scrollTop
        );
    }

    /*
       Target the heading itself, not its enclosing year block. This keeps
       every year aligned to the top and makes the final year reachable even
       when its block has a larger margin or different content height.
    */
    function getDestTop(el) {

        const heading =
            el.querySelector(".year-heading");

        if (!heading) return 0;

        return Math.max(
            0,
            offsetInScrollBox(heading) - 8
        );
    }

    function maxScrollTop() {
        return Math.max(
            0,
            scrollBox.scrollHeight -
            scrollBox.clientHeight
        );
    }

    function scrollToTop(dest, selectedIdx) {

        const selected =
            blocks[selectedIdx];

        const heading =
            selected && selected.heading;

        if (!heading) return;

        const target =
            Math.max(
                0,
                Math.min(dest, maxScrollTop())
            );

        scrollBox.scrollTo({
            top: target,
            behavior: "auto"
        });
    }

    /*
       ALL years target their own exact heading position.
    */
    function destinationForYear(idx) {

        const b =
            blocks[idx];

        if (!b) return 0;

        return getDestTop(b.el);
    }

    function scrollToYear(idx) {

        const b =
            blocks[idx];

        if (!b) return;

        /*
           Bottom spacer has already made this destination reachable.
        */
        const dest =
            destinationForYear(idx);

        scrollToTop(dest, idx);
    }

    function buildYearNav() {

        yearNavBox.innerHTML = "";

        blocks.forEach((b, idx) => {

            const btn =
                document.createElement("button");

            btn.type = "button";
            btn.className = "year-pill";
            btn.textContent = b.yearText;

            btn.addEventListener("click", () => {

                setActiveNav(idx);
                scrollToYear(idx);

            });

            yearNavBox.appendChild(btn);

        });
    }

    function setActiveNav(idx) {

        if (!blocks.length) return;

        activeIdx =
            Math.max(
                0,
                Math.min(
                    idx,
                    blocks.length - 1
                )
            );

        const pills =
            yearNavBox.querySelectorAll(
                ".year-pill"
            );

        pills.forEach((p, i) => {

            p.classList.toggle(
                "active",
                i === activeIdx
            );

        });

        yearPrev.disabled =
            activeIdx === 0;

        yearNext.disabled =
            activeIdx === blocks.length - 1;
    }

    function detectActiveYear() {

        if (!blocks.length) return;

        const st =
            scrollBox.scrollTop;

        let idx = 0;

        /*
           Small tolerance means a heading is considered active as it reaches
           the top of the certificate viewport.
        */
        const threshold = 40;

        for (
            let i = 0;
            i < blocks.length;
            i++
        ) {

            const top =
                destinationForYear(i);

            if (
                top <=
                st + threshold
            ) {
                idx = i;
            }
        }

        if (idx !== activeIdx) {
            setActiveNav(idx);
        }
    }

    /*
       Calculate a suitable certificate viewport on every device.

       Desktop:
       Base size follows Education.

       Mobile/tablet:
       Education is in another row, so using its entire huge height would be
       undesirable. Instead we use a viewport-oriented size, while still
       making sure the LAST year can fit completely.

       On ALL devices:
       viewport >= last year height.
    */
    function calculateViewportHeight() {

        const last =
            blocks[
                blocks.length - 1
            ];

        const lastHeight =
            last
                ? Math.ceil(
                    last.el.getBoundingClientRect().height
                ) + 18
                : 250;

        const isStacked =
            window.matchMedia(
                "(max-width: 950px)"
            ).matches;

        let baseHeight;

        if (!isStacked) {

            const eduH =
                eduCol
                    .getBoundingClientRect()
                    .height;

            const reserved =
                outerHeight(certHdr) +
                outerHeight(yearNav);

            baseHeight =
                Math.max(
                    260,
                    eduH - reserved
                );

        } else {

            /*
               Mobile/tablet internal scroll area.
               Keep enough room to comfortably use it, but don't allow it
               to consume an unreasonable part of the page unless the last
               year itself genuinely requires the height.
            */
            const viewportH =
                window.visualViewport
                    ? window.visualViewport.height
                    : window.innerHeight;

            baseHeight =
                Math.max(
                    360,
                    Math.min(
                        680,
                        viewportH * 0.72
                    )
                );
        }

        /*
           User requirement:
           final year is allowed to exceed education height when necessary.
        */
        return Math.max(
            baseHeight,
            lastHeight
        );
    }

    /*
       Critical last-year calculation.

       To put the final heading at the TOP, scrollTop must equal that heading's
       own content offset.

       Normally, there isn't enough content below it to permit that much scroll.
       Therefore add exactly enough bottom padding to make that scroll position
       reachable.

       Since the viewport is >= final block height, its complete contents
       remain visible underneath that heading.
    */
    function applyLastYearBottomSpace() {

        track.style.paddingBottom =
            "8px";

        if (!blocks.length) return;

        const last =
            blocks[
                blocks.length - 1
            ];

        const heading =
            last.heading;

        if (!heading) return;

        const desiredLastTop =
            getDestTop(last.el);

        const currentPadding =
            parseFloat(
                getComputedStyle(track).paddingBottom
            ) || 8;

        const contentHeight =
            Math.max(
                0,
                scrollBox.scrollHeight -
                currentPadding
            );

        const requiredBottomSpace =
            Math.max(
                8,
                desiredLastTop +
                scrollBox.clientHeight -
                contentHeight +
                8
            );

        track.style.paddingBottom =
            requiredBottomSpace + "px";
    }

    function syncSizes() {

        if (syncing) return;

        syncing = true;

        /*
           Reset first so measurements don't include our previous spacer.
        */
        track.style.paddingBottom =
            "8px";

        const boxH =
            calculateViewportHeight();

        scrollBox.style.height =
            Math.ceil(boxH) + "px";

        /*
           Now create just enough bottom room for last year -> top.
        */
        applyLastYearBottomSpace();

        /*
           Preserve legal scroll position after device rotation / browser zoom.
        */
        if (
            scrollBox.scrollTop >
            maxScrollTop()
        ) {
            scrollBox.scrollTop =
                maxScrollTop();
        }

        detectActiveYear();
        updateScrollControls();

        syncing = false;
    }

    function scheduleSync() {

        cancelAnimationFrame(
            resizeFrame
        );

        resizeFrame =
            requestAnimationFrame(() => {
                syncSizes();
            });
    }

    function updateScrollControls() {

        const atTop =
            scrollBox.scrollTop <= 2;

        const atBottom =
            scrollBox.scrollTop +
            scrollBox.clientHeight >=
            scrollBox.scrollHeight - 2;

        scrollUp.disabled = atTop;
        scrollDown.disabled = atBottom;
    }

    function scrollCertificate(direction) {

        scrollBox.scrollBy({
            top: direction *
                Math.max(
                    80,
                    scrollBox.clientHeight * 0.7
                ),
            behavior: "smooth"
        });
    }

    scrollUp.addEventListener(
        "click",
        () => scrollCertificate(-1)
    );

    scrollDown.addEventListener(
        "click",
        () => scrollCertificate(1)
    );

    yearPrev.addEventListener(
        "click",
        () => {

            const nextIdx =
                Math.max(
                    0,
                    activeIdx - 1
                );

            setActiveNav(nextIdx);
            scrollToYear(nextIdx);

        }
    );

    yearNext.addEventListener(
        "click",
        () => {

            const nextIdx =
                Math.min(
                    blocks.length - 1,
                    activeIdx + 1
                );

            setActiveNav(nextIdx);
            scrollToYear(nextIdx);

        }
    );

    scrollBox.addEventListener(
        "scroll",
        () => {
            detectActiveYear();
            updateScrollControls();
        },
        { passive: true }
    );

    /*
       Internal drag gesture for the certificate section.
       It works with mouse, touch, and pen while preserving native
       scrolling for the rest of the page.
    */
    scrollBox.addEventListener(
        "pointerdown",
        (e) => {

            if (e.button !== 0) return;

            const target =
                e.target.closest(
                    "button, a, input, select, textarea"
                );

            if (target) return;

            certDrag = {
                pointerId: e.pointerId,
                x: e.clientX,
                y: e.clientY,
                scrollTop: scrollBox.scrollTop
            };

            scrollBox.setPointerCapture(
                e.pointerId
            );
            scrollBox.classList.add(
                "dragging"
            );
            e.preventDefault();
        }
    );

    scrollBox.addEventListener(
        "pointermove",
        (e) => {

            if (
                !certDrag ||
                certDrag.pointerId !== e.pointerId
            ) {
                return;
            }

            const dx =
                e.clientX - certDrag.x;

            const dy =
                e.clientY - certDrag.y;

            if (
                Math.abs(dy) > 3 &&
                Math.abs(dy) > Math.abs(dx)
            ) {
                scrollBox.scrollTop =
                    certDrag.scrollTop - dy;
            }

            e.preventDefault();
        }
    );

    function endCertDrag(e) {

        if (
            !certDrag ||
            certDrag.pointerId !== e.pointerId
        ) {
            return;
        }

        try {
            scrollBox.releasePointerCapture(
                e.pointerId
            );
        } catch (_) {}

        certDrag = null;
        scrollBox.classList.remove(
            "dragging"
        );
    }

    scrollBox.addEventListener(
        "pointerup",
        endCertDrag
    );

    scrollBox.addEventListener(
        "pointercancel",
        endCertDrag
    );

    /*
       Desktop mouse wheel chaining.
    */
    scrollBox.addEventListener(
        "wheel",
        (e) => {

            const atTop =
                scrollBox.scrollTop <= 0;

            const atBottom =
                scrollBox.scrollTop +
                scrollBox.clientHeight >=
                scrollBox.scrollHeight - 1;

            if (
                (atTop && e.deltaY < 0) ||
                (atBottom && e.deltaY > 0)
            ) {

                e.preventDefault();

                window.scrollBy({
                    top: e.deltaY,
                    left: 0,
                    behavior: "auto"
                });
            }

        },
        { passive: false }
    );

    /*
       Mobile:
       Native touch scrolling is intentionally retained.
       We DO NOT call preventDefault() during touchmove.
       This is more reliable on iOS Safari and Android Chrome.
    */

    gather();
    buildYearNav();
    setActiveNav(0);

    requestAnimationFrame(
        syncSizes
    );

    window.addEventListener(
        "load",
        scheduleSync
    );

    window.addEventListener(
        "resize",
        scheduleSync
    );

    window.addEventListener(
        "orientationchange",
        () => {
            setTimeout(
                scheduleSync,
                100
            );
        }
    );

    if (window.visualViewport) {

        window.visualViewport.addEventListener(
            "resize",
            scheduleSync
        );
    }

    if ("ResizeObserver" in window) {

        const ro =
            new ResizeObserver(() => {
                scheduleSync();
            });

        ro.observe(eduCol);
        ro.observe(track);
        ro.observe(yearNav);
        ro.observe(certHdr);
    }

})();


/* =========================================================
   3. MEDIA VIEWER

   Zoom system:
   100% = fitted/default/minimum
   200% = twice fitted size
   300% = three times fitted size
   ...
   800% maximum

   You can NEVER zoom below fitted/default.

   Thumbnail behavior:
   - Open image -> visible.
   - Zoom IN above 100% -> hidden.
   - Zoom OUT all the way to 100% -> visible.
   - Single click/tap continues to toggle it.
   - Pan does not toggle it.
========================================================= */

(function mediaViewer() {

    const mv =
        document.getElementById("mv");

    const mvBackdrop =
        document.getElementById("mvBackdrop");

    const mvClose =
        document.getElementById("mvClose");

    const mvTitle =
        document.getElementById("mvTitle");

    const mvMeta =
        document.getElementById("mvMeta");

    const mvStage =
        document.getElementById("mvStage");

    const mvImg =
        document.getElementById("mvImg");

    const mvThumbs =
        document.getElementById("mvThumbs");

    const mvPrev =
        document.getElementById("mvPrev");

    const mvNext =
        document.getElementById("mvNext");

    const mvStatus =
        document.getElementById("mvStatus");

    const mvZoomOut =
        document.getElementById("mvZoomOut");

    const mvZoomIn =
        document.getElementById("mvZoomIn");

    const mvRange =
        document.getElementById("mvRange");

    const mvPctInput =
        document.getElementById("mvPctInput");

    const mvPctToggle =
        document.getElementById("mvPctToggle");

    const mvMenu =
        document.getElementById("mvMenu");

    /*
       1 = default fit and absolute minimum.
    */
    const USER_ZOOM_MIN = 1;
    const USER_ZOOM_MAX = 8;

    /*
       Ordered percentages requested:
       100%, 200%, 300%, ...
    */
    const PRESETS = [
        100,
        200,
        300,
        400,
        500,
        600,
        700,
        800
    ];

    let urls = [];
    let idx = 0;

    let naturalW = 0;
    let naturalH = 0;

    let fitScale = 1;
    let userZoom = 1;

    let offX = 0;
    let offY = 0;

    let isOpen = false;
    let resizeFrame = 0;
    let loadRequestId = 0;
    let isLoadingImage = false;
    let hasLoadedFirstImage = false;
    let thumbnailVisibilityBeforeClose = true;

    const pointers = new Map();

    let pinchStartDist = 0;
    let pinchStartZoom = 1;
    let pinchMid = {
        x: 0,
        y: 0
    };

    let dragStart = {
        x: 0,
        y: 0,
        offX: 0,
        offY: 0
    };

    let pointerDownPos = {
        x: 0,
        y: 0
    };

    let pointerMoved = false;
    let isDragging = false;

    let tapTimer = null;
    let lastTapTime = 0;

    let lastTapPos = {
        x: 0,
        y: 0
    };

    let lastPointerType = "mouse";
    let clickTimer = null;

    function clamp(n, a, b) {
        return Math.max(
            a,
            Math.min(b, n)
        );
    }

    function stageRect() {
        return mvStage.getBoundingClientRect();
    }

    function actualScale() {
        return fitScale * userZoom;
    }

    function setStatus(text) {

        if (!text) {
            mvStatus.style.display =
                "none";

            return;
        }

        mvStatus.textContent =
            text;

        mvStatus.style.display =
            "block";
    }

    function setThumbsVisible(visible) {

        if (urls.length <= 1) {

            mv.classList.remove(
                "show-thumbs"
            );

            return;
        }

        mv.classList.toggle(
            "show-thumbs",
            !!visible && hasLoadedFirstImage
        );
    }

    /*
       Automatic thumbnail rule:
       zoom > default => hidden
       zoom == default => visible
    */
    function syncThumbsWithZoom() {

        if (urls.length <= 1) {
            setThumbsVisible(false);
            return;
        }

        if (userZoom > 1.001) {
            setThumbsVisible(false);
        } else {
            setThumbsVisible(true);
        }
    }

    function updateArrows() {

        const multi =
            urls.length > 1;

        mvPrev.classList.toggle(
            "hidden",
            !multi
        );

        mvNext.classList.toggle(
            "hidden",
            !multi
        );

        mvPrev.disabled =
            urls.length === 0 ||
            idx <= 0;

        mvNext.disabled =
            urls.length === 0 ||
            idx >= urls.length - 1;

        mvPrev.setAttribute(
            "aria-disabled",
            String(mvPrev.disabled)
        );

        mvNext.setAttribute(
            "aria-disabled",
            String(mvNext.disabled)
        );
    }

    function renderThumbs() {

        mvThumbs.innerHTML = "";

        if (urls.length <= 1) {

            setThumbsVisible(false);
            return;
        }

        urls.forEach((u, i) => {

            const t =
                document.createElement(
                    "button"
                );

            t.type = "button";

            t.className =
                "mv-thumb" +
                (
                    i === idx
                        ? " active"
                        : ""
                );

            t.setAttribute(
                "aria-label",
                `Open image ${i + 1}`
            );

            const im =
                document.createElement(
                    "img"
                );

            im.src = u;
            im.alt = "";

            t.appendChild(im);

            t.addEventListener(
                "click",
                (e) => {

                    e.stopPropagation();

                    goTo(i);

                }
            );

            mvThumbs.appendChild(t);

        });

        /*
           Opening/default state.
        */
        if (userZoom <= 1.001) {
            setThumbsVisible(true);
        }
    }

    function markActiveThumb() {

        const thumbs =
            mvThumbs.querySelectorAll(
                ".mv-thumb"
            );

        thumbs.forEach((t, i) => {

            t.classList.toggle(
                "active",
                i === idx
            );

        });
    }

    function rebuildZoomMenu() {

        mvMenu.innerHTML = "";

        PRESETS.forEach(pct => {

            const b =
                document.createElement(
                    "button"
                );

            b.type = "button";

            b.setAttribute(
                "data-zoom",
                String(pct)
            );

            b.textContent =
                pct === 100
                    ? "100% (Default / Fit)"
                    : `${pct}%`;

            const current =
                Math.round(
                    userZoom * 100
                );

            b.classList.toggle(
                "active",
                current === pct
            );

            mvMenu.appendChild(b);

        });
    }

    function updateZoomUI() {

        const pct =
            Math.round(
                userZoom * 100
            );

        mvPctInput.value =
            pct + "%";

        mvRange.value =
            clamp(
                pct,
                100,
                800
            );

        /*
           Cannot zoom out below default.
        */
        mvZoomOut.disabled =
            userZoom <=
            USER_ZOOM_MIN + 0.001;

        mvZoomIn.disabled =
            userZoom >=
            USER_ZOOM_MAX - 0.001;

        rebuildZoomMenu();
    }

    function clampPan() {

        const r =
            stageRect();

        const stageW =
            r.width;

        const stageH =
            r.height;

        const scale =
            actualScale();

        const imgW =
            naturalW * scale;

        const imgH =
            naturalH * scale;

        const limX =
            Math.max(
                0,
                (imgW - stageW) / 2
            );

        const limY =
            Math.max(
                0,
                (imgH - stageH) / 2
            );

        offX =
            clamp(
                offX,
                -limX,
                limX
            );

        offY =
            clamp(
                offY,
                -limY,
                limY
            );
    }

    function applyTransform() {

        if (
            !naturalW ||
            !naturalH
        ) {
            return;
        }

        clampPan();

        const s =
            actualScale();

        mvImg.style.transform =
            `translate(-50%, -50%) ` +
            `translate(${offX}px, ${offY}px) ` +
            `scale(${s})`;

        mv.classList.toggle(
            "zoomed",
            userZoom > 1.001
        );

        updateZoomUI();
    }

    function calculateFitScale() {

        const r =
            stageRect();

        if (
            !naturalW ||
            !naturalH ||
            !r.width ||
            !r.height
        ) {
            return 1;
        }

        const padX =
            Math.min(
                24,
                r.width * 0.04
            );

        const padY =
            Math.min(
                24,
                r.height * 0.04
            );

        const availableW =
            Math.max(
                1,
                r.width - padX * 2
            );

        const availableH =
            Math.max(
                1,
                r.height - padY * 2
            );

        /*
           The viewer must always fit to the height of the stage. A width
           calculation would make tall certificate images shrink to a small
           scale and create the visible fill-to-fit jump.
        */
        return availableH / naturalH;
    }

    function fitToStage() {

        fitScale =
            calculateFitScale();

        userZoom = 1;

        offX = 0;
        offY = 0;

        applyTransform();

        /*
           Restore the visibility state that was active when the viewer
           closed, rather than forcing thumbnails on after every fit.
        */
        setThumbsVisible(
            thumbnailVisibilityBeforeClose
        );
    }

    function refitForViewport() {

        if (
            !naturalW ||
            !naturalH
        ) {
            return;
        }

        const wasDefault =
            userZoom <= 1.001;

        fitScale =
            calculateFitScale();

        if (wasDefault) {

            userZoom = 1;
            offX = 0;
            offY = 0;
        }

        applyTransform();

        if (wasDefault) {
            syncThumbsWithZoom();
        }
    }

    function setUserZoom(
        newZoom,
        clientX = null,
        clientY = null
    ) {

        /*
           Absolute minimum is 1 (100% fitted).
        */
        newZoom =
            clamp(
                newZoom,
                USER_ZOOM_MIN,
                USER_ZOOM_MAX
            );

        const previousZoom =
            userZoom;

        const previousActual =
            actualScale();

        if (
            Math.abs(
                newZoom -
                previousZoom
            ) < 0.0001
        ) {

            /*
               Still enforce thumbnail rule if caller attempted zoom-out while
               already at default.
            */
            if (newZoom <= 1.001) {
                syncThumbsWithZoom();
            }

            return;
        }

        userZoom =
            newZoom;

        const newActual =
            actualScale();

        if (
            clientX != null &&
            clientY != null &&
            previousActual > 0
        ) {

            const r =
                stageRect();

            const px =
                clientX -
                r.left -
                r.width / 2;

            const py =
                clientY -
                r.top -
                r.height / 2;

            const ratio =
                newActual /
                previousActual;

            offX =
                (offX - px) *
                ratio +
                px;

            offY =
                (offY - py) *
                ratio +
                py;
        }

        /*
           Exact default = centered fit.
        */
        if (
            userZoom <=
            USER_ZOOM_MIN + 0.001
        ) {

            userZoom = 1;
            offX = 0;
            offY = 0;
        }

        applyTransform();

        /*
           Requirement:
           Zoom IN -> hide.
           Zoom OUT all the way to Default -> show.
        */
        if (userZoom > 1.001) {
            setThumbsVisible(false);
        } else {
            setThumbsVisible(true);
        }
    }

    /*
       Each button step goes between clean hundred percentages:
       100 -> 200 -> 300 -> ... -> 800.
    */
    function zoomStep(dir) {

        const currentPct =
            Math.round(
                userZoom * 100
            );

        let nextPct;

        if (dir > 0) {

            nextPct =
                Math.ceil(
                    currentPct / 100
                ) * 100;

            if (
                nextPct <=
                currentPct
            ) {
                nextPct += 100;
            }

        } else {

            nextPct =
                Math.floor(
                    currentPct / 100
                ) * 100;

            if (
                nextPct >=
                currentPct
            ) {
                nextPct -= 100;
            }
        }

        nextPct =
            clamp(
                nextPct,
                100,
                800
            );

        const r =
            stageRect();

        setUserZoom(
            nextPct / 100,
            r.left + r.width / 2,
            r.top + r.height / 2
        );
    }

    function parsePctInput(val) {

        const s =
            String(val)
                .trim()
                .replace("%", "");

        const num =
            parseFloat(s);

        if (!isFinite(num)) {
            return null;
        }

        /*
           Cannot manually type less than 100 either.
        */
        return clamp(
            num,
            100,
            800
        );
    }

    function closeMenu() {
        mvMenu.classList.remove(
            "open"
        );
    }

    function toggleMenu() {
        mvMenu.classList.toggle(
            "open"
        );
    }

    async function urlExists(url) {

        return new Promise(resolve => {

            const im =
                new Image();

            im.onload =
                () => resolve(true);

            im.onerror =
                () => resolve(false);

            im.src = url;
        });
    }

    async function collectImages(
        base,
        ext,
        maxN
    ) {

        const found = [];
        let missesInARow = 0;

        for (
            let n = 1;
            n <= maxN;
            n++
        ) {

            const u =
                base +
                n +
                "." +
                ext;

            const ok =
                await urlExists(u);

            if (ok) {

                found.push(u);
                missesInARow = 0;

            } else {

                missesInARow++;

                if (
                    found.length > 0 &&
                    missesInARow >= 2
                ) {
                    break;
                }
            }
        }

        return found;
    }

    async function openViewer({
        kind,
        title,
        base,
        ext,
        maxN,
        images
    }) {

        isOpen = true;

        mv.classList.add(
            "open"
        );

        mv.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.style.overflow =
            "hidden";

        urls = [];
        idx = 0;

        naturalW = 0;
        naturalH = 0;

        fitScale = 1;
        userZoom = 1;

        offX = 0;
        offY = 0;

        hasLoadedFirstImage = false;
        mvImg.src = "";
        mvImg.style.transform =
            "translate(-50%, -50%) scale(1)";
        mvImg.style.opacity = "0";
        mvImg.style.visibility = "hidden";
        mvThumbs.innerHTML = "";

        setThumbsVisible(false);
        updateArrows();
        setStatus("Loadingâ€¦");

        const list = images
            ? images.map(n => base + n + "." + ext)
            : await collectImages(
                base,
                ext,
                maxN
            );

        if (!isOpen) return;

        urls = list;

        const isCert =
            kind === "doc";

        const suffix =
            isCert
                ? (
                    urls.length === 1
                        ? "Certificate"
                        : "Certificates"
                )
                : "Gallery";

        mvTitle.textContent =
            `${title} - ${suffix}`;

        mvMeta.textContent =
            urls.length > 1
                ? `${idx + 1} / ${urls.length}`
                : " ";

        if (!urls.length) {

            setStatus(
                "No images found in this folder."
            );

            mvPrev.classList.add(
                "hidden"
            );

            mvNext.classList.add(
                "hidden"
            );

            return;
        }

        setStatus("");

        updateArrows();
        renderThumbs();

        await loadImageAt(idx);
    }

    function closeViewer() {

        if (!isOpen) return;

        isOpen = false;

        clearTimeout(clickTimer);
        clearTimeout(tapTimer);

        pointers.clear();

        closeMenu();

        thumbnailVisibilityBeforeClose =
            mv.classList.contains(
                "show-thumbs"
            );

        mv.classList.remove(
            "open",
            "zoomed",
            "dragging",
            "show-thumbs"
        );

        mv.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.style.overflow =
            "";
    }

    function goTo(newIdx) {

        if (!urls.length) return;

        newIdx =
            clamp(
                newIdx,
                0,
                urls.length - 1
            );

        if (newIdx === idx) {

            /*
               Clicking current thumbnail still resets it to default fit,
               which keeps image state predictable.
            */
            fitToStage();
            return;
        }

        idx = newIdx;

        updateArrows();
        markActiveThumb();
        loadImageAt(idx);
    }

    function loadImageAt(i) {

        return new Promise(resolve => {

            const requestId =
                ++loadRequestId;

            isLoadingImage = true;

            setStatus(
                "Loadingâ€¦"
            );

            mvMeta.textContent =
                urls.length > 1
                    ? `${i + 1} / ${urls.length}`
                    : " ";

            const u =
                urls[i];

            fitScale = 1;
            userZoom = 1;
            offX = 0;
            offY = 0;
            naturalW = 0;
            naturalH = 0;

            mv.classList.remove(
                "zoomed",
                "dragging"
            );

            mvImg.style.transform =
                "translate(-50%, -50%) scale(1)";
            mvImg.style.opacity = "0";
            mvImg.style.visibility = "hidden";

            const startedAt =
                performance.now();
            const minimumLoadingMs = 1000;
            let revealTimer = null;
            let settled = false;

            const finish = () => {

                if (settled) return;
                settled = true;

                window.clearTimeout(
                    timeoutId
                );
                window.clearTimeout(
                    revealTimer
                );
            };

            const timeoutId =
                window.setTimeout(() => {

                    if (
                        settled ||
                        requestId !== loadRequestId ||
                        !isOpen
                    ) {
                        return;
                    }

                    finish();
                    isLoadingImage = false;
                    setStatus(
                        "Failed to load image."
                    );
                    resolve();
                }, 15000);

            const preload = new Image();

            const revealImage = () => {

                if (
                    settled ||
                    requestId !== loadRequestId ||
                    !isOpen
                ) {
                    return;
                }

                naturalW =
                    preload.naturalWidth || 0;
                naturalH =
                    preload.naturalHeight || 0;

                if (
                    !naturalW ||
                    !naturalH
                ) {
                    finish();
                    isLoadingImage = false;
                    setStatus(
                        "Failed to load image."
                    );
                    resolve();
                    return;
                }

                hasLoadedFirstImage = true;
                mvImg.src = u;

                window.requestAnimationFrame(() => {

                    if (
                        requestId !== loadRequestId ||
                        !isOpen
                    ) {
                        return;
                    }

                    fitScale =
                        calculateFitScale();
                    userZoom = 1;
                    offX = 0;
                    offY = 0;
                    applyTransform();

                    mvImg.style.opacity = "1";
                    mvImg.style.visibility = "visible";
                    setThumbsVisible(
                        thumbnailVisibilityBeforeClose
                    );
                    finish();
                    isLoadingImage = false;
                    setStatus("");
                    resolve();
                });
            };

            const handleLoad = () => {

                if (
                    settled ||
                    requestId !== loadRequestId ||
                    !isOpen
                ) {
                    return;
                }

                const elapsed =
                    performance.now() - startedAt;
                const delay =
                    Math.max(
                        0,
                        minimumLoadingMs - elapsed
                    );

                if (delay > 0) {
                    revealTimer =
                        window.setTimeout(
                            revealImage,
                            delay
                        );
                    return;
                }

                revealImage();
            };

            const handleError = () => {

                if (
                    settled ||
                    requestId !== loadRequestId ||
                    !isOpen
                ) {
                    return;
                }

                finish();
                isLoadingImage = false;
                setStatus(
                    "Failed to load image."
                );
                resolve();
            };

            preload.onload = handleLoad;
            preload.onerror = handleError;
            preload.src = u;
        });
    }

    /*
       Existing single click functionality remains.
    */
    function stageSingleClick() {

        if (urls.length <= 1) return;

        setThumbsVisible(
            !mv.classList.contains(
                "show-thumbs"
            )
        );
    }

    function stageDoubleZoom(
        clientX,
        clientY
    ) {

        if (
            userZoom > 1.001
        ) {

            /*
               Return to minimum/default.
            */
            fitToStage();

        } else {

            /*
               Default -> 200%.
            */
            setUserZoom(
                2,
                clientX,
                clientY
            );
        }
    }

    function distance(a, b) {

        const dx =
            a.x - b.x;

        const dy =
            a.y - b.y;

        return Math.hypot(
            dx,
            dy
        );
    }

    function midpoint(a, b) {

        return {
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2
        };
    }

    /* =====================================================
       OPEN BUTTONS
    ===================================================== */

    document.addEventListener(
        "click",
        (e) => {

            const btn =
                e.target.closest(
                    ".js-open-viewer"
                );

            if (!btn) return;

            const kind =
                btn.getAttribute(
                    "data-viewer-kind"
                );

            const title =
                btn.getAttribute(
                    "data-viewer-title"
                ) || "Item";

            const base =
                btn.getAttribute(
                    "data-viewer-base"
                ) || "";

            const ext =
                btn.getAttribute(
                    "data-viewer-ext"
                ) || "png";

            const maxN =
                parseInt(
                    btn.getAttribute(
                        "data-viewer-max"
                    ) || "25",
                    10
                );

            const images =
                (btn.getAttribute(
                    "data-viewer-images"
                ) || "")
                    .split(",")
                    .map(n => n.trim())
                    .filter(Boolean);

            openViewer({
                kind,
                title,
                base,
                ext,
                maxN,
                images: images.length
                    ? images
                    : null
            });
        }
    );

    mvBackdrop.addEventListener(
        "click",
        closeViewer
    );

    mvClose.addEventListener(
        "click",
        closeViewer
    );

    window.addEventListener(
        "keydown",
        (e) => {

            if (!isOpen) return;

            if (e.key === "Escape") {
                closeViewer();
            }

            if (e.key === "ArrowLeft") {
                goTo(idx - 1);
            }

            if (e.key === "ArrowRight") {
                goTo(idx + 1);
            }
        }
    );

    mvPrev.addEventListener(
        "click",
        () => goTo(idx - 1)
    );

    mvNext.addEventListener(
        "click",
        () => goTo(idx + 1)
    );

    /* =====================================================
       ZOOM BUTTONS
    ===================================================== */

    mvZoomIn.addEventListener(
        "click",
        () => {
            zoomStep(+1);
        }
    );

    mvZoomOut.addEventListener(
        "click",
        () => {
            zoomStep(-1);
        }
    );

    /*
       Slider's minimum is now 100.
       It physically cannot go below fit.
    */
    mvRange.addEventListener(
        "input",
        () => {

            const pct =
                clamp(
                    parseFloat(
                        mvRange.value
                    ),
                    100,
                    800
                );

            const r =
                stageRect();

            setUserZoom(
                pct / 100,
                r.left + r.width / 2,
                r.top + r.height / 2
            );
        }
    );

    mvPctInput.addEventListener(
        "keydown",
        (e) => {

            if (e.key !== "Enter") {
                return;
            }

            const pct =
                parsePctInput(
                    mvPctInput.value
                );

            if (pct == null) {

                updateZoomUI();
                return;
            }

            const r =
                stageRect();

            setUserZoom(
                pct / 100,
                r.left + r.width / 2,
                r.top + r.height / 2
            );

            mvPctInput.blur();
            closeMenu();
        }
    );

    mvPctInput.addEventListener(
        "blur",
        () => {

            const pct =
                parsePctInput(
                    mvPctInput.value
                );

            if (pct == null) {

                updateZoomUI();
                return;
            }

            const r =
                stageRect();

            setUserZoom(
                pct / 100,
                r.left + r.width / 2,
                r.top + r.height / 2
            );
        }
    );

    mvPctToggle.addEventListener(
        "click",
        (e) => {

            e.stopPropagation();
            rebuildZoomMenu();
            toggleMenu();

        }
    );

    mvMenu.addEventListener(
        "click",
        (e) => {

            const b =
                e.target.closest(
                    "button[data-zoom]"
                );

            if (!b) return;

            const pct =
                parseFloat(
                    b.getAttribute(
                        "data-zoom"
                    )
                );

            const r =
                stageRect();

            setUserZoom(
                pct / 100,
                r.left + r.width / 2,
                r.top + r.height / 2
            );

            closeMenu();
        }
    );

    document.addEventListener(
        "click",
        (e) => {

            if (!isOpen) return;

            if (
                mvMenu.classList.contains(
                    "open"
                )
            ) {

                const inside =
                    e.target.closest(
                        "#mvPct"
                    );

                if (!inside) {
                    closeMenu();
                }
            }
        }
    );

    /* =====================================================
       VIEWPORT / BROWSER ZOOM
    ===================================================== */

    function scheduleViewerResize() {

        if (!isOpen || isLoadingImage) return;

        cancelAnimationFrame(
            resizeFrame
        );

        resizeFrame =
            requestAnimationFrame(() => {
                refitForViewport();
            });
    }

    window.addEventListener(
        "resize",
        scheduleViewerResize
    );

    window.addEventListener(
        "orientationchange",
        () => {

            setTimeout(
                scheduleViewerResize,
                100
            );
        }
    );

    if (window.visualViewport) {

        window.visualViewport.addEventListener(
            "resize",
            scheduleViewerResize
        );
    }

    if ("ResizeObserver" in window) {

        const stageResizeObserver =
            new ResizeObserver(() => {

                if (!isOpen) return;

                scheduleViewerResize();

            });

        stageResizeObserver.observe(
            mvStage
        );
    }

    /* =====================================================
       SINGLE / DOUBLE CLICK
    ===================================================== */

    mvStage.addEventListener(
        "click",
        (e) => {

            if (!isOpen) return;

            if (
                lastPointerType ===
                "touch"
            ) {
                return;
            }

            if (pointerMoved) {

                pointerMoved = false;
                return;
            }

            if (
                mvMenu.classList.contains(
                    "open"
                )
            ) {
                closeMenu();
                return;
            }

            closeMenu();

            clearTimeout(
                clickTimer
            );

            clickTimer =
                setTimeout(() => {
                    stageSingleClick();
                }, 220);
        }
    );

    mvStage.addEventListener(
        "dblclick",
        (e) => {

            if (!isOpen) return;

            if (
                lastPointerType ===
                "touch"
            ) {
                return;
            }

            clearTimeout(
                clickTimer
            );

            stageDoubleZoom(
                e.clientX,
                e.clientY
            );
        }
    );

    /* =====================================================
       POINTER / MOBILE GESTURES
    ===================================================== */

    mvStage.addEventListener(
        "pointerdown",
        (e) => {

            if (!isOpen) return;

            lastPointerType =
                e.pointerType || "mouse";

            try {

                mvStage.setPointerCapture(
                    e.pointerId
                );

            } catch (_) {}

            pointers.set(
                e.pointerId,
                {
                    x: e.clientX,
                    y: e.clientY
                }
            );

            pointerDownPos = {
                x: e.clientX,
                y: e.clientY
            };

            pointerMoved = false;

            if (
                pointers.size === 2
            ) {

                const pts =
                    [...pointers.values()];

                pinchStartDist =
                    distance(
                        pts[0],
                        pts[1]
                    );

                pinchStartZoom =
                    userZoom;

                pinchMid =
                    midpoint(
                        pts[0],
                        pts[1]
                    );

                pointerMoved = true;
                isDragging = false;

            } else if (
                pointers.size === 1 &&
                userZoom > 1.001
            ) {

                dragStart = {
                    x: e.clientX,
                    y: e.clientY,
                    offX,
                    offY
                };
            }
        }
    );

    mvStage.addEventListener(
        "pointermove",
        (e) => {

            if (!isOpen) return;

            if (
                !pointers.has(
                    e.pointerId
                )
            ) {
                return;
            }

            pointers.set(
                e.pointerId,
                {
                    x: e.clientX,
                    y: e.clientY
                }
            );

            /*
               Pinch zoom.
               setUserZoom clamps it to minimum 100%, so mobile cannot
               pinch smaller than the fitted image either.
            */
            if (
                pointers.size === 2
            ) {

                pointerMoved = true;

                const pts =
                    [...pointers.values()];

                const d =
                    distance(
                        pts[0],
                        pts[1]
                    );

                if (
                    pinchStartDist <= 0
                ) {
                    return;
                }

                const factor =
                    d /
                    pinchStartDist;

                const ns =
                    pinchStartZoom *
                    factor;

                setUserZoom(
                    ns,
                    pinchMid.x,
                    pinchMid.y
                );

                return;
            }

            /*
               Pan only when enlarged.
            */
            if (
                pointers.size === 1 &&
                userZoom > 1.001
            ) {

                const dx =
                    e.clientX -
                    pointerDownPos.x;

                const dy =
                    e.clientY -
                    pointerDownPos.y;

                const moved =
                    Math.hypot(
                        dx,
                        dy
                    );

                if (
                    !isDragging &&
                    moved > 5
                ) {

                    isDragging = true;
                    pointerMoved = true;

                    mv.classList.add(
                        "dragging"
                    );
                }

                if (isDragging) {

                    offX =
                        dragStart.offX +
                        (
                            e.clientX -
                            dragStart.x
                        );

                    offY =
                        dragStart.offY +
                        (
                            e.clientY -
                            dragStart.y
                        );

                    applyTransform();
                }
            }
        }
    );

    function endPointer(e) {

        if (!isOpen) return;

        const wasTouch =
            e.pointerType ===
            "touch";

        pointers.delete(
            e.pointerId
        );

        if (
            pointers.size < 2
        ) {

            pinchStartDist = 0;
        }

        if (
            pointers.size !== 0
        ) {
            return;
        }

        const endedDragging =
            isDragging;

        isDragging = false;

        mv.classList.remove(
            "dragging"
        );

        clampPan();
        applyTransform();

        /*
           Single / double tap on mobile.
        */
        if (
            wasTouch &&
            !endedDragging &&
            !pointerMoved
        ) {

            const now =
                Date.now();

            const dx =
                e.clientX -
                lastTapPos.x;

            const dy =
                e.clientY -
                lastTapPos.y;

            const dist =
                Math.hypot(
                    dx,
                    dy
                );

            if (
                now -
                lastTapTime <
                280 &&
                dist < 24
            ) {

                clearTimeout(
                    tapTimer
                );

                tapTimer = null;
                lastTapTime = 0;

                stageDoubleZoom(
                    e.clientX,
                    e.clientY
                );

            } else {

                lastTapTime =
                    now;

                lastTapPos = {
                    x: e.clientX,
                    y: e.clientY
                };

                clearTimeout(
                    tapTimer
                );

                tapTimer =
                    setTimeout(() => {

                        stageSingleClick();

                    }, 280);
            }
        }

        if (pointerMoved) {

            setTimeout(() => {
                pointerMoved = false;
            }, 0);
        }
    }

    mvStage.addEventListener(
        "pointerup",
        endPointer
    );

    mvStage.addEventListener(
        "pointercancel",
        endPointer
    );

})();

