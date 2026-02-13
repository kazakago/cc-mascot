document.addEventListener("DOMContentLoaded", () => {
  // Scroll fade-in
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 },
  );
  document.querySelectorAll(".fade-in").forEach((el) => observer.observe(el));

  // Demo video play button
  const video = document.getElementById("demo-video");
  const playBtn = document.getElementById("demo-play-btn");
  if (video && playBtn) {
    playBtn.addEventListener("click", () => {
      video.play();
      playBtn.classList.add("opacity-0", "pointer-events-none");
    });
    video.addEventListener("pause", () => {
      playBtn.classList.remove("opacity-0", "pointer-events-none");
    });
  }

  // Resolve latest release download URLs
  fetch(
    "https://api.github.com/repos/kazakago/cc-mascot/releases/latest",
  )
    .then((res) => res.json())
    .then((release) => {
      const assets = release.assets || [];
      const macAsset = assets.find((a) => a.name.endsWith(".dmg"));
      const winAsset = assets.find((a) => a.name.endsWith(".exe"));

      if (macAsset) {
        document.querySelectorAll('[data-download="mac"]').forEach((el) => {
          el.href = macAsset.browser_download_url;
        });
      }
      if (winAsset) {
        document.querySelectorAll('[data-download="windows"]').forEach((el) => {
          el.href = winAsset.browser_download_url;
        });
      }
    })
    .catch(() => {
      // API失敗時はフォールバックURL（releases/latest）のまま
    });
});
