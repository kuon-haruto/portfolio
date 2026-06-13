const year = document.getElementById('year');
if (year) {
  year.textContent = new Date().getFullYear();
}

const navLinks = document.querySelectorAll('.nav a');
const sections = [...document.querySelectorAll('main section[id]')];

const setActiveLink = () => {
  const scrollY = window.scrollY + 140;
  let currentId = '';

  for (const section of sections) {
    if (scrollY >= section.offsetTop) {
      currentId = section.id;
    }
  }

  navLinks.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === `#${currentId}`);
  });
};

window.addEventListener('scroll', setActiveLink);
window.addEventListener('load', setActiveLink);
