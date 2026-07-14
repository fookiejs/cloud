const revealables = document.querySelectorAll(".block, .foot");

const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.18 }
);

for (const el of revealables) {
  el.classList.add("reveal");
  io.observe(el);
}

const constellation = document.querySelector(".constellation");
if (constellation) {
  window.addEventListener(
    "pointermove",
    (event) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 12;
      const y = (event.clientY / window.innerHeight - 0.5) * 10;
      constellation.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    },
    { passive: true }
  );
}
