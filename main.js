(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Formate-Umschalter (funktioniert auch ohne GSAP)
  const frame = document.querySelector(".formate__frame");
  const frameImg = frame.querySelector("img");
  const meta = document.querySelector(".formate__meta");
  const stage = document.querySelector(".formate__stage");
  let ratio = 4 / 5;
  const fit = () => {
    const maxW = stage.clientWidth, maxH = stage.clientHeight - 40;
    let w = maxH * ratio;
    if (w > maxW) w = maxW;
    frame.style.width = w + "px";
    frame.style.height = w / ratio + "px";
    frame.style.aspectRatio = "auto";
  };
  fit();
  addEventListener("resize", fit);
  document.querySelectorAll(".formate__btns button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelector(".formate__btns .is-active").classList.remove("is-active");
      btn.classList.add("is-active");
      const [a, b] = btn.dataset.ratio.split("/").map(Number);
      ratio = a / b;
      fit();
      frame.classList.toggle("is-round", btn.hasAttribute("data-round"));
      frameImg.style.objectPosition = btn.dataset.pos;
      meta.innerHTML = `<strong>${btn.dataset.name}</strong><span>${btn.dataset.size}</span>`;
    });
  });

  if (reduce || !window.gsap || !window.ScrollTrigger) return;
  document.documentElement.classList.add("js");
  gsap.registerPlugin(ScrollTrigger);

  // Smooth Scroll
  if (window.Lenis) {
    const lenis = (window.lenis = new Lenis({ lerp: 0.1 }));
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach((a) =>
      a.addEventListener("click", (e) => {
        const target = document.querySelector(a.getAttribute("href"));
        if (target) { e.preventDefault(); lenis.scrollTo(target); }
      })
    );
  }

  // HERO: Text-Einstieg (die 3D-Szene steckt in hero3d.js)
  gsap.from(".hero__content > *", { y: 50, opacity: 0, stagger: 0.1, duration: 1.3, ease: "expo.out", delay: 0.2 });

  // STATEMENT: Wort für Wort
  const st = document.querySelector("[data-words]");
  st.innerHTML = st.textContent.trim().split(/\s+/).map((w) => `<span class="w${/^(Grüner|Lächeln)/.test(w) ? " hl" : ""}">${w}</span>`).join(" ");
  gsap.to(st.querySelectorAll(".w"), {
    opacity: 1, stagger: 0.05, ease: "none",
    scrollTrigger: { trigger: st, start: "top 80%", end: "bottom 45%", scrub: true, refreshPriority: -1 },
  });

  // ZOOM: Plenarsaal ist schon groß (kommt aus dem Karussell), Text und Abdunklung sind schon da; Bild fährt sacht heran
  const zoom = gsap.timeline({
    scrollTrigger: { trigger: ".zoom", start: "top top", end: "bottom top", scrub: true },
  });
  zoom
    .fromTo(".zoom__frame img", { scale: 1 }, { scale: 1.06, ease: "none", duration: 1 }, 0);

  // HORIZONTAL: Porträts
  const track = document.querySelector(".hscroll__track");
  const dist = () => track.scrollWidth - innerWidth;
  const hTween = gsap.to(track, {
    x: () => -dist(), ease: "none",
    scrollTrigger: {
      trigger: ".hscroll", pin: ".hscroll__pin", start: "top top",
      end: () => "+=" + dist(), scrub: 0.6, invalidateOnRefresh: true,
    },
  });
  gsap.to(".hscroll__head", {
    opacity: 0.15, ease: "none",
    scrollTrigger: { trigger: ".hscroll", start: "top top", end: () => "+=" + innerWidth * 0.5, scrub: true },
  });
  document.querySelectorAll(".card__img img").forEach((img) => {
    gsap.fromTo(img, { xPercent: -8 }, {
      xPercent: 8, ease: "none",
      scrollTrigger: { trigger: img.closest(".card"), containerAnimation: hTween, start: "left right", end: "right left", scrub: true },
    });
  });

  // TERMIN: Aufdecken + Parallaxe in unterschiedlichen Tempi
  document.querySelectorAll(".tile").forEach((tile) => {
    const box = tile.querySelector(".tile__img");
    const img = box.querySelector("img");
    // früh und zügig aufdecken, damit beim schnellen Scrollen kein Bild leer bleibt
    gsap.fromTo(box, { clipPath: "inset(100% 0% 0% 0%)" }, {
      clipPath: "inset(0% 0% 0% 0%)", duration: 0.75, ease: "power3.out",
      scrollTrigger: { trigger: tile, start: "top bottom" },
    });
    gsap.fromTo(img, { scale: 1.25 }, {
      scale: 1.05, duration: 1.1, ease: "power3.out",
      scrollTrigger: { trigger: tile, start: "top bottom" },
    });
    const speed = parseFloat(tile.dataset.speed || 1);
    if (innerWidth > 720) {
      gsap.to(tile, {
        y: (1 - speed) * 400, ease: "none",
        scrollTrigger: { trigger: tile, start: "top bottom", end: "bottom top", scrub: true },
      });
    }
  });

  // LACHEN: Abzüge fallen nacheinander auf den Stapel
  const prints = gsap.utils.toArray(".print");
  prints.forEach((p, i) => gsap.set(p, { rotation: +p.dataset.rot, zIndex: i }));
  const pile = gsap.timeline({
    scrollTrigger: { trigger: ".stack", start: "top top", end: "bottom bottom", scrub: 0.6 },
  });
  prints.slice(1).forEach((p, i) => {
    pile.from(p, {
      y: () => innerHeight, x: i % 2 ? 120 : -120, rotation: +p.dataset.rot * 5, ease: "power3.out", duration: 1,
    }, i * 1.1);
  });
  pile.to({}, { duration: 0.4 });

  // SMILE: Wischblende
  gsap.to(".smile__img", {
    clipPath: "inset(0 0% 0 0)", ease: "expo.inOut", duration: 1.6,
    scrollTrigger: { trigger: ".smile", start: "top 65%" },
  });
  gsap.to(".smile__img img", {
    scale: 1, ease: "none",
    scrollTrigger: { trigger: ".smile", start: "top bottom", end: "bottom top", scrub: true },
  });
  gsap.from(".smile__text > *", {
    y: 40, opacity: 0, stagger: 0.12, duration: 1, ease: "expo.out",
    scrollTrigger: { trigger: ".smile__text", start: "top 75%" },
  });

  // Überschriften + Ablauf
  gsap.utils.toArray(".termin__head, .formate__text, .ablauf .label").forEach((el) =>
    gsap.from(el.children.length ? el.children : el, {
      y: 50, opacity: 0, stagger: 0.1, duration: 1.1, ease: "expo.out",
      scrollTrigger: { trigger: el, start: "top 82%" },
    })
  );
  gsap.from(".steps li", {
    y: 60, opacity: 0, stagger: 0.12, duration: 1.1, ease: "expo.out",
    scrollTrigger: { trigger: ".steps", start: "top 82%" },
  });

  // Marquee reagiert auf Scrollrichtung
  const marquee = document.querySelector(".marquee__inner");
  ScrollTrigger.create({
    trigger: ".kontakt", start: "top bottom", end: "bottom top",
    onUpdate: (self) => { marquee.style.animationDirection = self.direction < 0 ? "reverse" : "normal"; },
  });

  addEventListener("load", () => ScrollTrigger.refresh());
})();
